// 아이템 목록 — 기본(무브랜드) 아이템 + 검증을 통과한 스폰서 아이템
import { BASE_DETERGENTS, BASE_ITEMS, BASE_TOOLS, DIRT_TYPES, RECIPES, type DirtType, type ItemSpec } from './catalog';
import { SAMPLE_SPONSORS, toItemSpec, validateSponsor, type SponsorProduct } from './sponsor';

export { grantsUpTo } from './levels';

export interface ItemEntry {
  spec: ItemSpec;
  sponsor?: SponsorProduct;
}

/** 스폰서 노출 여부 — 웹 포털(Poki/CrazyGames) 빌드는 기본 꺼짐 (포털 정책상 외부 광고·링크 제한) */
export function sponsorsEnabled(): boolean {
  const env = import.meta.env;
  if (env.VITE_SPONSORS_ENABLED === 'false') return false;
  if (env.VITE_SPONSORS_ENABLED === 'true') return true;
  return env.VITE_AD_PROVIDER !== 'poki' && env.VITE_AD_PROVIDER !== 'crazygames';
}

/** 오늘 노출 가능한 스폰서 (원격 설정으로 교체 가능하도록 목록을 인자로 받음) */
export function activeSponsors(list: SponsorProduct[] = SAMPLE_SPONSORS, today = new Date().toISOString().slice(0, 10)): SponsorProduct[] {
  if (!sponsorsEnabled()) return [];
  return list.filter((p) => validateSponsor(p, today).length === 0);
}

export function allItems(sponsors: SponsorProduct[] = activeSponsors()): ItemEntry[] {
  return [...BASE_ITEMS.map((spec) => ({ spec })), ...sponsors.map((p) => ({ spec: toItemSpec(p), sponsor: p }))];
}

export function findItem(id: string, entries: ItemEntry[] = allItems()): ItemEntry | undefined {
  return entries.find((e) => e.spec.id === id);
}

/** 아이템이 레시피상 닦을 수 있는 오염 (UI 표시용 — 발견 전에는 수첩에서만 보여줌) */
export function strengths(spec: ItemSpec): DirtType[] {
  if (spec.kind === 'tool') return DIRT_TYPES.filter((d) => RECIPES[d].some((r) => r.tools.some((f) => spec.families.includes(f))));
  return DIRT_TYPES.filter((d) => RECIPES[d].some((r) => r.cleaner === spec.family));
}

export const BASE_IDS = [...Object.keys(BASE_TOOLS), ...Object.keys(BASE_DETERGENTS)];
