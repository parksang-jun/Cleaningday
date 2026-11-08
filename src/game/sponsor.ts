// 스폰서(광고주) 제품 → 게임 성능 환산
// 원칙
//  1) 게임 성능은 광고주가 낸 "시험 성적"만으로 정한다. 근거 없는 항목은 일반 기준 제품과 같다(과장 불가).
//  2) 같은 시험 조건으로 잰 일반 기준 제품의 제거율(REFERENCE_REMOVAL) 대비 비율로 환산한다.
//  3) 게임 밸런스를 위해 기준 대비 0.5~1.8배로 제한한다(실제 차이가 더 커도 표시는 근거 화면에서).
//  4) 주의 표면(사용 금지 재질)·화학 계열은 제품 라벨 그대로 반영한다 → 잘못 쓰면 게임에서도 손상.
//  5) 캠페인 기간 밖이거나 근거가 없으면 노출하지 않는다. 모든 스폰서 아이템에는 "광고" 표시.
import {
  BASE_DETERGENTS,
  BASE_TOOLS,
  DIRT_TYPES,
  PRO_RATIO,
  type Chemistry,
  type DetergentId,
  type DetergentSpec,
  type DirtType,
  type SurfaceType,
  type ToolId,
  type ToolSpec,
} from './catalog'

export interface LabResult {
  dirt: DirtType
  /** 표준 시험에서 정해진 횟수·압력으로 닦은 뒤 제거된 오염 비율(%) */
  removalPct: number
}

export interface Evidence {
  lab: string // 시험기관
  reportId: string // 성적서 번호
  date: string // YYYY-MM-DD
  protocol: string // 시험 방법 요약
  url?: string
}

export interface SponsorProduct {
  id: string
  brand: string
  name: string
  kind: 'tool' | 'detergent'
  base: ToolId | DetergentId
  lab: LabResult[]
  /** 도구: 1분당 닦는 면적(m²) — 기준 제품 대비로 반경 환산 */
  coverageM2PerMin?: number
  chemistry?: Chemistry
  /** 제품 라벨의 사용 금지 재질 */
  cautions: SurfaceType[]
  evidence?: Evidence
  campaign: { start: string; end: string }
  /** 데모용 가상 브랜드 여부 */
  sample?: boolean
  tagline?: string
  /** 실제 제품 구매 페이지 (마켓별 제휴 링크가 우선) */
  productUrl?: string
  links?: Partial<Record<'coupang' | 'amazon_us' | 'amazon_jp' | 'rakuten', string>>
  // ---- 쇼호스트(라이브 커머스 멘트)·운영 ----
  /** 광고주 소구점 — 표시·광고법상 근거 자료가 있는 문구만 (운영자가 검수 후 입력) */
  claims?: string[]
  /** 리뷰 수·평점·출처 (예: 쿠팡 4.7/5, 12,480개) */
  reviews?: { count: number; rating: number; source?: string }
  /** 운영자가 직접 쓴 쇼호스트 멘트 (언어별). 비우면 시험 성적·소구점·리뷰로 자동 생성 */
  hostLines?: Partial<Record<'ko' | 'en' | 'ja', string[]>>
  /** 쇼호스트 노출 위치 (없으면 전부 켜짐) */
  placements?: { intro?: boolean; struggle?: boolean; result?: boolean; shop?: boolean }
  /** 이 제품 소개 영상 (https mp4/webm, 또는 운영자 업로드 `idb:` 참조) — 실사 AI 아바타(HeyGen·D-ID 등)나 촬영본. 있으면 TTS 대신 영상 음성 */
  hostVideo?: string
  /** 이 제품 소개 때만 쓸 쇼호스트 사진 (없으면 전역 설정 사진) */
  hostPhoto?: string
  /** 노출 국가 (ISO2, 비우면 전부) — 언어로 판정: ko→KR, en→US, ja→JP */
  countries?: string[]
  /** 운영 상태 — paused 면 노출 안 함 */
  status?: 'active' | 'paused'
  /** 여러 제품이 겹칠 때 우선순위 (높을수록 먼저) */
  priority?: number
  /** 운영자가 추가한 제품 (내장 샘플이 아님) */
  custom?: boolean
}

/** 일반 기준 제품의 같은 시험 기준 제거율(%) — 운영사가 자체 시험으로 갱신. 레시피상 그 제품이 닦는 오염만 기재 */
export const REFERENCE_REMOVAL: Partial<Record<ToolId | DetergentId, Partial<Record<DirtType, number>>>> = {
  cloth: { dust: 85, stain: 60, film: 70, tar: 60 },
  vacuum: { dust: 95, hair: 90, mud: 50 },
  lintroller: { hair: 92, dust: 60 },
  sponge: { mud: 80, stain: 65, grease: 70, scale: 60, soap: 70 },
  scrubpad: { grease: 85, scale: 65 },
  tilebrush: { scale: 75, soap: 75, mold: 70, moss: 60 },
  squeegee: { film: 90, stain: 60, scale: 55, soap: 65 },
  deckbrush: { mud: 85, moss: 75, mold: 55 },
  hose: { mud: 85, dust: 80 },
  washer: { mud: 92, dust: 85, moss: 80, stain: 50 },
  mitt: { mud: 85, dust: 85, film: 70, stain: 60 },
  wheelbrush: { iron: 80, scale: 60, moss: 55 },
  allpurpose: { stain: 65, film: 60, grease: 35 },
  glass: { film: 85, stain: 60 },
  degreaser: { grease: 80, stain: 55 },
  descaler: { scale: 75, soap: 50 },
  bathroom: { soap: 75, scale: 45 },
  moldremover: { mold: 80 },
  fabric: { stain: 70, mud: 60, grease: 45 },
  deckcleaner: { mold: 65, moss: 55 },
  mossremover: { moss: 80 },
  carshampoo: { mud: 80, dust: 85, film: 60, stain: 55 },
  wheelcleaner: { iron: 85, scale: 50 },
  tarremover: { tar: 85 },
  interior: { film: 75, stain: 65, grease: 55 },
}

/** 기준 제품의 1분당 닦는 면적(m²) */
export const REFERENCE_COVERAGE: Partial<Record<ToolId, number>> = { cloth: 1.2, sponge: 0.9, scrubpad: 0.7, tilebrush: 0.5, vacuum: 3.0, lintroller: 0.8, squeegee: 1.5, deckbrush: 2.0, hose: 5.0, washer: 6.0, mitt: 1.5, wheelbrush: 0.4, rinse: 2.0 }

export const RATIO_MIN = 0.5
export const RATIO_MAX = 1.8

export function clampRatio(r: number): number {
  return Math.min(RATIO_MAX, Math.max(RATIO_MIN, r))
}

/** 오염별 기준 대비 배율 (근거 없는 오염은 1.0) */
export function performanceRatios(p: SponsorProduct): Record<DirtType, number> {
  const ref = REFERENCE_REMOVAL[p.base] ?? {}
  const out = {} as Record<DirtType, number>
  for (const d of DIRT_TYPES) {
    const lab = p.lab.find((l) => l.dirt === d)
    const base = ref[d]
    out[d] = lab && base && base > 0 && lab.removalPct >= 0 && lab.removalPct <= 100 ? clampRatio(lab.removalPct / base) : 1
  }
  return out
}

export type SponsorIssue = 'no_evidence' | 'campaign_inactive' | 'bad_lab_value' | 'kind_mismatch' | 'no_lab_results' | 'paused' | 'bad_base'

/** 노출 전 검증 — 문제가 있으면 노출하지 않음 */
export function validateSponsor(p: SponsorProduct, today: string): SponsorIssue[] {
  const issues: SponsorIssue[] = []
  if (p.status === 'paused') issues.push('paused')
  if (!(p.base in BASE_TOOLS) && !(p.base in BASE_DETERGENTS)) return [...issues, 'bad_base']
  if (!p.evidence || !p.evidence.lab || !p.evidence.reportId) issues.push('no_evidence')
  if (today < p.campaign.start || today > p.campaign.end) issues.push('campaign_inactive')
  if (!p.lab.length) issues.push('no_lab_results')
  if (p.lab.some((l) => !(l.removalPct >= 0 && l.removalPct <= 100))) issues.push('bad_lab_value')
  const isTool = p.base in BASE_TOOLS
  if ((p.kind === 'tool') !== isTool) issues.push('kind_mismatch')
  if ((isTool && BASE_TOOLS[p.base as ToolId]?.premium) || (!isTool && BASE_DETERGENTS[p.base as DetergentId]?.premium)) issues.push('kind_mismatch') // 프리미엄 계열은 스폰서 기준이 될 수 없음
  return issues
}

/** 고성능(pro) 판정 — 시험 성적이 어느 오염에서든 일반 제품 대비 PRO_RATIO 이상이면 찌든 때 보너스·광택 마감을 받는다 */
export function isProSponsor(p: SponsorProduct): boolean {
  const ratio = performanceRatios(p)
  if (DIRT_TYPES.some((d) => ratio[d] >= PRO_RATIO)) return true
  // 도구는 닦는 면적(분당 m²)이 기준보다 충분히 넓어도 고성능
  const refCov = p.kind === 'tool' ? REFERENCE_COVERAGE[p.base as ToolId] : undefined
  return Boolean(p.coverageM2PerMin && refCov && clampRatio(p.coverageM2PerMin / refCov) >= PRO_RATIO)
}

/** 스폰서 제품을 게임 아이템 스펙으로 변환 */
export function toItemSpec(p: SponsorProduct): ToolSpec | DetergentSpec {
  const ratio = performanceRatios(p)
  const pro = isProSponsor(p)
  if (p.kind === 'tool') {
    const base = BASE_TOOLS[p.base as ToolId]
    const refCov = REFERENCE_COVERAGE[p.base as ToolId]
    const covRatio = p.coverageM2PerMin && refCov ? clampRatio(p.coverageM2PerMin / refCov) : 1
    const effect = { ...base.effect }
    for (const d of DIRT_TYPES) effect[d] = round2(base.effect[d] * ratio[d])
    return {
      ...base,
      id: `sp:${p.id}`,
      effect,
      // 면적 비율 → 반경은 제곱근 비례
      radius: round2(base.radius * Math.sqrt(covRatio)),
      harms: unique([...base.harms, ...p.cautions]),
      cost: 0,
      pro,
    }
  }
  const base = BASE_DETERGENTS[p.base as DetergentId]
  const mult = { ...base.mult }
  // 세정제 속도 배율 = 기준 배율 × 시험 비율 (레시피가 맞는 오염에만 적용됨)
  for (const d of DIRT_TYPES) mult[d] = round2(base.mult[d] * ratio[d])
  return {
    ...base,
    id: `sp:${p.id}`,
    mult,
    chemistry: p.chemistry ?? base.chemistry,
    harms: unique([...base.harms, ...p.cautions]),
    cost: 0,
    pro,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function unique<T>(a: T[]): T[] {
  return [...new Set(a)]
}

/** 데모용 가상 브랜드 2종 — 실제 광고주가 오면 같은 형식으로 교체 (Supabase/원격 설정 권장) */
export const SAMPLE_SPONSORS: SponsorProduct[] = [
  {
    id: 'brightmax-degreaser',
    brand: 'BrightMax',
    name: 'Kitchen Degreaser',
    kind: 'detergent',
    base: 'degreaser',
    lab: [
      { dirt: 'grease', removalPct: 92 },
      { dirt: 'stain', removalPct: 63 },
    ],
    chemistry: 'alkaline',
    cautions: ['wood', 'paint'],
    evidence: { lab: '(샘플) 공인시험기관', reportId: 'SAMPLE-2026-001', date: '2026-10-15', protocol: '표준 기름때 시편, 동일 압력·왕복 10회 후 제거율' },
    campaign: { start: '2026-01-01', end: '2027-12-31' },
    sample: true,
    tagline: 'Cuts kitchen grease fast',
    productUrl: 'https://example.com/brightmax',
    claims: ['(샘플) 공인 시험 기름때 제거율 92%', '(샘플) 중성 세제 대비 2배 빠른 분해'],
    reviews: { count: 12480, rating: 4.7, source: '(샘플) 마켓 리뷰' },
    priority: 10,
  },
  {
    id: 'aquajet-washer',
    brand: 'AquaJet',
    name: 'Cordless Pressure Washer',
    kind: 'tool',
    base: 'washer',
    lab: [
      { dirt: 'mud', removalPct: 96 },
      { dirt: 'mold', removalPct: 50 },
    ],
    coverageM2PerMin: 7.5,
    cautions: ['wood', 'fabric', 'glass'],
    evidence: { lab: '(샘플) 공인시험기관', reportId: 'SAMPLE-2026-002', date: '2026-10-20', protocol: '표준 진흙 시편, 30cm 거리 1분 분사 후 제거율·면적' },
    campaign: { start: '2026-01-01', end: '2027-12-31' },
    sample: true,
    tagline: 'Outdoor mud, gone',
    productUrl: 'https://example.com/aquajet',
    claims: ['(샘플) 1분에 7.5m² — 진흙 96% 제거', '(샘플) 무선 60분 사용'],
    reviews: { count: 3210, rating: 4.6, source: '(샘플) 마켓 리뷰' },
    priority: 5,
  },
]
