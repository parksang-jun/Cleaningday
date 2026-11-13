// 개발/웹 단독 배포용 가짜 광고. 실제 광고 대신 짧은 플레이스홀더 오버레이를 보여준다.
import type { AdsProvider } from './types';

function showPlaceholder(label: string, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'ad-placeholder';
    el.setAttribute('data-testid', 'ad-placeholder');
    el.textContent = label;
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
      resolve();
    }, ms);
  });
}

export class NoopAds implements AdsProvider {
  readonly name = 'noop';
  async init(): Promise<void> {
    /* 없음 */
  }
  async showInterstitial(): Promise<boolean> {
    await showPlaceholder('AD', 800);
    return true;
  }
  async showRewarded(): Promise<boolean> {
    await showPlaceholder('REWARDED AD', 1200);
    return true;
  }
  async showBanner(): Promise<boolean> {
    // 웹·개발용: 배너가 들어갈 자리를 눈으로 확인할 수 있게 표시만 한다
    const slot = document.getElementById('ad-banner');
    if (slot) slot.innerHTML = '<span class="ad-banner__ph" data-testid="ad-banner-placeholder">AD · BANNER</span>';
    return true;
  }
  async hideBanner(): Promise<void> {
    const slot = document.getElementById('ad-banner');
    if (slot) slot.innerHTML = '';
  }
  gameplayStart(): void {
    /* 없음 */
  }
  gameplayStop(): void {
    /* 없음 */
  }
}
