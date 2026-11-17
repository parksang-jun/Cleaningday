// Google AdMob (Capacitor 네이티브). UMP 동의 + iOS ATT → 전면/보상형 프리로드 → 표시 후 재프리로드.
// 실제 광고 단위 ID 가 등록된 플랫폼은 그것을 쓰고 실제 광고를 받는다. 아직 없는 플랫폼은
// Google 공식 테스트 ID 로 돌아 테스트 광고만 나온다(수익 없음). .env 로 덮어쓸 수 있다.
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import type { AdsProvider } from './types';
import { track } from '../analytics';

const TEST_IDS = {
  android: {
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    banner: 'ca-app-pub-3940256099942544/6300978111',
  },
  ios: {
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    banner: 'ca-app-pub-3940256099942544/2934735716',
  },
} as const;

/**
 * 실제 광고 단위 ID. 앱 안에 그대로 담겨 배포되는 공개 값이라 저장소에 두어도 안전하다.
 * 아직 ID 를 받지 못한 플랫폼은 null 로 두면 테스트 광고로 돈다.
 */
const REAL_IDS: Record<'android' | 'ios', Record<'interstitial' | 'rewarded' | 'banner', string> | null> = {
  android: {
    interstitial: 'ca-app-pub-5724346706486152/2724123763',
    rewarded: 'ca-app-pub-5724346706486152/1191550242',
    banner: 'ca-app-pub-5724346706486152/1602613788',
  },
  ios: {
    interstitial: 'ca-app-pub-5724346706486152/7503098723',
    rewarded: 'ca-app-pub-5724346706486152/1129262065',
    banner: 'ca-app-pub-5724346706486152/9991475356',
  },
};

function adIds() {
  const env = import.meta.env;
  const isIos = Capacitor.getPlatform() === 'ios';
  const test = isIos ? TEST_IDS.ios : TEST_IDS.android;
  const forced = env.VITE_ADMOB_TESTING;
  // VITE_ADMOB_TESTING=true 면 구글 공식 테스트 단위 ID 로 바꾼다.
  // 실제 단위 ID 에 isTesting 만 켜도 이 기기가 테스트 기기로 등록돼 있지 않으면 실제 광고를 요청하고,
  // 신규 단위는 채워지지 않아 아무것도 안 뜬다. 테스트 단위 ID 는 언제나 채워진다.
  const real = forced === 'true' ? null : (isIos ? REAL_IDS.ios : REAL_IDS.android);
  const d = real ?? test;
  return {
    interstitial: (isIos ? env.VITE_ADMOB_IOS_INTERSTITIAL : env.VITE_ADMOB_ANDROID_INTERSTITIAL) || d.interstitial,
    rewarded: (isIos ? env.VITE_ADMOB_IOS_REWARDED : env.VITE_ADMOB_ANDROID_REWARDED) || d.rewarded,
    banner: (isIos ? env.VITE_ADMOB_IOS_BANNER : env.VITE_ADMOB_ANDROID_BANNER) || d.banner,
    isTesting: forced === 'true' ? true : forced === 'false' ? false : !real,
  };
}

/** 화면이 뜬 뒤 ATT 를 묻기까지 두는 여유 — 앱이 active 가 되기 전에 요청하면 iOS 가 창을 띄우지 않는다 */
const ATT_SETTLE_MS = 700;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const CONSENT_TIMEOUT_MS = 6000;
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(label)), ms))]);
}
/** 앱 화면이 보이는 상태가 될 때까지 기다린 뒤 잠깐 더 둔다 */
async function whenVisible(): Promise<void> {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    await new Promise<void>((r) => {
      const on = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', on);
        r();
      };
      document.addEventListener('visibilitychange', on);
    });
  }
  await sleep(ATT_SETTLE_MS);
}

export class AdMobAds implements AdsProvider {
  readonly name = 'admob';
  private interstitialReady = false;
  private rewardedReady = false;
  private npa = false;
  private ids = adIds();
  /** 운영자 화면에 보여줄 마지막 오류 (기기에서 Xcode 없이 원인을 보려고) */
  private errs: Record<string, string> = {};
  private consent = '-';
  private att = '-';
  private initialized = false;
  /** 초기화가 어디까지 갔는지 — 창이 안 뜰 때 어느 단계에서 멈췄는지 본다 */
  private stage = '시작 전';

  private note(where: string, e: unknown): void {
    const m = String((e as { message?: string })?.message ?? e);
    this.errs[where] = m.length > 120 ? `${m.slice(0, 120)}…` : m;
  }

  async init(): Promise<void> {
    try {
      await AdMob.initialize({ initializeForTesting: this.ids.isTesting });
      this.initialized = true;
    } catch (e) {
      this.note('initialize', e);
      throw e;
    }
    await this.consentFlow();
    this.stage = '광고 요청';
    void this.loadInterstitial();
    void this.loadRewarded();
  }

  /** 기기에서 바로 읽는 진단값 */
  debug(): Record<string, string> {
    const tail = (id: string) => id.replace(/^ca-app-pub-/, '').slice(-24);
    return {
      초기화: this.initialized ? 'OK' : '실패',
      단계: this.stage,
      테스트광고: this.ids.isTesting ? '켬' : '끔',
      단위_배너: tail(this.ids.banner),
      단위_전면: tail(this.ids.interstitial),
      단위_보상형: tail(this.ids.rewarded),
      동의: this.consent,
      ATT: this.att,
      비개인화: this.npa ? '예' : '아니오',
      전면준비: this.interstitialReady ? '됨' : '안 됨',
      보상형준비: this.rewardedReady ? '됨' : '안 됨',
      ...this.errs,
    };
  }

  /**
   * UMP(GDPR 등) 동의 폼 → iOS ATT 요청. 동의가 없으면 비개인화(npa) 광고로 요청한다.
   * 두 단계는 서로 독립이다: AdMob 에 개인정보 메시지가 설정돼 있지 않으면 UMP 요청이 실패하는데,
   * 그렇다고 ATT 창까지 건너뛰면 안 된다(추적 허용을 묻지 않은 채 광고를 요청하게 된다 — App Store 심사 2.1).
   */
  private async consentFlow(): Promise<void> {
    try {
      this.stage = '동의 정보 요청 중';
      // 응답이 오지 않아도 ATT 로 넘어가도록 시간 제한을 둔다
      const consent = await withTimeout(AdMob.requestConsentInfo(), CONSENT_TIMEOUT_MS, '동의 정보 응답 없음');
      this.consent = String(consent.status);
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        this.stage = '동의 폼 표시 중';
        const after = await AdMob.showConsentForm();
        this.consent = String(after.status);
        this.npa = after.status !== AdmobConsentStatus.OBTAINED && after.status !== AdmobConsentStatus.NOT_REQUIRED;
      }
    } catch (e) {
      this.note('동의오류', e);
      track('ads_consent_error', { message: String(e) });
    }
    if (Capacitor.getPlatform() === 'ios') await this.requestAtt();
  }

  /**
   * iOS 추적 허용 창(ATT). 광고를 한 건도 요청하기 전에 띄운다.
   * 앱이 화면에 완전히 올라오기 전에 요청하면 iOS 가 창을 띄우지 않고 '미결정'으로 남기므로,
   * 화면이 보일 때까지 기다렸다가 요청하고, 그래도 미결정이면 앱이 다시 앞으로 올 때 한 번 더 묻는다.
   */
  private async requestAtt(): Promise<void> {
    try {
      this.stage = 'ATT 상태 확인 중';
      let st = await AdMob.trackingAuthorizationStatus();
      this.att = String(st.status);
      if (st.status === 'notDetermined') {
        this.stage = 'ATT 화면 대기 중';
        await whenVisible();
        this.stage = 'ATT 창 요청함';
        await AdMob.requestTrackingAuthorization();
        this.stage = 'ATT 응답 받음';
        st = await AdMob.trackingAuthorizationStatus();
        if (st.status === 'notDetermined') this.retryAttOnResume();
      }
      this.att = String(st.status);
      if (st.status !== 'authorized') this.npa = true;
    } catch (e) {
      this.note('ATT오류', e);
      this.npa = true;
      track('ads_att_error', { message: String(e) });
    }
  }

  private attRetryArmed = false;
  private retryAttOnResume(): void {
    if (this.attRetryArmed) return;
    this.attRetryArmed = true;
    const again = async () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', again);
      try {
        await sleep(ATT_SETTLE_MS);
        await AdMob.requestTrackingAuthorization();
        const st = await AdMob.trackingAuthorizationStatus();
        this.att = String(st.status);
        if (st.status === 'authorized' && this.consentAllowsPersonalized()) {
          // 허용으로 바뀌었으면 이후 광고부터 개인화 요청
          this.npa = false;
          void this.loadInterstitial();
          void this.loadRewarded();
        }
      } catch (e) {
        this.note('ATT오류', e);
      }
    };
    document.addEventListener('visibilitychange', again);
  }

  private consentAllowsPersonalized(): boolean {
    return this.consent === '-' || this.consent === String(AdmobConsentStatus.OBTAINED) || this.consent === String(AdmobConsentStatus.NOT_REQUIRED);
  }

  private async loadInterstitial(): Promise<void> {
    try {
      await AdMob.prepareInterstitial({ adId: this.ids.interstitial, isTesting: this.ids.isTesting, npa: this.npa });
      this.interstitialReady = true;
    } catch (e) {
      this.interstitialReady = false;
      this.note('전면로드', e);
      track('ads_interstitial_load_error', { message: String(e) });
    }
  }

  private async loadRewarded(): Promise<void> {
    try {
      await AdMob.prepareRewardVideoAd({ adId: this.ids.rewarded, isTesting: this.ids.isTesting, npa: this.npa });
      this.rewardedReady = true;
    } catch (e) {
      this.rewardedReady = false;
      this.note('보상형로드', e);
      track('ads_rewarded_load_error', { message: String(e) });
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.interstitialReady) {
      void this.loadInterstitial();
      return false;
    }
    this.interstitialReady = false;
    const dismissed = new Promise<void>((resolve) => {
      void AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => resolve());
      void AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => resolve());
    });
    try {
      await AdMob.showInterstitial();
      await dismissed;
      return true;
    } catch (e) {
      this.note('전면표시', e);
      track('ads_interstitial_show_error', { message: String(e) });
      return false;
    } finally {
      void this.loadInterstitial();
    }
  }

  async showRewarded(): Promise<boolean> {
    if (!this.rewardedReady) {
      void this.loadRewarded();
      return false;
    }
    this.rewardedReady = false;
    let rewarded = false;
    const handle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
    });
    const dismissed = new Promise<void>((resolve) => {
      void AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve());
      void AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve());
    });
    try {
      await AdMob.showRewardVideoAd();
      await dismissed;
      return rewarded;
    } catch (e) {
      this.note('보상형표시', e);
      track('ads_rewarded_show_error', { message: String(e) });
      return false;
    } finally {
      void handle.remove();
      void this.loadRewarded();
    }
  }

  private bannerListening = false;

  /** 배너 높이를 CSS 변수(--banner-h)로 알려 화면이 그만큼 자리를 비우게 한다 */
  private async listenBanner(): Promise<void> {
    if (this.bannerListening) return;
    this.bannerListening = true;
    const setH = (px: number) => document.documentElement.style.setProperty('--banner-h', `${Math.max(0, Math.round(px))}px`);
    await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => setH(size.height));
    await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
      setH(0); // 광고가 없으면 빈 띠를 남기지 않는다
      this.note('배너', err?.message ?? err);
      track('ads_banner_error', { message: String(err?.message ?? err) });
    });
  }

  async showBanner(): Promise<boolean> {
    if (import.meta.env.VITE_ADMOB_BANNER === 'false') return false; // 기본 켬. 'false' 로 끈다
    try {
      await this.listenBanner();
      await AdMob.showBanner({
        adId: this.ids.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: this.ids.isTesting,
        npa: this.npa,
      });
      return true;
    } catch (e) {
      this.note('배너', e);
      track('ads_banner_error', { message: String(e) });
      return false;
    }
  }

  async hideBanner(): Promise<void> {
    try {
      await AdMob.removeBanner();
    } catch {
      /* 배너가 없으면 무시 */
    }
  }

  gameplayStart(): void {
    /* 네이티브는 신호 불필요 */
  }
  gameplayStop(): void {
    /* 네이티브는 신호 불필요 */
  }
}
