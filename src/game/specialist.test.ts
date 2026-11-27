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
})

/** 제보(2026-11-27): 스팀 청소기가 어디서나 제일 좋아서 다른 도구를 쓸 이유가 없다 — 단단한 표면 전용으로 */
describe('스팀 청소기는 단단한 표면 전용', () => {
  const st = BASE_TOOLS.steamer
  it('타일·스테인리스의 기름때·곰팡이·비누때는 세정제 없이 닦는다', () => {
    expect(matchRecipe('grease', 'steel', st, null)).toBeTruthy()
    expect(matchRecipe('mold', 'tile', st, null)).toBeTruthy()
    expect(matchRecipe('soap', 'tile', st, null)).toBeTruthy()
  })
  it('나무·페인트·비닐·플라스틱·천에서는 통하지 않고 표면을 상하게 한다', () => {
    for (const sf of ['wood', 'paint', 'vinyl', 'plastic', 'fabric'] as SurfaceType[]) {
      expect(st.harms).toContain(sf)
      expect(matchRecipe('stain', sf, st, null)).toBeFalsy()
      expect(matchRecipe('grease', sf, st, null)).toBeFalsy()
    }
  })
  it('먼지·엎지른 것은 못 치우고, 걸레 대신으로도 못 쓴다', () => {
    expect(matchRecipe('dust', 'tile', st, null)).toBeFalsy()
    expect(matchRecipe('spill', 'tile', st, null)).toBeFalsy()
    expect(st.families).toEqual(['steam'])
  })
})

/** 제보(2026-11-27): 스팀 청소기와 매직블럭만 있으면 다 닦인다 — 멜라민 스펀지도 제 자리에서만 */
describe('멜라민 스펀지는 무광 단단한 표면 전용', () => {
  const me = BASE_TOOLS.magiceraser
  it('타일의 얼룩·비누때·낙서는 세정제 없이 닦는다', () => {
    expect(matchRecipe('stain', 'tile', me, null)).toBeTruthy()
    expect(matchRecipe('soap', 'tile', me, null)).toBeTruthy()
    expect(matchRecipe('crayon', 'tile', me, null)).toBeTruthy()
  })
  it('광택·코팅 표면과 천에는 상하고, 일반 스펀지 대신으로는 못 쓴다', () => {
    for (const sf of ['paint', 'vinyl', 'glass', 'wood', 'fabric'] as SurfaceType[]) expect(me.harms).toContain(sf)
    expect(me.families).toEqual(['eraser'])
    expect(matchRecipe('grease', 'steel', me, 'degreaser')).toBeFalsy() // 스펀지 + 기름때 제거제 조합을 대신하지 못한다
  })
})

/** 제보(2026-11-27): 뒤로 갈수록 여러 오염이 섞여 여러 장비·세제를 쓰게 */
describe('뒤 구역일수록 오염이 다양하다', () => {
  const kinds = (id: number) => new Set(LEVELS[id - 1].patches.flatMap((p) => [p.type, ...(p.under ? [p.under] : [])])).size
  const kindsOf = (ids: number[]) => ids.reduce((n, id) => n + kinds(id), 0) / ids.length
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  it('정원 뒤 절반·차 외부·차 실내는 판마다 평균 3.5종 이상', () => {
    expect(kindsOf(range(61, 72))).toBeGreaterThanOrEqual(4)
    expect(kindsOf(range(73, 84))).toBeGreaterThanOrEqual(3.5)
    expect(kindsOf(range(85, 96))).toBeGreaterThanOrEqual(3.5)
  })
  it('마지막 대청소 판들은 6종 이상', () => {
    for (const id of [72, 84, 96]) expect(kinds(id)).toBeGreaterThanOrEqual(6)
  })
})
