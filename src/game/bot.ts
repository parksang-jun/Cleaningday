// 기준 플레이어 봇 — 규칙을 모두 아는 "숙련자"가 플레이하는 시간을 재서 목표·제한시간의 기준으로 쓴다.
// 결정적(같은 입력 → 같은 결과)이라 모든 기기에서 같은 목표시간이 나온다.
import { BASE_DETERGENTS, BASE_TOOLS, DIRT_TYPES, isHazardMix, type DetergentSpec, type ToolSpec } from './catalog'
import { CleanSession, type Timing } from './engine'
import { grantsUpTo, type LevelDef } from './levels'

export interface BotResult {
  time: number
  passed: boolean
  hazard: boolean
  damage: number
}

/** 스테이지 시작 시점에 플레이어가 보유한 기본 아이템 */
export function kitFor(level: LevelDef): { tools: ToolSpec[]; dets: DetergentSpec[] } {
  const owned = new Set(grantsUpTo(level.id))
  return {
    tools: Object.values(BASE_TOOLS).filter((t) => owned.has(t.id as never)),
    dets: Object.values(BASE_DETERGENTS).filter((d) => owned.has(d.id as never)),
  }
}

const DT = 1 / 30

export function simulateBot(level: LevelDef, maxSec = 600): BotResult {
  const s = new CleanSession(level)
  const { tools, dets } = kitFor(level)
  const usable = tools.filter((t) => s.canUse(t) && t.base !== 'rinse')
  const rinse = tools.find((t) => t.base === 'rinse')

  // 한 번에 한 종류씩: 남은 양이 가장 많은 오염 종류를 골라 끝까지 (제품을 자주 바꾸지 않는 숙련자 습관)
  let campaign = -1
  let lastX = s.w / 2
  let lastY = s.h / 2
  let lastTool = ''
  let lastDet = ''
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
      if (best < 0) break
    }
    const cx = (best % s.w) + 0.5
    const cy = Math.floor(best / s.w) + 0.5
    const dirt = s.dirtAt(best)
    const surface = s.surfaceAt(best)

    // 반경 안에 있는 표면들 (구역 경계 근처면 여러 개)
    const nearby = new Set<string>([surface])
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (dx * dx + dy * dy > 25) continue
        const x = Math.floor(cx) + dx
        const y = Math.floor(cy) + dy
        if (x >= 0 && x < s.w && y >= 0 && y < s.h) nearby.add(s.surfaceAt(y * s.w + x))
      }
    }
    const safe = (harms: string[]) => !harms.some((h) => nearby.has(h))

    // 근처 표면을 해치지 않고, 이 표면에서 효과가 있는 도구 중 가장 잘 듣는 것
    const candidates = usable.filter((t) => safe(t.harms) && (!t.onlyOn || t.onlyOn.includes(surface)))
    const tool = (candidates.length ? candidates : [BASE_TOOLS.cloth]).reduce((a, b) => (b.effect[dirt] * b.power > a.effect[dirt] * a.power ? b : a))

    // 세제: 효과 1.2배 이상, 근처 표면을 해치지 않고, 용량이 남은 것
    const detCandidates = dets.filter((d) => d.mult[dirt] > 1.2 && safe(d.harms) && s.budgetOf(d) > 0.3)
    const det = detCandidates.length ? detCandidates.reduce((a, b) => (b.mult[dirt] > a.mult[dirt] ? b : a)) : null

    // 이동: 가까우면 거의 즉시, 멀면 거리 비례. 도구를 바꾸면 전환 시간
    const dist = Math.hypot(cx - lastX, cy - lastY)
    s.tick(0.03 + Math.min(1.2, dist * 0.012) + (lastTool !== tool.id ? 0.4 : 0))
    lastX = cx
    lastY = cy
    lastTool = tool.id
    if (det && !s.activeSoak(best)) {
      if (lastDet !== det.id) s.tick(0.4)
      lastDet = det.id
      // 반대 계열 세제가 남아 있으면 헹구거나 기다림
      let conflictUntil = -1
      s.soak.forEach((so, i) => {
        if (so && so.until > s.time && isHazardMix(so.det.chemistry, det.chemistry) && Math.hypot((i % s.w) + 0.5 - cx, Math.floor(i / s.w) + 0.5 - cy) <= det.radius + 1) conflictUntil = Math.max(conflictUntil, so.until)
      })
      if (conflictUntil > 0) {
        if (rinse) {
          for (let k = 0; k < 10; k++) {
            s.scrub(rinse, cx, cy, DT)
            s.tick(DT)
          }
        } else {
          s.tick(conflictUntil - s.time + 0.1) // 이전 세제가 마를 때까지 기다림
        }
      }
      s.spray(det, cx, cy, 0.3)
      s.tick(0.3)
    }
    // 작은 원을 그리며 문지르기 (아래층이 드러나면 계속)
    let t = 0
    while (t < 4 && s.amount[best] > 0.02) {
      const ang = t * 9
      s.scrub(tool, cx + Math.cos(ang) * tool.radius * 0.35, cy + Math.sin(ang) * tool.radius * 0.35, DT)
      s.tick(DT)
      t += DT
    }
  }
  return { time: s.time, passed: s.passed, hazard: s.hazard, damage: s.damage }
}

const cache = new Map<number, Timing>()

/** 목표시간·제한시간 = 봇 시간 × 챕터 배수 (최초 1회 계산 후 캐시) */
export function resolveTiming(level: LevelDef): Timing {
  const hit = cache.get(level.id)
  if (hit) return hit
  const bot = simulateBot(level)
  const parSec = Math.max(15, Math.round(bot.time * level.parFactor))
  const timing: Timing = { parSec, limitSec: level.limitFactor ? Math.round(parSec * level.limitFactor) : undefined }
  cache.set(level.id, timing)
  return timing
}
