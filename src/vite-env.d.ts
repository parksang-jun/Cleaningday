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
  /** 스폰서 아이템 노출 (기본: 포털 빌드에서만 꺼짐) */
  readonly VITE_SPONSORS_ENABLED?: 'true' | 'false';
  /** 실제 제품 판매몰 노출 (기본: 포털 빌드에서만 꺼짐) */
  readonly VITE_MALL_ENABLED?: 'true' | 'false';
  /** 제휴 추적 코드 */
  readonly VITE_AMAZON_TAG_US?: string;
  readonly VITE_AMAZON_TAG_JP?: string;
  readonly VITE_COUPANG_LPTAG?: string;
  readonly VITE_COUPANG_SUBID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
