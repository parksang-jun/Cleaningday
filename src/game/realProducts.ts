// 실제 판매 제품(제휴 추천) — 쇼호스트가 소개하는 "진짜 제품"
//  원칙
//   1) 시험 성적이 없으므로 게임 성능은 일반 기준 제품과 같다(lab: []). 소개는 "제품 라벨에 있는 용도·주의"만 말한다 — 효능 수치·비교 주장 금지.
//   2) 수익은 구매 수수료(쿠팡 파트너스·Amazon Associates·楽天)다. 링크는 운영자가 각 제휴 사이트에서 만든 것을 관리자 패널에 붙여 넣는다.
//      붙여 넣기 전에는 마켓 검색 링크(수수료 없음, 동작은 함)로 연다.
//   3) 카드에는 "제휴 추천" 배지와 고지 문구(공정위 표시·광고법)를 반드시 붙인다. 브랜드 로고·공식 이미지는 쓰지 않는다(아이콘만).
//   4) 유료 광고주(SponsorProduct, 시험 성적 있음)가 같은 카테고리에 활성 상태면 그쪽이 먼저 나온다(priority).
import { BASE_DETERGENTS, BASE_TOOLS, type DetergentId, type DetergentSpec, type ToolId, type ToolSpec } from './catalog';
import type { SponsorProduct } from './sponsor';

export interface RealProductDef {
  id: string;
  base: ToolId | DetergentId;
  kind: 'tool' | 'detergent';
  /** 어느 마켓(언어권)에서 파는 제품인지 */
  market: 'coupang' | 'amazon_us' | 'amazon_jp';
  brand: string;
  name: string;
  /** 마켓 검색어 (정확한 제품명) */
  query: string;
  /** 라벨 기준 용도 한 줄 (쇼호스트 멘트에 그대로) */
  use: string;
  /** 라벨 기준 주의 한 줄 (없으면 생략) */
  caution?: string;
  chemistry?: SponsorProduct['chemistry'];
  cautions?: SponsorProduct['cautions'];
  /** 게임 안 성능의 기준 아이템 (제품 유형 — 무선 스틱 청소기 → 무선 청소기 등). 없으면 base */
  gameItem?: ToolId | DetergentId;
  /** 공개 사양으로 낸 성능 배율 (같은 유형의 기준 모델 대비) — 근거는 specNote */
  power?: number;
  /** 성능 근거 한 줄 (공개 사양) */
  specNote?: string;
}

/**
 * 시작용 실제 제품 목록 — 널리 팔리는 대표 제품만 (브랜드·제품명은 공식 표기, 설명은 라벨 용도).
 * 운영자는 관리자 패널에서 제휴 링크를 붙이고, 다른 제품으로 바꾸거나 지울 수 있다.
 */
// 초기 출시 버전: 실제 브랜드 제품 홍보 없음.
// 광고 계약이 들어오면 그때 여기에 추가한다.
export const REAL_PRODUCTS: RealProductDef[] = [];

const LANG_OF: Record<RealProductDef['market'], 'ko' | 'en' | 'ja'> = { coupang: 'ko', amazon_us: 'en', amazon_jp: 'ja' };
const COUNTRY_OF: Record<RealProductDef['market'], string> = { coupang: 'KR', amazon_us: 'US', amazon_jp: 'JP' };

/** 마켓 검색 링크 (제휴 코드가 설정돼 있으면 붙인다). 운영자가 제휴 사이트에서 만든 링크가 있으면 그것이 우선 */
export function realSearchUrl(p: RealProductDef, env: Record<string, string | undefined> = {}): string {
  const q = encodeURIComponent(p.query);
  if (p.market === 'coupang') {
    const tag = env.VITE_COUPANG_LPTAG ? `&lptag=${encodeURIComponent(env.VITE_COUPANG_LPTAG)}${env.VITE_COUPANG_SUBID ? `&subid=${encodeURIComponent(env.VITE_COUPANG_SUBID)}` : ''}` : '';
    return `https://www.coupang.com/np/search?q=${q}&channel=user${tag}`;
  }
  if (p.market === 'amazon_us') return `https://www.amazon.com/s?k=${q}${env.VITE_AMAZON_TAG_US ? `&tag=${encodeURIComponent(env.VITE_AMAZON_TAG_US)}` : ''}`;
  return `https://www.amazon.co.jp/s?k=${q}${env.VITE_AMAZON_TAG_JP ? `&tag=${encodeURIComponent(env.VITE_AMAZON_TAG_JP)}` : ''}`;
}

/** 실제 제품 → 쇼호스트 파이프라인이 쓰는 SponsorProduct (제휴 추천, 시험 성적 없음) */
export function toSponsor(p: RealProductDef, env: Record<string, string | undefined> = {}): SponsorProduct {
  const lang = LANG_OF[p.market];
  const lines = [p.use, ...(p.caution ? [p.caution] : [])];
  return {
    id: p.id,
    brand: p.brand,
    name: p.name,
    kind: p.kind,
    base: p.base,
    lab: [],
    chemistry: p.chemistry,
    cautions: p.cautions ?? [],
    campaign: { start: '2026-01-01', end: '2099-12-31' },
    affiliate: true,
    sample: false,
    hostLines: { [lang]: lines },
    links: { [p.market]: realSearchUrl(p, env) },
    countries: [COUNTRY_OF[p.market]],
    priority: 1,
    status: 'active',
  };
}

export function realSponsors(env: Record<string, string | undefined> = {}): SponsorProduct[] {
  return REAL_PRODUCTS.map((p) => toSponsor(p, env));
}

/**
 * 실제 제품의 게임 속 성능 — 제품 유형의 기준 아이템(무선 청소기·스팀 청소기·멜라민 스펀지 등) 스펙에
 * 공개 사양으로 낸 배율(흡입력·압력)만 곱한다. 효능 시험값이 아니므로 세정 효과 배율은 건드리지 않는다.
 */
export function realItemSpec(p: SponsorProduct): ToolSpec | DetergentSpec {
  const def = REAL_PRODUCTS.find((r) => r.id === p.id);
  const key = (def?.gameItem ?? p.base) as string;
  const powerMul = def?.power ?? 1;
  if (p.kind === 'tool') {
    const b = BASE_TOOLS[key as ToolId] ?? BASE_TOOLS[p.base as ToolId];
    return { ...b, id: `sp:${p.id}`, power: Math.round(b.power * powerMul * 100) / 100, harms: [...new Set([...b.harms, ...(p.cautions ?? [])])], cost: 0 };
  }
  const b = BASE_DETERGENTS[key as DetergentId] ?? BASE_DETERGENTS[p.base as DetergentId];
  return { ...b, id: `sp:${p.id}`, harms: [...new Set([...b.harms, ...(p.cautions ?? [])])], cost: 0 };
}

/** 기본 아이템 대비 배속 (카드·멘트용) — 같은 계열의 무료 기본 도구와 비교 */
export function realSpeedup(spec: ToolSpec | DetergentSpec): number {
  if (spec.kind !== 'tool') return 1;
  const basic = Object.values(BASE_TOOLS).filter((b) => !b.premium && b.families.some((f) => spec.families.includes(f)));
  const ref = basic.length ? Math.max(...basic.map((b) => b.power)) : spec.power;
  return Math.round((spec.power / ref) * 10) / 10;
}

export function realSpecNote(id: string): string | undefined {
  return REAL_PRODUCTS.find((r) => r.id === id)?.specNote;
}
