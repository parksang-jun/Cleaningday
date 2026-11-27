import { describe, expect, it } from 'vitest'
import { BASE_DETERGENTS, BASE_TOOLS, DIRT_TYPES, matchRecipe, type CleanerFamily, type DirtType, type SurfaceType, type ToolId } from './catalog'

/** 제보(2026-11-24): 도구를 다채롭게 쓸 일이 없다(스퀴지 등) — 그 일에 맞는 도구가 범용 도구보다 뚜렷이 빨라야 한다 */
const rate = (d: DirtType, sf: SurfaceType, tool: ToolId, c: CleanerFamily) => {
  const t = BASE_TOOLS[tool]
  const r = matchRecipe(d, sf, t, c)
  return r ? r.speed * t.power : 0
}
const CASES: [DirtType, SurfaceType, CleanerFamily, ToolId, ToolId][] = [
  ['film', 'glass', 'glass', 'squeegee', 'cloth'],
  ['stain', 'glass', 'glass', 'squeegee', 'cloth'],
  ['scale', 'glass', 'descaler', 'squeegee', 'sponge'],
  ['soap', 'glass', 'bathroom', 'squeegee', 'sponge'],
  ['mold', 'tile', 'mold', 'tilebrush', 'sponge'],
  ['soap', 'tile', 'bathroom', 'tilebrush', 'sponge'],
  ['scale', 'tile', 'descaler', 'tilebrush', 'sponge'],
  ['grease', 'steel', 'degreaser', 'scrubpad', 'sponge'],
  ['moss', 'wood', 'moss', 'deckbrush', 'tilebrush'],
  ['iron', 'metal', 'wheel', 'wheelbrush', 'sponge'],
]
describe('전용 도구', () => {
  it.each(CASES)('%s on %s (%s): %s 가 %s 보다 30% 이상 빠르다', (d, sf, c, best, plain) => {
    expect(rate(d, sf, plain, c)).toBeGreaterThan(0) // 범용 도구로도 닦이기는 한다
    expect(rate(d, sf, best, c)).toBeGreaterThanOrEqual(rate(d, sf, plain, c) * 1.3)
  })
})

/** 제보(2026-11-27): 닦아야 할 곳이 잘 안 닦인다 — 붓 가장자리도 충분히 닦이고, 보이지 않는 찌꺼기가 남지 않는다 */
import { CleanSession, BRUSH_EDGE, CLEAR_BELOW, WIPE_FEEL } from './engine'
import { LEVELS } from './levels'
describe('닦이는 손맛', () => {
  it('붓 가장자리 칸도 중심의 70% 이상 속도로 닦인다', () => {
    const lv = LEVELS[0]
    const s = new CleanSession(lv, undefined, lv.seed, { mess: false })
    const t = BASE_TOOLS.cloth
    const cx = Math.floor(s.w / 2) + 0.5
    const cy = Math.floor(s.h / 2) + 0.5
    const edge = Math.floor(cy) * s.w + Math.floor(cx + t.radius - 0.6)
    const mid = Math.floor(cy) * s.w + Math.floor(cx)
    for (const i of [edge, mid]) {
      s.amount[i] = 1
      s.type[i] = 0 // 먼지
    }
    s.scrub(t, cx, cy, 0.01)
    expect((1 - s.amount[edge]) / (1 - s.amount[mid])).toBeGreaterThan(0.7)
    expect(BRUSH_EDGE).toBeGreaterThanOrEqual(0.7)
    expect(WIPE_FEEL).toBeGreaterThanOrEqual(1.25)
  })
  it('눈에 안 보이는 옅은 찌꺼기는 남지 않는다', () => {
    const lv = LEVELS[0]
    const s = new CleanSession(lv, undefined, lv.seed, { mess: false })
    const i = Math.floor(s.h / 2) * s.w + Math.floor(s.w / 2)
    s.amount[i] = CLEAR_BELOW + 0.01
    s.type[i] = 0
    s.scrub(BASE_TOOLS.cloth, (i % s.w) + 0.5, Math.floor(i / s.w) + 0.5, 0.02)
    expect(s.amount[i]).toBe(0)
    expect(CLEAR_BELOW).toBeGreaterThanOrEqual(0.05)
  })
  // 자체 점검(2026-11-27): 뿌려 두면 저절로 녹는 세제(곰팡이 제거제 등)는 옛 기준 0.02 까지만 지워서,
  // 불림이 끝난 자리에 화면에는 안 그려지는(0.03 이하) 찌꺼기가 진행률만 깎으며 남았다
  it('뿌려서 녹인 자리에도 안 보이는 찌꺼기가 남지 않는다', () => {
    const lv = LEVELS[0]
    const dissolving = Object.values(BASE_DETERGENTS).filter((d) => d.dissolves)
    expect(dissolving.length).toBeGreaterThan(0)
    for (const det of dissolving) {
      for (const [dirt, rate] of Object.entries(det.dissolves!)) {
        const melts = (rate * det.soakSec) / lv.resistMul // 한 번 뿌려 불리는 동안 녹는 양
        for (const leftover of [0.021, 0.03, 0.045]) {
          const s = new CleanSession(lv, undefined, lv.seed, { mess: false })
          s.clearAll()
          const i = Math.floor(s.h / 2) * s.w + Math.floor(s.w / 2)
          s.amount[i] = Math.min(1, melts + leftover)
          s.type[i] = DIRT_TYPES.indexOf(dirt as DirtType)
          s.spray(det, (i % s.w) + 0.5, Math.floor(i / s.w) + 0.5, 0.1)
          for (let t = 0; t < det.soakSec + 1; t += 0.05) s.tick(0.05)
          expect(s.amount[i] === 0 || s.amount[i] >= CLEAR_BELOW, `${det.id} 로 녹인 ${dirt}: 남은 농도 ${s.amount[i].toFixed(3)}`).toBe(true)
        }
      }
    }
  })
  // 자체 점검(2026-11-27 2회차): 쏟은 음료를 빠르게 문지르면 번지고, 부스러기를 걸레로 밀면 밀려나는데,
  // 한 프레임에 옮겨 가는 양(번짐 약 0.023)이 화면에 그려지는 농도보다 작아 옆 칸에 안 보이는 찌꺼기가 쌓였다
  // (수정 전: 3초 문지르면 음료 7~16칸, 부스러기 1~6칸). 남은 오염 고리(0.05 초과만)로도 못 찾는다
  it.each([
    ['spill', 1 / 30], ['spill', 1 / 60], ['spill', 1 / 120],
    ['crumbs', 1 / 30], ['crumbs', 1 / 60], ['crumbs', 1 / 120],
  ] as const)('%s 를 빠르게 문질러 번지거나 밀려나도 안 보이는 찌꺼기가 생기지 않는다 (dt %f)', (d, dt) => {
    const lv = LEVELS.find((l) => l.patches.some((p) => p.type === d))!
    const s = new CleanSession(lv, undefined, lv.seed, { mess: false })
    const faint = () => { let n = 0; for (let i = 0; i < s.amount.length; i++) if (s.amount[i] > 0 && s.amount[i] < CLEAR_BELOW) n++; return n }
    expect(faint()).toBe(0)
    let c = -1
    for (let i = 0; i < s.amount.length; i++) if (s.amount[i] > 0.3 && s.dirtAt(i) === d) { c = i; break }
    expect(c).toBeGreaterThanOrEqual(0)
    const cx = (c % s.w) + 0.5
    const cy = Math.floor(c / s.w) + 0.5
    let moved = false
    for (let k = 0; k < Math.round(3 / dt); k++) {
      const ev = s.scrub(BASE_TOOLS.cloth, cx + Math.sin(k * dt * 27) * 2.5, cy + Math.sin(k * dt * 5), dt)
      moved ||= ev.some((e) => e.kind === 'noeffect' && (e.reason === 'smeared' || e.reason === 'pushed'))
      s.tick(dt)
    }
    expect(moved).toBe(true) // 실제로 번짐·밀려남이 일어난 상황에서
    expect(faint()).toBe(0)
  })
})
