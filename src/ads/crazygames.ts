// CrazyGames SDK v3 (https://docs.crazygames.com). 포털 제출 빌드에서 사용한다.
import type { AdsProvider } from './types';
import { setSoundEnabled } from '../audio';
import { getStore } from '../storage';

interface CgAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

interface CrazySdk {
  init(): Promise<void>;
  ad: { requestAd(type: 'midgame' | 'rewarded', callbacks: CgAdCallbacks): void };
  game: { gameplayStart(): void; gameplayStop(): void; loadingStart(): void; loadingStop(): void; happytime(): void };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazySdk };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`script load failed: ${src}`));
    document.head.appendChild(s);
  });
}

export class CrazyGamesAds implements AdsProvider {
  readonly name = 'crazygames';
  private sdk: CrazySdk | null = null;

  async init(): Promise<void> {
    try {
      await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      await sdk.init();
      this.sdk = sdk;
      sdk.game.loadingStop();
    } catch {
      this.sdk = null;
    }
  }

  private request(type: 'midgame' | 'rewarded'): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.sdk) return resolve(false);
      this.sdk.ad.requestAd(type, {
        adStarted: () => setSoundEnabled(false),
        adFinished: () => {
          setSoundEnabled(getStore().settings.sound);
          resolve(true);
        },
        adError: () => {
          setSoundEnabled(getStore().settings.sound);
          resolve(false);
        },
      });
    });
  }

  showInterstitial(): Promise<boolean> {
    return this.request('midgame');
  }
  showRewarded(): Promise<boolean> {
    return this.request('rewarded');
  }
  async showBanner(): Promise<void> {
    /* 포털이 관리 */
  }
  async hideBanner(): Promise<void> {
    /* 없음 */
  }
  gameplayStart(): void {
    this.sdk?.game.gameplayStart();
  }
  gameplayStop(): void {
    this.sdk?.game.gameplayStop();
  }
}
