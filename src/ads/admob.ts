// Google AdMob (Capacitor 네이티브). UMP 동의 + iOS ATT → 전면/보상형 프리로드 → 표시 후 재프리로드.
// 기본값은 Google 공식 테스트 광고 단위 ID. 출시 전 .env 에 실제 ID를 넣는다(README 참고).
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
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

function adIds() {
  const env = import.meta.env;
  const isIos = Capacitor.getPlatform() === 'ios';
  const d = isIos ? TEST_IDS.ios : TEST_IDS.android;
  return {
    interstitial: (isIos ? env.VITE_ADMOB_IOS_INTERSTITIAL : env.VITE_ADMOB_ANDROID_INTERSTITIAL) || d.interstitial,
    rewarded: (isIos ? env.VITE_ADMOB_IOS_REWARDED : env.VITE_ADMOB_ANDROID_REWARDED) || d.rewarded,
    banner: (isIos ? env.VITE_ADMOB_IOS_BANNER : env.VITE_ADMOB_ANDROID_BANNER) || d.banner,
    isTesting: env.VITE_ADMOB_TESTING !== 'false',
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

  async showBanner(): Promise<void> {
    if (import.meta.env.VITE_ADMOB_BANNER !== 'true') return;
    try {
      await AdMob.showBanner({
        adId: this.ids.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: this.ids.isTesting,
        npa: this.npa,
      });
    } catch (e) {
      track('ads_banner_error', { message: String(e) });
    }
  }

  async hideBanner(): Promise<void> {
    try {
      await AdMob.hideBanner();
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
