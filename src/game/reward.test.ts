import { describe, expect, it } from 'vitest'
import { kitFor, resolveTiming, simulateBot } from './bot'
import { BASE_TOOLS } from './catalog'
import { CleanSession, scoreSession, SLOW_FACTOR } from './engine'
import { areaWork, CHALLENGE, challengeFor, LEVELS, LIMIT_FROM, WORLDS } from './levels'
import { comboCoins, FEVER_BOOST, FEVER_CHARGE_SEC, FEVER_SEC, feverMeter, rewardFor, stepFever, streakBonus } from './reward'

describe('difficulty that can be felt', () => {
  it('the clock arrives at stage 5 (stages 1-4 cannot be failed) and gets steadily tighter against the expert bot', () => {
    for (const l of LEVELS) expect(resolveTiming(l).limitSec === undefined, `stage ${l.id}`).toBe(l.id < LIMIT_FROM)
    // 구역별 평균 (제한시간 ÷ 숙련자 봇 시간): 뒤 구역일수록 빠듯하다
    const ratios = WORLDS.flatMap((w) => w.areas).map((a) => {
      const ids = a.levelIds.filter((id) => id >= LIMIT_FROM)
      return ids.reduce((sum, id) => sum + resolveTiming(LEVELS[id - 1]).limitSec! / simulateBot(LEVELS[id - 1], 900, kitFor(LEVELS[id - 1]), { mess: false }).time, 0) / ids.length
    })
    for (let i = 1; i < ratios.length; i++) expect(ratios[i], `area ${i + 1} is tighter than area ${i}`).toBeLessThan(ratios[i - 1])
    expect(ratios[0]).toBeLessThan(4.2) // 거실: 예전엔 제한시간이 없었다
    expect(ratios[1]).toBeLessThan(3.6) // 방: 예전 4.2배
    expect(ratios[ratios.length - 1]).toBeGreaterThan(1.6) // 마지막 구역도 숙련자에게는 여유가 있다
  }, 120_000)

  it('each area starts light and builds up: a hard stage at 4 and 8, a big-clean boss at 12, paying more coins', () => {
    expect(areaWork(0)).toBeLessThan(1)
    expect(areaWork(11)).toBeGreaterThan(1.1)
    for (const a of WORLDS.flatMap((w) => w.areas)) {
      a.levelIds.forEach((id, idx) => {
        const lv = LEVELS[id - 1]
        expect(lv.challenge, `stage ${id}`).toBe(challengeFor(id, idx))
      })
      const last = LEVELS[a.levelIds[a.levelIds.length - 1] - 1]
      expect(last.challenge).toBe('boss')
      // 대청소 판은 그 구역에서 가장 오래 걸린다
      const times = a.levelIds.map((id) => simulateBot(LEVELS[id - 1], 900, kitFor(LEVELS[id - 1]), { mess: false }).time)
      expect(times[times.length - 1]).toBe(Math.max(...times))
      // 구역 뒤쪽 절반이 앞쪽 절반보다 일이 많다
      const half = Math.floor(times.length / 2)
      const avg = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length
      expect(avg(times.slice(half))).toBeGreaterThan(avg(times.slice(0, half)))
    }
    expect(LEVELS.slice(0, 6).every((l) => !l.challenge)).toBe(true) // 처음 6판은 배우는 구간
    expect(LEVELS.filter((l) => l.challenge === 'boss').map((l) => l.id)).toEqual([12, 24, 36, 48, 60, 72, 84, 96])
    expect(CHALLENGE.boss.coins).toBeGreaterThan(CHALLENGE.hard.coins)
  }, 120_000)

  it('stars: within target = 3, within 1.5x target = 2, slower = 1', () => {
    const s = { damage: 0, hazard: false }
    expect(scoreSession({ ...s, time: 30 }, 30).stars).toBe(3)
    expect(scoreSession({ ...s, time: 31 }, 30).stars).toBe(2)
    expect(scoreSession({ ...s, time: 30 * SLOW_FACTOR }, 30).stars).toBe(2)
    expect(scoreSession({ ...s, time: 30 * SLOW_FACTOR + 1 }, 30).stars).toBe(1)
    // 5판부터는 제한시간 안에서도 별 1개 구간이 있다 (제한시간 > 목표시간 × 1.5)
    for (const l of LEVELS.filter((x) => x.id >= LIMIT_FROM)) {
      const tm = resolveTiming(l)
      expect(tm.limitSec!, `stage ${l.id}`).toBeGreaterThan(tm.parSec * SLOW_FACTOR)
    }
  }, 60_000)
})

describe('rewards', () => {
  it('win streak adds 10% per win from the second, capped at 50%', () => {
    expect([1, 2, 3, 6, 7, 20].map(streakBonus)).toEqual([0, 0.1, 0.2, 0.5, 0.5, 0.5])
  })
  it('combo bonus needs a combo of 4 or more and scales with the tier', () => {
    expect(comboCoins(3, 2)).toBe(0)
    expect(comboCoins(4, 1)).toBe(4)
    expect(comboCoins(12, 6)).toBe(72)
  })
  it('reward = base x challenge x streak + combo', () => {
    expect(rewardFor(50, { streak: 1, maxCombo: 0, tier: 1 })).toEqual({ total: 50, challengeMul: 1, streakPct: 0, comboCoins: 0 })
    expect(rewardFor(50, { challenge: 'boss', streak: 3, maxCombo: 5, tier: 2 })).toEqual({ total: 50 * 2 * 1.2 + 10, challengeMul: 2, streakPct: 0.2, comboCoins: 10 })
    expect(rewardFor(50, { challenge: 'hard', streak: 1, maxCombo: 0, tier: 1 }).total).toBe(75)
  })
})

describe('sparkle time (fever)', () => {
  it('charges while scrubbing, forgives a short pause, fires, then resets', () => {
    const f = { charge: 0, left: 0 }
    for (let t = 0; t < FEVER_CHARGE_SEC - 1; t += 0.1) expect(stepFever(f, 0.1, true)).toBeNull()
    expect(feverMeter(f)).toBeGreaterThan(0.8)
    stepFever(f, 0.5, false) // 도구를 바꾸는 잠깐
    expect(f.charge).toBeGreaterThan(FEVER_CHARGE_SEC - 2.5)
    let started = false
    for (let t = 0; t < 3 && !started; t += 0.1) started = stepFever(f, 0.1, true) === 'start'
    expect(started).toBe(true)
    expect(f.left).toBe(FEVER_SEC)
    let ended = false
    for (let t = 0; t < FEVER_SEC + 0.2 && !ended; t += 0.1) ended = stepFever(f, 0.1, true) === 'end'
    expect(ended).toBe(true)
    expect(f).toEqual({ charge: 0, left: 0 })
    // 오래 쉬면 게이지가 빈다
    f.charge = 3
    stepFever(f, 5, false)
    expect(f.charge).toBe(0)
  })

  it('boost speeds up cleaning by its factor and never touches surface damage', () => {
    const lv = LEVELS[0]
    const run = (boost: number) => {
      const s = new CleanSession(lv, undefined, lv.seed, { mess: false })
      s.boost = boost
      let i = 0
      s.amount.forEach((a, k) => {
        if (a > s.amount[i]) i = k
      })
      const before = s.amount[i]
      s.scrub(BASE_TOOLS.cloth, (i % s.w) + 0.5, Math.floor(i / s.w) + 0.5, 0.05)
      return { removed: before - s.amount[i], damage: s.damage }
    }
    const normal = run(1)
    const fever = run(FEVER_BOOST)
    expect(normal.removed).toBeGreaterThan(0)
    expect(fever.removed).toBeGreaterThan(normal.removed * 1.2)
    expect(fever.damage).toBe(normal.damage)
  })
})
