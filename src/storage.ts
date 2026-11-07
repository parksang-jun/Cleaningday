// 영구 저장: Capacitor Preferences(네이티브) + localStorage(웹) 공용 래퍼. 동기 캐시로 즉시 읽기.
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import type { SponsorProduct } from './game/sponsor';

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  /** AI 쇼호스트 음성(TTS) */
  hostVoice: boolean;
  lang: 'auto' | 'ko' | 'en' | 'ja';
}

/** 쇼호스트 전역 설정 (운영자 모드에서 편집) */
export interface HostConfig {
  enabled: boolean;
  name: string;
  /** 판 시작 소개: 같은 제품 재노출 간격(분) */
  introCooldownMin: number;
  /** 판 시작 소개를 시작할 스테이지 */
  introFromStage: number;
  /** 막혔을 때(틀린 시도 N회) 등장 */
  struggleAfterTries: number;
  /** 결과 화면에서 추천 */
  result: boolean;
}

/** 운영 데이터 — 광고 제품 관리·쇼호스트·집계 (실서비스에선 원격 설정 JSON 으로 교체) */
export interface Ops {
  /** 운영자가 추가한 광고 제품 */
  sponsors: SponsorProduct[];
  /** 내장(샘플) 제품에 대한 덮어쓰기 (status·placements·hostLines 등) */
  overrides: Record<string, Partial<SponsorProduct>>;
  host: HostConfig;
  /** 이벤트 집계 "이벤트|제품|위치" → 횟수 */
  counters: Record<string, number>;
  /** 제품별 마지막 쇼호스트 노출 시각(ms) */
  lastHostAt: Record<string, number>;
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
  journal: string[]; // 발견한 조합 키 "dirt|tool|cleaner" (recipeKey)
  ops: Ops;
}

const KEY = 'sparkle-clean-v1';

export const DEFAULT_HOST: HostConfig = { enabled: true, name: '반디', introCooldownMin: 8, introFromStage: 2, struggleAfterTries: 2, result: true };

const DEFAULTS: Store = {
  settings: { sound: true, music: true, haptics: true, hostVoice: true, lang: 'auto' },
  stats: { gamesPlayed: 0, totalCleanedCells: 0 },
  ads: { lastInterstitialAt: 0, gamesSinceInterstitial: 0 },
  progress: { unlocked: 1, stars: {}, bestTime: {} },
  coins: 0,
  owned: [],
  journal: [],
  ops: { sponsors: [], overrides: {}, host: { ...DEFAULT_HOST }, counters: {}, lastHostAt: {} },
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
        journal: Array.isArray(p.journal) ? p.journal : [],
        ops: {
          sponsors: Array.isArray(p.ops?.sponsors) ? p.ops!.sponsors : [],
          overrides: { ...(p.ops?.overrides ?? {}) },
          host: { ...DEFAULT_HOST, ...(p.ops?.host ?? {}) },
          counters: { ...(p.ops?.counters ?? {}) },
          lastHostAt: { ...(p.ops?.lastHostAt ?? {}) },
        },
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
