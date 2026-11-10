// 스테이지 정의 — 청소 범위별로 묶고(아파트 → 단독주택 정원 → 자동차), 순서대로 갈수록 어려워진다.
//
//  월드 1 아파트   : 거실(1~12) · 방(13~24) · 주방(25~36) · 화장실(37~48)
//  월드 2 단독주택 : 정원(49~72) — 테라스·데크·외벽·정원 가구·담장·그릴
//  월드 3 자동차   : 실외(73~84) — 보닛·앞유리·휠·헤드라이트 / 실내(85~96) — 시트·대시보드·바닥매트·트렁크
//
// 난이도 단계(TIER)는 스테이지 번호 구간으로 정해지며 규칙이 하나씩 추가된다.
//  T1  1~12  기본: 오염 1~2종, 통과 90%, 제한시간 없음 — 맞는 도구 찾기 학습
//  T2 13~24  겹친 오염(윗층을 지우면 아래층이 드러남) + 제한시간, 통과 92%
//  T3 25~36  주방: 세정제가 꼭 필요한 오염(기름때·물때) + 세정제 용량 제한, 통과 94%
//  T4 37~48  화장실: 곰팡이·비누때, 염소계↔산성 안전(헹굼), 통과 95%
//  T5 49~72  정원: 실외 도구(호스·고압세척기), 이끼·곰팡이, 통과 96%
//  T6 73~96  자동차: 전용 세정제(카샴푸·휠·타르·실내), 오염 4~6종, 통과 97%, 가장 짧은 제한시간
//
// 각 스테이지의 오염은 "맞는 도구(+세정제)" 로만 지워진다(catalog.ts RECIPES). 지급(grants)은 그 오염이 처음 나오는 판에
// 맞는 아이템을 다른 후보와 함께 주어, 플레이어가 여러 시도 끝에 맞는 조합을 찾게 한다.
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
  /** 스팟 모드의 표적 얼룩 — 중심이 표적 링이 된다 */
  spot?: boolean
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
  | 'rug'
  | 'shelf'
  | 'desk'
  | 'bed'
  | 'closet'
  | 'kitchenTile'
  | 'stove'
  | 'sink'
  | 'table'
  | 'fridge'
  | 'bathTile'
  | 'basin'
  | 'mirror'
  | 'bathtub'
  | 'tub'
  | 'toilet'
  | 'showerglass'
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
  | 'grill'
  | 'gardenMix'
  | 'deckMix'
  | 'yardMix'
  // 자동차
  | 'car'
  | 'windshield'
  | 'wheel'
  | 'headlight'
  | 'seat'
  | 'dashboard'
  | 'floorMat'
  | 'trunk'
  | 'carExtMix'
  | 'carFullMix'
  | 'carIntMix'
  // 레거시(단독 호출용)
  | 'entrance'
  | 'bigClean'

export type WorldId = 'apartment' | 'house' | 'car'
export type AreaId = 'living' | 'room' | 'kitchen' | 'bathroom' | 'garden' | 'exterior' | 'interior'

/**
 * 스테이지 모드 — 같은 "닦기"라도 목표와 긴장이 다르다
 *  clean   기준 % 이상 닦기 (기본)
 *  spots   끈질긴 얼룩 몇 곳을 완전히 지우기 (표적 링, N/N)
 *  rush    닦는 동안 오염이 계속 생김(발자국·털·튀는 기름) — 다 생길 때까지 버티고 기준 달성
 *  spread  곰팡이·이끼가 번짐 — 세정제로 눌러야 멈춤
 *  fragile 민감한 표면 — 손상 10% 이면 실패 (유리·원목·비닐·플라스틱)
 *  dark    정전/밤 — 손전등 반경 안만 보임
 */
export type StageMode = 'clean' | 'spots' | 'rush' | 'spread' | 'fragile' | 'dark'
export type ThemeId =
  | 'morning' | 'party' | 'rain' | 'pet' | 'cat' | 'guests' | 'blackout' | 'monsoon' | 'movein' | 'kids' | 'cooking' | 'holiday' | 'spring'
  | 'weekend' | 'roadtrip' | 'bugs' | 'winter' | 'garden' | 'pollen' | 'storm' | 'bbq' | 'rental' | 'birthday' | 'sick' | 'latenight' | 'precision'
  | 'marathon' | 'newcar' | 'kidsCar' | 'beach'

/** 러시 모드: 플레이 중 생기는 오염 */
export interface SpawnDef {
  type: DirtType
  every: number // 초
  count: number
  size: [number, number]
  amount: [number, number]
}
/** 번짐 모드: 자라는 오염 */
export interface GrowthDef {
  type: DirtType
  rate: number // 초당 새로 감염되는 칸 수(대략)
  cap: number // 처음 양 대비 최대 배수
}

/**
 * 재오염 — 청소하는 동안 누가 자꾸 어지럽힌다. 4단계부터 (러시 모드 제외) 모든 판에 붙는다.
 *  kids      아이들이 뛰어다님 → 발자국 줄(trail)
 *  pet       반려동물이 지나감 → 털·발자국 줄(trail)
 *  splatter  요리하다 기름·소스가 튐 → 점점이(scatter)
 *  drift     창문·선반에 먼지가 내려앉음 → 옅게 넓게(haze)
 *  splash    물·비누 거품이 튐 → 점점이(scatter)
 *  leaves    낙엽·흙이 날려 옴 → 점점이(scatter)
 *  birds     새똥·벌레가 떨어짐 → 점점이(scatter)
 * 빨리 끝낼수록 덜 당한다 — 좋은 장비·부스터를 살 이유.
 */
export type MessKind = 'kids' | 'pet' | 'splatter' | 'drift' | 'splash' | 'leaves' | 'birds'
export type MessPattern = 'trail' | 'scatter' | 'haze'
export interface MessDef {
  kind: MessKind
  type: DirtType
  pattern: MessPattern
  /** 첫 발생(초, 시계 기준) */
  after: number
  /** 반복 간격(초) */
  every: number
  /** 한 번에 생기는 양 = 처음 오염량 × amount */
  amount: number
  /** 총 상한 = 처음 오염량 × cap */
  cap: number
}
/** 재오염이 시작되는 단계 (1~3단계는 안내 단계라 조용하다) */
export const MESS_FROM = 4

export interface TierDef {
  id: number
  passClean: number
  resistMul: number
  parFactor: number // 목표시간 = 봇 시간 × parFactor
  limitFactor?: number // 제한시간 = 목표시간 × limitFactor (없으면 제한 없음)
  sprayBudgetSec?: number // 세제별 분사 가능 시간(초)
  /** 찌든 때 감속 — 일반 도구가 마지막 층(TAIL_AMOUNT 아래)을 지우는 속도 배율 (없으면 1). 고성능 장비는 무시 */
  tailRate?: number
  fromId: number
}

export const TIERS: TierDef[] = [
  { id: 1, fromId: 1, passClean: 0.9, resistMul: 1.0, parFactor: 1.8 },
  { id: 2, fromId: 13, passClean: 0.93, resistMul: 1.05, parFactor: 1.6, limitFactor: 2.6 },
  { id: 3, fromId: 25, passClean: 0.95, resistMul: 1.1, parFactor: 1.5, limitFactor: 2.3, sprayBudgetSec: 18, tailRate: 0.7 },
  { id: 4, fromId: 37, passClean: 0.96, resistMul: 1.15, parFactor: 1.4, limitFactor: 2.1, sprayBudgetSec: 16, tailRate: 0.65 },
  { id: 5, fromId: 49, passClean: 0.97, resistMul: 1.2, parFactor: 1.3, limitFactor: 1.9, sprayBudgetSec: 14, tailRate: 0.6 },
  { id: 6, fromId: 73, passClean: 0.98, resistMul: 1.25, parFactor: 1.2, limitFactor: 1.75, sprayBudgetSec: 12, tailRate: 0.55 },
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
  mode: StageMode
  theme: ThemeId
  spawn?: SpawnDef
  growth?: GrowthDef
  /** 재오염 (4단계부터, 러시 제외) */
  mess?: MessDef
  failDamage?: number // fragile: 이 손상 비율이면 실패
  outdoor: boolean // 실외(정원·자동차 실외) — 호스·고압세척기 사용 가능
  surface: SurfaceType // 대표 표면 (구역이 없으면 전체)
  zones?: Zone[]
  patches: DirtPatch[]
  passClean: number
  resistMul: number
  sprayBudgetSec?: number
  tailRate?: number
  grants: ItemId[]
  hint?: string
  seed: number
  parFactor: number
  limitFactor?: number
}

export const GRID_W = 56
export const GRID_H = 72

/** 복합 장면의 구역 배치 */
export const ZONE_LAYOUTS: Partial<Record<SceneId, Zone[]>> = {
  livingMix: [
    { x0: 0, y0: 0, x1: 1, y1: 1, surface: 'wood', scene: 'floor' },
    { x0: 0.1, y0: 0.4, x1: 0.9, y1: 0.9, surface: 'fabric', scene: 'sofa' },
  ],
  roomMix: [
    { x0: 0, y0: 0, x1: 1, y1: 1, surface: 'wood', scene: 'floor' },
    { x0: 0.08, y0: 0.06, x1: 0.92, y1: 0.58, surface: 'fabric', scene: 'bed' },
  ],
  kitchenMix: [
    { x0: 0, y0: 0, x1: 1, y1: 0.36, surface: 'tile', scene: 'kitchenTile' },
    { x0: 0, y0: 0.36, x1: 1, y1: 0.72, surface: 'steel', scene: 'stove' },
    { x0: 0, y0: 0.72, x1: 1, y1: 1, surface: 'wood', scene: 'table' },
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
  rug: 'fabric',
  shelf: 'wood',
  desk: 'wood',
  bed: 'fabric',
  closet: 'paint',
  kitchenTile: 'tile',
  stove: 'steel',
  sink: 'steel',
  table: 'wood',
  fridge: 'steel',
  bathTile: 'tile',
  basin: 'ceramic',
  mirror: 'glass',
  bathtub: 'ceramic',
  tub: 'ceramic',
  toilet: 'ceramic',
  showerglass: 'glass',
  livingMix: 'wood',
  roomMix: 'wood',
  kitchenMix: 'tile',
  bathMix: 'tile',
  patio: 'stone',
  deck: 'wood',
  brickWall: 'brick',
  gardenChair: 'plastic',
  fence: 'paint',
  grill: 'metal',
  gardenMix: 'brick',
  deckMix: 'stone',
  yardMix: 'paint',
  car: 'paint',
  windshield: 'glass',
  wheel: 'metal',
  headlight: 'plastic',
  seat: 'fabric',
  dashboard: 'vinyl',
  floorMat: 'fabric',
  trunk: 'fabric',
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
  mode?: StageMode
  theme?: ThemeId
  /** rush: 생기는 오염 종류 (기본 = 주 오염) */
  spawnType?: DirtType
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
          { scene: 'floor', dirt: ['dust'], grants: ['cloth', 'vacuum', 'sponge', 'allpurpose'], hint: 'hintDust', theme: 'morning' },
          { scene: 'floor', dirt: ['stain', 'dust'], hint: 'hintTry', theme: 'kids' },
          { scene: 'sofa', dirt: ['hair', 'dust'], grants: ['lintroller', 'rubberglove'], hint: 'hintHair', mode: 'rush', spawnType: 'hair', theme: 'cat' },
          { scene: 'window', dirt: ['film', 'dust'], grants: ['glass', 'squeegee', 'vinegar', 'newspaper', 'dishsoap'], hint: 'hintFilm', theme: 'pollen' },
          { scene: 'rug', dirt: ['mud', 'hair', 'dust'], hint: 'hintRug', mode: 'rush', spawnType: 'mud', theme: 'pet' },
          { scene: 'shelf', dirt: ['film', 'stain'], hint: 'hintJournal', mode: 'spots', theme: 'movein' },
          { scene: 'floor', dirt: ['mud', 'stain', 'dust'], hint: 'hintMud', theme: 'rain' },
          { scene: 'sofa', dirt: ['stain', 'hair'], grants: ['fabric'], hint: 'hintFabricStain', mode: 'spots', theme: 'party' },
          { scene: 'window', dirt: ['stain', 'film', 'dust'], mode: 'dark', theme: 'blackout' },
          { scene: 'livingMix', dirt: ['dust', 'hair', 'stain'], hint: 'hintZones', theme: 'guests' },
          { scene: 'livingMix', dirt: ['stain', 'mud', 'hair', 'film'], mode: 'rush', spawnType: 'stain', theme: 'birthday' },
          { scene: 'livingMix', dirt: ['stain', 'mud', 'hair', 'film', 'dust'], hint: 'hintBig', theme: 'marathon' },
        ],
      },
      {
        id: 'room',
        scale: 1.1,
        stages: [
          { scene: 'desk', dirt: ['film', 'dust'], hint: 'hintLimit', theme: 'latenight' },
          { scene: 'bed', dirt: ['hair', 'dust'], mode: 'rush', spawnType: 'hair', theme: 'cat' },
          { scene: 'desk', dirt: ['stain', 'dust'], layered: true, hint: 'hintLayered', mode: 'spots', theme: 'kids' },
          { scene: 'closet', dirt: ['film', 'stain', 'dust'], theme: 'movein' },
          { scene: 'bed', dirt: ['stain', 'hair'], layered: true, theme: 'morning' },
          { scene: 'floor', dirt: ['mud', 'dust'], layered: true, mode: 'rush', spawnType: 'mud', theme: 'rain' },
          { scene: 'mirror', dirt: ['film', 'dust'], mode: 'fragile', theme: 'precision' },
          { scene: 'roomMix', dirt: ['dust', 'hair', 'stain'], layered: true, mode: 'dark', theme: 'blackout' },
          { scene: 'desk', dirt: ['film', 'stain', 'dust'], layered: true, mode: 'spots', theme: 'latenight' },
          { scene: 'closet', dirt: ['stain', 'film', 'mud'], layered: true, theme: 'rental' },
          { scene: 'roomMix', dirt: ['mud', 'hair', 'stain', 'film'], layered: true, mode: 'rush', spawnType: 'hair', theme: 'pet' },
          { scene: 'roomMix', dirt: ['stain', 'mud', 'hair', 'film', 'dust'], layered: true, hint: 'hintBig', theme: 'marathon' },
        ],
      },
      {
        id: 'kitchen',
        scale: 1.2,
        stages: [
          { scene: 'stove', dirt: ['grease', 'dust'], grants: ['degreaser', 'scrubpad', 'bakingsoda'], hint: 'hintGrease', theme: 'cooking' },
          { scene: 'sink', dirt: ['scale', 'grease'], grants: ['descaler', 'citric'], hint: 'hintScale', theme: 'morning' },
          { scene: 'table', dirt: ['stain', 'grease'], hint: 'hintWoodGrease', mode: 'fragile', theme: 'precision' },
          { scene: 'fridge', dirt: ['film', 'stain'], hint: 'hintBudget', mode: 'spots', theme: 'kids' },
          { scene: 'kitchenTile', dirt: ['grease', 'stain', 'dust'], layered: true, mode: 'rush', spawnType: 'grease', theme: 'cooking' },
          { scene: 'stove', dirt: ['grease', 'stain'], layered: true, mode: 'spots', theme: 'bbq' },
          { scene: 'sink', dirt: ['scale', 'grease', 'film'], mode: 'dark', theme: 'blackout' },
          { scene: 'fridge', dirt: ['stain', 'grease', 'film'], layered: true, theme: 'party' },
          { scene: 'kitchenMix', dirt: ['grease', 'stain', 'dust'], theme: 'guests' },
          { scene: 'kitchenMix', dirt: ['grease', 'scale', 'stain'], layered: true, mode: 'spots', theme: 'rental' },
          { scene: 'table', dirt: ['stain', 'film', 'dust'], layered: true, theme: 'holiday' },
          { scene: 'kitchenMix', dirt: ['grease', 'scale', 'stain', 'film', 'dust'], layered: true, hint: 'hintBig', theme: 'marathon' },
        ],
      },
      {
        id: 'bathroom',
        scale: 1.3,
        stages: [
          { scene: 'bathTile', dirt: ['soap', 'scale'], grants: ['bathroom', 'tilebrush', 'toothbrush'], hint: 'hintSoap', theme: 'morning' },
          { scene: 'basin', dirt: ['scale', 'soap', 'hair'], mode: 'rush', spawnType: 'hair', theme: 'sick' },
          { scene: 'mirror', dirt: ['film', 'scale', 'dust'], hint: 'hintGlassScale', mode: 'fragile', theme: 'precision' },
          { scene: 'bathtub', dirt: ['mold', 'soap'], grants: ['moldremover', 'percarbonate'], hint: 'hintMold', mode: 'spread', theme: 'monsoon' },
          { scene: 'toilet', dirt: ['scale', 'stain'], grants: ['rinse'], hint: 'hintRinse', theme: 'guests' },
          { scene: 'showerglass', dirt: ['scale', 'soap', 'film'], mode: 'fragile', theme: 'precision' },
          { scene: 'bathtub', dirt: ['mold', 'scale'], layered: true, hint: 'hintHazard', mode: 'spread', theme: 'monsoon' },
          { scene: 'bathTile', dirt: ['mold', 'soap', 'scale'], layered: true, mode: 'spots', theme: 'rental' },
          { scene: 'toilet', dirt: ['mold', 'scale', 'stain'], mode: 'dark', theme: 'blackout' },
          { scene: 'bathMix', dirt: ['mold', 'soap', 'scale'], mode: 'spread', theme: 'monsoon' },
          { scene: 'bathMix', dirt: ['scale', 'mold', 'soap', 'film'], layered: true, theme: 'holiday' },
          { scene: 'bathMix', dirt: ['mold', 'scale', 'soap', 'film', 'hair'], layered: true, hint: 'hintBig', theme: 'marathon' },
        ],
      },
    ],
  },
  {
    id: 'house',
    areas: [
      {
        id: 'garden',
        scale: 2.25,
        stages: [
          { scene: 'patio', dirt: ['mud', 'dust'], grants: ['hose', 'deckbrush'], hint: 'hintHose', theme: 'rain' },
          { scene: 'deck', dirt: ['mud', 'dust', 'stain'], hint: 'hintDeck', theme: 'garden' },
          { scene: 'patio', dirt: ['moss', 'mud'], grants: ['washer'], hint: 'hintMoss', mode: 'spread', theme: 'monsoon' },
          { scene: 'brickWall', dirt: ['dust', 'moss'], theme: 'spring' },
          { scene: 'deck', dirt: ['moss', 'mud'], grants: ['mossremover'], hint: 'hintDeckMoss', mode: 'spread', theme: 'monsoon' },
          { scene: 'gardenChair', dirt: ['mud', 'dust', 'stain'], hint: 'hintPlastic', mode: 'rush', spawnType: 'mud', theme: 'storm' },
          { scene: 'fence', dirt: ['mud', 'moss', 'dust'], theme: 'storm' },
          { scene: 'grill', dirt: ['grease', 'stain'], hint: 'hintGrill', mode: 'spots', theme: 'bbq' },
          { scene: 'deck', dirt: ['mold', 'mud'], grants: ['deckcleaner'], layered: true, hint: 'hintDeckMold', mode: 'spread', theme: 'monsoon' },
          { scene: 'brickWall', dirt: ['moss', 'mold', 'dust'], layered: true, mode: 'dark', theme: 'latenight' },
          { scene: 'patio', dirt: ['mud', 'moss', 'stain'], layered: true, mode: 'rush', spawnType: 'mud', theme: 'rain' },
          { scene: 'gardenChair', dirt: ['mold', 'mud', 'film'], hint: 'hintPlasticMold', mode: 'fragile', theme: 'precision' },
          { scene: 'fence', dirt: ['moss', 'mud', 'stain'], layered: true, theme: 'spring' },
          { scene: 'grill', dirt: ['grease', 'stain', 'dust'], layered: true, mode: 'spots', theme: 'bbq' },
          { scene: 'gardenMix', dirt: ['moss', 'mud', 'dust'], theme: 'garden' },
          { scene: 'deckMix', dirt: ['mud', 'moss', 'mold'], layered: true, mode: 'spread', theme: 'monsoon' },
          { scene: 'yardMix', dirt: ['mud', 'moss', 'stain'], layered: true, mode: 'rush', spawnType: 'mud', theme: 'storm' },
          { scene: 'gardenMix', dirt: ['moss', 'mold', 'mud', 'stain'], layered: true, theme: 'holiday' },
          { scene: 'deckMix', dirt: ['mud', 'moss', 'mold', 'dust'], layered: true, mode: 'dark', theme: 'latenight' },
          { scene: 'brickWall', dirt: ['moss', 'mold', 'mud'], layered: true, mode: 'spots', theme: 'rental' },
          { scene: 'yardMix', dirt: ['mold', 'mud', 'moss', 'film'], layered: true, mode: 'spread', theme: 'monsoon' },
          { scene: 'gardenMix', dirt: ['moss', 'mold', 'mud', 'stain', 'dust'], theme: 'spring' },
          { scene: 'deckMix', dirt: ['mud', 'moss', 'mold', 'stain', 'dust'], layered: true, mode: 'rush', spawnType: 'dust', theme: 'pollen' },
          { scene: 'gardenMix', dirt: ['mold', 'moss', 'mud', 'stain', 'film', 'dust'], layered: true, hint: 'hintBig', theme: 'marathon' },
        ],
      },
    ],
  },
  {
    id: 'car',
    areas: [
      {
        id: 'exterior',
        scale: 1.8,
        stages: [
          { scene: 'car', dirt: ['mud', 'dust'], grants: ['carshampoo', 'mitt'], hint: 'hintCar', theme: 'weekend' },
          { scene: 'windshield', dirt: ['film', 'dust'], mode: 'fragile', theme: 'precision' },
          { scene: 'wheel', dirt: ['iron', 'mud'], grants: ['wheelcleaner', 'wheelbrush', 'claybar'], hint: 'hintWheel', theme: 'weekend' },
          { scene: 'car', dirt: ['tar', 'mud'], grants: ['tarremover', 'cookingoil'], hint: 'hintTar', mode: 'spots', theme: 'bugs' },
          { scene: 'headlight', dirt: ['film', 'tar', 'dust'], grants: ['toothpaste'], hint: 'hintHeadlight', theme: 'roadtrip' },
          { scene: 'windshield', dirt: ['film', 'tar', 'dust'], layered: true, mode: 'rush', spawnType: 'tar', theme: 'bugs' },
          { scene: 'car', dirt: ['mud', 'tar', 'stain'], layered: true, mode: 'rush', spawnType: 'stain', theme: 'roadtrip' },
          { scene: 'wheel', dirt: ['iron', 'mud', 'tar'], layered: true, mode: 'dark', theme: 'latenight' },
          { scene: 'carExtMix', dirt: ['mud', 'film', 'tar'], theme: 'winter' },
          { scene: 'carFullMix', dirt: ['mud', 'iron', 'film'], layered: true, mode: 'spots', theme: 'newcar' },
          { scene: 'carExtMix', dirt: ['mud', 'tar', 'stain', 'film'], layered: true, mode: 'rush', spawnType: 'mud', theme: 'rain' },
          { scene: 'carFullMix', dirt: ['mud', 'iron', 'tar', 'film', 'stain'], layered: true, hint: 'hintBig', theme: 'marathon' },
        ],
      },
      {
        id: 'interior',
        scale: 2.1,
        stages: [
          { scene: 'seat', dirt: ['dust', 'hair'], grants: ['interior'], hint: 'hintSeat', theme: 'morning' },
          { scene: 'dashboard', dirt: ['dust', 'film'], hint: 'hintVinyl', mode: 'fragile', theme: 'precision' },
          { scene: 'floorMat', dirt: ['mud', 'dust', 'hair'], mode: 'rush', spawnType: 'mud', theme: 'rain' },
          { scene: 'seat', dirt: ['stain', 'hair'], hint: 'hintFabricStain', mode: 'spots', theme: 'kidsCar' },
          { scene: 'dashboard', dirt: ['film', 'grease', 'dust'], hint: 'hintVinylGrease', theme: 'roadtrip' },
          { scene: 'trunk', dirt: ['mud', 'dust', 'stain'], layered: true, theme: 'beach' },
          { scene: 'seat', dirt: ['stain', 'mud', 'hair'], layered: true, mode: 'rush', spawnType: 'hair', theme: 'pet' },
          { scene: 'floorMat', dirt: ['mud', 'stain', 'hair'], layered: true, mode: 'dark', theme: 'latenight' },
          { scene: 'carIntMix', dirt: ['dust', 'film', 'stain'], theme: 'weekend' },
          { scene: 'carIntMix', dirt: ['stain', 'hair', 'grease', 'film'], layered: true, mode: 'spots', theme: 'kidsCar' },
          { scene: 'trunk', dirt: ['mud', 'hair', 'stain', 'grease'], layered: true, mode: 'rush', spawnType: 'mud', theme: 'beach' },
          { scene: 'carIntMix', dirt: ['stain', 'mud', 'hair', 'grease', 'film', 'dust'], layered: true, hint: 'hintBig', theme: 'marathon' },
        ],
      },
    ],
  },
]

/** 난이도 t(0~1)·구역 배수·모드에 따른 얼룩 생성 — 뒤로 갈수록 더 많고, 더 크고, 더 진하게 */
function patchesFor(seed: StageSeed, t: number, scale: number): DirtPatch[] {
  const mode = seed.mode ?? 'clean'
  const baseBlobs = [6, 4, 3, 2, 1, 1]
  const out: DirtPatch[] = []
  seed.dirt.forEach((type, k) => {
    let blobs = Math.max(1, Math.round(baseBlobs[k] * (0.9 + 0.2 * t) * scale))
    let sMin = (k === 0 ? 4.2 : 3.0) * (1 + 0.1 * t)
    let sMax = (k === 0 ? 7.5 : 5.5) * (1 + 0.12 * t)
    const amount: [number, number] = [0.5 + 0.15 * t, 0.8 + 0.1 * t]
    if (mode === 'spots') {
      // 끈질긴 얼룩 몇 곳: 적고 크고 진하게. 주 오염은 표적, 나머지는 작게
      if (k === 0) {
        blobs = Math.min(6, 3 + Math.round(t * 3))
        sMin = 5.5
        sMax = 7.5
        amount[0] = 0.85
        amount[1] = 1
      } else {
        blobs = Math.max(1, Math.round(blobs * 0.5))
      }
    } else if (mode === 'rush') {
      blobs = Math.max(1, Math.round(blobs * 0.6)) // 시작은 가볍게, 플레이 중 계속 생김
    } else if (mode === 'spread') {
      if (k === 0) blobs = Math.max(2, Math.round(blobs * 0.7)) // 번질 여지를 남김
    } else if (mode === 'fragile') {
      blobs = Math.max(1, Math.round(blobs * 0.8))
    }
    const p: DirtPatch = { type, blobs, size: [round1(sMin), round1(sMax)], amount: [round2(amount[0]), round2(amount[1])] }
    if (type === 'dust' && mode !== 'spots') p.coverage = round2(0.16 + 0.1 * t)
    if (type === 'film' && mode !== 'spots') p.coverage = round2(0.1 + 0.08 * t)
    if (mode === 'spots' && k === 0) {
      p.spot = true
      if (seed.dirt[1]) {
        p.under = seed.dirt[1]
        p.underAmount = [0.5, 0.7]
        p.underChance = 1
      }
    } else if (seed.layered && k === 0 && seed.dirt[1]) {
      p.under = seed.dirt[1]
      p.underAmount = [round2(0.25 + 0.1 * t), round2(0.35 + 0.15 * t)]
      p.underChance = 0.5
    }
    out.push(p)
  })
  return out
}

function spawnFor(seed: StageSeed, t: number, scale: number): SpawnDef | undefined {
  if (seed.mode !== 'rush') return undefined
  const type = seed.spawnType ?? seed.dirt[0]
  const small = type === 'hair' || type === 'tar' || type === 'stain'
  return {
    type,
    every: round1(Math.max(1.8, 3.4 - 1.2 * t)),
    count: Math.round((6 + 8 * t) * Math.min(1.4, scale)),
    size: small ? [1.4, 2.4] : [1.8, 3.0],
    amount: [0.5, 0.8],
  }
}

function growthFor(seed: StageSeed, t: number): GrowthDef | undefined {
  if (seed.mode !== 'spread') return undefined
  const type = seed.dirt.includes('mold') ? 'mold' : 'moss'
  return { type, rate: round1(3 + 5 * t), cap: 1.6 }
}

/** 장면별 "누가 어지럽히나" */
const MESS_SCENE: Record<SceneId, MessKind> = {
  floor: 'kids', rug: 'kids', livingMix: 'kids', roomMix: 'kids', kitchenTile: 'kids', kitchenMix: 'kids', floorMat: 'kids', trunk: 'kids', entrance: 'kids', bigClean: 'kids', closet: 'drift',
  sofa: 'pet', bed: 'pet', seat: 'pet',
  stove: 'splatter', sink: 'splatter', grill: 'splatter', table: 'splatter', fridge: 'splatter',
  window: 'drift', shelf: 'drift', desk: 'drift', mirror: 'drift', showerglass: 'drift', dashboard: 'drift', windshield: 'drift', headlight: 'drift', carIntMix: 'drift',
  bathTile: 'splash', basin: 'splash', bathtub: 'splash', tub: 'splash', toilet: 'splash', bathMix: 'splash',
  patio: 'leaves', deck: 'leaves', brickWall: 'leaves', gardenChair: 'leaves', fence: 'leaves', gardenMix: 'leaves', deckMix: 'leaves', yardMix: 'leaves',
  car: 'birds', wheel: 'birds', carExtMix: 'birds', carFullMix: 'birds',
}
/** 종류별로 "새로 생기는" 오염 후보 (그 판에 이미 있는 오염 중에서 고른다 — 플레이어가 지울 도구를 반드시 갖고 있도록) */
const MESS_DIRT: Record<MessKind, DirtType[]> = {
  kids: ['mud', 'dust', 'stain'],
  pet: ['hair', 'dust', 'mud'],
  splatter: ['grease', 'stain', 'dust'],
  drift: ['dust', 'film'],
  splash: ['soap', 'scale', 'dust', 'stain'],
  leaves: ['mud', 'dust', 'stain'],
  birds: ['stain', 'mud', 'dust', 'tar'],
}
const MESS_PATTERN: Record<MessKind, MessPattern> = { kids: 'trail', pet: 'trail', splatter: 'scatter', drift: 'haze', splash: 'scatter', leaves: 'scatter', birds: 'scatter' }
/** 재오염으로는 생기지 않는 오염 (곰팡이·이끼·녹은 "자라는" 것이지 "떨어지는" 것이 아니다) */
const NEVER_FRESH: DirtType[] = ['mold', 'moss', 'iron']

export function messFor(seed: StageSeed, id: number, tier: TierDef): MessDef | undefined {
  if (id < MESS_FROM) return undefined
  const mode = seed.mode ?? 'clean'
  if (mode === 'rush') return undefined // 러시는 이미 계속 생긴다
  const kind = MESS_SCENE[seed.scene]
  const type = MESS_DIRT[kind].find((d) => seed.dirt.includes(d)) ?? seed.dirt.find((d) => !NEVER_FRESH.includes(d))
  if (!type) return undefined
  const t = (tier.id - 1) / (TIERS.length - 1)
  // 이미 어려운 모드는 덜. 튀는 기름·물때처럼 세정제를 뿌려야 지워지는 오염은 한 단위당 손이 더 가니 양을 줄이고,
  // 바깥(낙엽·흙·새)은 바람이 많이 실어 오니 더 많이 — 넓은 실외 판은 호스·솔로 금방 걷어낸다
  const hard = (mode === 'spread' || mode === 'dark' ? 0.7 : 1) * (kind === 'splatter' ? 0.7 : kind === 'splash' ? 0.55 : kind === 'leaves' || kind === 'birds' ? 1.25 : 1)
  return {
    kind,
    type,
    pattern: MESS_PATTERN[kind],
    after: round1(12 - 6 * t),
    every: round1(14 - 7 * t),
    amount: round2((0.03 + 0.03 * t) * hard),
    cap: round2((0.2 + 0.2 * t) * hard),
  }
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
        const mode = seed.mode ?? 'clean'
        levels.push({
          id,
          world: w.id,
          area: a.id,
          tier: tier.id,
          scene: seed.scene,
          mode,
          theme: seed.theme ?? 'morning',
          spawn: spawnFor(seed, t, a.scale),
          growth: growthFor(seed, t),
          mess: messFor(seed, id, tier),
          failDamage: mode === 'fragile' ? 0.1 : undefined,
          outdoor: w.id === 'house' || a.id === 'exterior',
          surface: SCENE_SURFACE[seed.scene],
          zones: ZONE_LAYOUTS[seed.scene],
          patches: patchesFor(seed, t, a.scale),
          passClean: tier.passClean,
          resistMul: tier.resistMul,
          sprayBudgetSec: tier.sprayBudgetSec,
          tailRate: tier.tailRate,
          grants: seed.grants ?? [],
          hint: seed.hint,
          seed: id * 7919 + 17,
          // 정전·번짐·러시는 사람이 봇보다 훨씬 느리므로 여유를 더 준다
          parFactor: round2(tier.parFactor * (mode === 'dark' ? 1.3 : mode === 'spread' || mode === 'rush' ? 1.15 : 1)),
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
