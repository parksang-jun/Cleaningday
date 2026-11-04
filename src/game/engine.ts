// 청소 세션 — 격자 오염 상태(겹친 층 포함), 구역별 표면, 도구 문지르기·세제 분사·헹굼, 세제 용량, 제한시간, 손상·위험 혼합, 별점
import { DIRT_RESIST, DIRT_TYPES, isHazardMix, SURFACES, type Chemistry, type DetergentSpec, type DirtType, type ItemSpec, type SurfaceType, type ToolSpec } from './catalog'
import { GRID_H, GRID_W, type LevelDef } from './levels'
import { mulberry32 } from './rng'

export interface Soak {
  det: DetergentSpec
  until: number // 세션 시간(초)
}

export type SessionEvent =
  | { kind: 'harm'; item: string; surface: SurfaceType }
  | { kind: 'hazard'; a: Chemistry; b: Chemistry }
  | { kind: 'blocked'; item: string; surface: SurfaceType }
  | { kind: 'empty'; item: string }
  | { kind: 'revealed'; cells: number[] } // 윗층이 벗겨져 아래층이 드러남
  | { kind: 'cleared'; cells: number[] }

export interface Timing {
  parSec: number
  limitSec?: number
}

export class CleanSession {
  readonly w = GRID_W
  readonly h = GRID_H
  readonly amount: Float32Array
  readonly type: Uint8Array // DIRT_TYPES 인덱스 (윗층)
  readonly under: Float32Array // 아래층 농도 (0 = 없음)
  readonly underType: Uint8Array
  readonly grain: Float32Array // 칸별 고정 질감(렌더링용)
  readonly surfaceIdx: Uint8Array // 칸별 표면 (SURFACES 인덱스)
  readonly soak: (Soak | null)[]
  readonly initialTotal: number
  readonly sprayLeft: Map<string, number> // 세제 id → 남은 분사 시간(초)
  readonly hasLayers: boolean
  time = 0
  damage = 0 // 0~1
  hazard = false
  limitSec: number | undefined
  private lastHarmAt = -10
  private lastBlockedAt = -10
  private lastEmptyAt = -10
  private remaining: number

  constructor(
    readonly level: LevelDef,
    timing?: Timing,
    seed = level.seed,
  ) {
    const n = this.w * this.h
    this.amount = new Float32Array(n)
    this.type = new Uint8Array(n)
    this.under = new Float32Array(n)
    this.underType = new Uint8Array(n)
    this.grain = new Float32Array(n)
    this.surfaceIdx = new Uint8Array(n)
    this.soak = new Array(n).fill(null)
    this.sprayLeft = new Map()
    this.limitSec = timing?.limitSec

    // 표면 지도
    const base = SURFACES.indexOf(level.surface)
    this.surfaceIdx.fill(base)
    if (level.zones) {
      for (const z of level.zones) {
        const si = SURFACES.indexOf(z.surface)
        const x0 = Math.floor(z.x0 * this.w)
        const x1 = Math.ceil(z.x1 * this.w)
        const y0 = Math.floor(z.y0 * this.h)
        const y1 = Math.ceil(z.y1 * this.h)
        for (let y = y0; y < Math.min(this.h, y1); y++) for (let x = x0; x < Math.min(this.w, x1); x++) this.surfaceIdx[y * this.w + x] = si
      }
    }

    const rng = mulberry32(seed)
    const noise = smoothNoise(this.w, this.h, 6, rng)
    const fine = smoothNoise(this.w, this.h, 2.5, rng)
    for (let i = 0; i < n; i++) this.grain[i] = 0.8 + fine[i] * 0.4
    let layers = false
    for (const p of level.patches) {
      const t = DIRT_TYPES.indexOf(p.type)
      const ut = p.under ? DIRT_TYPES.indexOf(p.under) : -1
      if (p.coverage) {
        // 부드러운 노이즈 기반 얇은 막 (격자 무늬가 보이지 않게)
        const thr = 1 - p.coverage
        for (let i = 0; i < n; i++) {
          const v = noise[i] * 0.75 + fine[i] * 0.25
          if (v > thr) this.put(i, t, p.amount[0] * Math.min(1, (v - thr) / 0.25 + 0.3))
        }
      }
      for (let b = 0; b < p.blobs; b++) {
        const cx = 3 + rng.next() * (this.w - 6)
        const cy = 3 + rng.next() * (this.h - 6)
        const r = p.size[0] + rng.next() * (p.size[1] - p.size[0])
        const amt = p.amount[0] + rng.next() * (p.amount[1] - p.amount[0])
        const hasUnder = p.underAmount !== undefined && rng.next() < (p.underChance ?? 1)
        const uamt = hasUnder && p.underAmount ? p.underAmount[0] + rng.next() * (p.underAmount[1] - p.underAmount[0]) : 0
        const wobble = [rng.next(), rng.next(), rng.next()]
        for (let y = Math.max(0, Math.floor(cy - r - 2)); y < Math.min(this.h, cy + r + 2); y++) {
          for (let x = Math.max(0, Math.floor(cx - r - 2)); x < Math.min(this.w, cx + r + 2); x++) {
            const dx = x - cx
            const dy = y - cy
            const ang = Math.atan2(dy, dx)
            const rr = r * (0.75 + 0.25 * Math.sin(ang * 3 + wobble[0] * 6) * wobble[1] + 0.15 * Math.sin(ang * 5 + wobble[2] * 6))
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < rr) {
              const falloff = 1 - Math.pow(d / rr, 2.2) * 0.6
              const idx = y * this.w + x
              this.put(idx, t, amt * falloff * (0.7 + 0.3 * fine[idx]))
              if (ut >= 0 && uamt > 0 && d < rr * 0.8) {
                const ua = uamt * (0.8 + 0.2 * fine[idx])
                if (ua > this.under[idx]) {
                  this.under[idx] = Math.min(1, ua)
                  this.underType[idx] = ut
                  layers = true
                }
              }
            }
          }
        }
      }
    }
    this.hasLayers = layers
    let total = 0
    for (let i = 0; i < n; i++) total += this.amount[i] + this.under[i]
    this.initialTotal = Math.max(total, 1e-6)
    this.remaining = total
  }

  /** 더 진한 오염이 칸을 차지 */
  private put(i: number, t: number, a: number) {
    if (a > this.amount[i]) {
      this.amount[i] = Math.min(1, a)
      this.type[i] = t
    } else {
      this.amount[i] = Math.min(1, this.amount[i] + a * 0.15)
    }
  }

  get cleanliness(): number {
    return Math.max(0, Math.min(1, 1 - this.remaining / this.initialTotal))
  }

  get passed(): boolean {
    return this.cleanliness >= this.level.passClean
  }

  /** 제한시간을 넘겼고 아직 통과 못 함 */
  get expired(): boolean {
    return this.limitSec !== undefined && this.time >= this.limitSec && !this.passed
  }

  extendLimit(sec: number) {
    if (this.limitSec !== undefined) this.limitSec += sec
  }

  dirtAt(i: number): DirtType {
    return DIRT_TYPES[this.type[i]]
  }

  surfaceAt(i: number): SurfaceType {
    return SURFACES[this.surfaceIdx[i]]
  }

  /** 이 판에 있는 표면 종류 */
  get surfaces(): SurfaceType[] {
    const seen = new Set<number>()
    for (let i = 0; i < this.surfaceIdx.length; i++) seen.add(this.surfaceIdx[i])
    return [...seen].map((k) => SURFACES[k])
  }

  tick(dt: number) {
    this.time += dt
  }

  /** 남은 분사 시간 (무제한이면 Infinity) */
  budgetOf(det: DetergentSpec): number {
    if (this.level.sprayBudgetSec === undefined) return Infinity
    return this.sprayLeft.get(det.id) ?? this.level.sprayBudgetSec
  }

  refill(det: DetergentSpec, sec: number) {
    if (this.level.sprayBudgetSec === undefined) return
    this.sprayLeft.set(det.id, this.budgetOf(det) + sec)
  }

  /** 붓 영역 칸 순회 (가장자리로 갈수록 약해짐) */
  private forEachInRadius(cx: number, cy: number, radius: number, fn: (i: number, w: number) => void) {
    const r = radius
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        if (d <= r) fn(y * this.w + x, 1 - (d / r) * 0.55)
      }
    }
  }

  /** 영역 안에서 아이템이 해치는 표면 비율 → 손상 누적 */
  private applyHarm(item: ItemSpec, cx: number, cy: number, dt: number, events: SessionEvent[]) {
    if (!item.harms.length) return
    let cells = 0
    let harmed = 0
    let harmedSurface: SurfaceType | null = null
    this.forEachInRadius(cx, cy, item.kind === 'tool' ? item.radius : item.radius, (i) => {
      cells++
      const s = this.surfaceAt(i)
      if (item.harms.includes(s)) {
        harmed++
        harmedSurface = s
      }
    })
    if (!harmed || !harmedSurface) return
    // 구역 경계에 살짝 걸치는 정도(30% 미만)는 봐주고, 그 이상부터 비율대로 손상
    const frac = Math.max(0, (harmed / cells - 0.3) / 0.7)
    if (frac <= 0) return
    this.damage = Math.min(1, this.damage + dt * 0.12 * frac)
    if (this.time - this.lastHarmAt > 1.5) {
      this.lastHarmAt = this.time
      events.push({ kind: 'harm', item: item.id, surface: harmedSurface })
    }
  }

  /** 이 판에서 아예 못 쓰는 도구인지 (실외 전용 도구를 실내에서) */
  canUse(item: ItemSpec): boolean {
    if (item.kind !== 'tool' || !item.onlyOn) return true
    return this.surfaces.some((s) => item.onlyOn!.includes(s))
  }

  /** 도구로 (cx,cy) 지점을 dt 초 동안 문지름 */
  scrub(tool: ToolSpec, cx: number, cy: number, dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    if (!this.canUse(tool)) {
      if (this.time - this.lastBlockedAt > 1.5) {
        this.lastBlockedAt = this.time
        events.push({ kind: 'blocked', item: tool.id, surface: this.level.surface })
      }
      return events
    }
    this.applyHarm(tool, cx, cy, dt, events)
    const cleared: number[] = []
    const revealed: number[] = []
    const resistMul = this.level.resistMul
    const isRinse = tool.base === 'rinse'
    this.forEachInRadius(cx, cy, tool.radius, (i, w) => {
      if (isRinse) this.soak[i] = null // 헹굼: 세제를 씻어냄
      const a = this.amount[i]
      if (a <= 0) return
      // 실외 전용 도구는 허용 표면 밖에서는 효과 없음
      if (tool.onlyOn && !tool.onlyOn.includes(this.surfaceAt(i))) return
      const dirt = DIRT_TYPES[this.type[i]]
      const s = this.soak[i]
      const mult = s && s.until > this.time ? s.det.mult[dirt] : 1
      const rate = (tool.power * tool.effect[dirt] * mult * w) / (DIRT_RESIST[dirt] * resistMul)
      const next = Math.max(0, a - rate * dt)
      this.remaining -= a - next
      if (next < 0.02) {
        this.remaining -= next
        if (this.under[i] > 0) {
          // 윗층 제거 → 아래층이 드러남
          this.amount[i] = this.under[i]
          this.type[i] = this.underType[i]
          this.under[i] = 0
          revealed.push(i)
        } else {
          this.amount[i] = 0
          cleared.push(i)
        }
      } else this.amount[i] = next
    })
    if (revealed.length) events.push({ kind: 'revealed', cells: revealed })
    if (cleared.length) events.push({ kind: 'cleared', cells: cleared })
    return events
  }

  /** 세제 분사 — 칸을 불림. 용량이 남아야 하고, 염소계↔산성이 같은 칸에서 겹치면 위험 혼합 */
  spray(det: DetergentSpec, cx: number, cy: number, dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    const left = this.budgetOf(det)
    if (left <= 0) {
      if (this.time - this.lastEmptyAt > 1.5) {
        this.lastEmptyAt = this.time
        events.push({ kind: 'empty', item: det.id })
      }
      return events
    }
    if (left !== Infinity) this.sprayLeft.set(det.id, Math.max(0, left - dt))
    this.applyHarm(det, cx, cy, dt, events)
    let mixed: Chemistry | null = null
    this.forEachInRadius(cx, cy, det.radius, (i) => {
      const prev = this.soak[i]
      if (prev && prev.until > this.time && isHazardMix(prev.det.chemistry, det.chemistry)) mixed = prev.det.chemistry
      this.soak[i] = { det, until: this.time + det.soakSec }
    })
    if (mixed && !this.hazard) {
      this.hazard = true
      events.push({ kind: 'hazard', a: mixed, b: det.chemistry })
    }
    return events
  }

  /** 칸이 불려 있는 정도(0~1, 렌더링용) */
  soakLevel(i: number): number {
    const s = this.soak[i]
    if (!s) return 0
    const left = s.until - this.time
    return left <= 0 ? 0 : Math.min(1, left / 3)
  }

  /** 활성 상태인 세제 (헹굼 필요 여부 판단용) */
  activeSoak(i: number): DetergentSpec | null {
    const s = this.soak[i]
    return s && s.until > this.time ? s.det : null
  }
}

export interface Result {
  stars: number
  coins: number
  timeSec: number
  damage: number
  hazard: boolean
}

/** 별점: 기본 3, 목표시간 초과 -1(2배 초과 -2), 손상 15% 이상 -1, 위험 혼합 -1, 최소 1 */
export function scoreSession(s: Pick<CleanSession, 'time' | 'damage' | 'hazard'>, parSec: number, chapter = 1): Result {
  let stars = 3
  if (s.time > parSec) stars--
  if (s.time > parSec * 2) stars--
  if (s.damage >= 0.15) stars--
  if (s.hazard) stars--
  stars = Math.max(1, stars)
  return { stars, coins: (20 + stars * 10) * chapter, timeSec: Math.round(s.time), damage: s.damage, hazard: s.hazard }
}

/** 값 노이즈(격자 난수 + 부드러운 보간), 0~1 */
function smoothNoise(w: number, h: number, scale: number, rng: { next(): number }): Float32Array {
  const gw = Math.ceil(w / scale) + 2
  const gh = Math.ceil(h / scale) + 2
  const lattice = new Float32Array(gw * gh)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next()
  const out = new Float32Array(w * h)
  const fade = (t: number) => t * t * (3 - 2 * t)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / scale
      const gy = y / scale
      const x0 = Math.floor(gx)
      const y0 = Math.floor(gy)
      const fx = fade(gx - x0)
      const fy = fade(gy - y0)
      const a = lattice[y0 * gw + x0]
      const b = lattice[y0 * gw + x0 + 1]
      const c = lattice[(y0 + 1) * gw + x0]
      const d = lattice[(y0 + 1) * gw + x0 + 1]
      out[y * w + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    }
  }
  return out
}
