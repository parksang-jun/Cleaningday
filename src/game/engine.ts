// 청소 세션 — 격자 오염 상태, 도구 문지르기·세제 분사, 진행률, 손상·위험 혼합, 별점
import { DIRT_RESIST, DIRT_TYPES, isHazardMix, type Chemistry, type DetergentSpec, type DirtType, type ItemSpec, type SurfaceType, type ToolSpec } from './catalog'
import { GRID_H, GRID_W, type LevelDef } from './levels'
import { mulberry32 } from './rng'

export const PASS_CLEAN = 0.95

export interface Soak {
  det: DetergentSpec
  until: number // 세션 시간(초)
}

export type SessionEvent =
  | { kind: 'harm'; item: string; surface: SurfaceType }
  | { kind: 'hazard'; a: Chemistry; b: Chemistry }
  | { kind: 'blocked'; item: string; surface: SurfaceType }
  | { kind: 'cleared'; cells: number[] }

export class CleanSession {
  readonly w = GRID_W
  readonly h = GRID_H
  readonly amount: Float32Array
  readonly type: Uint8Array // DIRT_TYPES 인덱스
  readonly grain: Float32Array // 칸별 고정 질감(렌더링용)
  readonly soak: (Soak | null)[]
  readonly initialTotal: number
  time = 0
  damage = 0 // 0~1
  hazard = false
  private lastHarmAt = -10
  private lastBlockedAt = -10
  private remaining: number

  constructor(readonly level: LevelDef, seed = level.id * 7919) {
    const n = this.w * this.h
    this.amount = new Float32Array(n)
    this.type = new Uint8Array(n)
    this.grain = new Float32Array(n)
    this.soak = new Array(n).fill(null)
    const rng = mulberry32(seed)
    const noise = smoothNoise(this.w, this.h, 6, rng)
    const fine = smoothNoise(this.w, this.h, 2.5, rng)
    for (let i = 0; i < n; i++) this.grain[i] = 0.8 + fine[i] * 0.4
    for (const p of level.patches) {
      const t = DIRT_TYPES.indexOf(p.type)
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
        // 불규칙한 얼룩: 원 + 노이즈 가장자리
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
            }
          }
        }
      }
    }
    let total = 0
    for (let i = 0; i < n; i++) total += this.amount[i]
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
    return this.cleanliness >= PASS_CLEAN
  }

  dirtAt(i: number): DirtType {
    return DIRT_TYPES[this.type[i]]
  }

  tick(dt: number) {
    this.time += dt
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

  /** 표면에 맞지 않는 아이템 사용 → 손상 누적 */
  private checkHarm(item: ItemSpec, dt: number, events: SessionEvent[]) {
    if (!item.harms.includes(this.level.surface)) return
    this.damage = Math.min(1, this.damage + dt * 0.12)
    if (this.time - this.lastHarmAt > 1.5) {
      this.lastHarmAt = this.time
      events.push({ kind: 'harm', item: item.id, surface: this.level.surface })
    }
  }

  canUse(item: ItemSpec): boolean {
    return !(item.kind === 'tool' && item.onlyOn && !item.onlyOn.includes(this.level.surface))
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
    this.checkHarm(tool, dt, events)
    const cleared: number[] = []
    this.forEachInRadius(cx, cy, tool.radius, (i, w) => {
      const a = this.amount[i]
      if (a <= 0) return
      const dirt = DIRT_TYPES[this.type[i]]
      const s = this.soak[i]
      const mult = s && s.until > this.time ? s.det.mult[dirt] : 1
      const rate = (tool.power * tool.effect[dirt] * mult * w) / DIRT_RESIST[dirt]
      const next = Math.max(0, a - rate * dt)
      this.remaining -= a - next
      this.amount[i] = next < 0.02 ? 0 : next
      if (next < 0.02) {
        this.remaining -= next
        cleared.push(i)
      }
    })
    if (cleared.length) events.push({ kind: 'cleared', cells: cleared })
    return events
  }

  /** 세제 분사 — 칸을 불림. 염소계↔산성이 같은 칸에서 겹치면 위험 혼합 */
  spray(det: DetergentSpec, cx: number, cy: number, dt: number): SessionEvent[] {
    const events: SessionEvent[] = []
    this.checkHarm(det, dt, events)
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
}

export interface Result {
  stars: number
  coins: number
  timeSec: number
  damage: number
  hazard: boolean
}

/** 별점: 기본 3, 기준시간 초과 -1(2배 초과 -2), 손상 15% 이상 -1, 위험 혼합 -1, 최소 1 */
export function scoreSession(s: Pick<CleanSession, 'time' | 'damage' | 'hazard'>, parSec: number): Result {
  let stars = 3
  if (s.time > parSec) stars--
  if (s.time > parSec * 2) stars--
  if (s.damage >= 0.15) stars--
  if (s.hazard) stars--
  stars = Math.max(1, stars)
  return { stars, coins: 20 + stars * 10, timeSec: Math.round(s.time), damage: s.damage, hazard: s.hazard }
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
