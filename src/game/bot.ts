// 기준 플레이어 봇 — 레시피(맞는 도구·세정제)를 모두 아는 "숙련자"가 플레이하는 시간을 재서 목표·제한시간의 기준으로 쓴다.
// 결정적(같은 입력 → 같은 결과)이라 모든 기기에서 같은 목표시간이 나온다.
import { BASE_DETERGENTS, BASE_TOOLS, DIRT_TYPES, isHazardMix, recipesFor, type DetergentSpec, type Recipe, type ToolSpec } from './catalog'
import { CleanSession, type Timing } from './engine'
import { grantsUpTo, type LevelDef } from './levels'

export interface BotResult {
  time: number
  passed: boolean
  hazard: boolean
  damage: number
  /** 못 지운 오염 (레시피·지급 설계 오류 탐지용) */
  stuck?: string
  stats?: { sprays: number; scrubSec: number; moveSec: number; waitSec: number; switches: number }
}

/** 스테이지 시작 시점에 플레이어가 보유한 기본 아이템 (프리미엄 제외) */
export function kitFor(level: LevelDef): { tools: ToolSpec[]; dets: DetergentSpec[] } {
  const owned = new Set(grantsUpTo(level.id))
  return {
    tools: Object.values(BASE_TOOLS).filter((t) => owned.has(t.id as never)),
    dets: Object.values(BASE_DETERGENTS).filter((d) => owned.has(d.id as never)),
  }
}

const DT = 1 / 30

interface Plan {
  tool: ToolSpec
  det: DetergentSpec | null
  recipe: Recipe
  score: number
}

/** 기본 지급품 + 프리미엄 전부 — "좋은 장비" 효과 측정용 */
export function premiumKitFor(level: LevelDef): { tools: ToolSpec[]; dets: DetergentSpec[] } {
  const base = kitFor(level)
  return {
    tools: [...base.tools, ...Object.values(BASE_TOOLS).filter((t) => t.premium)],
    dets: [...base.dets, ...Object.values(BASE_DETERGENTS).filter((d) => d.premium)],
  }
}

export function simulateBot(level: LevelDef, maxSec = 900, kit: { tools: ToolSpec[]; dets: DetergentSpec[] } = kitFor(level)): BotResult & { polish: number } {
  const s = new CleanSession(level)
  const { tools, dets } = kit
  const usable = tools.filter((t) => s.canUse(t))
  const rinse = tools.find((t) => t.families.includes('rinse') && !t.onlyOn) ?? tools.find((t) => t.families.includes('rinse'))

  // 한 번에 한 종류씩: 남은 양이 가장 많은 오염 종류를 골라 끝까지 (제품을 자주 바꾸지 않는 숙련자 습관)
  let campaign = -1
  let lastX = s.w / 2
  let lastY = s.h / 2
  let lastTool = ''
  let lastDet = ''
  let stuckGuard = 0
  let stuck: string | undefined
  const stats = { sprays: 0, scrubSec: 0, moveSec: 0, waitSec: 0, switches: 0 }
  while (!s.passed && s.time < maxSec) {
    const perType = new Float32Array(DIRT_TYPES.length)
    for (let i = 0; i < s.amount.length; i++) perType[s.type[i]] += s.amount[i]
    if (campaign < 0 || perType[campaign] < 0.5) {
      campaign = 0
      for (let k = 1; k < perType.length; k++) if (perType[k] > perType[campaign]) campaign = k
    }
    // 그 종류 중 가장 "가치 있는" 칸: 진하고 가까운 곳 (사람의 쓸기 동선에 가깝게)
    let best = -1
    let bestScore = 0
    for (let i = 0; i < s.amount.length; i++) {
      if (s.type[i] !== campaign || s.amount[i] < 0.05) continue
      const d = Math.hypot((i % s.w) + 0.5 - lastX, Math.floor(i / s.w) + 0.5 - lastY)
      const score = s.amount[i] / (1 + d * 0.08)
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) {
      campaign = -1
      // 남은 게 아주 옅은 칸뿐이면 그냥 가장 진한 칸
      for (let i = 0; i < s.amount.length; i++) if (s.amount[i] > bestScore) {
        bestScore = s.amount[i]
        best = i
      }
      if (best < 0) {
        // 러시: 아직 생길 오염이 있으면 기다림
        if (s.pendingSpawns > 0) {
          s.tick(0.5)
          stats.waitSec += 0.5
          continue
        }
        break
      }
    }
    const cx = (best % s.w) + 0.5
    const cy = Math.floor(best / s.w) + 0.5
    const dirt = s.dirtAt(best)
    const surface = s.surfaceAt(best)

    // 해로운 표면이 반경의 30% 이하만 걸치도록 중심을 살짝 옮길 수 있는지 (엔진의 손상 허용치와 같음)
    const safeCenterAt = (harms: string[], radius: number, cx: number, cy: number): [number, number] | null => {
      if (!harms.length) return [cx, cy]
      const harmFrac = (x0: number, y0: number) => {
        let cells = 0
        let bad = 0
        const r = Math.ceil(radius)
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const x = Math.floor(x0) + dx
            const y = Math.floor(y0) + dy
            if (x < 0 || x >= s.w || y < 0 || y >= s.h) continue
            if (Math.hypot(x + 0.5 - x0, y + 0.5 - y0) > radius) continue
            cells++
            if (harms.includes(s.surfaceAt(y * s.w + x))) bad++
          }
        }
        return cells ? bad / cells : 1
      }
      if (harmFrac(cx, cy) <= 0.22) return [cx, cy]
      const step = radius * 0.45
      let best: [number, number] | null = null
      let bestFrac = 1
      for (const [ox, oy] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, -step], [step, -step], [-step, step], [2 * step, 0], [-2 * step, 0], [0, 2 * step], [0, -2 * step]]) {
        const x0 = cx + ox
        const y0 = cy + oy
        if (Math.hypot(ox, oy) > radius * 0.85) continue // 목표 칸이 반경 안에 들어와야 함
        const f = harmFrac(x0, y0)
        if (f <= 0.22 && f < bestFrac) {
          bestFrac = f
          best = [x0, y0]
        }
      }
      return best
    }
    const safeCenter = (harms: string[], radius: number) => safeCenterAt(harms, radius, cx, cy)

    // 레시피 중 보유 도구(+세정제)로 가능한 것 — 세정제 없는 조합 우선, 그다음 속도
    let plan: (Plan & { tc: [number, number]; dc: [number, number] | null }) | null = null
    for (const recipe of recipesFor(dirt, surface)) {
      const toolCands = usable.filter((t) => recipe.tools.some((f) => t.families.includes(f)) && (!t.onlyOn || t.onlyOn.includes(surface)))
      for (const tool of toolCands) {
        const tc = safeCenter(tool.harms, tool.radius)
        if (!tc) continue
        let det: DetergentSpec | null = null
        let dc: [number, number] | null = null
        if (recipe.cleaner) {
          const detCands = dets.filter((d) => d.family === recipe.cleaner && s.budgetOf(d) > 0.3)
          for (const d of detCands) {
            dc = safeCenter(d.harms, d.radius)
            if (dc) {
              det = d
              break
            }
          }
          if (!det) continue
        }
        const score = tool.power * tool.radius * recipe.speed * (det ? 0.7 : 1) * (tool.id === lastTool ? 1.15 : 1)
        if (!plan || score > plan.score) plan = { tool, det, recipe, score, tc, dc }
      }
    }
    if (!plan) {
      // 보유 아이템으로는 못 지우는 오염 — 설계 오류. 그 칸을 포기하고 진행
      stuck = stuck ?? `${dirt} on ${surface} (level ${level.id})`
      s.amount[best] = 0
      if (++stuckGuard > 400) break
      continue
    }
    const { tool, det } = plan

    // 이동: 가까우면 거의 즉시, 멀면 거리 비례. 도구를 바꾸면 전환 시간
    const dist = Math.hypot(cx - lastX, cy - lastY)
    const mv = 0.03 + Math.min(1.2, dist * 0.012) + (lastTool !== tool.id ? 0.4 : 0)
    stats.moveSec += mv
    if (lastTool !== tool.id) stats.switches++
    s.tick(mv)
    lastX = cx
    lastY = cy
    lastTool = tool.id
    if (det && s.activeSoak(best)?.family !== det.family) {
      if (lastDet !== det.id) {
        s.tick(0.4)
        stats.moveSec += 0.4
        stats.switches++
      }
      lastDet = det.id
      // 반대 계열 세제가 남아 있으면 헹구거나 기다림
      let conflictUntil = -1
      s.soak.forEach((so, i) => {
        if (so && so.until > s.time && isHazardMix(so.det.chemistry, det.chemistry) && Math.hypot((i % s.w) + 0.5 - plan!.dc![0], Math.floor(i / s.w) + 0.5 - plan!.dc![1]) <= det.radius + 1) conflictUntil = Math.max(conflictUntil, so.until)
      })
      if (conflictUntil > 0) {
        if (rinse && s.canUse(rinse)) {
          for (let k = 0; k < 10; k++) {
            s.scrub(rinse, cx, cy, DT)
            s.tick(DT)
          }
          stats.waitSec += 10 * DT
        } else {
          stats.waitSec += conflictUntil - s.time + 0.1
          s.tick(conflictUntil - s.time + 0.1) // 이전 세제가 마를 때까지 기다림
        }
      }
      s.spray(det, plan.dc![0], plan.dc![1], 0.2)
      s.tick(0.25)
      stats.sprays++
      stats.moveSec += 0.25
    }
    // 한 칸을 작은 원을 그리며 문지르기 (아래층이 드러나면 계속). 2초 동안 전혀 줄지 않으면 포기
    const scrubAt = (i: number): boolean => {
      const ox = (i % s.w) + 0.5
      const oy = Math.floor(i / s.w) + 0.5
      const c = safeCenterAt(tool.harms, tool.radius * 1.3, ox, oy)
      if (!c) return true // 이 칸은 해로운 표면에 너무 가까움 — 건너뜀
      const [px, py] = c
      let t = 0
      const startClean = s.cleanliness
      const t0 = s.type[i]
      // 윗층이 벗겨져 다른 오염이 드러나면 멈춤 (그 오염은 제 도구로)
      while (t < 4 && s.amount[i] > 0.02 && s.type[i] === t0) {
        const ang = t * 9
        s.scrub(tool, px + Math.cos(ang) * tool.radius * 0.25, py + Math.sin(ang) * tool.radius * 0.25, DT)
        s.tick(DT)
        t += DT
        stats.scrubSec += DT
        if (t > 2 && s.cleanliness <= startClean + 1e-6) return false
      }
      lastX = ox
      lastY = oy
      return true
    }
    if (!scrubAt(best)) {
      stuck = stuck ?? `${dirt} on ${surface} with ${tool.id} (level ${level.id})`
      s.amount[best] = 0
      if (++stuckGuard > 400) return { time: s.time, passed: false, hazard: s.hazard, damage: s.damage, stuck, polish: s.polish }
      continue
    }
    // 세정제를 뿌렸으면 그 범위 안의 같은 오염을 마르기 전에 다 닦는다 (숙련자의 "뿌리고 쓸기")
    if (det) {
      const r = det.radius
      const cells: number[] = []
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          const x = Math.floor(cx) + dx
          const y = Math.floor(cy) + dy
          if (x < 0 || x >= s.w || y < 0 || y >= s.h || dx * dx + dy * dy > r * r) continue
          const i = y * s.w + x
          if (s.type[i] === campaign && s.amount[i] > 0.05) cells.push(i)
        }
      }
      cells.sort((a, b) => Math.hypot((a % s.w) - cx, Math.floor(a / s.w) - cy) - Math.hypot((b % s.w) - cx, Math.floor(b / s.w) - cy))
      for (const i of cells) {
        if (s.amount[i] <= 0.05 || s.type[i] !== campaign) continue
        if (s.activeSoak(i)?.family !== det.family) break // 말랐으면 다음 라운드에서 다시 뿌림
        if (!scrubAt(i)) break
      }
    }
  }
  return { time: s.time, passed: s.passed, hazard: s.hazard, damage: s.damage, stuck, stats, polish: s.polish }
}

const cache = new Map<number, Timing>()

/** 목표시간·제한시간 = 봇 시간 × 단계 배수 (최초 1회 계산 후 캐시) */
export function resolveTiming(level: LevelDef): Timing {
  const hit = cache.get(level.id)
  if (hit) return hit
  const bot = simulateBot(level)
  const parSec = Math.max(15, Math.round(bot.time * level.parFactor))
  const timing: Timing = { parSec, limitSec: level.limitFactor ? Math.round(parSec * level.limitFactor) : undefined }
  cache.set(level.id, timing)
  return timing
}
