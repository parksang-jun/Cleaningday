// 판을 깼을 때의 보상 계산 — 고비 판 배수, 연승 보너스, 콤보 보너스. (기본 코인은 engine.scoreSession)
// 그리고 "반짝 타임": 쉬지 않고 닦으면 잠깐 닦는 속도가 빨라지는 보상.
import { CHALLENGE, type Challenge } from './levels'

/** 연승 보너스: 2연승부터 +10%씩, 최대 +50% */
export const STREAK_STEP = 0.1
export const STREAK_MAX = 0.5
export function streakBonus(streak: number): number {
  return Math.min(STREAK_MAX, Math.round(STREAK_STEP * Math.max(0, streak - 1) * 100) / 100)
}

/** 콤보 보너스: 한 판에서 낸 최고 콤보(4 이상)에 단계 수를 곱한 코인 */
export const COMBO_BONUS_FROM = 4
export function comboCoins(maxCombo: number, tier: number): number {
  return maxCombo >= COMBO_BONUS_FROM ? maxCombo * tier : 0
}

export interface Reward {
  /** 실제로 받는 코인 */
  total: number
  /** 고비 판 배수 (없으면 1) */
  challengeMul: number
  /** 연승 보너스 비율 (0~0.5) */
  streakPct: number
  comboCoins: number
}
/** 기본 코인 × 고비 판 배수 × (1 + 연승 보너스) + 콤보 보너스 */
export function rewardFor(baseCoins: number, opts: { challenge?: Challenge; streak: number; maxCombo: number; tier: number }): Reward {
  const challengeMul = opts.challenge ? CHALLENGE[opts.challenge].coins : 1
  const streakPct = streakBonus(opts.streak)
  const combo = comboCoins(opts.maxCombo, opts.tier)
  return { total: Math.round(baseCoins * challengeMul * (1 + streakPct)) + combo, challengeMul, streakPct, comboCoins: combo }
}

// ---------- 반짝 타임 ----------
/** 쉬지 않고 이만큼(초) 닦으면 반짝 타임이 켜진다 */
export const FEVER_CHARGE_SEC = 7
/** 반짝 타임 길이(초)와 닦는 속도 배율 */
export const FEVER_SEC = 5
export const FEVER_BOOST = 1.5
/** 손을 멈추면 게이지가 줄어드는 속도 (초당, 게이지 초 단위) — 도구를 바꾸는 잠깐은 봐준다 */
export const FEVER_DECAY = 1.75

export interface FeverState {
  /** 게이지 (0 ~ FEVER_CHARGE_SEC) */
  charge: number
  /** 남은 반짝 타임(초). 0 이면 꺼짐 */
  left: number
}
/**
 * 한 프레임 진행. scrubbing = 방금까지 실제로 때가 지워지고 있었나(콤보가 살아 있나).
 * 돌려주는 값: 'start' 이번 프레임에 켜짐, 'end' 꺼짐, null 변화 없음
 */
export function stepFever(f: FeverState, dt: number, scrubbing: boolean): 'start' | 'end' | null {
  if (f.left > 0) {
    f.left -= dt
    if (f.left <= 0) {
      f.left = 0
      f.charge = 0
      return 'end'
    }
    return null
  }
  if (scrubbing) f.charge = Math.min(FEVER_CHARGE_SEC, f.charge + dt)
  else f.charge = Math.max(0, f.charge - FEVER_DECAY * dt)
  if (f.charge >= FEVER_CHARGE_SEC) {
    f.left = FEVER_SEC
    return 'start'
  }
  return null
}
/** 게이지 표시용 0~1 (반짝 타임 중에는 남은 시간) */
export function feverMeter(f: FeverState): number {
  return f.left > 0 ? f.left / FEVER_SEC : f.charge / FEVER_CHARGE_SEC
}
