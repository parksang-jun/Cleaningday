import { describe, expect, it } from 'vitest'
import { AD_BOOSTERS_PER_DAY, AD_COINS_PER_DAY, adBoostersLeft, adCoinsLeft, claimDailyBonus, daily, todayKey } from './economy'
import type { Store } from './storage'

function store(over: Partial<Store['daily']> = {}): Store {
  return {
    coins: 0,
    daily: { day: '', adCoins: 0, adBoosters: 0, bonusDay: '', streak: 0, ...over },
  } as unknown as Store
}

describe('economy', () => {
  it('daily counters reset when the date changes', () => {
    const st = store({ day: '2026-11-10', adCoins: 5, adBoosters: 3 })
    daily(st, '2026-11-10')
    expect(st.daily).toMatchObject({ adCoins: 5, adBoosters: 3 })
    daily(st, '2026-11-11')
    expect(st.daily).toMatchObject({ day: '2026-11-11', adCoins: 0, adBoosters: 0 })
    // 같은 날 다시 불러도 그대로
    st.daily.adBoosters = 1
    daily(st, '2026-11-11')
    expect(st.daily.adBoosters).toBe(1)
    // 오늘 기준 남은 횟수 (todayKey 로 초기화된 뒤)
    const fresh = store({ day: todayKey(), adCoins: 2, adBoosters: 1 })
    expect(adCoinsLeft(fresh)).toBe(AD_COINS_PER_DAY - 2)
    expect(adBoostersLeft(fresh)).toBe(AD_BOOSTERS_PER_DAY - 1)
  })

  it('daily bonus pays once a day and grows with the streak (capped), then restarts after a missed day', () => {
    const st = store()
    const d1 = new Date(2026, 10, 1, 9)
    expect(claimDailyBonus(st, d1)).toEqual({ coins: 30, streak: 1 })
    expect(claimDailyBonus(st, new Date(2026, 10, 1, 20))).toBeNull()
    expect(st.coins).toBe(30)
    let day = 2
    let last = { coins: 0, streak: 0 }
    for (; day <= 8; day++) last = claimDailyBonus(st, new Date(2026, 10, day, 9))!
    expect(last).toEqual({ coins: 80, streak: 8 }) // 30 + 10 × min(7, 5)
    // 하루 건너뛰면 연속 끊김
    expect(claimDailyBonus(st, new Date(2026, 10, 10, 9))).toEqual({ coins: 30, streak: 1 })
    expect(st.coins).toBe(30 + 40 + 50 + 60 + 70 + 80 + 80 + 80 + 30)
  })

  it('todayKey is a local calendar date', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
