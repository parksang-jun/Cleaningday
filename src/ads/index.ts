// 공급자 선택 + 노출 빈도 정책(AdsController)
// 정책(보고서 3장 벤치마크 반영): 전면 광고는 게임 종료 시점에만, 2게임 이상·150초 이상 간격, 첫 게임 제외.
import { Capacitor } from '@capacitor/core';
import type { AdsProvider, AdProviderName } from './types';
import { NoopAds } from './noop';
import { getStore, persist } from '../storage';
import { track } from '../analytics';

export const INTERSTITIAL_MIN_GAMES = 2;
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
    } catch (e) {
      track('ads_init_error', { provider: name, message: String(e) });
      this.provider = new NoopAds();
      this.ready = true;
    }
  }

  get providerName(): string {
    return this.provider.name;
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
    const firstEver = getStore().stats.gamesPlayed <= 1;
    if (!this.ready || this.busy || firstEver || ads.gamesSinceInterstitial < INTERSTITIAL_MIN_GAMES || !intervalOk) {
      return false;
    }
    this.busy = true;
    try {
      const shown = await this.provider.showInterstitial();
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

  /** 보상형 광고. placement는 분석용 라벨(revive, slide) */
  async showRewarded(placement: string): Promise<boolean> {
    if (!this.ready || this.busy) return false;
    this.busy = true;
    track('ad_rewarded_request', { placement });
    try {
      const ok = await this.provider.showRewarded();
      track(ok ? 'ad_rewarded_earned' : 'ad_rewarded_failed', { placement, provider: this.provider.name });
      return ok;
    } finally {
      this.busy = false;
    }
  }

  showBanner(): Promise<void> {
    return this.provider.showBanner();
  }
  hideBanner(): Promise<void> {
    return this.provider.hideBanner();
  }
}
