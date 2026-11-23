import { describe, expect, it } from 'vitest'
import { kitFor } from './bot'
import { BASE_DETERGENTS, BASE_TOOLS, BLOT_DIRT, DIRT_TYPES, type DetergentSpec, type DirtType, type ToolSpec } from './catalog'
import { CleanSession } from './engine'
import { pickHint } from './hints'
import { LEVELS } from './levels'

const DT = 1 / 30
const toolOf = (id: string) => (BASE_TOOLS as Record<string, ToolSpec>)[id]
const detOf = (id: string) => (BASE_DETERGENTS as Record<string, DetergentSpec>)[id]

/** 겉에 d 가 드러난 칸 몇 개에서, 힌트대로(그 칸 표면의 조합으로) 뿌리고 문질러 본다 → 그 칸들에 남은 d 의 비율 */
function followHint(levelId: number, d: DirtType): { left: number; note: string } {
  const level = LEVELS.find((l) => l.id === levelId)!
  const s = new CleanSession(level)
  const kit = kitFor(level)
  const k = DIRT_TYPES.indexOf(d)
  const cells: number[] = []
  for (let i = 0; i < s.amount.length && cells.length < 12; i += 7) if (s.amount[i] > 0.3 && s.type[i] === k) cells.push(i)
  if (!cells.length) return { left: 0, note: 'hidden' }
  let before = 0
  let after = 0
  let note = ''
  for (const i of cells) {
    const h = pickHint(s, d, kit, s.surfaceAt(i))
    if (!h) return { left: 1, note: `no hint on ${s.surfaceAt(i)}` }
    note = `${h.cleanerId ?? '-'}+${h.toolId}${h.harmful ? ' (harmful)' : ''}`
    const x = (i % s.w) + 0.5
    const y = Math.floor(i / s.w) + 0.5
    before += s.amount[i]
    const det = h.cleanerId ? detOf(h.cleanerId) : null
    const tool = toolOf(h.toolId)
    if (det) {
      if (s.budgetOf(det) < 1) s.refill(det, 5) // 세제 양은 따로 본다 — 여기서는 조합이 통하는지만
      for (let n = 0; n < 10; n++) { s.spray(det, x, y, DT); s.tick(DT) }
    }
    // 12초까지: 눌러 흡수하는 오염은 천천히, 나머지는 작은 원을 그리며
    const slow = BLOT_DIRT.includes(d)
    for (let n = 0; n < 360 && s.amount[i] > 0 && s.type[i] === k; n++) {
      const a = n * (slow ? 0.02 : 0.5)
      s.scrub(tool, x + Math.cos(a) * (slow ? 0.3 : 0.8), y + Math.sin(a) * (slow ? 0.3 : 0.8), DT)
      s.tick(DT)
      if (det && n % 150 === 149) for (let m = 0; m < 6; m++) s.spray(det, x, y, DT)
    }
    after += s.type[i] === k ? s.amount[i] : 0
  }
  return { left: after / before, note }
}

describe('힌트대로 하면 닦인다', () => {
  it('모든 판의 모든 오염: 힌트가 있고, 그대로 하면 그 자리가 닦인다', () => {
    const bad: string[] = []
    for (const level of LEVELS) {
      const s = new CleanSession(level)
      for (const d of s.dirtKinds) {
        const r = followHint(level.id, d)
        if (r.left > 0.15) bad.push(`#${level.id} ${level.scene} ${d}: ${r.note} → ${(r.left * 100).toFixed(0)}% 남음`)
      }
    }
    expect(bad).toEqual([])
  })

  it('표면을 상하게 하는 조합은, 안전한 조합이 있으면 알려 주지 않는다', () => {
    const bad: string[] = []
    for (const level of LEVELS) {
      const s = new CleanSession(level)
      const kit = kitFor(level)
      for (const d of s.dirtKinds) {
        const h = pickHint(s, d, kit)
        if (h?.harmful) bad.push(`#${level.id} ${level.scene}(${h.surface}) ${d}: ${h.cleanerId ?? '-'}+${h.toolId}`)
      }
    }
    expect(bad).toEqual([])
  })
})
