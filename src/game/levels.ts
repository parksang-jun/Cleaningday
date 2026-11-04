// 스테이지 정의 — 청소 범위별로 묶고(아파트 → 단독주택 정원 → 자동차), 순서대로 갈수록 어려워진다.
//
//  월드 1 아파트   : 거실(1~6) · 방(7~12) · 주방(13~18) · 화장실(19~24)
//  월드 2 단독주택 : 정원(25~36) — 테라스·데크·외벽·정원 가구·담장
//  월드 3 자동차   : 실외(37~42) — 보닛·앞유리·휠 / 실내(43~48) — 시트·대시보드·바닥매트
//
// 난이도 단계(TIER)는 스테이지 번호 구간으로 정해지며 규칙이 하나씩 추가된다.
//  T1  1~8   기본: 한 표면, 오염 1~2종, 통과 90%, 제한시간 없음
//  T2  9~16  겹친 오염(윗층을 지우면 아래층이 드러남) + 제한시간, 통과 93%
//  T3 17~24  복합 표면(구역마다 도구를 바꿔야 함) + 세제 용량 제한 + 헹굼 도구(23), 통과 95%
//  T4 25~36  정원: 고압세척기, 끈질긴 오염, 통과 96%
//  T5 37~48  자동차: 모든 규칙, 오염 4종, 통과 97%, 가장 짧은 제한시간
//
// 목표 시간(parSec)·제한시간(limitSec)은 봇(bot.ts) 플레이 시간 × 단계 배수 → resolveTiming()
import type { DirtType, ItemId, SurfaceType } from './catalog'

export interface DirtPatch {
  type: DirtType
  blobs: number
  size: [number, number] // 반경 범위(칸)
  amount: [number, number] // 농도 0~1
  coverage?: number // 얇은 막(먼지 등) 비율
  /** 겹친 오염: 이 얼룩 아래에 깔린 오염 종류 (윗층을 지워야 드러남) */
  under?: DirtType
  underAmount?: [number, number]
  /** 얼룩마다 아래층이 깔릴 확률 (기본 1) */
  underChance?: number
}

/** 복합 표면 구역 — 격자 비율(0~1) 좌표. 뒤에 오는 구역이 앞 구역을 덮는다 */
export interface Zone {
  x0: number
  y0: number
  x1: number
  y1: number
  surface: SurfaceType
  scene: SceneId
}

export type SceneId =
  // 아파트
  | 'floor'
  | 'sofa'
  | 'window'
  | 'desk'
  | 'bed'
  | 'kitchenTile'
  | 'stove'
  | 'sink'
  | 'table'
  | 'bathTile'
  | 'basin'
  | 'mirror'
  | 'bathtub'
  | 'tub'
  | 'livingMix'
  | 'roomMix'
  | 'kitchenMix'
  | 'bathMix'
  // 단독주택 정원
  | 'patio'
  | 'deck'
  | 'brickWall'
  | 'gardenChair'
  | 'fence'
  | 'gardenMix'
  | 'deckMix'
  | 'yardMix'
  // 자동차
  | 'car'
  | 'windshield'
  | 'wheel'
  | 'seat'
  | 'dashboard'
  | 'floorMat'
  | 'carExtMix'
  | 'carFullMix'
  | 'carIntMix'
  // 레거시(단독 호출용)
  | 'entrance'
  | 'bigClean'

export type WorldId = 'apartment' | 'house' | 'car'
export type AreaId = 'living' | 'room' | 'kitchen' | 'bathroom' | 'garden' | 'exterior' | 'interior'

export interface TierDef {
  id: number
  passClean: number
  resistMul: number
  parFactor: number // 목표시간 = 봇 시간 × parFactor
  limitFactor?: number // 제한시간 = 목표시간 × limitFactor (없으면 제한 없음)
  sprayBudgetSec?: number // 세제별 분사 가능 시간(초)
  fromId: number
}

export const TIERS: TierDef[] = [
  { id: 1, fromId: 1, passClean: 0.9, resistMul: 1.0, parFactor: 1.8 },
  { id: 2, fromId: 9, passClean: 0.93, resistMul: 1.05, parFactor: 1.6, limitFactor: 2.4 },
  { id: 3, fromId: 17, passClean: 0.95, resistMul: 1.1, parFactor: 1.5, limitFactor: 2.2, sprayBudgetSec: 10 },
  { id: 4, fromId: 25, passClean: 0.96, resistMul: 1.15, parFactor: 1.4, limitFactor: 2.0, sprayBudgetSec: 8 },
  { id: 5, fromId: 37, passClean: 0.97, resistMul: 1.2, parFactor: 1.3, limitFactor: 1.8, sprayBudgetSec: 7 },
]

export function tierFor(id: number): TierDef {
  let t = TIERS[0]
  for (const tier of TIERS) if (id >= tier.fromId) t = tier
  return t
}

export interface LevelDef {
  id: number
  world: WorldId
  area: AreaId
  tier: number
  scene: SceneId
  surface: SurfaceType // 대표 표면 (구역이 없으면 전체)
  zones?: Zone[]
  patches: DirtPatch[]
  passClean: number
  resistMul: number
  sprayBudgetSec?: number
  grants: ItemId[]
  hint?: string
  seed: number
  parFactor: number
  limitFactor?: number
}

export const GRID_W = 48
export const GRID_H = 64

/** 복합 장면의 구역 배치 */
export const ZONE_LAYOUTS: Partial<Record<SceneId, Zone[]>> = {
  livingMix: [
    { x0: 0, y0: 0, x1: 1, y1: 1, surface: 'wood', scene: 'floor' },
    { x0: 0.12, y0: 0.42, x1: 0.88, y1: 0.92, surface: 'fabric', scene: 'sofa' },
  ],
  roomMix: [
    { x0: 0, y0: 0, x1: 1, y1: 1, surface: 'wood', scene: 'floor' },
    { x0: 0.1, y0: 0.08, x1: 0.9, y1: 0.6, surface: 'fabric', scene: 'bed' },
  ],
  kitchenMix: [
    { x0: 0, y0: 0, x1: 1, y1: 0.38, surface: 'tile', scene: 'kitchenTile' },
    { x0: 0, y0: 0.38, x1: 1, y1: 0.74, surface: 'steel', scene: 'stove' },
    { x0: 0, y0: 0.74, x1: 1, y1: 1, surface: 'wood', scene: 'table' },
  ],
  bathMix: [
    { x0: 0, y0: 0, x1: 1, y1: 0.55, surface: 'tile', scene: 'bathTile' },
    { x0: 0, y0: 0.55, x1: 1, y1: 1, surface: 'ceramic', scene: 'tub' },
  ],
  gardenMix: [
    { x0: 0, y0: 0, x1: 1, y1: 0.45, surface: 'brick', scene: 'brickWall' },
    { x0: 0, y0: 0.45, x1: 1, y1: 1, surface: 'wood', scene: 'deck' },
  ],
  deckMix: [
    { x0: 0, y0: 0, x1: 0.5, y1: 1, surface: 'stone', scene: 'patio' },
    { x0: 0.5, y0: 0, x1: 1, y1: 1, surface: 'wood', scene: 'deck' },
  ],
  yardMix: [
    { x0: 0, y0: 0, x1: 1, y1: 0.5, surface: 'paint', scene: 'fence' },
    { x0: 0, y0: 0.5, x1: 1, y1: 1, surface: 'plastic', scene: 'gardenChair' },
  ],
  carExtMix: [
    { x0: 0, y0: 0, x1: 1, y1: 0.36, surface: 'glass', scene: 'windshield' },
    { x0: 0, y0: 0.36, x1: 1, y1: 1, surface: 'paint', scene: 'car' },
  ],
  carFullMix: [
    { x0: 0, y0: 0, x1: 1, y1: 0.34, surface: 'glass', scene: 'windshield' },
    { x0: 0, y0: 0.34, x1: 1, y1: 1, surface: 'paint', scene: 'car' },
    { x0: 0.05, y0: 0.7, x1: 0.42, y1: 0.98, surface: 'metal', scene: 'wheel' },
  ],
  carIntMix: [
    { x0: 0, y0: 0, x1: 1, y1: 0.42, surface: 'vinyl', scene: 'dashboard' },
    { x0: 0, y0: 0.42, x1: 1, y1: 1, surface: 'fabric', scene: 'seat' },
  ],
}

const SCENE_SURFACE: Record<SceneId, SurfaceType> = {
  floor: 'wood',
  sofa: 'fabric',
  window: 'glass',
  desk: 'wood',
  bed: 'fabric',
  kitchenTile: 'tile',
  stove: 'steel',
  sink: 'steel',
  table: 'wood',
  bathTile: 'tile',
  basin: 'ceramic',
  mirror: 'glass',
  bathtub: 'ceramic',
  tub: 'ceramic',
  livingMix: 'wood',
  roomMix: 'wood',
  kitchenMix: 'tile',
  bathMix: 'tile',
  patio: 'stone',
  deck: 'wood',
  brickWall: 'brick',
  gardenChair: 'plastic',
  fence: 'paint',
  gardenMix: 'brick',
  deckMix: 'stone',
  yardMix: 'paint',
  car: 'paint',
  windshield: 'glass',
  wheel: 'metal',
  seat: 'fabric',
  dashboard: 'vinyl',
  floorMat: 'fabric',
  carExtMix: 'paint',
  carFullMix: 'paint',
  carIntMix: 'vinyl',
  entrance: 'tile',
  bigClean: 'tile',
}

interface StageSeed {
  scene: SceneId
  dirt: DirtType[] // 첫 번째가 주 오염
  layered?: boolean
  grants?: ItemId[]
  hint?: string
}

interface AreaSeed {
  id: AreaId
  /** 구역별 오염량 배수 — 넓은 실외·끈질긴 실내일수록 크다 (난이도가 구역 순서대로 오르도록) */
  scale: number
  stages: StageSeed[]
}

interface WorldSeed {
  id: WorldId
  areas: AreaSeed[]
}

const WORLD_SEEDS: WorldSeed[] = [
  {
    id: 'apartment',
    areas: [
      {
        id: 'living',
        scale: 1.0,
        stages: [
          { scene: 'floor', dirt: ['dust'], grants: ['cloth', 'sponge', 'allpurpose'], hint: 'hintDust' },
          { scene: 'sofa', dirt: ['dust', 'stain'], grants: ['vacuum'], hint: 'hintFabric' },
          { scene: 'window', dirt: ['dust', 'stain'], hint: 'hintGlass' },
          { scene: 'floor', dirt: ['mud', 'dust'], hint: 'hintMud' },
          { scene: 'sofa', dirt: ['stain', 'dust'], hint: 'hintStain' },
          { scene: 'livingMix', dirt: ['dust', 'stain', 'mud'], hint: 'hintZones' },
        ],
      },
      {
        id: 'room',
        scale: 1.1,
        stages: [
          { scene: 'desk', dirt: ['stain', 'dust'], hint: 'hintWood' },
          { scene: 'bed', dirt: ['dust', 'stain'] },
          { scene: 'floor', dirt: ['dust', 'stain'], layered: true, hint: 'hintLayered' },
          { scene: 'desk', dirt: ['grease', 'stain'], layered: true, hint: 'hintLimit' },
          { scene: 'bed', dirt: ['stain', 'dust'], layered: true },
          { scene: 'roomMix', dirt: ['dust', 'stain', 'mud'], layered: true },
        ],
      },
      {
        id: 'kitchen',
        scale: 1.2,
        stages: [
          { scene: 'stove', dirt: ['grease', 'stain'], grants: ['degreaser'], hint: 'hintGrease' },
          { scene: 'sink', dirt: ['scale', 'grease'], grants: ['descaler', 'brush'], hint: 'hintScale' },
          { scene: 'table', dirt: ['stain', 'grease'], hint: 'hintWood' },
          { scene: 'kitchenTile', dirt: ['grease', 'stain', 'dust'], layered: true },
          { scene: 'kitchenMix', dirt: ['grease', 'stain', 'dust'], hint: 'hintBudget' },
          { scene: 'kitchenMix', dirt: ['grease', 'scale', 'stain', 'dust'], layered: true },
        ],
      },
      {
        id: 'bathroom',
        scale: 1.3,
        stages: [
          { scene: 'bathTile', dirt: ['scale', 'dust'] },
          { scene: 'basin', dirt: ['scale', 'stain'] },
          { scene: 'mirror', dirt: ['stain', 'scale', 'dust'], layered: true, hint: 'hintGlass' },
          { scene: 'bathtub', dirt: ['mold', 'stain'], grants: ['moldremover'], hint: 'hintMold' },
          { scene: 'bathtub', dirt: ['mold', 'scale'], grants: ['rinse'], hint: 'hintRinse' },
          { scene: 'bathMix', dirt: ['mold', 'scale', 'stain'], layered: true },
        ],
      },
    ],
  },
  {
    id: 'house',
    areas: [
      {
        id: 'garden',
        scale: 1.7,
        stages: [
          { scene: 'patio', dirt: ['mud', 'dust'], grants: ['washer'], hint: 'hintPatio' },
          { scene: 'deck', dirt: ['mud', 'stain', 'dust'], hint: 'hintDeck' },
          { scene: 'brickWall', dirt: ['dust', 'mold', 'stain'] },
          { scene: 'gardenChair', dirt: ['mud', 'dust', 'stain'], hint: 'hintPlastic' },
          { scene: 'fence', dirt: ['mud', 'dust'] },
          { scene: 'patio', dirt: ['mud', 'mold'], layered: true },
          { scene: 'deck', dirt: ['mud', 'stain'], layered: true },
          { scene: 'brickWall', dirt: ['mold', 'stain', 'dust'], layered: true },
          { scene: 'gardenMix', dirt: ['mold', 'mud', 'stain', 'dust'] },
          { scene: 'deckMix', dirt: ['mud', 'mold', 'stain'], layered: true },
          { scene: 'yardMix', dirt: ['mud', 'dust', 'stain'], layered: true },
          { scene: 'gardenMix', dirt: ['mold', 'mud', 'stain', 'dust'], layered: true, hint: 'hintBig' },
        ],
      },
    ],
  },
  {
    id: 'car',
    areas: [
      {
        id: 'exterior',
        scale: 2.4,
        stages: [
          { scene: 'car', dirt: ['mud', 'dust'], hint: 'hintCar' },
          { scene: 'windshield', dirt: ['dust', 'stain'] },
          { scene: 'wheel', dirt: ['scale', 'mud'], hint: 'hintWheel' },
          { scene: 'car', dirt: ['mud', 'stain', 'dust'], layered: true },
          { scene: 'carExtMix', dirt: ['mud', 'dust', 'stain'], layered: true },
          { scene: 'carFullMix', dirt: ['mud', 'scale', 'stain', 'dust'], layered: true },
        ],
      },
      {
        id: 'interior',
        scale: 2.0,
        stages: [
          { scene: 'seat', dirt: ['dust', 'stain'], hint: 'hintFabric' },
          { scene: 'dashboard', dirt: ['dust', 'stain'], hint: 'hintVinyl' },
          { scene: 'floorMat', dirt: ['mud', 'dust'] },
          { scene: 'seat', dirt: ['stain', 'grease', 'dust'], layered: true },
          { scene: 'carIntMix', dirt: ['dust', 'stain', 'grease'], layered: true },
          { scene: 'carIntMix', dirt: ['grease', 'stain', 'mud', 'dust'], layered: true, hint: 'hintBig' },
        ],
      },
    ],
  },
]

/** 난이도 t(0~1)·구역 배수에 따른 얼룩 생성 — 뒤로 갈수록 더 많고, 더 크고, 더 진하게 */
function patchesFor(seed: StageSeed, t: number, scale: number): DirtPatch[] {
  const baseBlobs = [7, 4, 3, 2, 2]
  const out: DirtPatch[] = []
  seed.dirt.forEach((type, k) => {
    const blobs = Math.round(baseBlobs[k] * (0.9 + 0.2 * t) * scale)
    const sMin = (k === 0 ? 4 : 3) * (1 + 0.1 * t)
    const sMax = (k === 0 ? 7.5 : 5.5) * (1 + 0.12 * t)
    const amount: [number, number] = [0.5 + 0.15 * t, 0.8 + 0.1 * t]
    const p: DirtPatch = { type, blobs, size: [round1(sMin), round1(sMax)], amount: [round2(amount[0]), round2(amount[1])] }
    if (type === 'dust') p.coverage = round2(0.18 + 0.1 * t)
    if (seed.layered && k === 0 && seed.dirt[1]) {
      p.under = seed.dirt[1]
      p.underAmount = [round2(0.3 + 0.15 * t), round2(0.45 + 0.2 * t)]
      p.underChance = 0.6
    }
    out.push(p)
  })
  return out
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
function round2(n: number) {
  return Math.round(n * 100) / 100
}

export interface AreaInfo {
  id: AreaId
  world: WorldId
  levelIds: number[]
}
export interface WorldInfo {
  id: WorldId
  areas: AreaInfo[]
}

function build(): { levels: LevelDef[]; worlds: WorldInfo[] } {
  const levels: LevelDef[] = []
  const worlds: WorldInfo[] = []
  const total = WORLD_SEEDS.reduce((n, w) => n + w.areas.reduce((m, a) => m + a.stages.length, 0), 0)
  let id = 0
  for (const w of WORLD_SEEDS) {
    const info: WorldInfo = { id: w.id, areas: [] }
    for (const a of w.areas) {
      const area: AreaInfo = { id: a.id, world: w.id, levelIds: [] }
      for (const seed of a.stages) {
        id++
        const tier = tierFor(id)
        const t = (id - 1) / (total - 1)
        levels.push({
          id,
          world: w.id,
          area: a.id,
          tier: tier.id,
          scene: seed.scene,
          surface: SCENE_SURFACE[seed.scene],
          zones: ZONE_LAYOUTS[seed.scene],
          patches: patchesFor(seed, t, a.scale),
          passClean: tier.passClean,
          resistMul: tier.resistMul,
          sprayBudgetSec: tier.sprayBudgetSec,
          grants: seed.grants ?? [],
          hint: seed.hint,
          seed: id * 7919 + 17,
          parFactor: tier.parFactor,
          limitFactor: tier.limitFactor,
        })
        area.levelIds.push(id)
      }
      info.areas.push(area)
    }
    worlds.push(info)
  }
  return { levels, worlds }
}

const built = build()
export const LEVELS: LevelDef[] = built.levels
export const WORLDS: WorldInfo[] = built.worlds

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id)
}

/** 스테이지 n까지 누적 지급 아이템 */
export function grantsUpTo(levelId: number): ItemId[] {
  return LEVELS.filter((l) => l.id <= levelId).flatMap((l) => l.grants)
}
