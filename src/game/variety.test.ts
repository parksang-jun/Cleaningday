import { describe, expect, it } from 'vitest'
import { BASE_DETERGENTS, BASE_TOOLS, DIRT_SURFACES, DIRT_TYPES, LEAVES_UNDER } from './catalog'
import { simulateBot } from './bot'
import { BLOT_FAST, CleanSession } from './engine'
import { grantsUpTo, LEVELS } from './levels'

const DT = 1 / 30
const levelWith = (d: string) => LEVELS.find((l) => l.patches.some((p) => p.type === d))!
function cellOf(s: CleanSession, d: string): number {
  let best = -1
  for (let i = 0; i < s.amount.length; i++) if (s.amount[i] > 0.3 && s.dirtAt(i) === d && (best < 0 || s.amount[i] > s.amount[best])) best = i
  return best
}
const xy = (s: CleanSession, i: number): [number, number] => [(i % s.w) + 0.5, Math.floor(i / s.w) + 0.5]
const totalOf = (s: CleanSession, d: string) => { let n = 0; for (let i = 0; i < s.amount.length; i++) if (s.amount[i] > 0 && s.dirtAt(i) === d) n += s.amount[i]; return n }

describe('닦는 방법이 다른 오염', () => {
  it('새 오염 5종이 실제 판에 나오고, 그 판은 지급된 기본 도구로 깰 수 있다', () => {
    for (const d of ['crumbs', 'spill', 'sticker', 'crayon']) {
      const lv = levelWith(d)
      expect(lv, d).toBeTruthy()
      const bot = simulateBot(lv)
      expect(bot.stuck, `${d} @${lv.id}`).toBeUndefined()
      expect(bot.passed, `${d} @${lv.id}`).toBe(true)
    }
    // 끈끈이는 스티커 밑에만 깔린다
    expect(LEVELS.some((l) => l.patches.some((p) => p.type === 'glue'))).toBe(false)
    expect(LEVELS.some((l) => l.patches.some((p) => p.type === 'sticker' && p.under === 'glue' && p.underChance === 1))).toBe(true)
    expect(LEAVES_UNDER.spill).toBe('stain')
    // 번호는 뒤에만 붙인다 (저장·격자가 순서를 쓴다)
    expect(DIRT_TYPES.slice(0, 12)).toEqual(['dust', 'hair', 'mud', 'grease', 'stain', 'scale', 'soap', 'mold', 'moss', 'iron', 'tar', 'film'])
  })

  it('부스러기: 걸레로 닦으면 지워지지 않고 밀려나기만 한다 — 청소기는 빨아들인다', () => {
    const lv = levelWith('crumbs')
    const s = new CleanSession(lv, undefined, lv.seed, { mess: false })
    const c = cellOf(s, 'crumbs')
    const [cx, cy] = xy(s, c)
    const before = totalOf(s, 'crumbs')
    const here = s.amount[c]
    const events = []
    for (let k = 0; k < 40; k++) { events.push(...s.scrub(BASE_TOOLS.cloth, cx + k * 0.05, cy, DT)); s.tick(DT) }
    expect(totalOf(s, 'crumbs')).toBeCloseTo(before, 3) // 총량은 그대로
    expect(s.amount[c]).toBeLessThan(here) // 그 자리에서는 밀려났다
    expect(events.some((e) => e.kind === 'noeffect' && e.reason === 'pushed')).toBe(true)
    const s2 = new CleanSession(lv, undefined, lv.seed, { mess: false })
    for (let k = 0; k < 40; k++) { s2.scrub(BASE_TOOLS.vacuum, cx, cy, DT); s2.tick(DT) }
    expect(totalOf(s2, 'crumbs')).toBeLessThan(before - 0.5)
  })

  it('쏟은 음료: 꾹 누르면 흡수되고, 빠르게 문지르면 거의 안 닦이고 번진다. 걷어내면 얼룩이 남는다', () => {
    const lv = levelWith('spill')
    const mk = () => new CleanSession(lv, undefined, lv.seed, { mess: false })
    const s = mk()
    const c = cellOf(s, 'spill')
    const [cx, cy] = xy(s, c)
    const before = totalOf(s, 'spill')
    // 누르기 (제자리)
    let revealed = false
    for (let k = 0; k < 90; k++) { revealed = s.scrub(BASE_TOOLS.cloth, cx, cy, DT).some((e) => e.kind === 'revealed') || revealed; s.tick(DT) }
    const held = before - totalOf(s, 'spill')
    expect(held).toBeGreaterThan(1)
    expect(revealed).toBe(true)
    expect(s.dirtAt(c)).toBe('stain')
    // 문지르기 (좌우로 빠르게)
    const r = mk()
    const events = []
    for (let k = 0; k < 90; k++) { const x = cx + Math.sin(k * 0.9) * 2.5; events.push(...r.scrub(BASE_TOOLS.cloth, x, cy, DT)); r.tick(DT) }
    expect(r.strokeSpeed).toBeGreaterThan(BLOT_FAST)
    const rubbed = before - totalOf(r, 'spill')
    expect(rubbed).toBeLessThan(held * 0.4)
    expect(events.some((e) => e.kind === 'noeffect' && e.reason === 'smeared')).toBe(true)
  })

  it('스티커: 긁개로 떼면 끈끈이가 남고, 끈끈이는 식용유를 뿌려야 닦인다', () => {
    const lv = levelWith('sticker')
    expect(grantsUpTo(lv.id)).toEqual(expect.arrayContaining(['scraper', 'cookingoil']))
    const s = new CleanSession(lv, undefined, lv.seed, { mess: false })
    const c = cellOf(s, 'sticker')
    const [cx, cy] = xy(s, c)
    for (let k = 0; k < 300 && s.dirtAt(c) === 'sticker'; k++) { s.scrub(BASE_TOOLS.scraper, cx, cy, DT); s.tick(DT) }
    expect(s.dirtAt(c)).toBe('glue')
    const glue = s.amount[c]
    for (let k = 0; k < 60; k++) { s.scrub(BASE_TOOLS.cloth, cx, cy, DT); s.tick(DT) }
    expect(s.amount[c]).toBeCloseTo(glue, 3) // 마른 걸레로는 그대로
    s.spray(BASE_DETERGENTS.cookingoil, cx, cy, 0.3)
    for (let k = 0; k < 300 && s.amount[c] > 0; k++) { s.scrub(BASE_TOOLS.cloth, cx, cy, DT); s.tick(DT) }
    expect(s.amount[c]).toBe(0)
  })

  it('낙서: 베이킹소다를 묻혀야 지워진다', () => {
    const lv = levelWith('crayon')
    expect(grantsUpTo(lv.id)).toContain('bakingsoda')
    const s = new CleanSession(lv, undefined, lv.seed, { mess: false })
    const c = cellOf(s, 'crayon')
    const [cx, cy] = xy(s, c)
    const a = s.amount[c]
    for (let k = 0; k < 60; k++) { s.scrub(BASE_TOOLS.cloth, cx, cy, DT); s.tick(DT) }
    expect(s.amount[c]).toBeCloseTo(a, 3)
    s.spray(BASE_DETERGENTS.bakingsoda, cx, cy, 0.3)
    for (let k = 0; k < 400 && s.dirtAt(c) === 'crayon' && s.amount[c] > 0; k++) { s.scrub(BASE_TOOLS.cloth, cx, cy, DT); s.tick(DT) }
    expect(s.amount[c] === 0 || s.dirtAt(c) !== 'crayon').toBe(true)
  })

  it('새 오염은 놓일 수 있는 표면이 있고, 그 표면마다 기본 도구 레시피가 있다', () => {
    for (const d of ['crumbs', 'spill', 'sticker', 'glue', 'crayon'] as const) expect(DIRT_SURFACES[d].length).toBeGreaterThan(3)
  })
})

describe('겉에 드러난 오염', () => {
  it('surfaceKinds 는 밑에 깔린 층을 빼고 지금 보이는 오염만 돌려준다', async () => {
    const { CleanSession } = await import('./engine')
    const { LEVELS } = await import('./levels')
    const lv = LEVELS.find((l) => l.patches.some((p) => p.under))!
    const s = new CleanSession(lv)
    const top = new Set<string>()
    s.amount.forEach((a, i) => a > 0 && top.add(s.dirtAt(i)))
    expect(new Set(s.surfaceKinds)).toEqual(top)
    expect(s.surfaceKinds.length).toBeLessThanOrEqual(s.dirtKinds.length)
  })
})
