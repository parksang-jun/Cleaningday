// 힌트로 알려 줄 조합 고르기 — 수첩 힌트·오염 스캔·실패 팁이 모두 이것을 쓴다.
// 알려 준 대로 하면 반드시 닦여야 한다:
//  · 그 오염이 실제로 묻어 있는 표면을 기준으로 고른다(구역 판은 구역마다 표면이 다르다. 밑에 깔린 층도 센다)
//  · 이 판에서 쓸 수 있는 도구만(실외 전용 등 제외), 도구 막대에 있는 것을 먼저
//  · 그 표면을 상하게 하는 도구·세제는 피한다(다른 방법이 없을 때만)
import { DIRT_TYPES, recipesFor, type CleanerFamily, type DetergentSpec, type DirtType, type SurfaceType, type ToolFamily, type ToolSpec } from './catalog'
import type { CleanSession } from './engine'

export interface HintPick {
  tool: ToolFamily
  cleaner: CleanerFamily | null
  /** 실제로 고른 아이템 */
  toolId: string
  cleanerId: string | null
  /** 이 조합이 통하는 표면 */
  surface: SurfaceType
  /** 그 표면을 상하게 하는가(피할 수 없었을 때만 true) */
  harmful: boolean
}

/** 그 오염이 묻어 있는 표면들(칸 수 많은 순). 겉에 드러난 것과 밑에 깔린 것을 모두 센다 */
export function surfacesOf(session: CleanSession, d: DirtType): SurfaceType[] {
  const k = DIRT_TYPES.indexOf(d)
  const count = new Map<SurfaceType, number>()
  for (let i = 0; i < session.amount.length; i++) {
    const top = session.amount[i] > 0 && session.type[i] === k
    const under = session.under[i] > 0 && session.underType[i] === k
    if (top || under) {
      const sf = session.surfaceAt(i)
      count.set(sf, (count.get(sf) ?? 0) + 1)
    }
  }
  const list = [...count].sort((a, b) => b[1] - a[1]).map(([sf]) => sf)
  return list.length ? list : [session.level.surface]
}

export interface HintItems {
  tools: ToolSpec[]
  dets: DetergentSpec[]
  /** 세정제군을 섞어서 만들 수 있는가(섞는 레시피) */
  canMix?: (family: CleanerFamily) => boolean
  /** 도구 막대에 올라와 있는 아이템 — 있으면 이것으로 되는 조합을 먼저 고른다 */
  kit?: ReadonlySet<string>
}

/** 오염 d 에 대해 알려 줄 조합. 가능한 조합이 없으면 null */
export function pickHint(session: CleanSession, d: DirtType, items: HintItems, surface: SurfaceType = surfacesOf(session, d)[0]): HintPick | null {
  const tools = items.tools.filter((t) => !t.premium && session.canUse(t))
  const dets = items.dets.filter((c) => !c.premium)
  let best: (HintPick & { score: number }) | null = null
  for (const r of recipesFor(d, surface)) {
    for (const tool of tools) {
      const fam = r.tools.find((f) => tool.families.includes(f))
      if (!fam) continue
      const cands: (DetergentSpec | null)[] = r.cleaner ? dets.filter((c) => c.family === r.cleaner) : [null]
      if (r.cleaner && !cands.length && items.canMix?.(r.cleaner)) cands.push(null)
      for (const det of cands) {
        const harmful = tool.harms.includes(surface) || Boolean(det && det.harms.includes(surface))
        const inKit = !items.kit || (items.kit.has(tool.id) && (!det || items.kit.has(det.id)))
        // 안전한 것 ≫ 세제 하나로 되는 것 ≫ 도구 막대에 있는 것 ≫ 빠른 것
        // 두 세제를 섞어야 하는 조합은 따라 하기 어렵다 — 세제 하나로 되는 방법이 없을 때만 알려 준다
        const mixed = Boolean(r.cleaner && !det)
        const score = (harmful ? 0 : 100) + (mixed ? 0 : 30) + (inKit ? 10 : 0) + r.speed
        if (!best || score > best.score) best = { tool: fam, cleaner: r.cleaner ?? null, toolId: tool.id, cleanerId: det ? det.id : null, surface, harmful, score }
      }
    }
  }
  if (!best) return null
  const { score: _score, ...pick } = best
  return pick
}

/** 그 오염이 여러 표면에 걸쳐 있고 표면마다 방법이 다르면, 표면별 조합을 모두 돌려준다(같은 조합은 한 번만) */
export function pickHints(session: CleanSession, d: DirtType, items: HintItems): HintPick[] {
  const out: HintPick[] = []
  for (const sf of surfacesOf(session, d)) {
    const h = pickHint(session, d, items, sf)
    if (h && !out.some((o) => o.toolId === h.toolId && o.cleanerId === h.cleanerId)) out.push(h)
  }
  return out
}
