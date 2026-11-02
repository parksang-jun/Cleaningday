// 영구 저장: Capacitor Preferences(네이티브) + localStorage(웹) 공용 래퍼. 동기 캐시로 즉시 읽기.
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  lang: 'auto' | 'ko' | 'en' | 'ja';
}

export interface AdState {
  lastInterstitialAt: number;
  gamesSinceInterstitial: number;
}

export interface Stats {
  gamesPlayed: number; // 플레이한 스테이지 수 (광고 정책용)
  totalCleanedCells: number;
}

export interface Progress {
  unlocked: number; // 열린 최고 스테이지
  stars: Record<string, number>; // levelId -> 최고 별
  bestTime: Record<string, number>;
}

export interface Store {
  settings: Settings;
  stats: Stats;
  ads: AdState;
  progress: Progress;
  coins: number;
  owned: string[]; // 보유 아이템 id
}

const KEY = 'sparkle-clean-v1';

const DEFAULTS: Store = {
  settings: { sound: true, haptics: true, lang: 'auto' },
  stats: { gamesPlayed: 0, totalCleanedCells: 0 },
  ads: { lastInterstitialAt: 0, gamesSinceInterstitial: 0 },
  progress: { unlocked: 1, stars: {}, bestTime: {} },
  coins: 0,
  owned: [],
};

let cache: Store = structuredClone(DEFAULTS);
let writeTimer: ReturnType<typeof setTimeout> | null = null;

async function readRaw(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) return (await Preferences.get({ key: KEY })).value;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

async function writeRaw(value: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: KEY, value });
    return;
  }
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* 저장 실패 무시 */
  }
}

export async function loadStore(): Promise<Store> {
  const raw = await readRaw();
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<Store>;
      cache = {
        settings: { ...DEFAULTS.settings, ...p.settings },
        stats: { ...DEFAULTS.stats, ...p.stats },
        ads: { ...DEFAULTS.ads, ...p.ads },
        progress: { ...DEFAULTS.progress, ...p.progress, stars: { ...(p.progress?.stars ?? {}) }, bestTime: { ...(p.progress?.bestTime ?? {}) } },
        coins: typeof p.coins === 'number' ? p.coins : 0,
        owned: Array.isArray(p.owned) ? p.owned : [],
      };
    } catch {
      cache = structuredClone(DEFAULTS);
    }
  }
  return cache;
}

export function getStore(): Store {
  return cache;
}

export function persist(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void writeRaw(JSON.stringify(cache));
  }, 150);
}

export function resetStore(): void {
  cache = structuredClone(DEFAULTS);
  persist();
}
