// 코인 경제 — 코인을 "쓸 곳"과 광고로 "채울 곳"을 한 군데서 정의한다.
//  벌기: 판 클리어(20+별×10)×티어 · 결과 화면 광고로 2배 · 상점 "광고 보고 +80"(하루 5회) · 매일 첫 접속 보너스(연속 접속 가산)
//  쓰기: 부스터(판 안에서 바로 체감되는 소모품) · 실패 화면 코인 이어하기 · 수첩 힌트(30) · 프로 장비(400~1200, 영구)
//  광고 접점: 부스터는 코인이 모자라면 "광고 보고 1개"(하루 3회) — 코인이 부족한 순간이 곧 광고를 보는 순간이다.
import type { Store } from './storage';

export type BoosterId = 'time' | 'bomb' | 'scan' | 'shield';

export interface BoosterDef {
  id: BoosterId;
  icon: string;
  /** 코인 가격 */
  cost: number;
  /** 효과 수치 — time: 초, bomb: 남은 오염 비율, scan: 초, shield: 재오염 차단 초 */
  amount: number;
}

export const BOOSTERS: Record<BoosterId, BoosterDef> = {
  time: { id: 'time', icon: '⏱', cost: 60, amount: 20 },
  bomb: { id: 'bomb', icon: '🫧', cost: 120, amount: 0.2 },
  scan: { id: 'scan', icon: '🔎', cost: 50, amount: 12 },
  shield: { id: 'shield', icon: '🛡', cost: 80, amount: 25 },
};
export const BOOSTER_IDS: BoosterId[] = ['time', 'bomb', 'scan', 'shield'];

/** 상점 "광고 보고 코인 받기" */
export const AD_COINS = 80;
export const AD_COINS_PER_DAY = 5;
/** 부스터 "광고 보고 1개 받기" 하루 한도 */
export const AD_BOOSTERS_PER_DAY = 3;
/** 실패 화면: 코인으로 이어하기 (+time 부스터만큼) */
export const CONTINUE_COINS = 100;

export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 오늘 날짜의 일일 카운터 — 날짜가 바뀌면 0 부터 */
export function daily(st: Store, today = todayKey()) {
  if (st.daily.day !== today) {
    st.daily.day = today;
    st.daily.adCoins = 0;
    st.daily.adBoosters = 0;
  }
  return st.daily;
}

/** 매일 첫 접속 보너스: 30 + 연속 접속일 × 10 (최대 5일 가산). 이미 받았으면 0 */
export function claimDailyBonus(st: Store, now = new Date()): { coins: number; streak: number } | null {
  const today = todayKey(now);
  if (st.daily.bonusDay === today) return null;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const streak = st.daily.bonusDay === todayKey(y) ? Math.min(st.daily.streak + 1, 99) : 1;
  const coins = 30 + 10 * Math.min(streak - 1, 5);
  st.daily.bonusDay = today;
  st.daily.streak = streak;
  st.coins += coins;
  return { coins, streak };
}

export function adCoinsLeft(st: Store): number {
  return Math.max(0, AD_COINS_PER_DAY - daily(st).adCoins);
}
export function adBoostersLeft(st: Store): number {
  return Math.max(0, AD_BOOSTERS_PER_DAY - daily(st).adBoosters);
}
