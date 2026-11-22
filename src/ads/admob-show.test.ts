import { beforeEach, describe, expect, it, vi } from 'vitest';

// iOS 플러그인을 흉내 낸다: 보상형 show 호출은 "보상을 받았을 때만" 끝나고, 중간에 닫으면 영영 돌아오지 않는다.
const listeners = new Map<string, Set<() => void>>();
const emit = (name: string) => listeners.get(name)?.forEach((fn) => fn());
let loadOk = true;
let loads = 0;
/** 광고가 뜬 뒤 사용자가 하는 일 */
let viewer: 'finish' | 'close-early' | 'never-shows' = 'finish';

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
vi.mock('../analytics', () => ({ track: () => {} }));
vi.mock('@capacitor-community/admob', () => ({
  AdmobConsentStatus: { REQUIRED: 'REQUIRED', OBTAINED: 'OBTAINED', NOT_REQUIRED: 'NOT_REQUIRED', UNKNOWN: 'UNKNOWN' },
  BannerAdPluginEvents: {},
  BannerAdPosition: {},
  BannerAdSize: {},
  InterstitialAdPluginEvents: { Showed: 'iShowed', Dismissed: 'iDismissed', FailedToShow: 'iFailed' },
  RewardAdPluginEvents: { Showed: 'rShowed', Dismissed: 'rDismissed', FailedToShow: 'rFailed', Rewarded: 'rRewarded' },
  AdMob: {
    initialize: async () => {},
    requestConsentInfo: async () => ({ status: 'NOT_REQUIRED', isConsentFormAvailable: false }),
    trackingAuthorizationStatus: async () => ({ status: 'authorized' }),
    requestTrackingAuthorization: async () => {},
    prepareInterstitial: async () => {},
    prepareRewardVideoAd: async () => {
      loads++;
      if (!loadOk) throw new Error('No fill');
    },
    showRewardVideoAd: () =>
      new Promise<void>((resolve) => {
        if (viewer === 'never-shows') return;
        setTimeout(() => {
          emit('rShowed');
          if (viewer === 'finish') {
            emit('rRewarded');
            resolve();
          }
          emit('rDismissed');
        }, 5);
      }),
    showInterstitial: async () => {
      setTimeout(() => {
        emit('iShowed');
        emit('iDismissed');
      }, 5);
    },
    addListener: async (name: string, fn: () => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(fn);
      return { remove: async () => void listeners.get(name)!.delete(fn) };
    },
  },
}));

async function boot() {
  const { AdMobAds } = await import('./admob');
  const ads = new AdMobAds();
  await ads.init();
  await new Promise((r) => setTimeout(r, 0));
  return ads;
}
const listening = () => [...listeners.values()].reduce((n, s) => n + s.size, 0);

describe('AdMob 보상형 광고', () => {
  beforeEach(() => {
    listeners.clear();
    loadOk = true;
    loads = 0;
    viewer = 'finish';
    vi.useRealTimers();
  });

  it('끝까지 보면 보상을 준다', async () => {
    const ads = await boot();
    expect(await ads.showRewarded()).toBe(true);
    expect(ads.rewardedMiss).toBeNull();
    expect(listening()).toBe(0);
  });

  it('중간에 닫아도 멈추지 않고 "끝까지 안 봄"으로 끝난다 (iOS: show 호출이 돌아오지 않는 경우)', async () => {
    viewer = 'close-early';
    const ads = await boot();
    expect(await ads.showRewarded()).toBe(false);
    expect(ads.rewardedMiss).toBe('closed');
    expect(listening()).toBe(0);
    // 다음 광고도 정상적으로 볼 수 있다
    viewer = 'finish';
    expect(await ads.showRewarded()).toBe(true);
  });

  it('광고가 끝내 뜨지 않으면 기다리다 포기한다', async () => {
    viewer = 'never-shows';
    const ads = await boot();
    vi.useFakeTimers();
    const p = ads.showRewarded();
    await vi.advanceTimersByTimeAsync(9000);
    expect(await p).toBe(false);
    expect(ads.rewardedMiss).toBe('unavailable');
  });

  it('받아 둔 광고가 없으면 그 자리에서 불러와 보여 준다', async () => {
    loadOk = false;
    const ads = await boot();
    expect(ads.rewardedReadyNow()).toBe(false);
    expect(await ads.showRewarded()).toBe(false);
    expect(ads.rewardedMiss).toBe('unavailable');
    loadOk = true;
    const before = loads;
    expect(await ads.showRewarded()).toBe(true);
    expect(loads).toBeGreaterThan(before);
  });

  it('전면 광고도 닫히면 돌아오고 리스너를 남기지 않는다', async () => {
    const ads = await boot();
    expect(await ads.showInterstitial()).toBe(true);
    expect(listening()).toBe(0);
  });
});
