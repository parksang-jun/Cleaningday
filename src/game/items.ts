// 아이템 목록 — 기본(무브랜드) 아이템 + 검증을 통과한 스폰서 아이템
import { BASE_DETERGENTS, BASE_ITEMS, BASE_TOOLS, DIRT_TYPES, type DirtType, type ItemSpec } from './catalog';
import { SAMPLE_SPONSORS, toItemSpec, validateSponsor, type SponsorProduct } from './sponsor';
import { LEVELS } from './levels';

export interface ItemEntry {
  spec: ItemSpec;
  sponsor?: SponsorProduct;
}

/** 오늘 노출 가능한 스폰서 (원격 설정으로 교체 가능하도록 목록을 인자로 받음) */
export function activeSponsors(list: SponsorProduct[] = SAMPLE_SPONSORS, today = new Date().toISOString().slice(0, 10)): SponsorProduct[] {
  return list.filter((p) => validateSponsor(p, today).length === 0);
}

export function allItems(sponsors: SponsorProduct[] = activeSponsors()): ItemEntry[] {
  return [...BASE_ITEMS.map((spec) => ({ spec })), ...sponsors.map((p) => ({ spec: toItemSpec(p), sponsor: p }))];
}

export function findItem(id: string, entries: ItemEntry[] = allItems()): ItemEntry | undefined {
  return entries.find((e) => e.spec.id === id);
}

/** 스테이지 n 시작 시 보유해야 할 기본 아이템 (지급 누적) */
export function grantsUpTo(levelId: number): string[] {
  return LEVELS.filter((l) => l.id <= levelId).flatMap((l) => l.grants);
}

/** 아이템이 특히 잘 듣는 오염 (UI 표시용) */
export function strengths(spec: ItemSpec): DirtType[] {
  if (spec.kind === 'tool') return DIRT_TYPES.filter((d) => spec.effect[d] >= 0.9);
  return DIRT_TYPES.filter((d) => spec.mult[d] >= 1.5);
}

export const BASE_IDS = [...Object.keys(BASE_TOOLS), ...Object.keys(BASE_DETERGENTS)];
