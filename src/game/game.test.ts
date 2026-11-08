import { describe, expect, it } from 'vitest'
import { BASE_DETERGENTS, BASE_TOOLS, diagnose, isHazardMix, matchRecipe, type DirtType } from './catalog'
import { CleanSession, scoreSession } from './engine'
import { resolveTiming, simulateBot } from './bot'
import { LEVELS, tierFor, TIERS, WORLDS } from './levels'
import { performanceRatios, SAMPLE_SPONSORS, toItemSpec, validateSponsor, type SponsorProduct } from './sponsor'

/** 어떤 오염이 가장 진한 칸 */
function densest(s: CleanSession, dirt: DirtType): number {
  let best = -1
  let bestA = 0
  s.amount.forEach((a, i) => {
    if (s.dirtAt(i) === dirt && a > bestA) {
      bestA = a
      best = i
    }
  })
  return best
}

describe('engine', () => {
  it('generates dirt deterministically and starts dirty', () => {
    const a = new CleanSession(LEVELS[0])
    const b = new CleanSession(LEVELS[0])
    expect(Array.from(a.amount)).toEqual(Array.from(b.amount))
    expect(a.cleanliness).toBe(0)
    expect(a.initialTotal).toBeGreaterThan(100)
    expect(a.dirtKinds).toEqual(['dust'])
  })

  it('wrong tool does nothing; the right tool (and cleaner) cleans — and reports why it failed', () => {
    const lv = LEVELS.find((l) => l.scene === 'stove')! // 기름때 on steel
    const s = new CleanSession(lv)
    const best = densest(s, 'grease')
    const cx = (best % s.w) + 0.5
    const cy = Math.floor(best / s.w) + 0.5
    // 1) 청소기: 기름때에 아예 안 통함
    let ev = s.scrub(BASE_TOOLS.vacuum, cx, cy, 0.5)
    expect(s.cleanliness).toBe(0)
    expect(ev.find((e) => e.kind === 'noeffect')).toMatchObject({ reason: 'wrong_tool', dirt: 'grease' })
    // 2) 수세미만: 세정제 필요
    s.tick(3)
    ev = s.scrub(BASE_TOOLS.scrubpad, cx, cy, 0.5)
    expect(s.cleanliness).toBe(0)
    expect(ev.find((e) => e.kind === 'noeffect')).toMatchObject({ reason: 'need_cleaner' })
    // 3) 유리 세정제 + 수세미: 틀린 세정제
    s.tick(3)
    s.spray(BASE_DETERGENTS.glass, cx, cy, 0.2)
    ev = s.scrub(BASE_TOOLS.scrubpad, cx, cy, 0.5)
    expect(s.cleanliness).toBe(0)
    expect(ev.find((e) => e.kind === 'noeffect')).toMatchObject({ reason: 'wrong_cleaner' })
    expect(s.triesOn('grease')).toBe(3) // vacuum, scrubpad, glass (scrubpad 재시도는 같은 id)
    // 4) 기름때 제거제 + 수세미: 통함 + 발견 이벤트
    s.spray(BASE_DETERGENTS.degreaser, cx, cy, 0.2)
    ev = s.scrub(BASE_TOOLS.scrubpad, cx, cy, 0.5)
    expect(s.cleanliness).toBeGreaterThan(0)
    expect(ev.find((e) => e.kind === 'discovered')).toMatchObject({ dirt: 'grease', tool: 'scrubpad', cleaner: 'degreaser' })
    expect(s.discovered.has('grease|scrubpad|degreaser')).toBe(true)
    expect(s.engaged).toBe(true)
  })

  it('recipes respect the surface: no degreaser on wood, fabric stains need fabric cleaner', () => {
    expect(matchRecipe('grease', 'steel', BASE_TOOLS.scrubpad, 'degreaser')).not.toBeNull()
    expect(matchRecipe('grease', 'wood', BASE_TOOLS.scrubpad, 'degreaser')).toBeNull()
    expect(matchRecipe('grease', 'wood', BASE_TOOLS.cloth, 'allpurpose')).not.toBeNull()
    expect(matchRecipe('stain', 'fabric', BASE_TOOLS.sponge, 'allpurpose')).toBeNull()
    expect(matchRecipe('stain', 'fabric', BASE_TOOLS.sponge, 'fabric')).not.toBeNull()
    expect(matchRecipe('film', 'glass', BASE_TOOLS.cloth, null)).toBeNull() // 유리 지문은 그냥 걸레로는 번짐
    expect(matchRecipe('film', 'glass', BASE_TOOLS.squeegee, 'glass')!.speed).toBeGreaterThan(1)
    expect(diagnose('hair', 'wood', BASE_TOOLS.lintroller, null)).toBe('wrong_surface') // 돌돌이는 패브릭에서만
    expect(diagnose('mold', 'tile', BASE_TOOLS.tilebrush, null)).toBe('need_cleaner')
    // 프리미엄: 스팀은 세정제 없이 기름때, 전동 스크러버는 스펀지·수세미·타일솔 군을 겸함
    expect(matchRecipe('grease', 'steel', BASE_TOOLS.steamer, null)).not.toBeNull()
    expect(matchRecipe('scale', 'tile', BASE_TOOLS.scrubber, 'descaler')).not.toBeNull()
    expect(BASE_TOOLS.scrubber.power).toBeGreaterThan(BASE_TOOLS.tilebrush.power * 1.5)
  })

  it('mold remover dissolves mold by itself while it soaks', () => {
    const lv = LEVELS.find((l) => l.scene === 'bathtub')!
    const s = new CleanSession(lv)
    const best = densest(s, 'mold')
    const before = s.amount[best]
    s.spray(BASE_DETERGENTS.moldremover, (best % s.w) + 0.5, Math.floor(best / s.w) + 0.5, 0.2)
    for (let k = 0; k < 90; k++) s.tick(1 / 30) // 3초
    expect(s.amount[best]).toBeLessThan(before)
    expect(s.cleanliness).toBeGreaterThan(0)
  })

  it('worlds and areas: apartment(4) → house garden → car(2), 96 stages, 6 tiers getting stricter', () => {
    expect(WORLDS.map((w) => w.id)).toEqual(['apartment', 'house', 'car'])
    expect(WORLDS[0].areas.map((a) => a.id)).toEqual(['living', 'room', 'kitchen', 'bathroom'])
    expect(WORLDS[1].areas.map((a) => a.id)).toEqual(['garden'])
    expect(WORLDS[2].areas.map((a) => a.id)).toEqual(['exterior', 'interior'])
    expect(LEVELS).toHaveLength(96)
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].passClean).toBeGreaterThan(TIERS[i - 1].passClean)
      expect(TIERS[i].resistMul).toBeGreaterThan(TIERS[i - 1].resistMul)
      expect(TIERS[i].parFactor).toBeLessThan(TIERS[i - 1].parFactor)
    }
    expect(tierFor(1).id).toBe(1)
    expect(tierFor(13).id).toBe(2)
    expect(tierFor(96).id).toBe(6)
    expect(LEVELS[48].tier).toBe(5) // 정원 첫 판
    expect(LEVELS[72].tier).toBe(6) // 자동차 첫 판
    // 새 오염이 처음 나오는 판에는 맞는 아이템이 함께 지급된다 (봇이 통째로 검증)
    for (const id of [1, 3, 4, 25, 26, 37, 40, 49, 51, 73, 75, 76, 85]) expect(LEVELS[id - 1].grants.length, `level ${id} grants`).toBeGreaterThan(0)
  })

  it('stage modes: spots complete per target, rush keeps spawning until done, spread grows until treated, fragile ruins', () => {
    // 스팟: 표적이 있고, 표적 안을 다 지우면 spotdone → 전부 지우면 통과
    const spots = LEVELS.find((l) => l.mode === 'spots')!
    const sp = new CleanSession(spots)
    expect(sp.spots.length).toBeGreaterThanOrEqual(3)
    expect(sp.passed).toBe(false)
    const bot = simulateBot(spots)
    expect(bot.passed).toBe(true)
    // 러시: 시간이 지나면 오염이 생기고 총량이 늘어난다. 다 생기기 전엔 통과 불가
    const rush = LEVELS.find((l) => l.mode === 'rush')!
    const ru = new CleanSession(rush)
    const total0 = ru.initialTotal
    expect(ru.pendingSpawns).toBe(rush.spawn!.count)
    let spawned = 0
    for (let k = 0; k < 30 * (rush.spawn!.every * 3 + 1); k++) spawned += ru.tick(1 / 30).filter((e) => e.kind === 'spawned').length
    expect(spawned).toBeGreaterThanOrEqual(2)
    expect(ru.initialTotal).toBeGreaterThan(total0)
    expect(ru.pendingSpawns).toBeLessThan(rush.spawn!.count)
    ru.amount.fill(0)
    ru.under.fill(0)
    expect(ru.passed).toBe(false) // 아직 생길 오염이 남음
    // 번짐: 세정제 없이 두면 곰팡이가 는다
    const spread = LEVELS.find((l) => l.mode === 'spread')!
    const sr = new CleanSession(spread)
    const mold0 = sr.remainingOf(spread.growth!.type)
    for (let k = 0; k < 30 * 20; k++) sr.tick(1 / 30)
    expect(sr.remainingOf(spread.growth!.type)).toBeGreaterThan(mold0 * 1.05)
    expect(sr.remainingOf(spread.growth!.type)).toBeLessThanOrEqual(mold0 * spread.growth!.cap + 1)
    // 정밀: 손상 10% 면 ruined
    const fragile = LEVELS.find((l) => l.mode === 'fragile' && l.surface === 'wood')!
    const fr = new CleanSession(fragile)
    for (let k = 0; k < 60; k++) fr.scrub(BASE_TOOLS.scrubpad, 20, 20, 1 / 30)
    expect(fr.damage).toBeGreaterThanOrEqual(0.1)
    expect(fr.ruined).toBe(true)
    // 모든 모드가 섞여 있다
    const modes = new Set(LEVELS.map((l) => l.mode))
    expect([...modes].sort()).toEqual(['clean', 'dark', 'fragile', 'rush', 'spots', 'spread'])
    expect(new Set(LEVELS.map((l) => l.theme)).size).toBeGreaterThanOrEqual(25)
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

  it('layered dirt reveals the under layer when the top is wiped; clearing a kind fires typecleared', () => {
    const lv = LEVELS.find((l) => l.patches.some((p) => p.under))!
    const s = new CleanSession(lv)
    expect(s.hasLayers).toBe(true)
    const bot = simulateBot(lv)
    expect(bot.passed).toBe(true)
    // 직접: 아래층이 있는 칸을 찾아 윗층을 지움 (desk: stain over dust → allpurpose + cloth)
    let cell = -1
    for (let i = 0; i < s.under.length; i++) if (s.under[i] > 0 && s.amount[i] > 0) { cell = i; break }
    expect(cell).toBeGreaterThanOrEqual(0)
    const cx = (cell % s.w) + 0.5
    const cy = Math.floor(cell / s.w) + 0.5
    s.spray(BASE_DETERGENTS.allpurpose, cx, cy, 0.2)
    let revealed = false
    for (let k = 0; k < 600 && !revealed; k++) {
      revealed = s.scrub(BASE_TOOLS.cloth, cx, cy, 1 / 30).some((e) => e.kind === 'revealed')
      s.tick(1 / 30)
    }
    expect(revealed).toBe(true)
    // 한 종류만 있는 판에서 다 지우면 typecleared
    const one = new CleanSession(LEVELS[0])
    let fired = false
    for (let y = 0; y < one.h && !fired; y += 2) for (let x = 0; x < one.w && !fired; x += 2) fired = one.scrub(BASE_TOOLS.vacuum, x + 1, y + 1, 1).some((e) => e.kind === 'typecleared')
    expect(fired).toBe(true)
  })

  it('harms wrong surfaces, blocks restricted tools, flags hazardous mixes', () => {
    const glass = new CleanSession(LEVELS.find((l) => l.surface === 'glass' && !l.zones)!)
    const ev = glass.scrub(BASE_TOOLS.tilebrush, 10, 10, 0.5)
    expect(ev.some((e) => e.kind === 'harm')).toBe(true)
    expect(glass.damage).toBeGreaterThan(0)

    const floor = new CleanSession(LEVELS[0]) // 실내 원목
    expect(floor.canUse(BASE_TOOLS.washer)).toBe(false)
    expect(floor.canUse(BASE_TOOLS.hose)).toBe(false)
    expect(floor.scrub(BASE_TOOLS.washer, 10, 10, 0.1).some((e) => e.kind === 'blocked')).toBe(true)

    const tub = new CleanSession(LEVELS.find((l) => l.scene === 'bathtub')!)
    tub.limitSec = undefined
    tub.spray(BASE_DETERGENTS.moldremover, 20, 20, 0.1)
    const ev2 = tub.spray(BASE_DETERGENTS.descaler, 21, 20, 0.1)
    expect(ev2.some((e) => e.kind === 'hazard')).toBe(true)
    expect(isHazardMix('acid', 'chlorine')).toBe(true)
    expect(isHazardMix('alkaline', 'neutral')).toBe(false)
    // 헹구면 세정제가 씻겨 나가 위험 혼합이 생기지 않음
    const tub2 = new CleanSession(LEVELS.find((l) => l.scene === 'bathtub')!)
    tub2.spray(BASE_DETERGENTS.moldremover, 20, 20, 0.1)
    tub2.scrub(BASE_TOOLS.rinse, 20, 20, 0.2)
    expect(tub2.spray(BASE_DETERGENTS.descaler, 20, 20, 0.1).some((e) => e.kind === 'hazard')).toBe(false)
  })

  it('layering two cleaners makes a mixture: soda + dish soap cleans grease, soda + vinegar fizzes and neutralizes', () => {
    const stove = new CleanSession(LEVELS.find((l) => l.scene === 'stove')!)
    stove.limitSec = undefined
    // 기름때 칸 하나 고르기
    let cell = -1
    for (let i = 0; i < stove.w * stove.h && cell < 0; i++) if (stove.amount[i] > 0 && stove.dirtAt(i) === 'grease') cell = i
    expect(cell).toBeGreaterThanOrEqual(0)
    const cx = (cell % stove.w) + 0.5
    const cy = Math.floor(cell / stove.w) + 0.5
    expect(stove.spray(BASE_DETERGENTS.bakingsoda, cx, cy, 0.1).some((e) => e.kind === 'mixed')).toBe(false)
    const ev = stove.spray(BASE_DETERGENTS.dishsoap, cx, cy, 0.1)
    const mixed = ev.find((e) => e.kind === 'mixed')
    expect(mixed && mixed.kind === 'mixed' && mixed.mix).toBe('soapsoda')
    expect(mixed && mixed.kind === 'mixed' && mixed.neutralized).toBe(false)
    expect(stove.activeSoak(cell)?.family).toBe('soapsoda')
    // 같은 재료(주방세제·베이킹소다)를 더 뿌려도 페이스트는 그대로 — 쓸어 뿌리다 겹쳐도 깨지지 않는다
    stove.spray(BASE_DETERGENTS.dishsoap, cx, cy, 0.1)
    stove.spray(BASE_DETERGENTS.bakingsoda, cx, cy, 0.1)
    expect(stove.activeSoak(cell)?.family).toBe('soapsoda')
    // 혼합물 위에 세 번째 세제를 뿌리면 새 세제로 덮인다 (혼합물끼리 또 섞이지 않음)
    expect(stove.spray(BASE_DETERGENTS.vinegar, cx, cy, 0.1).some((e) => e.kind === 'mixed')).toBe(false)
    expect(stove.activeSoak(cell)?.family).toBe('vinegar')
    // 페이스트 + 수세미 = 기름때가 지워진다 (베이킹소다 단독보다 빠르게)
    const before = stove.remainingOf('grease')
    const paste = new CleanSession(LEVELS.find((l) => l.scene === 'stove')!)
    paste.limitSec = undefined
    paste.spray(BASE_DETERGENTS.bakingsoda, cx, cy, 0.1)
    paste.spray(BASE_DETERGENTS.dishsoap, cx, cy, 0.1)
    const evs = []
    for (let i = 0; i < 30; i++) evs.push(...paste.scrub(BASE_TOOLS.scrubpad, cx, cy, 1 / 30))
    expect(paste.remainingOf('grease')).toBeLessThan(before)
    expect(evs.some((e) => e.kind === 'discovered' && e.dirt === 'grease' && e.tool === 'scrubpad' && e.cleaner === 'soapsoda')).toBe(true)

    // 베이킹소다 + 식초 → 거품(중화): 그 자리는 세정력 0, 위험 경고는 아니다
    const fizz = new CleanSession(LEVELS.find((l) => l.scene === 'stove')!)
    fizz.limitSec = undefined
    fizz.spray(BASE_DETERGENTS.bakingsoda, cx, cy, 0.1)
    const ev2 = fizz.spray(BASE_DETERGENTS.vinegar, cx, cy, 0.1)
    const fz = ev2.find((e) => e.kind === 'mixed')
    expect(fz && fz.kind === 'mixed' && fz.neutralized).toBe(true)
    expect(ev2.some((e) => e.kind === 'hazard')).toBe(false)
    expect(fizz.activeSoak(cell)?.family).toBe('fizz')
    const g0 = fizz.remainingOf('grease')
    for (let i = 0; i < 30; i++) fizz.scrub(BASE_TOOLS.scrubpad, cx, cy, 1 / 30)
    expect(fizz.remainingOf('grease')).toBe(g0)
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
    const huge: SponsorProduct = { ...p, lab: [{ dirt: 'grease', removalPct: 100 }], base: 'allpurpose' }
    expect(performanceRatios(huge).grease).toBe(1.8) // 100/35 = 2.86 → 상한 1.8
    expect(performanceRatios({ ...huge, lab: [{ dirt: 'grease', removalPct: 100 }], base: 'tilebrush', kind: 'tool' }).grease).toBe(1) // 기준 없음
  })

  it('converts to item specs that keep label cautions, chemistry and recipe family', () => {
    const det = toItemSpec(SAMPLE_SPONSORS[0])
    expect(det.kind).toBe('detergent')
    if (det.kind === 'detergent') {
      expect(det.mult.grease).toBeCloseTo(92 / 80, 2)
      expect(det.mult.scale).toBe(1)
      expect(det.family).toBe('degreaser')
      expect(det.harms).toEqual(expect.arrayContaining(['wood', 'paint']))
      expect(det.id).toBe('sp:brightmax-degreaser')
    }
    const tool = toItemSpec(SAMPLE_SPONSORS[1])
    if (tool.kind === 'tool') {
      expect(tool.radius).toBeCloseTo(BASE_TOOLS.washer.radius * Math.sqrt(7.5 / 6), 2)
      expect(tool.effect.mud).toBeCloseTo(BASE_TOOLS.washer.effect.mud * (96 / 92), 2)
      expect(tool.families).toEqual(BASE_TOOLS.washer.families)
      expect(tool.harms).toContain('glass')
    }
  })

  it('a better-tested sponsor product really cleans faster in the same recipe', () => {
    const lv = LEVELS.find((l) => l.scene === 'stove')!
    const generic = new CleanSession(lv)
    const branded = new CleanSession(lv)
    const sp = toItemSpec(SAMPLE_SPONSORS[0])
    const best = densest(generic, 'grease')
    const cx = (best % generic.w) + 0.5
    const cy = Math.floor(best / generic.w) + 0.5
    generic.spray(BASE_DETERGENTS.degreaser, cx, cy, 0.2)
    if (sp.kind === 'detergent') branded.spray(sp, cx, cy, 0.2)
    for (let k = 0; k < 15; k++) {
      generic.scrub(BASE_TOOLS.scrubpad, cx, cy, 1 / 30)
      branded.scrub(BASE_TOOLS.scrubpad, cx, cy, 1 / 30)
    }
    expect(branded.cleanliness).toBeGreaterThan(generic.cleanliness)
  })

  it('refuses sponsors without evidence, outside campaign, with bad values or a premium base', () => {
    const p = SAMPLE_SPONSORS[0]
    expect(validateSponsor(p, today)).toEqual([])
    expect(validateSponsor({ ...p, evidence: undefined }, today)).toContain('no_evidence')
    expect(validateSponsor(p, '2030-01-01')).toContain('campaign_inactive')
    expect(validateSponsor({ ...p, lab: [{ dirt: 'grease', removalPct: 140 }] }, today)).toContain('bad_lab_value')
    expect(validateSponsor({ ...p, lab: [] }, today)).toContain('no_lab_results')
    expect(validateSponsor({ ...p, base: 'cloth' }, today)).toContain('kind_mismatch')
    expect(validateSponsor({ ...p, base: 'heavydegreaser' }, today)).toContain('kind_mismatch')
  })
})
