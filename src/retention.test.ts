import { describe, expect, it } from 'vitest'
import { ATTENDANCE, attendanceIndex, attendanceReward, CHEST_COINS, chestBooster, chestReady, claimable, claimChest, claimMission, daysBetween, MISSION_COINS, missionIdsFor, MISSIONS, missions, recordClear, recordVisit } from './retention'
import type { Store } from './storage'

function store(): Store {
  return {
    coins: 0,
    boosters: { time: 0, bomb: 0, scan: 0, shield: 0 },
    daily: { day: '', adCoins: 0, adBoosters: 0, bonusDay: '', streak: 0 },
    stats: { gamesPlayed: 0, totalCleanedCells: 0 },
  } as unknown as Store
}

describe('retention', () => {
  it('check-in calendar grows over 7 days, peaks on day 7, then cycles', () => {
    expect(ATTENDANCE).toHaveLength(7)
    const coins = ATTENDANCE.map((d) => d.coins)
    expect([...coins].sort((a, b) => a - b)).toEqual(coins) // 매일 같거나 커진다
    expect(coins[6]).toBe(Math.max(...coins))
    expect(attendanceReward(1).coins).toBe(30)
    expect(attendanceReward(7)).toEqual({ coins: 200, booster: 'bomb' })
    expect(attendanceReward(8)).toEqual(attendanceReward(1))
    expect(attendanceIndex(15)).toBe(0)
  })

  it('picks 3 distinct missions per day, always including "clear", stable for the date', () => {
    const seen = new Set<string>()
    for (let d = 1; d <= 28; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`
      const ids = missionIdsFor(day)
      expect(ids).toHaveLength(3)
      expect(new Set(ids).size).toBe(3)
      expect(ids[0]).toBe('clear')
      expect(missionIdsFor(day)).toEqual(ids)
      ids.forEach((i) => seen.add(i))
    }
    expect(seen.size).toBe(Object.keys(MISSIONS).length) // 한 달 안에 모든 미션이 돈다
  })

  it('clears advance missions; rewards are claimed by hand, once; the chest opens after all three', () => {
    const st = store()
    const day = '2026-11-13'
    const m = missions(st, day)
    expect(claimMission(st, 'clear', day)).toBe(0) // 아직 달성 전
    expect(recordClear(st, { stars: 3, underPar: true, safe: true }, day)).toEqual(m.ids.filter((id) => MISSIONS[id].target === 1))
    recordClear(st, { stars: 3, underPar: true, safe: true }, day)
    const newly = recordClear(st, { stars: 3, underPar: true, safe: true }, day)
    expect(newly).toContain('clear') // 3판째에 '판 3개 깨기' 달성
    expect(m.ids.every((id) => (m.prog[id] ?? 0) >= MISSIONS[id].target)).toBe(true)
    expect(m.prog.clear).toBe(3)
    recordClear(st, { stars: 3, underPar: true, safe: true }, day)
    expect(m.prog.clear).toBe(3) // 목표를 넘지 않는다
    expect(st.coins).toBe(0) // 자동 지급 없음
    expect(claimable(m)).toBe(3)
    expect(claimChest(st, day)).toBeNull()
    expect(claimMission(st, m.ids[0], day)).toBe(MISSION_COINS)
    expect(claimMission(st, m.ids[0], day)).toBe(0) // 두 번은 안 된다
    claimMission(st, m.ids[1], day)
    expect(chestReady(m)).toBe(false)
    claimMission(st, m.ids[2], day)
    expect(chestReady(m)).toBe(true)
    expect(claimChest(st, day)).toEqual({ coins: CHEST_COINS, booster: chestBooster(day) })
    expect(claimChest(st, day)).toBeNull()
    expect(st.coins).toBe(3 * MISSION_COINS + CHEST_COINS)
    expect(Object.values(st.boosters).reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('a weak clear only counts toward what it earned', () => {
    const st = store()
    const day = '2026-11-14'
    recordClear(st, { stars: 1, underPar: false, safe: false }, day)
    const m = missions(st, day)
    expect(m.prog.clear).toBe(1)
    for (const id of m.ids) if (id === 'perfect' || id === 'par' || id === 'safe') expect(m.prog[id]).toBe(0)
    if (m.ids.includes('stars')) expect(m.prog.stars).toBe(1)
  })

  it('missions reset on a new day', () => {
    const st = store()
    recordClear(st, { stars: 3, underPar: true, safe: true }, '2026-11-13')
    const next = missions(st, '2026-11-14')
    expect(next.day).toBe('2026-11-14')
    expect(next.prog).toEqual({})
    expect(next.claimed).toEqual([])
  })

  it('records install day and distinct days played for retention tracking', () => {
    const st = store()
    expect(recordVisit(st, '2026-11-13')).toEqual({ dayN: 0, days: 1 })
    expect(recordVisit(st, '2026-11-13')).toBeNull() // 같은 날 두 번째 접속
    expect(recordVisit(st, '2026-11-14')).toEqual({ dayN: 1, days: 2 }) // 1일차 잔존
    expect(recordVisit(st, '2026-11-20')).toEqual({ dayN: 7, days: 3 }) // 7일차 잔존
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })
})
