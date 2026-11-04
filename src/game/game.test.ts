import { describe, expect, it } from 'vitest'
import { BASE_DETERGENTS, BASE_TOOLS, isHazardMix, type DetergentSpec, type ToolSpec } from './catalog'
import { CleanSession, scoreSession } from './engine'
import { resolveTiming, simulateBot } from './bot'
import { LEVELS, tierFor, TIERS, WORLDS, type LevelDef } from './levels'
import { performanceRatios, SAMPLE_SPONSORS, toItemSpec, validateSponsor, type SponsorProduct } from './sponsor'

/** 봇: 남은 일이 가장 많은 지점으로 손가락을 옮겨, 그 주변이 깨끗해질 때까지 문지름.
 *  지점마다 그 오염에 가장 잘 듣는 도구·세제를 고름 (사람의 플레이에 가까운 근사) */
function simulate(level: LevelDef, tools: ToolSpec[], dets: DetergentSpec[] = [], maxSec = 400): number {
  const s = new CleanSession(level)
  const usable = tools.filter((t) => s.canUse(t))
  const dt = 1 / 30
  while (!s.passed && s.time < maxSec) {
    // 가장 진한 칸 찾기
    let best = -1
    let bestA = 0
    for (let i = 0; i < s.amount.length; i++) {
      if (s.amount[i] > bestA) {
        bestA = s.amount[i]
        best = i
      }
    }
    if (best < 0) break
    const cx = (best % s.w) + 0.5
    const cy = Math.floor(best / s.w) + 0.5
    const dirt = s.dirtAt(best)
    const tool = usable.reduce((a, b) => (b.effect[dirt] * b.power > a.effect[dirt] * a.power ? b : a))
    const det = dets.length ? dets.reduce((a, b) => (b.mult[dirt] > a.mult[dirt] ? b : a)) : null
    const useDet = det && det.mult[dirt] > 1.2 ? det : null
    s.tick(0.15) // 이동·도구 전환
    if (useDet && s.soakLevel(best) <= 0) {
      s.spray(useDet, cx, cy, 0.3)
      s.tick(0.3)
    }
    // 작은 원을 그리며 문지르기
    let t = 0
    while (t < 4 && s.amount[best] > 0.02) {
      const ang = t * 9
      s.scrub(tool, cx + Math.cos(ang) * tool.radius * 0.35, cy + Math.sin(ang) * tool.radius * 0.35, dt)
      s.tick(dt)
      t += dt
    }
  }
  return s.time
}

describe('engine', () => {
  it('generates dirt deterministically and starts dirty', () => {
    const a = new CleanSession(LEVELS[0])
    const b = new CleanSession(LEVELS[0])
    expect(Array.from(a.amount)).toEqual(Array.from(b.amount))
    expect(a.cleanliness).toBe(0)
    expect(a.initialTotal).toBeGreaterThan(100)
  })

  it('the right tool cleans much faster than the wrong one', () => {
    const lv = LEVELS.find((l) => l.scene === 'stove')!
    const right = new CleanSession(lv)
    const wrong = new CleanSession(lv)
    // 기름때가 가장 진한 칸
    let best = 0
    right.amount.forEach((a, i) => {
      if (right.dirtAt(i) === 'grease' && a > right.amount[best]) best = i
    })
    const cx = (best % right.w) + 0.5
    const cy = Math.floor(best / right.w) + 0.5
    for (let t = 0; t < 30; t++) {
      right.spray(BASE_DETERGENTS.degreaser, cx, cy, 1 / 30)
      right.scrub(BASE_TOOLS.sponge, cx, cy, 1 / 30)
      wrong.scrub(BASE_TOOLS.cloth, cx, cy, 1 / 30)
      right.tick(1 / 30)
      wrong.tick(1 / 30)
    }
    expect(right.cleanliness).toBeGreaterThan(wrong.cleanliness * 2)
  })

  it('every level can be cleared near its par time with the intended kit (simple greedy bot)', () => {
    // 각 스테이지 시점에 가진 기본 아이템(지급 누적) — 그 판의 표면에 해로운 것은 제외
    const owned: string[] = []
    const kitFor = (lv: LevelDef): [ToolSpec[], DetergentSpec[]] => {
      owned.push(...lv.grants)
      const surfaces = new CleanSession(lv).surfaces
      const tools = Object.values(BASE_TOOLS).filter((t) => owned.includes(t.id) && t.id !== 'rinse' && !t.harms.some((h) => surfaces.includes(h)))
      const dets = Object.values(BASE_DETERGENTS).filter((d) => owned.includes(d.id) && !d.harms.some((h) => surfaces.includes(h)))
      return [tools, dets]
    }
    // 난이도 1단계(기본 규칙)만 단순 봇으로 검증 — 뒤 단계는 bot.ts 의 숙련자 봇이 balance.test 에서 검증
    for (const lv of LEVELS.filter((l) => l.tier === 1)) {
      const [tools, dets] = kitFor(lv)
      const t = simulate(lv, tools, dets)
      const { parSec } = resolveTiming(lv)
      expect(t, `level ${lv.id}`).toBeLessThan(parSec * 1.5)
    }
  })

  it('worlds and areas are laid out as apartment → house garden → car, tiers get stricter in order', () => {
    expect(WORLDS.map((w) => w.id)).toEqual(['apartment', 'house', 'car'])
    expect(WORLDS[0].areas.map((a) => a.id)).toEqual(['living', 'room', 'kitchen', 'bathroom'])
    expect(WORLDS[1].areas.map((a) => a.id)).toEqual(['garden'])
    expect(WORLDS[2].areas.map((a) => a.id)).toEqual(['exterior', 'interior'])
    expect(LEVELS).toHaveLength(48)
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].passClean).toBeGreaterThan(TIERS[i - 1].passClean)
      expect(TIERS[i].resistMul).toBeGreaterThan(TIERS[i - 1].resistMul)
      expect(TIERS[i].parFactor).toBeLessThan(TIERS[i - 1].parFactor)
    }
    expect(tierFor(1).id).toBe(1)
    expect(tierFor(9).id).toBe(2)
    expect(tierFor(48).id).toBe(5)
    // 월드가 바뀌면 바로 더 어려운 단계
    expect(LEVELS[24].tier).toBe(4) // 정원 첫 판
    expect(LEVELS[36].tier).toBe(5) // 자동차 첫 판
  })

  it('time limit expires and can be extended; spray budget runs out and refills', () => {
    const lv = LEVELS.find((l) => l.tier === 3)!
    const timing = resolveTiming(lv)
    expect(timing.limitSec).toBeGreaterThan(timing.parSec)
    const s = new CleanSession(lv, timing)
    s.tick(timing.limitSec! + 1)
    expect(s.expired).toBe(true)
    s.extendLimit(30)
    expect(s.expired).toBe(false)
    // 세제 용량
    expect(lv.sprayBudgetSec).toBeDefined()
    const det = BASE_DETERGENTS.allpurpose
    expect(s.budgetOf(det)).toBe(lv.sprayBudgetSec)
    let empty = false
    for (let i = 0; i < 60 * lv.sprayBudgetSec! + 30 && !empty; i++) empty = s.spray(det, 20, 20, 1 / 30).some((e) => e.kind === 'empty')
    expect(empty).toBe(true)
    expect(s.budgetOf(det)).toBeLessThanOrEqual(0)
    s.refill(det, 6)
    expect(s.budgetOf(det)).toBeGreaterThan(5)
  })

  it('layered dirt reveals the under layer when the top is wiped', () => {
    const lv = LEVELS.find((l) => l.patches.some((p) => p.under))!
    const s = new CleanSession(lv)
    expect(s.hasLayers).toBe(true)
    let revealed = false
    const bot = simulateBot(lv)
    expect(bot.passed).toBe(true)
    // 직접: 아래층이 있는 칸을 찾아 윗층을 지움
    let cell = -1
    for (let i = 0; i < s.under.length; i++) if (s.under[i] > 0 && s.amount[i] > 0) { cell = i; break }
    expect(cell).toBeGreaterThanOrEqual(0)
    const cx = (cell % s.w) + 0.5
    const cy = Math.floor(cell / s.w) + 0.5
    for (let k = 0; k < 600 && !revealed; k++) {
      revealed = s.scrub(BASE_TOOLS.sponge, cx, cy, 1 / 30).some((e) => e.kind === 'revealed')
      s.tick(1 / 30)
    }
    expect(revealed).toBe(true)
  })

  it('harms wrong surfaces, blocks restricted tools, flags hazardous mixes', () => {
    const glass = new CleanSession(LEVELS.find((l) => l.surface === 'glass' && !l.zones)!)
    const ev = glass.scrub(BASE_TOOLS.brush, 10, 10, 0.5)
    expect(ev.some((e) => e.kind === 'harm')).toBe(true)
    expect(glass.damage).toBeGreaterThan(0)

    const floor = new CleanSession(LEVELS[0]) // 실내 원목
    expect(floor.canUse(BASE_TOOLS.washer)).toBe(false)
    expect(floor.scrub(BASE_TOOLS.washer, 10, 10, 0.1).some((e) => e.kind === 'blocked')).toBe(true)

    const tub = new CleanSession(LEVELS.find((l) => l.scene === 'bathtub')!)
    tub.limitSec = undefined
    tub.spray(BASE_DETERGENTS.moldremover, 20, 20, 0.1)
    const ev2 = tub.spray(BASE_DETERGENTS.descaler, 21, 20, 0.1)
    expect(ev2.some((e) => e.kind === 'hazard')).toBe(true)
    expect(isHazardMix('acid', 'chlorine')).toBe(true)
    expect(isHazardMix('alkaline', 'neutral')).toBe(false)
  })

  it('scores stars from time, damage and hazards', () => {
    expect(scoreSession({ time: 20, damage: 0, hazard: false }, 30).stars).toBe(3)
    expect(scoreSession({ time: 40, damage: 0, hazard: false }, 30).stars).toBe(2)
    expect(scoreSession({ time: 70, damage: 0.2, hazard: true }, 30).stars).toBe(1)
    expect(scoreSession({ time: 20, damage: 0, hazard: false }, 30).coins).toBe(50)
    expect(scoreSession({ time: 20, damage: 0, hazard: false }, 30, 3).coins).toBe(150) // 난이도 단계 × 보상
  })
})

describe('sponsors', () => {
  const today = '2026-11-02'

  it('maps lab results to ratios vs the reference product, clamped, unproven = 1.0', () => {
    const p = SAMPLE_SPONSORS[0]
    const r = performanceRatios(p)
    expect(r.grease).toBeCloseTo(92 / 80, 5)
    expect(r.stain).toBeCloseTo(63 / 55, 5)
    expect(r.scale).toBe(1)
    const huge: SponsorProduct = { ...p, lab: [{ dirt: 'grease', removalPct: 100 }] , base: 'allpurpose' }
    expect(performanceRatios(huge).grease).toBe(1.8) // 1.82 → 상한 1.8
    expect(performanceRatios({ ...huge, lab: [{ dirt: 'grease', removalPct: 100 }], base: 'brush', kind: 'tool' }).grease).toBe(1) // 기준 없음
  })

  it('converts to item specs that keep label cautions and chemistry', () => {
    const det = toItemSpec(SAMPLE_SPONSORS[0])
    expect(det.kind).toBe('detergent')
    if (det.kind === 'detergent') {
      expect(det.mult.grease).toBeCloseTo(1 + 2.0 * (92 / 80), 2)
      expect(det.mult.scale).toBe(1)
      expect(det.harms).toEqual(expect.arrayContaining(['wood', 'paint']))
      expect(det.id).toBe('sp:brightmax-degreaser')
    }
    const tool = toItemSpec(SAMPLE_SPONSORS[1])
    if (tool.kind === 'tool') {
      expect(tool.radius).toBeCloseTo(BASE_TOOLS.washer.radius * Math.sqrt(7.5 / 6), 2)
      expect(tool.effect.mud).toBeCloseTo(BASE_TOOLS.washer.effect.mud * (96 / 92), 2)
      expect(tool.harms).toContain('glass')
    }
  })

  it('validates evidence and campaign windows', () => {
    expect(validateSponsor(SAMPLE_SPONSORS[0], today)).toEqual([])
    expect(validateSponsor({ ...SAMPLE_SPONSORS[0], evidence: undefined }, today)).toContain('no_evidence')
    expect(validateSponsor(SAMPLE_SPONSORS[0], '2028-01-01')).toContain('campaign_inactive')
    expect(validateSponsor({ ...SAMPLE_SPONSORS[0], kind: 'tool' }, today)).toContain('kind_mismatch')
    expect(validateSponsor({ ...SAMPLE_SPONSORS[0], lab: [{ dirt: 'grease', removalPct: 140 }] }, today)).toContain('bad_lab_value')
  })

  it('a better product really cleans faster in the game', () => {
    const lv = LEVELS.find((l) => l.scene === 'stove')!
    const sp = toItemSpec(SAMPLE_SPONSORS[0]) as DetergentSpec
    const run = (det: DetergentSpec) => {
      const s = new CleanSession(lv)
      for (let t = 0; t < 120; t++) {
        const x = 6 + (t % 40)
        for (let y = 4; y < 60; y += 4) {
          s.spray(det, x, y, 1 / 30)
          s.scrub(BASE_TOOLS.sponge, x, y, 1 / 30)
        }
        s.tick(1 / 30)
      }
      return s.cleanliness
    }
    const base = run(BASE_DETERGENTS.degreaser)
    const better = run(sp)
    expect(better).toBeGreaterThan(base)
  })
})
