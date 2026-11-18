// 도구·세제 강화 — 코인을 계속 쓸 곳.
//  보유한 기본·프로 아이템을 Lv1→Lv5 로 올린다. 올릴수록 닦는 힘과 범위(세제는 지속 시간과 범위)가 커진다.
//  가격은 단계마다 크게 뛴다(100→250→500→1,000). 아이템이 수십 개라 사실상 끝이 없다.
//  광고 제품(스폰서)은 강화하지 않는다 — 광고주가 낸 근거 수치 그대로 보여야 한다.
import type { ItemSpec } from './game/catalog';
import type { Store } from './storage';

export const MAX_LEVEL = 5;
/** 다음 단계로 올리는 값: [Lv1→2, Lv2→3, Lv3→4, Lv4→5] */
export const UPGRADE_COSTS = [100, 250, 500, 1000] as const;
/** 단계당 증가율 */
export const POWER_STEP = 0.12;
export const RADIUS_STEP = 0.05;
export const SOAK_STEP = 0.15;

export function upgradeLevel(st: Pick<Store, 'upgrades'>, id: string): number {
  const lv = Math.floor(st.upgrades?.[id] ?? 1);
  return Math.max(1, Math.min(MAX_LEVEL, lv));
}

/** 이 단계에서 다음 단계로 올리는 값. 끝 단계면 null */
export function upgradeCost(level: number): number | null {
  return level >= MAX_LEVEL ? null : UPGRADE_COSTS[level - 1];
}

/** 강화 구매: 보유 중이고 코인이 충분하면 한 단계 올린다 */
export function buyUpgrade(st: Pick<Store, 'upgrades' | 'coins'>, id: string): boolean {
  const lv = upgradeLevel(st, id);
  const cost = upgradeCost(lv);
  if (cost === null || st.coins < cost) return false;
  st.coins -= cost;
  st.upgrades[id] = lv + 1;
  return true;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** 단계가 반영된 스펙 (원본은 건드리지 않는다). Lv1 은 원본 그대로 */
export function applyUpgrade<T extends ItemSpec>(spec: T, level: number): T {
  const k = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  if (k === 0) return spec;
  if (spec.kind === 'tool') return { ...spec, power: r2(spec.power * (1 + POWER_STEP * k)), radius: r2(spec.radius * (1 + RADIUS_STEP * k)) };
  return { ...spec, soakSec: r2(spec.soakSec * (1 + SOAK_STEP * k)), radius: r2(spec.radius * (1 + RADIUS_STEP * k)) };
}

/** 화면 표시용: 이 단계의 증가 폭(%) */
export function upgradeGain(kind: ItemSpec['kind'], level: number): { main: number; radius: number } {
  const k = Math.max(0, level - 1);
  return { main: Math.round((kind === 'tool' ? POWER_STEP : SOAK_STEP) * k * 100), radius: Math.round(RADIUS_STEP * k * 100) };
}
