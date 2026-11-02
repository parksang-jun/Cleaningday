// Poki 웹 포털 SDK (https://sdk.poki.com). Poki 심사 통과 후 포털에 업로드하는 빌드에서 사용한다.
import type { AdsProvider } from './types';
import { setSoundEnabled } from '../audio';
import { getStore } from '../storage';

interface PokiSdk {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(onStart?: () => void): Promise<void>;
  rewardedBreak(onStart?: () => void): Promise<boolean>;
}

declare global {
  interface Window {
    PokiSDK?: PokiSdk;
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

export class PokiAds implements AdsProvider {
  readonly name = 'poki';
  private sdk: PokiSdk | null = null;

  async init(): Promise<void> {
    try {
      await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
      if (!window.PokiSDK) return;
      await window.PokiSDK.init();
      this.sdk = window.PokiSDK;
      this.sdk.gameLoadingFinished();
    } catch {
      this.sdk = null;
    }
  }

  private mute(): void {
    setSoundEnabled(false);
  }
  private unmute(): void {
    setSoundEnabled(getStore().settings.sound);
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.sdk) return false;
    await this.sdk.commercialBreak(() => this.mute());
    this.unmute();
    return true;
  }

  async showRewarded(): Promise<boolean> {
    if (!this.sdk) return false;
    const ok = await this.sdk.rewardedBreak(() => this.mute());
    this.unmute();
    return ok;
  }

  async showBanner(): Promise<void> {
    /* Poki는 포털이 광고 배치를 관리 */
  }
  async hideBanner(): Promise<void> {
    /* 없음 */
  }
  gameplayStart(): void {
    this.sdk?.gameplayStart();
  }
  gameplayStop(): void {
    this.sdk?.gameplayStop();
  }
}
