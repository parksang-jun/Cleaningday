// 고성능 장비(프리미엄·광고 제품) 효과 — 찌든 때 감속, 광택 마감, 세정제 용량 보너스, 광택 보너스 코인
import { describe, expect, it } from 'vitest'
import { BASE_DETERGENTS, BASE_TOOLS, TAIL_AMOUNT } from './catalog'
import { CleanSession, scoreSession } from './engine'
import { LEVELS } from './levels'
import { isProSponsor, SAMPLE_SPONSORS, toItemSpec } from './sponsor'

function fresh(id: number) {
  return new CleanSession(LEVELS[id - 1])
}

describe('pro gear', () => {
  it('basic tool slows down on the last layer (tail) where tailRate applies; premium tool does not', () => {
    // 찌든 때 단계(T3+)에서 청소기로 지워지는 먼지 칸을 찾는다
    let lv = LEVELS[0]
    let i = -1
    for (const cand of LEVELS) {
      if (cand.tailRate === undefined) continue
      const probe = new CleanSession(cand)
      for (let k = 0; k < probe.amount.length; k++) {
        if (probe.amount[k] > 0.5 && probe.dirtAt(k) === 'dust') {
          const before = probe.amount[k]
          probe.scrub(BASE_TOOLS.vacuum, (k % probe.w) + 0.5, Math.floor(k / probe.w) + 0.5, 0.05)
          if (probe.amount[k] < before) {
            lv = cand
            i = k
            break
          }
        }
      }
      if (i >= 0) break
    }
    expect(i, 'a tail stage with vacuumable dust exists').toBeGreaterThanOrEqual(0)
    const s = new CleanSession(lv)
    // 그 칸의 농도를 TAIL 바로 위/아래로 두고 같은 시간 문질러 비교
    const x = (i % s.w) + 0.5
    const y = Math.floor(i / s.w) + 0.5
    const basic = BASE_TOOLS.vacuum
    const pro = BASE_TOOLS.cordlessvac
    const rateAt = (tool: typeof basic, a0: number) => {
      const t = new CleanSession(lv)
      t.amount[i] = a0
      const before = t.amount[i]
      t.scrub(tool, x, y, 0.05)
      return (before - t.amount[i]) / 0.05
    }
    const rBasicHigh = rateAt(basic, 0.9) / 0.9 // 비율로 정규화하지 않음 — 속도는 농도와 무관하므로 절대값 비교
    const rBasicLow = rateAt(basic, TAIL_AMOUNT - 0.05)
    const rBasicHighAbs = rateAt(basic, 0.9)
    expect(rBasicLow, 'basic tool is slower under the tail threshold').toBeLessThan(rBasicHighAbs * 0.8)
    expect(rBasicHigh).toBeGreaterThan(0)
    const rProLow = rateAt(pro, TAIL_AMOUNT - 0.05)
    const rProHigh = rateAt(pro, 0.9)
    // 프리미엄: 끝까지 같은 속도 (다 지워져 0 이 되는 경우는 농도만큼만 줄어듦)
    expect(rProLow).toBeGreaterThanOrEqual(Math.min(rProHigh, (TAIL_AMOUNT - 0.05) / 0.05) * 0.95)
  })

  it('cells cleaned to the bottom by pro gear get a polished finish; basic gear never does', () => {
    const s = fresh(1)
    const i = Array.from(s.amount.keys()).find((k) => s.amount[k] > 0 && s.under[k] === 0)!
    const x = (i % s.w) + 0.5
    const y = Math.floor(i / s.w) + 0.5
    for (let k = 0; k < 400 && s.amount[i] > 0; k++) s.scrub(BASE_TOOLS.cloth, x, y, 0.05)
    expect(s.amount[i]).toBe(0)
    expect(s.shine[i]).toBe(0)
    expect(s.polish).toBe(0)
    const p = fresh(1)
    const j = Array.from(p.amount.keys()).find((k) => p.amount[k] > 0 && p.under[k] === 0 && p.dirtAt(k) === 'dust')!
    const px = (j % p.w) + 0.5
    const py = Math.floor(j / p.w) + 0.5
    for (let k = 0; k < 400 && p.amount[j] > 0; k++) p.scrub(BASE_TOOLS.cordlessvac, px, py, 0.05)
    expect(p.amount[j]).toBe(0)
    expect(p.shine[j]).toBe(1)
    expect(p.polish).toBeGreaterThan(0)
  })

  it('pro cleaners get a bigger spray budget on budgeted stages', () => {
    const lv = LEVELS.find((l) => l.sprayBudgetSec !== undefined)!
    const s = new CleanSession(lv)
    expect(s.budgetOf(BASE_DETERGENTS.degreaser)).toBe(lv.sprayBudgetSec)
    expect(s.budgetOf(BASE_DETERGENTS.heavydegreaser)).toBeCloseTo(lv.sprayBudgetSec! * 1.5)
  })

  it('polish ≥ 50% earns bonus coins scaled by tier', () => {
    const base = scoreSession({ time: 10, damage: 0, hazard: false, polish: 0 }, 30, 2)
    const shiny = scoreSession({ time: 10, damage: 0, hazard: false, polish: 0.9 }, 30, 2)
    expect(base.polishBonus).toBe(0)
    expect(shiny.polishBonus).toBe(18)
    expect(shiny.coins).toBe(base.coins + 18)
    expect(scoreSession({ time: 10, damage: 0, hazard: false, polish: 0.3 }, 30, 2).polishBonus).toBe(0)
  })

  it('sponsored products with strong lab results are pro grade; weak ones are not', () => {
    for (const p of SAMPLE_SPONSORS) {
      expect(isProSponsor(p), p.id).toBe(true)
      expect(toItemSpec(p).pro).toBe(true)
    }
    const weak = { ...SAMPLE_SPONSORS[0], id: 'weak', lab: [{ dirt: 'grease' as const, removalPct: 70 }] }
    expect(isProSponsor(weak)).toBe(false)
    expect(toItemSpec(weak).pro).toBe(false)
  })
})
