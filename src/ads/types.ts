// 광고 공급자 추상화. 네이티브(AdMob)·웹 포털(Poki/CrazyGames)·개발용(Noop)을 동일 인터페이스로 다룬다.
export interface AdsProvider {
  readonly name: string;
  init(): Promise<void>;
  /** 전면 광고. 광고가 닫히면 resolve. 표시 실패 시 false */
  showInterstitial(): Promise<boolean>;
  /** 보상형 광고. 끝까지 시청해 보상을 받았으면 true */
  showRewarded(): Promise<boolean>;
  /** 하단 배너. 실제로 배너 자리를 쓰면 true (포털처럼 배너가 없으면 false → 자리도 비우지 않는다) */
  showBanner(): Promise<boolean>;
  hideBanner(): Promise<void>;
  /** 웹 포털 SDK용 게임플레이 신호(없으면 무시) */
  gameplayStart(): void;
  gameplayStop(): void;
}

export type AdProviderName = 'admob' | 'poki' | 'crazygames' | 'noop';
