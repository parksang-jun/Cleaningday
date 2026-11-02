/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AD_PROVIDER?: 'poki' | 'crazygames' | 'noop';
  readonly VITE_ADMOB_TESTING?: string;
  readonly VITE_ADMOB_BANNER?: string;
  readonly VITE_ADMOB_ANDROID_INTERSTITIAL?: string;
  readonly VITE_ADMOB_ANDROID_REWARDED?: string;
  readonly VITE_ADMOB_ANDROID_BANNER?: string;
  readonly VITE_ADMOB_IOS_INTERSTITIAL?: string;
  readonly VITE_ADMOB_IOS_REWARDED?: string;
  readonly VITE_ADMOB_IOS_BANNER?: string;
  readonly VITE_PRIVACY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
