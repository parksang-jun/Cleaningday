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
