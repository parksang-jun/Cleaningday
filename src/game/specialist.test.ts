import { describe, expect, it } from 'vitest'
import { BASE_TOOLS, matchRecipe, type CleanerFamily, type DirtType, type SurfaceType, type ToolId } from './catalog'

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
})
