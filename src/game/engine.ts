// 청소 세션 — 격자 오염 상태(겹친 층 포함), 구역별 표면, 레시피 기반 문지르기·세정제 분사·헹굼,
// 무효과 진단(틀린 도구·세정제 필요·틀린 세정제·틀린 표면), 발견, 세정제 용량, 제한시간, 손상·위험 혼합, 별점
import {
  diagnose,
  DIRT_RESIST,
  PRO_BUDGET_MUL,
  TAIL_AMOUNT,
  findMix,
  type MixDef,
  DIRT_SURFACES,
  DIRT_TYPES,
  isHazardMix,
  mixHasPart,
  matchRecipe,
  SURFACES,
  type Chemistry,
  type CleanerFamily,
  type DetergentSpec,
  type DirtType,
  type ItemSpec,
  type NoEffectReason,
  type SurfaceType,
  type ToolFamily,
  type ToolSpec,
} from './catalog'
import { GRID_H, GRID_W, type LevelDef } from './levels'
import { mulberry32 } from './rng'

export interface Soak {
  det: DetergentSpec
  until: number // 세션 시간(초)
}

export type SessionEvent =
  | { kind: 'harm'; item: string; surface: SurfaceType }
  | { kind: 'hazard'; a: Chemistry; b: Chemistry }
  | { kind: 'mixed'; mix: string; family: CleanerFamily; cells: number[]; neutralized: boolean }
  | { kind: 'blocked'; item: string; surface: SurfaceType }
  | { kind: 'empty'; item: string }
  | { kind: 'noeffect'; reason: NoEffectReason; dirt: DirtType; surface: SurfaceType; item: string }
  | { kind: 'discovered'; dirt: DirtType; tool: ToolFamily; cleaner: CleanerFamily | null }
  | { kind: 'typecleared'; dirt: DirtType }
  | { kind: 'spotdone'; done: number; total: number }
  | { kind: 'spawned'; dirt: DirtType; left: number }
  | { kind: 'revealed'; cells: number[] } // 윗층이 벗겨져 아래층이 드러남
  | { kind: 'cleared'; cells: number[] }

export interface Timing {
  parSec: number
  limitSec?: number
}

/** 발견한 조합 키: "grease|scrubpad|degreaser" */
export function recipeKey(dirt: DirtType, tool: ToolFamily, cleaner: CleanerFamily | null): string {
  return `${dirt}|${tool}|${cleaner ?? '-'}`
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
  /** 이 판에 있는(있었던) 오염 종류 */
  readonly dirtKinds: DirtType[]
  /** 이 세션에서 발견한 조합 */
  readonly discovered = new Set<string>()
  /** 오염별 시도해 본 도구(실패 포함) — 힌트 조건 */
  readonly tried = new Map<DirtType, Set<string>>()
  /** 스팟 모드 표적 (중심·반경·완료) */
  readonly spots: { x: number; y: number; r: number; done: boolean }[] = []
  /** 오염 배열이 바뀔 때마다 증가 — 렌더러가 오염층을 다시 합성할지 판단 */
  version = 0
  /** 광택 마감: 고성능 도구·세정제로 끝까지 지운 칸 (렌더링·결과 보너스) */
  readonly shine: Uint8Array
  shineCells = 0
  /** 오염이 있었던 칸 수 (광택 비율의 분모) */
  dirtyCellsSeen = 0
  /** 러시 모드: 아직 생길 오염 수 */
  spawnLeft = 0
  private nextSpawnAt = 0
  private readonly spawnRng: { next(): number }
  private growthAcc = 0
  private growthBudget = 0 // 번짐으로 더 생길 수 있는 양 (cap)
  private readonly fine: Float32Array
  time = 0
  damage = 0 // 0~1
  hazard = false
  limitSec: number | undefined
  /** 첫 효과(분사 또는 실제 제거)가 난 뒤 true — 이때부터 시계가 간다 */
  engaged = false
  private lastHarmAt = -10
  private lastBlockedAt = -10
  private lastEmptyAt = -10
  private lastMixAt = -10
  private lastNoEffectAt = new Map<string, number>()
  private remaining: number
  private perType: Float32Array // 종류별 남은 양 (윗층+아래층)

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
    this.shine = new Uint8Array(n)
    this.sprayLeft = new Map()
    this.perType = new Float32Array(DIRT_TYPES.length)
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
    this.spawnRng = mulberry32(seed + 101)
    const noise = smoothNoise(this.w, this.h, 6, rng)
    const fine = smoothNoise(this.w, this.h, 2.5, rng)
    this.fine = fine
    for (let i = 0; i < n; i++) this.grain[i] = 0.8 + fine[i] * 0.4
    let layers = false
    const kinds = new Set<DirtType>()
    for (const p of level.patches) {
      const t = DIRT_TYPES.indexOf(p.type)
      const ut = p.under ? DIRT_TYPES.indexOf(p.under) : -1
      const allowed = DIRT_SURFACES[p.type]
      const underAllowed = p.under ? DIRT_SURFACES[p.under] : null
      if (p.coverage) {
        // 부드러운 노이즈 기반 얇은 막 (격자 무늬가 보이지 않게) — 가능한 표면 위에만
        const thr = 1 - p.coverage
        for (let i = 0; i < n; i++) {
          if (!allowed.includes(SURFACES[this.surfaceIdx[i]])) continue
          const v = noise[i] * 0.75 + fine[i] * 0.25
          if (v > thr) {
            this.put(i, t, p.amount[0] * Math.min(1, (v - thr) / 0.25 + 0.3))
            kinds.add(p.type)
          }
        }
      }
      for (let b = 0; b < p.blobs; b++) {
        // 중심이 가능한 표면 위에 오도록 (최대 24회 재시도)
        let cx = 0
        let cy = 0
        let ok = false
        for (let tries = 0; tries < 24 && !ok; tries++) {
          cx = 3 + rng.next() * (this.w - 6)
          cy = 3 + rng.next() * (this.h - 6)
          const s = SURFACES[this.surfaceIdx[Math.floor(cy) * this.w + Math.floor(cx)]]
          ok = allowed.includes(s) && (!underAllowed || underAllowed.includes(s))
        }
        if (!ok) continue
        const r = p.size[0] + rng.next() * (p.size[1] - p.size[0])
        const amt = p.amount[0] + rng.next() * (p.amount[1] - p.amount[0])
        const hasUnder = p.underAmount !== undefined && rng.next() < (p.underChance ?? 1)
        const uamt = hasUnder && p.underAmount ? p.underAmount[0] + rng.next() * (p.underAmount[1] - p.underAmount[0]) : 0
        const wobble = [rng.next(), rng.next(), rng.next()]
        if (p.spot) {
          // 표적끼리 겹치지 않게: 기존 표적과 너무 가까우면 건너뜀
          if (this.spots.some((sp) => Math.hypot(sp.x - cx, sp.y - cy) < sp.r + r + 1)) continue
          this.spots.push({ x: cx, y: cy, r: r + 1, done: false })
        }
        for (let y = Math.max(0, Math.floor(cy - r - 2)); y < Math.min(this.h, cy + r + 2); y++) {
          for (let x = Math.max(0, Math.floor(cx - r - 2)); x < Math.min(this.w, cx + r + 2); x++) {
            const dx = x - cx
            const dy = y - cy
            const ang = Math.atan2(dy, dx)
            const rr = r * (0.75 + 0.25 * Math.sin(ang * 3 + wobble[0] * 6) * wobble[1] + 0.15 * Math.sin(ang * 5 + wobble[2] * 6))
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < rr) {
              const idx = y * this.w + x
              const surf = SURFACES[this.surfaceIdx[idx]]
              if (!allowed.includes(surf)) continue
              const falloff = 1 - Math.pow(d / rr, 2.2) * 0.6
              this.put(idx, t, amt * falloff * (0.7 + 0.3 * fine[idx]))
              kinds.add(p.type)
              if (ut >= 0 && uamt > 0 && d < rr * 0.8 && underAllowed!.includes(surf)) {
                const ua = uamt * (0.8 + 0.2 * fine[idx])
                if (ua > this.under[idx]) {
                  this.under[idx] = Math.min(1, ua)
                  this.underType[idx] = ut
                  layers = true
                  kinds.add(p.under!)
                }
              }
            }
          }
        }
      }
    }
    if (level.spawn) {
      this.spawnLeft = level.spawn.count
      this.nextSpawnAt = level.spawn.every
      kinds.add(level.spawn.type)
    }
    this.hasLayers = layers
    this.dirtKinds = DIRT_TYPES.filter((d) => kinds.has(d))
    let total = 0
    for (let i = 0; i < n; i++) {
      total += this.amount[i] + this.under[i]
      if (this.amount[i] > 0) {
        this.perType[this.type[i]] += this.amount[i]
        this.dirtyCellsSeen++
      }
      if (this.under[i] > 0) this.perType[this.underType[i]] += this.under[i]
    }
    this.initialTotal = Math.max(total, 1e-6)
    this.remaining = total
    if (level.growth) this.growthBudget = this.remainingOf(level.growth.type) * (level.growth.cap - 1)
  }

  /** 생성 중 호출: 더 많은 오염이 생기면 총량도 늘어 진행률이 내려간다 */
  private addDirt(i: number, t: number, a: number) {
    const before = this.amount[i]
    const tBefore = this.type[i]
    this.put(i, t, a)
    const delta = this.amount[i] - before
    if (delta <= 0) return
    this.version++
    if (before <= 0) {
      this.dirtyCellsSeen++
      if (this.shine[i]) {
        this.shine[i] = 0
        this.shineCells--
      }
    }
    if (this.type[i] !== tBefore && before > 0) {
      // 종류가 바뀌면 이전 종류 양을 옮김
      this.perType[tBefore] -= before
      this.perType[this.type[i]] += before
    }
    this.perType[this.type[i]] += delta
    this.remaining += delta
    ;(this as { initialTotal: number }).initialTotal += delta
  }

  /** 러시 모드: 작은 얼룩(발자국·털·튄 자국)을 하나 떨어뜨림 */
  private spawnOne() {
    const sp = this.level.spawn!
    const t = DIRT_TYPES.indexOf(sp.type)
    const allowed = DIRT_SURFACES[sp.type]
    for (let tries = 0; tries < 20; tries++) {
      const cx = 3 + this.spawnRng.next() * (this.w - 6)
      const cy = 3 + this.spawnRng.next() * (this.h - 6)
      const idx0 = Math.floor(cy) * this.w + Math.floor(cx)
      if (!allowed.includes(SURFACES[this.surfaceIdx[idx0]]) || this.amount[idx0] > 0.3) continue
      const r = sp.size[0] + this.spawnRng.next() * (sp.size[1] - sp.size[0])
      const amt = sp.amount[0] + this.spawnRng.next() * (sp.amount[1] - sp.amount[0])
      for (let y = Math.max(0, Math.floor(cy - r - 1)); y < Math.min(this.h, cy + r + 1); y++) {
        for (let x = Math.max(0, Math.floor(cx - r - 1)); x < Math.min(this.w, cx + r + 1); x++) {
          const d = Math.hypot(x - cx, y - cy)
          if (d >= r) continue
          const i = y * this.w + x
          if (!allowed.includes(SURFACES[this.surfaceIdx[i]])) continue
          this.addDirt(i, t, amt * (1 - Math.pow(d / r, 2) * 0.5) * (0.75 + 0.25 * this.fine[i]))
        }
      }
      return true
    }
    return false
  }

  /** 번짐 모드: 세정제가 안 닿은 곰팡이·이끼 칸이 가장자리 이웃을 감염 (rate = 초당 감염 칸 수) */
  private grow(dt: number) {
    const g = this.level.growth!
    if (this.growthBudget <= 0) return
    this.growthAcc += g.rate * dt
    let n = Math.floor(this.growthAcc)
    if (n <= 0) return
    this.growthAcc -= n
    const t = DIRT_TYPES.indexOf(g.type)
    const allowed = DIRT_SURFACES[g.type]
    const dirs = [1, -1, this.w, -this.w]
    while (n > 0 && this.growthBudget > 0) {
      let infected = false
      for (let tries = 0; tries < 40 && !infected; tries++) {
        const i = Math.floor(this.spawnRng.next() * this.amount.length)
        if (this.type[i] !== t || this.amount[i] < 0.3) continue
        const so = this.soak[i]
        if (so && so.until > this.time) continue
        const j = i + dirs[Math.floor(this.spawnRng.next() * 4)]
        if (j < 0 || j >= this.amount.length || Math.abs((j % this.w) - (i % this.w)) > 1) continue
        if (!allowed.includes(SURFACES[this.surfaceIdx[j]])) continue
        const before = this.amount[j]
        const same = this.type[j] === t
        if (before > 0.2 && !same) continue // 다른 오염 위로는 안 번짐
        if (same && before >= 0.55) continue // 이미 진한 곳
        const target = same ? Math.min(0.6, before + 0.3) : 0.35
        if (!same) {
          if (before > 0) {
            this.perType[this.type[j]] -= before
            this.perType[t] += before
          }
          this.type[j] = t
        }
        const delta = target - before
        this.amount[j] = target
        this.perType[t] += delta
        this.remaining += delta
        ;(this as { initialTotal: number }).initialTotal += delta
        this.growthBudget -= delta
        this.version++
        if (before <= 0 && this.shine[j]) {
          this.shine[j] = 0
          this.shineCells--
        }
        infected = true
      }
      n--
    }
  }

  /** 아직 생길 오염이 있는지 (러시) */
  get pendingSpawns(): number {
    return this.spawnLeft
  }

  /** 스팟 완료 수 */
  get spotsDone(): number {
    return this.spots.filter((sp) => sp.done).length
  }

  private checkSpots(events: SessionEvent[]) {
    for (const sp of this.spots) {
      if (sp.done) continue
      let left = 0
      const r = sp.r
      for (let y = Math.max(0, Math.floor(sp.y - r)); y <= Math.min(this.h - 1, Math.ceil(sp.y + r)); y++) {
        for (let x = Math.max(0, Math.floor(sp.x - r)); x <= Math.min(this.w - 1, Math.ceil(sp.x + r)); x++) {
          if (Math.hypot(x + 0.5 - sp.x, y + 0.5 - sp.y) > r) continue
          const i = y * this.w + x
          left += this.amount[i] + this.under[i]
        }
      }
      if (left < 0.6) {
        sp.done = true
        events.push({ kind: 'spotdone', done: this.spotsDone, total: this.spots.length })
      }
    }
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

  /** 광택 마감 비율 — 고성능 장비로 끝까지 지운 칸 / 오염이 있었던 칸 */
  get polish(): number {
    return this.dirtyCellsSeen > 0 ? Math.max(0, Math.min(1, this.shineCells / this.dirtyCellsSeen)) : 0
  }

  get passed(): boolean {
    if (this.level.mode === 'spots') return this.spots.length > 0 && this.spots.every((sp) => sp.done)
    if (this.level.spawn && this.spawnLeft > 0) return false // 러시: 다 생길 때까지 통과 없음
    return this.cleanliness >= this.level.passClean
  }

  /** 제한시간을 넘겼고 아직 통과 못 함 */
  get expired(): boolean {
    return this.limitSec !== undefined && this.time >= this.limitSec && !this.passed
  }

  /** 정밀 모드: 표면을 너무 망쳤음 */
  get ruined(): boolean {
    return this.level.failDamage !== undefined && this.damage >= this.level.failDamage && !this.passed
  }

  extendLimit(sec: number) {
    if (this.limitSec !== undefined) this.limitSec += sec
  }

  /** 거품 폭탄: 남은 오염의 frac 만큼을 칸 단위로 통째로 지운다(윗층이 있으면 벗겨서 아래층을 드러냄). 어느 칸이 지워졌는지 이벤트로 돌려준다 */
  blast(frac: number, rand: () => number = Math.random): SessionEvent[] {
    const events: SessionEvent[] = []
    const dirty: number[] = []
    for (let i = 0; i < this.w * this.h; i++) if (this.amount[i] > 0) dirty.push(i)
    if (!dirty.length) return events
    // 무작위 순서로 섞되, 한 번 지운 칸이 이웃과 뭉치도록 시작점 주변을 먼저
    for (let i = dirty.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[dirty[i], dirty[j]] = [dirty[j], dirty[i]]
    }
    const target = this.remaining * frac
    let removed = 0
    const cleared: number[] = []
    const revealed: number[] = []
    for (const i of dirty) {
      if (removed >= target) break
      removed += this.amount[i]
      this.finishCell(i, cleared, revealed, events, false)
    }
    if (revealed.length) events.push({ kind: 'revealed', cells: revealed })
    if (cleared.length) events.push({ kind: 'cleared', cells: cleared })
    return events
  }

  dirtAt(i: number): DirtType {
    return DIRT_TYPES[this.type[i]]
  }

  surfaceAt(i: number): SurfaceType {
    return SURFACES[this.surfaceIdx[i]]
  }

  /** 종류별 남은 양 */
  remainingOf(d: DirtType): number {
    return Math.max(0, this.perType[DIRT_TYPES.indexOf(d)])
  }

  /** 이 판에 있는 표면 종류 */
  get surfaces(): SurfaceType[] {
    const seen = new Set<number>()
    for (let i = 0; i < this.surfaceIdx.length; i++) seen.add(this.surfaceIdx[i])
    return [...seen].map((k) => SURFACES[k])
  }

  /** 시간 진행 + 세정제 용해(뿌려 두면 저절로 녹는 오염) */
  tick(dt: number): SessionEvent[] {
    this.time += dt
    const events: SessionEvent[] = []
    const cleared: number[] = []
    if (this.level.spawn && this.spawnLeft > 0 && this.time >= this.nextSpawnAt) {
      const ok = this.spawnOne()
      this.spawnLeft-- // 자리가 없어도 횟수는 소진 (끝없이 기다리지 않게)
      if (ok) events.push({ kind: 'spawned', dirt: this.level.spawn.type, left: this.spawnLeft })
      this.nextSpawnAt = this.time + this.level.spawn.every
    }
    if (this.level.growth) this.grow(dt)
    for (let i = 0; i < this.soak.length; i++) {
      const s = this.soak[i]
      if (!s || s.until <= this.time || !s.det.dissolves) continue
      const a = this.amount[i]
      if (a <= 0) continue
      const dirt = DIRT_TYPES[this.type[i]]
      const rate = s.det.dissolves[dirt]
      if (!rate) continue
      const next = Math.max(0, a - (rate * dt) / this.level.resistMul)
      this.take(i, a - next)
      this.amount[i] = next
      if (next < 0.02) this.finishCell(i, cleared, null, events, Boolean(s.det.pro))
    }
    if (cleared.length) {
      events.push({ kind: 'cleared', cells: cleared })
      if (this.spots.length) this.checkSpots(events)
    }
    return events
  }

  /** 남은 분사 시간 (무제한이면 Infinity) */
  budgetOf(det: DetergentSpec): number {
    if (this.level.sprayBudgetSec === undefined) return Infinity
    return this.sprayLeft.get(det.id) ?? this.level.sprayBudgetSec * (det.pro ? PRO_BUDGET_MUL : 1)
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
    this.forEachInRadius(cx, cy, item.radius, (i) => {
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

  /** 이 판에서 아예 못 쓰는 도구인지 (실외 전용 도구를 실내에서, 또는 허용 표면이 하나도 없음) */
  canUse(item: ItemSpec): boolean {
    if (item.kind !== 'tool') return true
    if (item.outdoorOnly && !this.level.outdoor) return false
    if (!item.onlyOn) return true
    return this.surfaces.some((s) => item.onlyOn!.includes(s))
  }

  private take(i: number, delta: number) {
    this.remaining -= delta
    this.perType[this.type[i]] -= delta
    this.version++
  }

  /** 남은 오염을 전부 지움 (클리어 연출용) */
  clearAll() {
    for (let i = 0; i < this.amount.length; i++) {
      if (this.amount[i] > 0) this.take(i, this.amount[i])
      this.amount[i] = 0
      if (this.under[i] > 0) {
        this.remaining -= this.under[i]
        this.perType[this.underType[i]] -= this.under[i]
        this.under[i] = 0
      }
    }
    this.remaining = Math.max(0, this.remaining)
    this.version++
  }

  /** 칸이 다 지워짐 — 아래층이 있으면 드러내고, 없으면 비움. 종류가 다 사라지면 typecleared */
  private finishCell(i: number, cleared: number[], revealed: number[] | null, events: SessionEvent[], pro = false) {
    const t = this.type[i]
    this.take(i, this.amount[i])
    if (this.under[i] > 0) {
      this.amount[i] = this.under[i]
      this.type[i] = this.underType[i]
      this.under[i] = 0
      if (revealed) revealed.push(i)
      else cleared.push(i)
    } else {
      this.amount[i] = 0
      cleared.push(i)
      // 고성능 장비로 바닥까지 지운 칸은 광택이 남는다
      if (pro && !this.shine[i]) {
        this.shine[i] = 1
        this.shineCells++
      }
    }
    if (this.perType[t] < 0.05 && this.perType[t] > -1) {
      this.perType[t] = -1 // 한 번만 알림
      events.push({ kind: 'typecleared', dirt: DIRT_TYPES[t] })
    }
  }

  private noEffect(reason: NoEffectReason, dirt: DirtType, surface: SurfaceType, item: string, events: SessionEvent[]) {
    const key = `${reason}|${dirt}`
    const last = this.lastNoEffectAt.get(key) ?? -10
    if (this.time - last < 2.5) return
    this.lastNoEffectAt.set(key, this.time)
    events.push({ kind: 'noeffect', reason, dirt, surface, item })
  }

  /** 도구로 (cx,cy) 지점을 dt 초 동안 문지름 — 레시피가 맞는 칸만 지워진다 */
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
    const tailRate = this.level.tailRate ?? 1
    const isRinse = tool.families.includes('rinse')
    // 무효과 통계: 오염 칸 수 vs 효과 난 칸 수, 가장 흔한 이유
    let dirtyCells = 0
    let effective = 0
    const reasons = new Map<string, { n: number; reason: NoEffectReason; dirt: DirtType; surface: SurfaceType }>()
    this.forEachInRadius(cx, cy, tool.radius, (i, w) => {
      if (isRinse) this.soak[i] = null // 헹굼: 세제를 씻어냄 (효과 판정은 헹굼 전 세제로)
      const a = this.amount[i]
      if (a <= 0) return
      const surface = this.surfaceAt(i)
      // 실외 전용 도구는 허용 표면 밖에서는 효과 없음
      if (tool.onlyOn && !tool.onlyOn.includes(surface)) return
      dirtyCells++
      const dirt = DIRT_TYPES[this.type[i]]
      const s = isRinse ? null : this.soak[i]
      const det = s && s.until > this.time ? s.det : null
      const fam = det ? det.family : null
      const recipe = matchRecipe(dirt, surface, tool, fam)
      if (!recipe) {
        // 이유는 "양"으로 가중 — 얇게 깔린 먼지보다 플레이어가 노리는 진한 얼룩의 이유를 말해 준다
        const reason = diagnose(dirt, surface, tool, fam)
        const key = `${reason}|${dirt}`
        const r = reasons.get(key)
        if (r) r.n += a
        else reasons.set(key, { n: a, reason, dirt, surface })
        return
      }
      effective++
      const toolFam = recipe.tools.find((f) => tool.families.includes(f))!
      const rk = recipeKey(dirt, toolFam, recipe.cleaner ?? null)
      if (!this.discovered.has(rk)) {
        this.discovered.add(rk)
        events.push({ kind: 'discovered', dirt, tool: toolFam, cleaner: recipe.cleaner ?? null })
      }
      const mult = det ? det.mult[dirt] : 1
      const pro = Boolean(tool.pro || det?.pro)
      let rate = (tool.power * tool.effect[dirt] * recipe.speed * mult * w) / (DIRT_RESIST[dirt] * resistMul)
      // 찌든 때: 마지막 층은 일반 도구로는 더디다 (고성능 장비는 끝까지 같은 속도)
      if (!pro && a < TAIL_AMOUNT) rate *= tailRate
      const next = Math.max(0, a - rate * dt)
      this.take(i, a - next)
      this.amount[i] = next
      this.engaged = true
      if (next < 0.02) this.finishCell(i, cleared, revealed, events, pro)
    })
    if (dirtyCells > 0) {
      if (effective === 0 && reasons.size) {
        let top: { n: number; reason: NoEffectReason; dirt: DirtType; surface: SurfaceType } | null = null
        for (const r of reasons.values()) if (!top || r.n > top.n) top = r
        if (top) {
          const set = this.tried.get(top.dirt) ?? new Set<string>()
          set.add(tool.id)
          this.tried.set(top.dirt, set)
          this.noEffect(top.reason, top.dirt, top.surface, tool.id, events)
        }
      }
    }
    if (revealed.length) events.push({ kind: 'revealed', cells: revealed })
    if (cleared.length) {
      events.push({ kind: 'cleared', cells: cleared })
      if (this.spots.length) this.checkSpots(events)
    }
    return events
  }

  /** 세정제 분사 — 칸을 불림. 용량이 남아야 하고, 염소계↔산성이 같은 칸에서 겹치면 위험 혼합 */
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
    this.engaged = true
    this.applyHarm(det, cx, cy, dt, events)
    let mixed: Chemistry | null = null
    let mix: MixDef | undefined
    const mixCells: number[] = []
    this.forEachInRadius(cx, cy, det.radius, (i) => {
      const prev = this.soak[i]
      const live = prev && prev.until > this.time ? prev : null
      if (live && isHazardMix(live.det.chemistry, det.chemistry)) mixed = live.det.chemistry
      // 이미 혼합물인 칸에 그 재료를 더 뿌리면 혼합물이 그대로 남는다(시간만 연장) — 다른 세정제를 뿌리면 새 세정제로 덮인다
      if (live && live.det.id.startsWith('mix:') && mixHasPart(live.det.family, det.family)) {
        this.soak[i] = { det: live.det, until: this.time + live.det.soakSec }
        return
      }
      // 다른 세정제가 아직 남아 있는 칸에 겹쳐 뿌리면 혼합물
      const m = live && !live.det.id.startsWith('mix:') ? findMix(live.det.family, det.family) : undefined
      if (m) {
        mix = m
        mixCells.push(i)
        this.soak[i] = { det: m.det, until: this.time + m.det.soakSec }
        if (this.amount[i] > 0) {
          const set = this.tried.get(this.dirtAt(i)) ?? new Set<string>()
          set.add(m.det.id)
          this.tried.set(this.dirtAt(i), set)
        }
        return
      }
      this.soak[i] = { det, until: this.time + det.soakSec }
      if (this.amount[i] > 0) {
        const set = this.tried.get(this.dirtAt(i)) ?? new Set<string>()
        set.add(det.id)
        this.tried.set(this.dirtAt(i), set)
      }
    })
    if (mixed && !this.hazard) {
      this.hazard = true
      events.push({ kind: 'hazard', a: mixed, b: det.chemistry })
    }
    if (mix && mixCells.length && this.time - this.lastMixAt > 1.2) {
      this.lastMixAt = this.time
      events.push({ kind: 'mixed', mix: mix.id, family: mix.det.family, cells: mixCells, neutralized: Boolean(mix.neutralized) })
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

  /** 오염 종류별 시도 횟수(실패 포함) — 힌트 조건 */
  triesOn(d: DirtType): number {
    return this.tried.get(d)?.size ?? 0
  }
}

export interface Result {
  stars: number
  coins: number
  timeSec: number
  damage: number
  hazard: boolean
  /** 광택 마감 비율 (0~1) — 고성능 장비로 지운 칸 */
  polish: number
  /** 광택 보너스 코인 (coins 에 포함) */
  polishBonus: number
}

/** 별점: 기본 3, 목표시간 초과 -1(2배 초과 -2), 손상 15% 이상 -1, 위험 혼합 -1, 최소 1. 광택 마감 50% 이상이면 보너스 코인 */
export function scoreSession(s: Pick<CleanSession, 'time' | 'damage' | 'hazard'> & { polish?: number }, parSec: number, tier = 1): Result {
  let stars = 3
  if (s.time > parSec) stars--
  if (s.time > parSec * 2) stars--
  if (s.damage >= 0.15) stars--
  if (s.hazard) stars--
  stars = Math.max(1, stars)
  const polish = Math.max(0, Math.min(1, s.polish ?? 0))
  const polishBonus = polish >= 0.5 ? Math.round(10 * polish) * tier : 0
  return { stars, coins: (20 + stars * 10) * tier + polishBonus, timeSec: Math.round(s.time), damage: s.damage, hazard: s.hazard, polish, polishBonus }
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
