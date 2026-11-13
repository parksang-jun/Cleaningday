import { describe, expect, it } from 'vitest'
import { AD_BOOSTERS_PER_DAY, AD_COINS_PER_DAY, adBoostersLeft, adCoinsLeft, adFree, buyAdFree, claimDailyBonus, daily, todayKey } from './economy'
import type { Store } from './storage'

function store(over: Partial<Store['daily']> = {}): Store {
  return {
    coins: 0,
    boosters: { time: 0, bomb: 0, scan: 0, shield: 0 },
    daily: { day: '', adCoins: 0, adBoosters: 0, bonusDay: '', streak: 0, ...over },
    ads: { lastInterstitialAt: 0, gamesSinceInterstitial: 0, adFreeUntil: 0 },
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

  it('daily bonus follows the 7-day check-in calendar, pays once a day, and restarts after a missed day', () => {
    const st = store()
    const d1 = new Date(2026, 10, 1, 9)
    expect(claimDailyBonus(st, d1)).toEqual({ coins: 30, streak: 1 })
    expect(claimDailyBonus(st, new Date(2026, 10, 1, 20))).toBeNull()
    expect(st.coins).toBe(30)
    const got = []
    for (let day = 2; day <= 8; day++) got.push(claimDailyBonus(st, new Date(2026, 10, day, 9))!)
    expect(got.map((g) => g.coins)).toEqual([40, 50, 60, 80, 100, 200, 30]) // 8일째는 다시 1일째 보상
    expect(got.map((g) => g.booster)).toEqual([undefined, 'scan', undefined, 'time', undefined, 'bomb', undefined])
    expect(got[6].streak).toBe(8)
    expect(st.boosters).toEqual({ time: 1, bomb: 1, scan: 1, shield: 0 })
    // 하루 건너뛰면 연속 끊김 (이틀 차이는 복귀 보너스 없음)
    expect(claimDailyBonus(st, new Date(2026, 10, 10, 9))).toEqual({ coins: 30, streak: 1 })
    expect(st.coins).toBe(30 + 40 + 50 + 60 + 80 + 100 + 200 + 30 + 30)
    // 3일 이상 쉬었다 오면 복귀 보너스가 붙는다
    expect(claimDailyBonus(st, new Date(2026, 10, 14, 9))).toEqual({ coins: 30 + 50, streak: 1, comeback: true })
  })

  it('todayKey is a local calendar date', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('ad-free passes cost coins, stack on remaining time, and expire', () => {
    const st = store()
    st.coins = 2000
    const t0 = Date.UTC(2026, 10, 12)
    expect(adFree(st, t0)).toBe(false)
    expect(buyAdFree(st, 'day', t0)).toBe(true)
    expect(st.coins).toBe(1700)
    expect(adFree(st, t0 + 23 * 3_600_000)).toBe(true)
    expect(buyAdFree(st, 'week', t0 + 3_600_000)).toBe(true) // 남은 23시간 위에 7일
    expect(st.ads.adFreeUntil).toBe(t0 + 24 * 3_600_000 + 7 * 24 * 3_600_000)
    expect(adFree(st, t0 + 8 * 24 * 3_600_000 + 1)).toBe(false)
    st.coins = 100
    expect(buyAdFree(st, 'day', t0)).toBe(false)
    expect(st.coins).toBe(100)
  })
})
