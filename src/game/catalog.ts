// 게임 데이터 카탈로그 — 오염·표면·도구·세정제와 "레시피".
//
// 핵심 규칙(실제 청소와 같게): 오염마다 맞는 도구(군)와 세정제(군)가 정해져 있고,
// 맞지 않는 조합은 아무리 문질러도 지워지지 않는다(RECIPES). 플레이어는 여러 시도 끝에 맞는 조합을 찾는다.
// 수치는 "일반(무브랜드) 기준 제품"의 게임 성능이다. 스폰서 제품은 sponsor.ts 가 시험 결과를 이 기준 대비로 환산한다.

/** 오염 12종 */
export type DirtType = 'dust' | 'hair' | 'mud' | 'grease' | 'stain' | 'scale' | 'soap' | 'mold' | 'moss' | 'iron' | 'tar' | 'film';
export const DIRT_TYPES: DirtType[] = ['dust', 'hair', 'mud', 'grease', 'stain', 'scale', 'soap', 'mold', 'moss', 'iron', 'tar', 'film'];

/** 표면: 원목 · 타일 · 스테인리스 · 유리 · 도기 · 패브릭 · 석재 · 도장(자동차·담장·문) · 벽돌 · 플라스틱 · 금속(휠·그릴) · 비닐(대시보드) */
export type SurfaceType = 'wood' | 'tile' | 'steel' | 'glass' | 'ceramic' | 'fabric' | 'stone' | 'paint' | 'brick' | 'plastic' | 'metal' | 'vinyl';
export const SURFACES: SurfaceType[] = ['wood', 'tile', 'steel', 'glass', 'ceramic', 'fabric', 'stone', 'paint', 'brick', 'plastic', 'metal', 'vinyl'];

/** 오염이 생길 수 있는 표면 (스테이지 생성 시 이 표면 위에만 놓음) */
export const DIRT_SURFACES: Record<DirtType, SurfaceType[]> = {
  dust: SURFACES,
  hair: ['fabric', 'wood', 'tile', 'vinyl', 'plastic', 'stone', 'ceramic'],
  mud: SURFACES,
  grease: ['steel', 'tile', 'wood', 'vinyl', 'glass', 'metal', 'stone', 'plastic', 'fabric'],
  stain: SURFACES,
  scale: ['tile', 'ceramic', 'glass', 'steel', 'metal', 'plastic'],
  soap: ['tile', 'ceramic', 'glass', 'steel', 'plastic'],
  mold: ['tile', 'ceramic', 'wood', 'brick', 'plastic', 'stone', 'fabric', 'paint', 'glass'],
  moss: ['stone', 'brick', 'wood', 'paint', 'plastic', 'tile', 'metal'],
  iron: ['metal', 'paint', 'steel'],
  tar: ['paint', 'glass', 'plastic', 'metal'],
  film: ['glass', 'steel', 'wood', 'vinyl', 'plastic', 'paint', 'tile', 'ceramic'],
};

export type Chemistry = 'neutral' | 'alkaline' | 'acid' | 'chlorine' | 'solvent' | 'oxygen';

/** 도구군 — 레시피는 도구군으로 판정하고, 프리미엄 도구는 여러 군을 겸한다 */
export type ToolFamily = 'cloth' | 'vacuum' | 'lintroller' | 'sponge' | 'scrubpad' | 'tilebrush' | 'squeegee' | 'deckbrush' | 'hose' | 'washer' | 'mitt' | 'wheelbrush' | 'rinse' | 'steam' | 'eraser' | 'claybar';
/** 세정제군 */
export type CleanerFamily = 'allpurpose' | 'glass' | 'degreaser' | 'descaler' | 'bathroom' | 'mold' | 'fabric' | 'deck' | 'moss' | 'carshampoo' | 'wheel' | 'tar' | 'interior' | 'bakingsoda' | 'oxy' | 'vinegar' | 'polish';

export type ToolId =
  | 'cloth'
  | 'vacuum'
  | 'lintroller'
  | 'sponge'
  | 'scrubpad'
  | 'tilebrush'
  | 'squeegee'
  | 'deckbrush'
  | 'hose'
  | 'washer'
  | 'mitt'
  | 'wheelbrush'
  | 'rinse'
  // 살림 꿀팁 도구 (집에 있는 것들)
  | 'rubberglove'
  | 'toothbrush'
  | 'newspaper'
  | 'claybar'
  // 프리미엄(상점 전용) — 더 빠르거나 세정제 없이도 닦임
  | 'cordlessvac'
  | 'scrubber'
  | 'drillbrush'
  | 'steamer'
  | 'magiceraser';
export type DetergentId =
  | 'allpurpose'
  | 'glass'
  | 'degreaser'
  | 'descaler'
  | 'bathroom'
  | 'moldremover'
  | 'fabric'
  | 'deckcleaner'
  | 'mossremover'
  | 'carshampoo'
  | 'wheelcleaner'
  | 'tarremover'
  | 'interior'
  // 살림 꿀팁 세정제 (천연 세제·집에 있는 것들)
  | 'bakingsoda'
  | 'citric'
  | 'percarbonate'
  | 'vinegar'
  | 'toothpaste'
  | 'cookingoil'
  // 프리미엄
  | 'heavydegreaser'
  | 'limescalegel';
export type ItemId = ToolId | DetergentId;

/** 오염별 기본 저항(초 단위 감각: 효율 1.0 도구로 한 칸을 지우는 대략 시간) */
export const DIRT_RESIST: Record<DirtType, number> = {
  dust: 0.13,
  hair: 0.2,
  mud: 0.33,
  grease: 0.5,
  stain: 0.39,
  scale: 0.55,
  soap: 0.44,
  mold: 0.55,
  moss: 0.5,
  iron: 0.5,
  tar: 0.44,
  film: 0.28,
};

/**
 * 찌든 때: 칸의 오염이 이 농도 아래로 내려가면 "눌어붙은" 마지막 층이라 일반 도구는 단계별 tailRate 배(T3 0.7 → T6 0.55)로 느려진다.
 * 고성능(pro) 도구·세정제(프리미엄 구매품, 성능 근거가 있는 광고 제품)는 끝까지 같은 속도로 지우고 광택 마감을 남긴다.
 */
export const TAIL_AMOUNT = 0.35;
/** 고성능 세정제의 분사 용량 배율 (T3+ 용량 제한 판) */
export const PRO_BUDGET_MUL = 1.5;
/** 광고 제품이 고성능으로 인정되는 기준 — 어느 오염에서든 일반 제품 대비 이 배율 이상 */
export const PRO_RATIO = 1.15;

/** 렌더링 색 (RGB) + 불투명도 계수 */
export const DIRT_COLOR: Record<DirtType, [number, number, number, number]> = {
  dust: [150, 140, 122, 0.8],
  hair: [40, 34, 30, 0.95],
  mud: [104, 72, 42, 0.95],
  grease: [146, 98, 18, 0.88],
  stain: [120, 52, 36, 0.85],
  scale: [236, 232, 214, 0.92],
  soap: [214, 206, 170, 0.8],
  mold: [36, 48, 38, 0.95],
  moss: [78, 120, 46, 0.92],
  iron: [86, 52, 30, 0.95],
  tar: [22, 20, 22, 0.97],
  film: [190, 214, 230, 0.55],
};

/** 오염 질감(렌더링): 균일막 · 가닥 · 점 · 얼룩 · 분말 · 반투명 */
export type DirtTexture = 'film' | 'strand' | 'dots' | 'blotch' | 'powder' | 'sheen';
export const DIRT_TEXTURE: Record<DirtType, DirtTexture> = {
  dust: 'powder',
  hair: 'strand',
  mud: 'blotch',
  grease: 'film',
  stain: 'blotch',
  scale: 'powder',
  soap: 'film',
  mold: 'dots',
  moss: 'dots',
  iron: 'dots',
  tar: 'dots',
  film: 'sheen',
};

export type Effect = Record<DirtType, number>;
/** 모든 오염에 같은 배율 */
export const flat = (v: number): Effect => Object.fromEntries(DIRT_TYPES.map((d) => [d, v])) as Effect;
/** 일부 오염만 다른 배율 */
export const effect = (base: number, over: Partial<Effect> = {}): Effect => ({ ...flat(base), ...over });

export interface ToolSpec {
  id: string
  base: ToolId // 기준이 되는 일반 도구 (스폰서 제품도 이 계열)
  kind: 'tool'
  families: ToolFamily[] // 레시피 판정에 쓰는 도구군 (프리미엄은 여러 군)
  radius: number // 격자 칸 단위 반경
  power: number
  effect: Effect // 오염별 속도 배율 (레시피가 맞을 때만 적용, 1 = 기준)
  /** 이 표면에 쓰면 손상(흠집·변형)이 생김 */
  harms: SurfaceType[]
  /** 사용 가능 표면 제한 (고압세척기: 석재·벽돌·타일·금속·플라스틱·도장만) */
  onlyOn?: SurfaceType[]
  /** 실외 전용 (호스·고압세척기) — 실내 스테이지에서는 사용 불가 */
  outdoorOnly?: boolean
  cost: number // 상점 코인 (0 = 지급)
  premium?: boolean // 프리미엄(더 빠른 장비) — 상점 "빨리 닦는 장비" 섹션
  /** 고성능: 찌든 때 감속 없음 + 광택 마감 (프리미엄 구매품, 근거 있는 광고 제품) */
  pro?: boolean
}

export interface DetergentSpec {
  id: string
  base: DetergentId
  kind: 'detergent'
  family: CleanerFamily
  radius: number
  soakSec: number // 분사 후 효과 지속 시간
  mult: Effect // 불린 칸을 문지를 때 속도 배율 (1 = 기준)
  chemistry: Chemistry
  harms: SurfaceType[]
  /** 뿌려 두면 저절로 녹는 오염 (곰팡이 제거제 등) — 초당 농도 감소량 */
  dissolves?: Partial<Record<DirtType, number>>
  cost: number
  premium?: boolean
  /** 고성능: 찌든 때 감속 없음 + 광택 마감 + 분사 용량 보너스 */
  pro?: boolean
}

export type ItemSpec = ToolSpec | DetergentSpec

export const BASE_TOOLS: Record<ToolId, ToolSpec> = {
  cloth: { id: 'cloth', base: 'cloth', kind: 'tool', families: ['cloth'], radius: 3.4, power: 1.0, effect: flat(1), harms: [], cost: 0 },
  vacuum: { id: 'vacuum', base: 'vacuum', kind: 'tool', families: ['vacuum'], radius: 4.2, power: 1.2, effect: flat(1), harms: [], cost: 0 },
  lintroller: { id: 'lintroller', base: 'lintroller', kind: 'tool', families: ['lintroller'], radius: 2.6, power: 1.1, effect: flat(1), harms: [], cost: 0 },
  sponge: { id: 'sponge', base: 'sponge', kind: 'tool', families: ['sponge'], radius: 2.8, power: 1.1, effect: flat(1), harms: [], cost: 0 },
  scrubpad: { id: 'scrubpad', base: 'scrubpad', kind: 'tool', families: ['scrubpad'], radius: 2.4, power: 1.3, effect: flat(1), harms: ['glass', 'paint', 'plastic', 'vinyl', 'wood'], cost: 0 },
  tilebrush: { id: 'tilebrush', base: 'tilebrush', kind: 'tool', families: ['tilebrush'], radius: 2.2, power: 1.35, effect: flat(1), harms: ['glass', 'paint', 'wood', 'plastic', 'vinyl', 'fabric'], cost: 0 },
  squeegee: { id: 'squeegee', base: 'squeegee', kind: 'tool', families: ['squeegee'], radius: 3.2, power: 1.2, effect: flat(1), harms: [], cost: 0 },
  deckbrush: { id: 'deckbrush', base: 'deckbrush', kind: 'tool', families: ['deckbrush'], radius: 3.2, power: 1.3, effect: flat(1), harms: ['fabric', 'glass', 'vinyl'], cost: 0 },
  hose: { id: 'hose', base: 'hose', kind: 'tool', families: ['hose', 'rinse'], radius: 4.6, power: 1.0, effect: flat(1), harms: ['fabric', 'vinyl'], outdoorOnly: true, cost: 0 },
  washer: { id: 'washer', base: 'washer', kind: 'tool', families: ['washer', 'rinse'], radius: 3.6, power: 1.6, effect: flat(1), harms: ['wood', 'fabric', 'vinyl', 'glass'], onlyOn: ['stone', 'brick', 'tile', 'metal', 'plastic', 'paint'], outdoorOnly: true, cost: 0 },
  mitt: { id: 'mitt', base: 'mitt', kind: 'tool', families: ['mitt', 'cloth'], radius: 3.4, power: 1.05, effect: flat(1), harms: [], cost: 0 },
  wheelbrush: { id: 'wheelbrush', base: 'wheelbrush', kind: 'tool', families: ['wheelbrush'], radius: 2.2, power: 1.3, effect: flat(1), harms: ['glass', 'vinyl', 'fabric'], cost: 0 },
  /** 물 헹굼(실내) — 세정제를 씻어내 화학 반응을 막음(염소계↔산성 전환 전 필수), 먼지·진흙에 약간 효과 */
  rinse: { id: 'rinse', base: 'rinse', kind: 'tool', families: ['rinse'], radius: 4.8, power: 0.9, effect: flat(1), harms: [], cost: 0 },
  // ---- 살림 꿀팁 도구 ----
  /** 고무장갑 — 살짝 적셔 한 방향으로 쓸면 패브릭 사이 털이 뭉쳐 나온다 (돌돌이보다 깊이) */
  rubberglove: { id: 'rubberglove', base: 'rubberglove', kind: 'tool', families: ['lintroller'], radius: 3.0, power: 1.15, effect: effect(1, { hair: 1.15 }), harms: [], cost: 0 },
  /** 칫솔 — 줄눈·틈새 (작지만 구석까지) */
  toothbrush: { id: 'toothbrush', base: 'toothbrush', kind: 'tool', families: ['tilebrush'], radius: 1.6, power: 1.0, effect: effect(1, { mold: 1.15 }), harms: ['paint'], cost: 0 },
  /** 신문지 — 유리 마무리 (잉크의 기름이 잔여물을 잡고 보풀이 없다) */
  newspaper: { id: 'newspaper', base: 'newspaper', kind: 'tool', families: ['cloth'], radius: 3.2, power: 1.15, effect: effect(1, { film: 1.2 }), harms: [], onlyOn: ['glass'], cost: 0 },
  /** 클레이바 — 윤활(카샴푸)과 함께 도장면의 철분·타르를 떼어낸다. 떨어뜨리면 버릴 것 */
  claybar: { id: 'claybar', base: 'claybar', kind: 'tool', families: ['claybar'], radius: 2.2, power: 1.0, effect: flat(1), harms: [], onlyOn: ['paint', 'glass'], cost: 0 },
  // ---- 프리미엄: 실제로 더 빨리 닦이는 장비 (상점 구매) ----
  cordlessvac: { id: 'cordlessvac', base: 'cordlessvac', kind: 'tool', families: ['vacuum', 'lintroller'], radius: 5.2, power: 1.8, effect: flat(1), harms: [], cost: 600, premium: true, pro: true },
  scrubber: { id: 'scrubber', base: 'scrubber', kind: 'tool', families: ['sponge', 'scrubpad', 'tilebrush', 'wheelbrush'], radius: 3.0, power: 2.2, effect: flat(1), harms: ['glass', 'paint', 'vinyl'], cost: 900, premium: true, pro: true },
  drillbrush: { id: 'drillbrush', base: 'drillbrush', kind: 'tool', families: ['tilebrush', 'deckbrush', 'wheelbrush', 'scrubpad'], radius: 2.8, power: 2.8, effect: flat(1), harms: ['glass', 'paint', 'wood', 'plastic', 'vinyl', 'fabric'], cost: 800, premium: true, pro: true },
  /** 스팀 — 뜨거운 증기가 세정제 역할: 기름때·얼룩·비누때·유막·곰팡이를 세정제 없이 */
  steamer: { id: 'steamer', base: 'steamer', kind: 'tool', families: ['steam', 'cloth'], radius: 3.0, power: 1.6, effect: flat(1), harms: ['fabric'], cost: 1200, premium: true, pro: true },
  /** 멜라민 스펀지 — 얼룩·유막·비누때를 세정제 없이 (광택면은 흠집) */
  magiceraser: { id: 'magiceraser', base: 'magiceraser', kind: 'tool', families: ['eraser', 'sponge'], radius: 2.6, power: 1.4, effect: flat(1), harms: ['paint', 'vinyl'], cost: 500, premium: true, pro: true },
};

export const BASE_DETERGENTS: Record<DetergentId, DetergentSpec> = {
  allpurpose: { id: 'allpurpose', base: 'allpurpose', kind: 'detergent', family: 'allpurpose', radius: 4.5, soakSec: 14, mult: flat(1), chemistry: 'neutral', harms: [], cost: 0 },
  glass: { id: 'glass', base: 'glass', kind: 'detergent', family: 'glass', radius: 4.5, soakSec: 12, mult: flat(1), chemistry: 'neutral', harms: [], cost: 0 },
  degreaser: { id: 'degreaser', base: 'degreaser', kind: 'detergent', family: 'degreaser', radius: 4.5, soakSec: 16, mult: flat(1), chemistry: 'alkaline', harms: ['wood', 'vinyl', 'fabric'], cost: 0 },
  descaler: { id: 'descaler', base: 'descaler', kind: 'detergent', family: 'descaler', radius: 4.5, soakSec: 18, mult: flat(1), chemistry: 'acid', harms: ['stone', 'wood', 'fabric'], cost: 0 },
  bathroom: { id: 'bathroom', base: 'bathroom', kind: 'detergent', family: 'bathroom', radius: 4.5, soakSec: 16, mult: flat(1), chemistry: 'acid', harms: ['stone', 'wood', 'fabric'], cost: 0 },
  moldremover: { id: 'moldremover', base: 'moldremover', kind: 'detergent', family: 'mold', radius: 4.0, soakSec: 20, mult: flat(1), chemistry: 'chlorine', harms: ['wood', 'fabric', 'paint', 'plastic', 'vinyl', 'metal'], dissolves: { mold: 0.045 }, cost: 0 },
  fabric: { id: 'fabric', base: 'fabric', kind: 'detergent', family: 'fabric', radius: 4.2, soakSec: 14, mult: flat(1), chemistry: 'neutral', harms: [], cost: 0 },
  /** 산소계 데크 클리너 — 원목 데크의 곰팡이·회색 변색·이끼 (염소계 대신) */
  deckcleaner: { id: 'deckcleaner', base: 'deckcleaner', kind: 'detergent', family: 'deck', radius: 4.6, soakSec: 18, mult: flat(1), chemistry: 'neutral', harms: [], dissolves: { mold: 0.03 }, cost: 0 },
  mossremover: { id: 'mossremover', base: 'mossremover', kind: 'detergent', family: 'moss', radius: 4.6, soakSec: 18, mult: flat(1), chemistry: 'neutral', harms: ['fabric'], dissolves: { moss: 0.03 }, cost: 0 },
  carshampoo: { id: 'carshampoo', base: 'carshampoo', kind: 'detergent', family: 'carshampoo', radius: 5.0, soakSec: 14, mult: flat(1), chemistry: 'neutral', harms: [], cost: 0 },
  wheelcleaner: { id: 'wheelcleaner', base: 'wheelcleaner', kind: 'detergent', family: 'wheel', radius: 4.2, soakSec: 14, mult: flat(1), chemistry: 'neutral', harms: ['fabric', 'vinyl'], dissolves: { iron: 0.03 }, cost: 0 },
  tarremover: { id: 'tarremover', base: 'tarremover', kind: 'detergent', family: 'tar', radius: 3.8, soakSec: 12, mult: flat(1), chemistry: 'solvent', harms: ['vinyl', 'fabric'], dissolves: { tar: 0.03 }, cost: 0 },
  interior: { id: 'interior', base: 'interior', kind: 'detergent', family: 'interior', radius: 4.4, soakSec: 12, mult: flat(1), chemistry: 'neutral', harms: [], cost: 0 },
  // ---- 살림 꿀팁 세정제 (천연 세제·집에 있는 것들) ----
  /** 베이킹소다 — 약알칼리 + 고운 연마: 반죽을 발라 불린 기름때, 싱크대 얼룩·물자국, 비누때 */
  bakingsoda: { id: 'bakingsoda', base: 'bakingsoda', kind: 'detergent', family: 'bakingsoda', radius: 4.0, soakSec: 20, mult: flat(1), chemistry: 'alkaline', harms: [], cost: 0 },
  /** 구연산 — 산성: 물때·석회 (물때 제거제의 천연 버전). 대리석·원목엔 금지, 락스와 절대 혼합 금지 */
  citric: { id: 'citric', base: 'citric', kind: 'detergent', family: 'descaler', radius: 4.4, soakSec: 22, mult: effect(1, { scale: 0.9, soap: 0.8 }), chemistry: 'acid', harms: ['stone', 'wood', 'fabric'], dissolves: { scale: 0.015 }, cost: 0 },
  /** 과탄산소다 — 산소계 표백: 40~60℃ 물에 녹여 곰팡이·줄눈·찌든 때·데크 녹조. 염소계와 혼합 금지, 알루미늄·구리 변색 */
  percarbonate: { id: 'percarbonate', base: 'percarbonate', kind: 'detergent', family: 'oxy', radius: 4.2, soakSec: 24, mult: flat(1), chemistry: 'oxygen', harms: ['paint', 'metal'], dissolves: { mold: 0.03 }, cost: 0 },
  /** 식초 — 산성: 유리 유막·물 자국, 가벼운 물때·비누때, 데크 녹조. 대리석엔 금지, 락스와 절대 혼합 금지 */
  vinegar: { id: 'vinegar', base: 'vinegar', kind: 'detergent', family: 'vinegar', radius: 4.2, soakSec: 12, mult: flat(1), chemistry: 'acid', harms: ['stone'], cost: 0 },
  /** 치약(흰색 불투명) — 고운 연마제: 헤드라이트 황변·플라스틱 유막. 도장면은 흠집 */
  toothpaste: { id: 'toothpaste', base: 'toothpaste', kind: 'detergent', family: 'polish', radius: 2.6, soakSec: 10, mult: flat(1), chemistry: 'neutral', harms: ['paint'], cost: 0 },
  /** 식용유 — 타르·스티커 자국을 불려 떼어낸다 (WD-40 과 같은 원리). 패브릭엔 기름 얼룩 */
  cookingoil: { id: 'cookingoil', base: 'cookingoil', kind: 'detergent', family: 'tar', radius: 3.2, soakSec: 24, mult: effect(1, { tar: 0.6 }), chemistry: 'neutral', harms: ['fabric'], dissolves: { tar: 0.012 }, cost: 0 },
  // ---- 프리미엄 세정제 ----
  heavydegreaser: { id: 'heavydegreaser', base: 'heavydegreaser', kind: 'detergent', family: 'degreaser', radius: 4.8, soakSec: 10, mult: effect(1, { grease: 1.8, stain: 1.3 }), chemistry: 'alkaline', harms: ['wood', 'vinyl', 'fabric'], cost: 400, premium: true, pro: true },
  limescalegel: { id: 'limescalegel', base: 'limescalegel', kind: 'detergent', family: 'descaler', radius: 4.2, soakSec: 24, mult: effect(1, { scale: 1.8, soap: 1.3 }), chemistry: 'acid', harms: ['stone', 'wood', 'fabric'], dissolves: { scale: 0.025 }, cost: 400, premium: true, pro: true },
};

/** 같은 칸에 섞이면 위험한 조합 — 염소계(락스) + 산성(식초·구연산·물때 제거제) → 염소가스, 염소계 + 산소계(과탄산소다) → 유해가스 */
export function isHazardMix(a: Chemistry, b: Chemistry): boolean {
  const bad = (x: Chemistry, y: Chemistry) => x === 'chlorine' && (y === 'acid' || y === 'oxygen')
  return bad(a, b) || bad(b, a)
}

export const BASE_ITEMS: ItemSpec[] = [...Object.values(BASE_TOOLS), ...Object.values(BASE_DETERGENTS)]

// ---------------------------------------------------------------------------
// 레시피 — 이 오염은 이 도구군 (+ 이 세정제군) 으로만 지워진다
// ---------------------------------------------------------------------------
export interface Recipe {
  tools: ToolFamily[]
  cleaner?: CleanerFamily // 없으면 세정제 불필요
  on?: SurfaceType[] // 이 표면에서만 유효
  not?: SurfaceType[] // 이 표면에서는 무효
  speed: number // 기준 속도 배율
}

const HARD_NOT_FABRIC: SurfaceType[] = ['fabric'];

export const RECIPES: Record<DirtType, Recipe[]> = {
  dust: [
    { tools: ['vacuum'], speed: 1.2 },
    { tools: ['cloth'], not: HARD_NOT_FABRIC, speed: 1.0 },
    { tools: ['lintroller'], on: ['fabric'], speed: 0.8 },
    { tools: ['hose', 'washer'], speed: 1.3 },
    { tools: ['mitt'], cleaner: 'carshampoo', speed: 1.1 },
    { tools: ['steam'], speed: 0.8 },
  ],
  hair: [
    { tools: ['vacuum'], speed: 1.0 },
    { tools: ['lintroller'], on: ['fabric'], speed: 1.3 }, // 돌돌이·고무장갑
    { tools: ['squeegee'], on: ['fabric'], speed: 1.0 }, // 꿀팁: 스퀴지를 한 방향으로 끌면 털이 모인다
    { tools: ['hose', 'washer'], on: ['stone', 'tile', 'plastic'], speed: 1.0 },
  ],
  mud: [
    { tools: ['sponge'], not: HARD_NOT_FABRIC, speed: 1.0 },
    { tools: ['hose', 'washer'], speed: 1.5 },
    { tools: ['deckbrush'], on: ['stone', 'brick', 'wood', 'paint', 'plastic', 'tile'], speed: 1.2 },
    { tools: ['mitt'], cleaner: 'carshampoo', speed: 1.3 },
    { tools: ['vacuum'], on: ['fabric'], speed: 0.8 }, // 마른 진흙은 털어내고 빨아들임
    { tools: ['sponge', 'tilebrush'], cleaner: 'fabric', on: ['fabric'], speed: 1.0 },
  ],
  grease: [
    { tools: ['scrubpad', 'sponge'], cleaner: 'degreaser', not: ['wood', 'vinyl', 'fabric'], speed: 1.0 },
    { tools: ['scrubpad', 'sponge'], cleaner: 'bakingsoda', not: ['wood', 'vinyl', 'fabric'], speed: 0.8 }, // 꿀팁: 베이킹소다 반죽을 발라 20~30분 불린 뒤
    { tools: ['scrubpad', 'tilebrush'], cleaner: 'oxy', on: ['steel', 'metal'], speed: 0.85 }, // 꿀팁: 삼발이는 과탄산소다 따뜻한 물에 담갔다가
    { tools: ['cloth'], cleaner: 'allpurpose', on: ['wood'], speed: 0.6 }, // 원목엔 알칼리 금지 → 중성세제로 천천히
    { tools: ['cloth'], cleaner: 'interior', on: ['vinyl', 'plastic'], speed: 0.9 },
    { tools: ['sponge'], cleaner: 'fabric', on: ['fabric'], speed: 0.7 },
    { tools: ['steam'], speed: 1.2 },
  ],
  stain: [
    { tools: ['cloth', 'sponge'], cleaner: 'allpurpose', not: ['fabric', 'glass'], speed: 1.0 },
    { tools: ['cloth', 'sponge'], cleaner: 'bakingsoda', on: ['steel', 'ceramic', 'tile'], speed: 0.85 }, // 꿀팁: 싱크대·컵 얼룩은 베이킹소다로
    { tools: ['sponge', 'tilebrush'], cleaner: 'descaler', on: ['ceramic'], speed: 0.8 }, // 꿀팁: 변기 얼룩은 구연산 10분
    { tools: ['sponge', 'tilebrush', 'cloth'], cleaner: 'fabric', on: ['fabric'], speed: 1.0 },
    { tools: ['cloth', 'squeegee'], cleaner: 'glass', on: ['glass'], speed: 1.0 },
    { tools: ['cloth'], cleaner: 'interior', on: ['vinyl', 'plastic'], speed: 1.0 },
    { tools: ['mitt'], cleaner: 'carshampoo', on: ['paint', 'glass', 'plastic', 'metal'], speed: 1.0 },
    { tools: ['eraser'], not: ['fabric'], speed: 1.1 },
    { tools: ['steam'], speed: 1.0 },
    { tools: ['washer'], on: ['stone', 'brick', 'tile'], speed: 0.7 },
  ],
  scale: [
    { tools: ['sponge', 'tilebrush', 'scrubpad'], cleaner: 'descaler', not: ['glass', 'metal'], speed: 1.0 }, // 물때 제거제·구연산
    { tools: ['cloth', 'squeegee', 'sponge'], cleaner: 'descaler', on: ['glass'], speed: 1.0 },
    { tools: ['sponge', 'cloth'], cleaner: 'bakingsoda', on: ['steel'], speed: 0.6 }, // 꿀팁: 스테인리스 물자국은 베이킹소다 뿌려 결 방향으로
    { tools: ['sponge', 'cloth', 'squeegee'], cleaner: 'vinegar', not: ['metal', 'stone'], speed: 0.6 }, // 식초물 — 가벼운 물때
    { tools: ['wheelbrush', 'tilebrush'], cleaner: 'wheel', on: ['metal'], speed: 1.0 },
    { tools: ['sponge', 'tilebrush'], cleaner: 'bathroom', speed: 0.5 }, // 욕실 세정제로는 느리게
  ],
  soap: [
    { tools: ['sponge', 'tilebrush'], cleaner: 'bathroom', not: ['glass'], speed: 1.0 },
    { tools: ['squeegee', 'sponge', 'cloth'], cleaner: 'bathroom', on: ['glass'], speed: 1.0 },
    { tools: ['sponge'], cleaner: 'descaler', speed: 0.6 },
    { tools: ['sponge', 'tilebrush'], cleaner: 'bakingsoda', speed: 0.7 }, // 꿀팁: 비누때·물자국엔 베이킹소다 연마
    { tools: ['sponge', 'squeegee'], cleaner: 'vinegar', speed: 0.6 },
    { tools: ['eraser'], speed: 1.0 },
    { tools: ['steam'], speed: 1.0 },
  ],
  mold: [
    { tools: ['tilebrush', 'sponge', 'squeegee', 'scrubpad'], cleaner: 'mold', not: ['wood', 'fabric', 'paint', 'plastic'], speed: 1.0 }, // 락스 습포
    { tools: ['tilebrush', 'sponge', 'scrubpad', 'deckbrush'], cleaner: 'oxy', not: ['paint', 'metal'], speed: 0.85 }, // 꿀팁: 과탄산소다 페이스트 20~30분 → 칫솔
    { tools: ['deckbrush', 'sponge', 'tilebrush'], cleaner: 'deck', speed: 0.9 }, // 원목·플라스틱·패브릭 곰팡이는 산소계
    { tools: ['steam'], speed: 0.8 },
  ],
  moss: [
    { tools: ['washer'], on: ['stone', 'brick', 'tile', 'metal', 'plastic', 'paint'], speed: 1.2 }, // 저~중압으로
    { tools: ['deckbrush', 'tilebrush', 'wheelbrush'], cleaner: 'moss', speed: 1.0 },
    { tools: ['deckbrush'], cleaner: 'deck', on: ['wood'], speed: 0.9 },
    { tools: ['deckbrush', 'tilebrush'], cleaner: 'oxy', not: ['paint', 'metal'], speed: 0.85 }, // 꿀팁: 산소계(과탄산소다)로 녹조
    { tools: ['deckbrush'], cleaner: 'vinegar', on: ['wood', 'stone', 'brick'], speed: 0.7 }, // 꿀팁: 식초 1컵/양동이 10~20분 → 부드러운 솔
  ],
  iron: [
    { tools: ['wheelbrush', 'tilebrush', 'sponge'], cleaner: 'wheel', speed: 1.0 },
    { tools: ['claybar'], cleaner: 'carshampoo', on: ['paint', 'glass'], speed: 1.0 }, // 꿀팁: 세차 후 까끌하면 클레이바 + 윤활
  ],
  tar: [
    { tools: ['cloth', 'mitt', 'sponge'], cleaner: 'tar', speed: 1.0 }, // 타르 리무버·식용유(WD-40 원리)
    { tools: ['claybar'], cleaner: 'carshampoo', on: ['paint', 'glass'], speed: 0.9 },
  ],
  film: [
    { tools: ['squeegee'], cleaner: 'glass', on: ['glass'], speed: 1.5 },
    { tools: ['cloth'], cleaner: 'glass', on: ['glass'], speed: 0.9 },
    { tools: ['squeegee', 'cloth'], cleaner: 'vinegar', on: ['glass'], speed: 1.1 }, // 꿀팁: 식초물 + 신문지/스퀴지
    { tools: ['cloth', 'sponge', 'eraser'], cleaner: 'polish', on: ['plastic'], speed: 0.8 }, // 꿀팁: 헤드라이트 황변은 흰 치약으로 5~10분
    { tools: ['cloth'], cleaner: 'interior', on: ['vinyl', 'plastic'], speed: 1.0 },
    { tools: ['cloth', 'sponge'], cleaner: 'allpurpose', not: ['glass', 'fabric'], speed: 0.9 },
    { tools: ['mitt'], cleaner: 'carshampoo', on: ['paint', 'glass', 'plastic'], speed: 1.0 },
    { tools: ['eraser'], not: ['fabric'], speed: 1.1 },
    { tools: ['steam'], not: ['fabric'], speed: 1.0 },
  ],
};

export type NoEffectReason = 'wrong_tool' | 'need_cleaner' | 'wrong_cleaner' | 'wrong_surface';

/** 오염·표면·도구·(활성 세정제군) → 맞는 레시피, 없으면 null */
export function matchRecipe(dirt: DirtType, surface: SurfaceType, tool: ToolSpec, cleaner: CleanerFamily | null): Recipe | null {
  let best: Recipe | null = null;
  for (const r of RECIPES[dirt]) {
    if (r.on && !r.on.includes(surface)) continue;
    if (r.not && r.not.includes(surface)) continue;
    if (!r.tools.some((f) => tool.families.includes(f))) continue;
    if (r.cleaner && r.cleaner !== cleaner) continue;
    if (!best || r.speed > best.speed) best = r;
  }
  return best;
}

/** 효과가 없는 이유 진단 (피드백·힌트용) */
export function diagnose(dirt: DirtType, surface: SurfaceType, tool: ToolSpec, cleaner: CleanerFamily | null): NoEffectReason {
  const withTool = RECIPES[dirt].filter((r) => r.tools.some((f) => tool.families.includes(f)));
  if (!withTool.length) return 'wrong_tool';
  const onSurface = withTool.filter((r) => !(r.on && !r.on.includes(surface)) && !(r.not && r.not.includes(surface)));
  if (!onSurface.length) return 'wrong_surface'; // 이 도구는 다른 표면에서만 통함
  return cleaner ? 'wrong_cleaner' : 'need_cleaner';
}

/** 이 오염·표면에 쓸 수 있는 레시피 (힌트·수첩용) */
export function recipesFor(dirt: DirtType, surface: SurfaceType): Recipe[] {
  return RECIPES[dirt].filter((r) => !(r.on && !r.on.includes(surface)) && !(r.not && r.not.includes(surface)));
}

/** 도구군·세정제군 → 대표 기본 아이템 id (수첩·힌트 표시용) */
export function familyItem(f: ToolFamily | CleanerFamily): ItemId {
  const tool = (Object.values(BASE_TOOLS) as ToolSpec[]).find((t) => !t.premium && t.families[0] === f);
  if (tool) return tool.base;
  const det = (Object.values(BASE_DETERGENTS) as DetergentSpec[]).find((d) => !d.premium && d.family === f);
  if (det) return det.base;
  if (f === 'steam') return 'steamer';
  if (f === 'eraser') return 'magiceraser';
  return 'cloth';
}
