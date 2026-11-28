// 코인 쓸 곳 (운영자 승인 2026-11-28, B안) — 막힌 순간에 코인으로 넘어갈 길을 준다.
//  · 장비 대여: 실패 화면에서 이 오염에 맞는 프로 장비 하나를 한 판만 빌려 다시 한다
//  · 별 3개 재도전: 결과 화면(별 1~2개)에서 아직 없는 프로 장비·세제를 전부 한 판만 빌려 다시 한다
//  · 판 건너뛰기: 같은 판에서 여러 번 실패하면 코인으로 다음 판을 연다(별은 0 — 구역 별 관문은 그대로)
import type { Store } from './storage';

export const RENT_COINS = 40;
export const STAR_RETRY_COINS = 60;
export const SKIP_COINS = 150;
/** 건너뛰기는 같은 판에서 이만큼 실패한 뒤에 나온다 */
export const SKIP_AFTER_FAILS = 2;

type Wallet = Pick<Store, 'coins'>;

/** 코인이 충분하면 빼고 true */
export function spend(st: Wallet, cost: number): boolean {
  if (!(cost > 0) || st.coins < cost) return false;
  st.coins -= cost;
  return true;
}

/** 건너뛰기를 보여 줄 판인가: 진행의 맨 앞 판이고, 마지막 판이 아니며, 충분히 실패했을 때 */
export function canOfferSkip(st: Pick<Store, 'progress'>, levelId: number, failRun: number, lastLevelId: number): boolean {
  return levelId === st.progress.unlocked && levelId < lastLevelId && failRun >= SKIP_AFTER_FAILS;
}

/** 코인을 내고 다음 판을 연다. 별·기록은 건드리지 않는다 */
export function skipStage(st: Pick<Store, 'progress' | 'coins' | 'failRuns'>, levelId: number, failRun: number, lastLevelId: number): boolean {
  if (!canOfferSkip(st, levelId, failRun, lastLevelId)) return false;
  if (!spend(st, SKIP_COINS)) return false;
  st.progress.unlocked = levelId + 1;
  if (st.failRuns) delete st.failRuns[levelId];
  return true;
}
