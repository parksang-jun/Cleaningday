// 결재 보관함 — 처리 끝난 결재가 결재함에서 빠져 업무 분류별로 보관되는지 (2026-11-15 명령)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const html = readFileSync(resolve(root, 'ops/agent/mac/console/index.html'), 'utf8')
const src = html.match(/\/\*archive-model:start\*\/([\s\S]*?)\/\*archive-model:end\*\//)?.[1] ?? ''
const { AREAS, archiveModel } = new Function(`${src}; return { AREAS, archiveModel }`)() as {
  AREAS: string[]
  archiveModel: (list: unknown[], filter?: string) => { total: number; counts: { area: string; n: number }[]; groups: { area: string; items: { id: string; area: string; decisionLabel: string }[] }[]; filter: string }
}
const file = JSON.parse(readFileSync(resolve(root, 'ops/agent/state/approvals.json'), 'utf8')) as { items: Record<string, unknown>[] }

describe('approvals archive', () => {
  it('every request has one of the fixed work areas, and finished ones record what was decided, when, and the result', () => {
    expect(AREAS.length).toBeGreaterThan(3)
    for (const a of file.items) {
      expect(AREAS, `${a.id} area`).toContain(a.area)
      if (a.status === 'done') {
        expect(a.decision, `${a.id} decision`).toBeTruthy()
        expect(a.decided, `${a.id} decided`).toMatch(/^\d{4}-\d{2}-\d{2}/)
        expect(a.result, `${a.id} result`).toBeTruthy()
      }
    }
  })

  it('only finished requests are archived, grouped by work area with the newest first', () => {
    const list = [
      { id: 'a', status: 'open', area: '홍보' },
      { id: 'b', status: 'done', area: '홍보', decision: 'done', decided: '2026-11-13 10:00' },
      { id: 'c', status: 'done', area: '홍보', decision: 'x', decided: '2026-11-14 10:00', options: [{ id: 'x', label: '엑스 안' }] },
      { id: 'd', status: 'done', area: '없는 분류', decision: 'reject', decided: '2026-11-12 10:00' },
    ]
    const m = archiveModel(list)
    expect(m.total).toBe(3)
    expect(m.groups.map((g) => [g.area, g.items.map((i) => i.id)])).toEqual([['홍보', ['c', 'b']], ['운영·기타', ['d']]])
    expect(m.groups[0].items.map((i) => i.decisionLabel)).toEqual(['엑스 안', '완료'])
    expect(m.groups[1].items[0].decisionLabel).toBe('하지 않음')
    expect(m.counts).toEqual([{ area: '홍보', n: 2 }, { area: '운영·기타', n: 1 }])
  })

  it('filtering by a work area shows only that area; an unknown filter falls back to everything', () => {
    const list = file.items
    const all = archiveModel(list)
    const first = all.counts[0]
    const one = archiveModel(list, first.area)
    expect(one.groups).toHaveLength(1)
    expect(one.groups[0].items).toHaveLength(first.n)
    expect(archiveModel(list, '없는 분류').groups.length).toBe(all.groups.length)
  })

  it('the approvals inbox no longer lists finished requests; it links to the archive instead', () => {
    expect(html).not.toContain('처리 끝난 결재 <small>')
    expect(html).toContain('data-page="archive"')
    expect(html).toContain('data-page-go="archive"')
  })
})
