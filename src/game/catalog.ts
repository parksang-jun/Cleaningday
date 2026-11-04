// 게임 데이터 카탈로그 — 오염·표면·도구·세제와 그 상성표.
// 수치는 "일반(무브랜드) 기준 제품"의 게임 성능이다. 스폰서 제품은 sponsor.ts 가 시험 결과를 이 기준 대비로 환산한다.

export type DirtType = 'dust' | 'mud' | 'grease' | 'stain' | 'scale' | 'mold';
export const DIRT_TYPES: DirtType[] = ['dust', 'mud', 'grease', 'stain', 'scale', 'mold'];

/** 표면: 원목 · 타일 · 스테인리스 · 유리 · 도기 · 패브릭 · 석재 · 도장(자동차·담장) · 벽돌 · 플라스틱(정원 가구) · 금속(휠) · 비닐(대시보드) */
export type SurfaceType = 'wood' | 'tile' | 'steel' | 'glass' | 'ceramic' | 'fabric' | 'stone' | 'paint' | 'brick' | 'plastic' | 'metal' | 'vinyl';
export const SURFACES: SurfaceType[] = ['wood', 'tile', 'steel', 'glass', 'ceramic', 'fabric', 'stone', 'paint', 'brick', 'plastic', 'metal', 'vinyl'];

export type Chemistry = 'neutral' | 'alkaline' | 'acid' | 'chlorine';

export type ToolId = 'cloth' | 'sponge' | 'brush' | 'vacuum' | 'washer' | 'rinse';
export type DetergentId = 'allpurpose' | 'degreaser' | 'descaler' | 'moldremover';
export type ItemId = ToolId | DetergentId;

/** 오염별 기본 저항(초 단위 감각: 효율 1.0 도구로 한 칸을 지우는 대략 시간) */
export const DIRT_RESIST: Record<DirtType, number> = {
  dust: 0.14,
  mud: 0.32,
  grease: 0.75,
  stain: 0.5,
  scale: 0.8,
  mold: 0.85,
};

/** 렌더링 색 (RGB) + 불투명도 계수 */
export const DIRT_COLOR: Record<DirtType, [number, number, number, number]> = {
  dust: [150, 140, 122, 0.82],
  mud: [104, 72, 42, 0.95],
  grease: [146, 98, 18, 0.88],
  stain: [92, 56, 30, 0.85],
  scale: [232, 228, 210, 0.9],
  mold: [44, 56, 40, 0.92],
};

export type Effect = Record<DirtType, number>;

export interface ToolSpec {
  id: string
  base: ToolId // 기준이 되는 일반 도구 (스폰서 제품도 이 계열)
  kind: 'tool'
  radius: number // 격자 칸 단위 반경
  power: number
  effect: Effect // 오염별 효율 (일반 기준 대비)
  /** 이 표면에 쓰면 손상(흠집·변형)이 생김 */
  harms: SurfaceType[]
  /** 실내 사용 불가 등 사용 제한 (고압세척기) */
  onlyOn?: SurfaceType[]
  cost: number // 상점 해금 코인 (0 = 기본 지급)
}

export interface DetergentSpec {
  id: string
  base: DetergentId
  kind: 'detergent'
  radius: number
  soakSec: number // 분사 후 효과 지속 시간
  mult: Effect // 불린 칸을 문지를 때 오염별 배율
  chemistry: Chemistry
  harms: SurfaceType[]
  cost: number
}

const E = (dust: number, mud: number, grease: number, stain: number, scale: number, mold: number): Effect => ({ dust, mud, grease, stain, scale, mold })

export const BASE_TOOLS: Record<ToolId, ToolSpec> = {
  cloth: { id: 'cloth', base: 'cloth', kind: 'tool', radius: 3.4, power: 1.0, effect: E(1.0, 0.45, 0.2, 0.3, 0.05, 0.1), harms: [], cost: 0 },
  sponge: { id: 'sponge', base: 'sponge', kind: 'tool', radius: 2.8, power: 1.1, effect: E(0.6, 0.95, 0.5, 0.75, 0.2, 0.3), harms: [], cost: 0 },
  brush: { id: 'brush', base: 'brush', kind: 'tool', radius: 2.0, power: 1.35, effect: E(0.3, 1.0, 0.6, 0.8, 0.75, 0.95), harms: ['glass', 'paint', 'wood', 'plastic', 'vinyl'], cost: 120 },
  vacuum: { id: 'vacuum', base: 'vacuum', kind: 'tool', radius: 4.2, power: 1.2, effect: E(1.7, 0.15, 0, 0, 0, 0), harms: [], cost: 200 },
  washer: { id: 'washer', base: 'washer', kind: 'tool', radius: 3.6, power: 1.5, effect: E(0.9, 1.7, 0.7, 0.6, 0.5, 0.7), harms: ['wood', 'fabric', 'vinyl'], onlyOn: ['stone', 'paint', 'tile', 'brick', 'metal', 'plastic'], cost: 320 },
  /** 물 헹굼 — 세제를 씻어내 화학 반응을 막고(염소계↔산성 전환 전 필수), 먼지·진흙에 약간 효과 */
  rinse: { id: 'rinse', base: 'rinse', kind: 'tool', radius: 4.8, power: 0.9, effect: E(0.5, 0.7, 0.05, 0.1, 0.05, 0.05), harms: [], cost: 0 },
}

export const BASE_DETERGENTS: Record<DetergentId, DetergentSpec> = {
  allpurpose: { id: 'allpurpose', base: 'allpurpose', kind: 'detergent', radius: 4.5, soakSec: 9, mult: E(1.0, 1.3, 1.6, 1.6, 1.1, 1.2), chemistry: 'neutral', harms: [], cost: 0 },
  degreaser: { id: 'degreaser', base: 'degreaser', kind: 'detergent', radius: 4.5, soakSec: 9, mult: E(1.0, 1.2, 3.0, 1.5, 1.0, 1.0), chemistry: 'alkaline', harms: ['wood', 'vinyl'], cost: 150 },
  descaler: { id: 'descaler', base: 'descaler', kind: 'detergent', radius: 4.5, soakSec: 10, mult: E(1.0, 1.0, 1.0, 1.3, 3.2, 1.1), chemistry: 'acid', harms: ['stone'], cost: 150 },
  moldremover: { id: 'moldremover', base: 'moldremover', kind: 'detergent', radius: 4.0, soakSec: 12, mult: E(1.0, 1.0, 1.0, 1.8, 1.0, 3.4), chemistry: 'chlorine', harms: ['wood', 'fabric', 'paint', 'plastic', 'vinyl', 'metal'], cost: 180 },
}

export type ItemSpec = ToolSpec | DetergentSpec

/** 같은 칸에 섞이면 위험한 조합 (염소계 + 산성 → 유독가스) */
export function isHazardMix(a: Chemistry, b: Chemistry): boolean {
  return (a === 'chlorine' && b === 'acid') || (a === 'acid' && b === 'chlorine')
}

export const BASE_ITEMS: ItemSpec[] = [...Object.values(BASE_TOOLS), ...Object.values(BASE_DETERGENTS)]
