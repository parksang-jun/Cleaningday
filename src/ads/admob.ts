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
  const real = isIos ? REAL_IDS.ios : REAL_IDS.android;
  const d = real ?? (isIos ? TEST_IDS.ios : TEST_IDS.android);
  // 테스트 모드: .env 가 정하면 그대로, 없으면 실제 ID 가 있는 플랫폼만 실제 광고를 받는다.
  const forced = env.VITE_ADMOB_TESTING;
  return {
    interstitial: (isIos ? env.VITE_ADMOB_IOS_INTERSTITIAL : env.VITE_ADMOB_ANDROID_INTERSTITIAL) || d.interstitial,
    rewarded: (isIos ? env.VITE_ADMOB_IOS_REWARDED : env.VITE_ADMOB_ANDROID_REWARDED) || d.rewarded,
    banner: (isIos ? env.VITE_ADMOB_IOS_BANNER : env.VITE_ADMOB_ANDROID_BANNER) || d.banner,
    isTesting: forced === 'true' ? true : forced === 'false' ? false : !real,
  };
}

export class AdMobAds implements AdsProvider {
  readonly name = 'admob';
  private interstitialReady = false;
  private rewardedReady = false;
  private npa = false;
  private ids = adIds();

  async init(): Promise<void> {
    await AdMob.initialize({ initializeForTesting: this.ids.isTesting });
    await this.consentFlow();
    void this.loadInterstitial();
    void this.loadRewarded();
  }

  /** UMP(GDPR 등) 동의 폼 + iOS ATT 요청. 동의가 없으면 비개인화(npa) 광고로 요청한다 */
  private async consentFlow(): Promise<void> {
    try {
      const consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        const after = await AdMob.showConsentForm();
        this.npa = after.status !== AdmobConsentStatus.OBTAINED && after.status !== AdmobConsentStatus.NOT_REQUIRED;
      }
      if (Capacitor.getPlatform() === 'ios') {
        const att = await AdMob.trackingAuthorizationStatus();
        if (att.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
        const after = await AdMob.trackingAuthorizationStatus();
        if (after.status !== 'authorized') this.npa = true;
      }
    } catch (e) {
      track('ads_consent_error', { message: String(e) });
    }
  }

  private async loadInterstitial(): Promise<void> {
    try {
      await AdMob.prepareInterstitial({ adId: this.ids.interstitial, isTesting: this.ids.isTesting, npa: this.npa });
      this.interstitialReady = true;
    } catch (e) {
      this.interstitialReady = false;
      track('ads_interstitial_load_error', { message: String(e) });
    }
  }

  private async loadRewarded(): Promise<void> {
    try {
      await AdMob.prepareRewardVideoAd({ adId: this.ids.rewarded, isTesting: this.ids.isTesting, npa: this.npa });
      this.rewardedReady = true;
    } catch (e) {
      this.rewardedReady = false;
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
