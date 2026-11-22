// 공급자 선택 + 노출 빈도 정책(AdsController)
// 정책(보고서 3장 벤치마크 반영): 전면 광고는 게임 종료 시점에만, 2게임 이상·150초 이상 간격, 첫 게임 제외.
import { recoverAudio } from '../audio';
import { Capacitor } from '@capacitor/core';
import type { AdsProvider, AdProviderName } from './types';
import { NoopAds } from './noop';
import { getStore, persist } from '../storage';
import { track } from '../analytics';

export const INTERSTITIAL_MIN_GAMES = 2;
/** 처음 이만큼의 판은 전면 광고 없이 — 게임에 재미를 붙이기 전에 광고부터 보면 지운다 */
export const INTERSTITIAL_GRACE_GAMES = 6;
export const INTERSTITIAL_MIN_INTERVAL_MS = 150_000;

export function resolveProviderName(): AdProviderName {
  if (Capacitor.isNativePlatform()) return 'admob';
  const forced = import.meta.env.VITE_AD_PROVIDER as AdProviderName | undefined;
  if (forced === 'poki' || forced === 'crazygames' || forced === 'noop') return forced;
  return 'noop';
}

export async function createProvider(name: AdProviderName): Promise<AdsProvider> {
  // 네이티브 전용 모듈은 동적 import로 웹 번들에서 분리한다.
  switch (name) {
    case 'admob':
      return new (await import('./admob')).AdMobAds();
    case 'poki':
      return new (await import('./poki')).PokiAds();
    case 'crazygames':
      return new (await import('./crazygames')).CrazyGamesAds();
    default:
      return new NoopAds();
  }
}

export class AdsController {
  private provider: AdsProvider = new NoopAds();
  private ready = false;
  private busy = false;

  async init(): Promise<void> {
    const name = resolveProviderName();
    try {
      this.provider = await createProvider(name);
      await this.provider.init();
      this.ready = true;
      track('ads_init', { provider: name });
      void this.applyBanner();
    } catch (e) {
      track('ads_init_error', { provider: name, message: String(e) });
      this.provider = new NoopAds();
      this.ready = true;
    }
  }

  get providerName(): string {
    return this.provider.name;
  }

  /** 운영자 화면용 진단값. 기기에서 Xcode 없이 광고가 왜 안 뜨는지 본다 */
  debug(): Record<string, string> {
    return {
      공급자: this.provider.name,
      준비: this.ready ? '됨' : '안 됨',
      배너요청: this.bannerWanted ? '예' : '아니오',
      배너표시: this.bannerShown ? '예' : '아니오',
      ...(this.provider.debug?.() ?? {}),
    };
  }

  gameplayStart(): void {
    this.provider.gameplayStart();
  }
  gameplayStop(): void {
    this.provider.gameplayStop();
  }

  /** 게임 종료 후 전환 시점에 호출. 정책을 만족할 때만 전면 광고를 표시 */
  async maybeShowInterstitial(): Promise<boolean> {
    const ads = getStore().ads;
    ads.gamesSinceInterstitial++;
    persist();
    const now = Date.now();
    const intervalOk = now - ads.lastInterstitialAt >= INTERSTITIAL_MIN_INTERVAL_MS;
    const firstEver = getStore().stats.gamesPlayed <= INTERSTITIAL_GRACE_GAMES;
    // 코인으로 산 광고 제거 이용권 기간에는 전면 광고 없음
    if ((ads.adFreeUntil ?? 0) > now) return false;
    if (!this.ready || this.busy || firstEver || ads.gamesSinceInterstitial < INTERSTITIAL_MIN_GAMES || !intervalOk) {
      return false;
    }
    this.busy = true;
    try {
      const shown = await this.provider.showInterstitial();
      recoverAudio(); // 광고가 오디오를 가져갔다가 돌려주지 않는다 (iOS)
      if (shown) {
        ads.lastInterstitialAt = now;
        ads.gamesSinceInterstitial = 0;
        persist();
        track('ad_interstitial_shown', { provider: this.provider.name });
      }
      return shown;
    } finally {
      this.busy = false;
    }
  }

  /** 다음 화면 전환에서 전면 광고가 나올 차례인가 (상태를 바꾸지 않는다) — "코인으로 건너뛰기" 버튼을 보일지 정한다 */
  interstitialDue(now = Date.now()): boolean {
    const st = getStore();
    const ads = st.ads;
    if ((ads.adFreeUntil ?? 0) > now) return false;
    if (!this.ready || st.stats.gamesPlayed <= INTERSTITIAL_GRACE_GAMES) return false;
    return ads.gamesSinceInterstitial + 1 >= INTERSTITIAL_MIN_GAMES && now - ads.lastInterstitialAt >= INTERSTITIAL_MIN_INTERVAL_MS;
  }

  /** 이번 차례의 전면 광고를 건너뛴다 — 방금 본 것으로 치고 간격을 다시 센다 */
  skipInterstitial(now = Date.now()): void {
    const ads = getStore().ads;
    ads.lastInterstitialAt = now;
    ads.gamesSinceInterstitial = 0;
    persist();
  }

  /** 진단 전용: 빈도 정책을 무시하고 전면 광고를 바로 띄운다 (운영자 화면) */
  async showInterstitialNow(): Promise<boolean> {
    if (!this.ready || this.busy) return false;
    this.busy = true;
    try {
      return await this.provider.showInterstitial();
    } finally {
      recoverAudio();
      this.busy = false;
    }
  }

  /** 보상형 광고가 보상 없이 끝났을 때 화면에 알릴 곳 — 'loading': 광고를 불러오는 중, 'unavailable': 볼 광고가 없음, 'closed': 끝까지 보지 않음 */
  onRewardedNotice: ((why: 'loading' | 'unavailable' | 'closed') => void) | null = null;

  /** 보상형 광고. placement는 분석용 라벨(revive, slide) */
  async showRewarded(placement: string): Promise<boolean> {
    if (this.busy) return false;
    if (!this.ready) {
      this.onRewardedNotice?.('unavailable');
      return false;
    }
    this.busy = true;
    track('ad_rewarded_request', { placement });
    try {
      if (this.provider.rewardedReadyNow?.() === false) this.onRewardedNotice?.('loading');
      const ok = await this.provider.showRewarded();
      recoverAudio();
      const miss = ok ? null : (this.provider.rewardedMiss ?? 'unavailable');
      track(ok ? 'ad_rewarded_earned' : 'ad_rewarded_failed', { placement, provider: this.provider.name, ...(miss ? { why: miss } : {}) });
      if (miss) this.onRewardedNotice?.(miss);
      return ok;
    } catch (e) {
      track('ad_rewarded_failed', { placement, provider: this.provider.name, why: String(e) });
      this.onRewardedNotice?.('unavailable');
      return false;
    } finally {
      this.busy = false;
    }
  }

  private bannerWanted = false;
  private bannerShown = false;

  /**
   * 하단 배너 자리. 메뉴 화면(홈·구역·결과)에서만 켜고, 청소 중에는 끈다(잘못 누름 방지 — AdMob 정책).
   * 광고 제거 이용권 기간에는 켜지지 않는다. 화면은 body.has-banner 일 때 배너 높이만큼 아래를 비운다.
   */
  setBanner(on: boolean): void {
    this.bannerWanted = on;
    void this.applyBanner();
  }

  /** 광고 제거 이용권 상태가 바뀌었을 때 다시 맞춘다 */
  refreshBanner(): void {
    void this.applyBanner();
  }

  private async applyBanner(): Promise<void> {
    if (!this.ready) return;
    const want = this.bannerWanted && (getStore().ads.adFreeUntil ?? 0) <= Date.now();
    if (want === this.bannerShown) return;
    this.bannerShown = want;
    if (!want) {
      document.body.classList.remove('has-banner');
      await this.provider.hideBanner();
      return;
    }
    let slot = document.getElementById('ad-banner');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'ad-banner';
      slot.className = 'ad-banner';
      slot.setAttribute('data-testid', 'ad-banner');
      document.body.appendChild(slot);
    }
    const used = await this.provider.showBanner();
    if (!this.bannerShown) return; // 기다리는 사이 꺼졌다
    if (used) {
      document.body.classList.add('has-banner');
      track('ad_banner_shown', { provider: this.provider.name });
    } else this.bannerShown = false;
  }
}
