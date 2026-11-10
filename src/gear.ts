// 장비 추천 — "이런 도구를 쓰면 청소가 더 빨라지고 깨끗해져요"
//  판 안에서 느리게 가고 있거나(목표시간의 절반이 지났는데 반도 못 닦음) 재오염을 두 번째 당했을 때,
//  지금 닦고 있는 오염·표면에 맞는 코인 구매 프리미엄 장비 하나를 골라 뽀득이가 설명한다.
//  한 판에 한 번, 판 사이 쿨다운, 이미 가진 장비는 추천하지 않는다.
import { BASE_DETERGENTS, BASE_TOOLS, familyItem, recipesFor, type DetergentSpec, type DirtType, type SurfaceType, type ToolId, type ToolSpec } from './game/catalog';

export interface GearPick {
  spec: ToolSpec | DetergentSpec;
  /** 같은 일을 하는 기본 장비 대비 배속 (1.8 → "1.8배 빠름") */
  x: number;
  /** 세정제 없이 닦인다 (스팀·멜라민) */
  noCleaner: boolean;
  /** 기본 장비보다 넓게 닦는다 */
  wide: boolean;
  /** 추천 근거가 된 오염 */
  dirt: DirtType;
}

/** 추천이 뜨는 때 */
export type GearReason = 'slow' | 'mess' | 'fail';

/** 목표시간의 이 비율이 지났는데 */
export const GEAR_SLOW_AT = 0.5;
/** 이만큼도 못 닦았으면 "느리게 가는 중" */
export const GEAR_SLOW_CLEAN = 0.5;
/** 재오염 몇 번째에 */
export const GEAR_MESS_COUNT = 2;
/** 판 사이 쿨다운(ms) — 매 판 조르지 않는다 */
export const GEAR_COOLDOWN_MS = 90_000;
/** 추천 카드가 떠 있는 시간(초) */
export const GEAR_TIP_SEC = 14;

function basePower(spec: ToolSpec): number {
  const base = spec.families.map((f) => BASE_TOOLS[familyItem(f) as ToolId]).filter((b) => b && !b.premium);
  return base.length ? Math.max(...base.map((b) => b.power)) : 1;
}
function baseRadius(spec: ToolSpec): number {
  const base = spec.families.map((f) => BASE_TOOLS[familyItem(f) as ToolId]).filter((b) => b && !b.premium);
  return base.length ? Math.max(...base.map((b) => b.radius)) : spec.radius;
}

/**
 * 이 오염·표면에 쓸 수 있는 프리미엄 장비 중 가장 큰 차이를 내는 것. 없으면 null.
 * 도구를 먼저(손에 바로 잡히는 차이), 도구가 없으면 세정제.
 */
export function premiumFor(dirt: DirtType, surface: SurfaceType, owned: string[]): GearPick | null {
  const recipes = recipesFor(dirt, surface);
  if (!recipes.length) return null;
  const basicTools = Object.values(BASE_TOOLS).filter((t) => !t.premium);
  const basicRoutes = recipes.filter((rc) => rc.tools.some((f) => basicTools.some((t) => t.families.includes(f))));
  let best: GearPick | null = null;
  let bestScore = -1;
  for (const spec of Object.values(BASE_TOOLS)) {
    if (!spec.premium || owned.includes(spec.id)) continue;
    if (spec.harms.includes(surface)) continue;
    if (spec.onlyOn && !spec.onlyOn.includes(surface)) continue;
    // 이 장비로 가능한 레시피 중 세정제 없는 것, 그 다음 빠른 것
    const r = recipes
      .filter((rc) => rc.tools.some((f) => spec.families.includes(f)))
      .sort((a, b) => (a.cleaner ? 1 : 0) - (b.cleaner ? 1 : 0) || b.speed - a.speed)[0];
    if (!r) continue;
    const noCleaner = !r.cleaner && basicRoutes.length > 0 && basicRoutes.every((rc) => rc.cleaner); // 기본 장비로는 세정제가 꼭 필요한데 이건 아니다
    const x = Math.round((spec.power / basePower(spec)) * 10) / 10;
    const score = spec.power * r.speed * (noCleaner ? 1.3 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = { spec, x, noCleaner, wide: spec.radius > baseRadius(spec) + 0.5, dirt };
    }
  }
  if (best) return best;
  for (const spec of Object.values(BASE_DETERGENTS)) {
    if (!spec.premium || owned.includes(spec.id)) continue;
    if (spec.harms.includes(surface)) continue;
    const r = recipes.find((rc) => rc.cleaner === spec.family);
    if (!r) continue;
    const x = Math.round((spec.mult[dirt] ?? 1) * 10) / 10;
    if (x <= 1.05) continue;
    if (!best || x > best.x) best = { spec, x, noCleaner: false, wide: false, dirt };
  }
  return best;
}

/** 남은 양이 가장 많은 오염 (추천 근거) */
export function dominantDirt(kinds: DirtType[], remainingOf: (d: DirtType) => number): DirtType | null {
  let best: DirtType | null = null;
  let max = 0;
  for (const d of kinds) {
    const n = remainingOf(d);
    if (n > max) {
      max = n;
      best = d;
    }
  }
  return best;
}
