import { beforeEach, describe, expect, it, vi } from 'vitest';

// 네이티브 플러그인을 가짜로 바꿔 동의·ATT 순서를 확인한다
const calls: string[] = [];
let attStatus = 'notDetermined';
let attAnswer = 'authorized';
let consentFails = true;
const lastNpa: Record<string, boolean | undefined> = {};

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios' } }));
vi.mock('../analytics', () => ({ track: () => {} }));
vi.mock('@capacitor-community/admob', () => ({
  AdmobConsentStatus: { REQUIRED: 'REQUIRED', OBTAINED: 'OBTAINED', NOT_REQUIRED: 'NOT_REQUIRED', UNKNOWN: 'UNKNOWN' },
  BannerAdPluginEvents: {},
  BannerAdPosition: {},
  BannerAdSize: {},
  InterstitialAdPluginEvents: {},
  RewardAdPluginEvents: {},
  AdMob: {
    initialize: async () => void calls.push('initialize'),
    requestConsentInfo: async () => {
      calls.push('consent');
      if (consentFails) throw new Error('Request consent info failed');
      return { status: 'NOT_REQUIRED', isConsentFormAvailable: false };
    },
    trackingAuthorizationStatus: async () => ({ status: attStatus }),
    requestTrackingAuthorization: async () => {
      calls.push('att');
      attStatus = attAnswer;
    },
    prepareInterstitial: async (o: { npa?: boolean }) => {
      calls.push('interstitial');
      lastNpa.interstitial = o.npa;
    },
    prepareRewardVideoAd: async (o: { npa?: boolean }) => {
      calls.push('rewarded');
      lastNpa.rewarded = o.npa;
    },
    addListener: async () => ({ remove: async () => {} }),
  },
}));

async function boot() {
  const { AdMobAds } = await import('./admob');
  const ads = new AdMobAds();
  await ads.init();
  await new Promise((r) => setTimeout(r, 0));
  return ads;
}

describe('AdMob 동의 · ATT 순서', () => {
  beforeEach(() => {
    calls.length = 0;
    attStatus = 'notDetermined';
    attAnswer = 'authorized';
    consentFails = true;
  });

  it('UMP 요청이 실패해도 ATT 창은 묻는다 — 그리고 어떤 광고 요청보다 먼저다', async () => {
    const ads = await boot();
    expect(calls).toContain('att');
    expect(calls.indexOf('att')).toBeLessThan(calls.indexOf('interstitial'));
    expect(calls.indexOf('att')).toBeLessThan(calls.indexOf('rewarded'));
    expect(ads.debug().ATT).toBe('authorized');
    expect(lastNpa.interstitial).toBe(false);
  });

  it('추적을 거부하면 비개인화 광고로 요청한다', async () => {
    attAnswer = 'denied';
    const ads = await boot();
    expect(ads.debug().ATT).toBe('denied');
    expect(lastNpa.interstitial).toBe(true);
    expect(lastNpa.rewarded).toBe(true);
  });

  it('이미 답한 기기에는 다시 묻지 않는다', async () => {
    attStatus = 'denied';
    consentFails = false;
    await boot();
    expect(calls).not.toContain('att');
    expect(lastNpa.interstitial).toBe(true);
  });
});
