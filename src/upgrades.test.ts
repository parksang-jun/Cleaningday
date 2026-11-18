import { describe, expect, it } from 'vitest';
import { BASE_DETERGENTS, BASE_TOOLS } from './game/catalog';
import { areaGate, allAreas, starsShort } from './game/gates';
import { applyUpgrade, buyUpgrade, MAX_LEVEL, UPGRADE_COSTS, upgradeCost, upgradeLevel } from './upgrades';

describe('도구 강화', () => {
  it('Lv1 은 원본 그대로, 올릴수록 도구는 힘·범위가 커진다', () => {
    const cloth = BASE_TOOLS.cloth;
    expect(applyUpgrade(cloth, 1)).toBe(cloth);
    const top = applyUpgrade(cloth, MAX_LEVEL);
    expect(top.power).toBeCloseTo(cloth.power * 1.48, 2);
    expect(top.radius).toBeCloseTo(cloth.radius * 1.2, 2);
    expect(cloth.power).toBe(1.0); // 원본 불변
    for (let l = 2; l <= MAX_LEVEL; l++) expect(applyUpgrade(cloth, l).power).toBeGreaterThan(applyUpgrade(cloth, l - 1).power);
  });
  it('세제는 지속 시간·범위가 커지고 성분·주의 표면은 그대로다', () => {
    const d = BASE_DETERGENTS.dishsoap;
    const top = applyUpgrade(d, MAX_LEVEL);
    expect(top.soakSec).toBeCloseTo(d.soakSec * 1.6, 2);
    expect(top.chemistry).toBe(d.chemistry);
    expect(top.harms).toEqual(d.harms);
  });
  it('가격은 단계마다 뛰고 끝 단계에서는 더 살 수 없다', () => {
    const st = { coins: 2000, upgrades: {} as Record<string, number> };
    expect(upgradeLevel(st, 'cloth')).toBe(1);
    for (const cost of UPGRADE_COSTS) {
      const before = st.coins;
      expect(buyUpgrade(st, 'cloth')).toBe(true);
      expect(before - st.coins).toBe(cost);
    }
    expect(upgradeLevel(st, 'cloth')).toBe(MAX_LEVEL);
    expect(upgradeCost(MAX_LEVEL)).toBeNull();
    expect(buyUpgrade(st, 'cloth')).toBe(false);
    expect(st.coins).toBe(2000 - 1850);
  });
  it('코인이 모자라면 사지 못하고 아무것도 바뀌지 않는다', () => {
    const st = { coins: 99, upgrades: {} as Record<string, number> };
    expect(buyUpgrade(st, 'cloth')).toBe(false);
    expect(st).toEqual({ coins: 99, upgrades: {} });
  });
  it('저장값이 이상해도 1~5 로 읽는다', () => {
    expect(upgradeLevel({ upgrades: { a: 99, b: -3, c: 2.7 } }, 'a')).toBe(5);
    expect(upgradeLevel({ upgrades: { a: 99, b: -3, c: 2.7 } }, 'b')).toBe(1);
    expect(upgradeLevel({ upgrades: { a: 99, b: -3, c: 2.7 } }, 'c')).toBe(2);
  });
});

describe('별 관문', () => {
  const areas = allAreas();
  it('첫 구역은 관문이 없고, 뒤 구역일수록 요구 별이 늘어난다', () => {
    expect(areaGate(areas[0].id)).toBe(0);
    let prev = 0;
    for (const a of areas.slice(1)) {
      const g = areaGate(a.id);
      expect(g).toBeGreaterThan(prev);
      prev = g;
    }
  });
  it('모든 판을 별 3개로 깨면 어떤 관문이든 열리고, 요구는 최대의 75% 를 넘지 않는다', () => {
    for (const a of areas.slice(1)) {
      const before = areas.slice(0, areas.indexOf(a)).reduce((n, x) => n + x.levelIds.length, 0);
      expect(areaGate(a.id)).toBeLessThanOrEqual(before * 3 * 0.75);
    }
  });
  it('전부 별 1개로만 깨면 둘째 구역부터 막힌다 (강화·재도전이 필요해지는 지점)', () => {
    const stars: Record<number, number> = {};
    for (const id of areas[0].levelIds) stars[id] = 1;
    expect(starsShort(areas[1].levelIds[0], stars)).toBe(areaGate(areas[1].id) - areas[0].levelIds.length);
    for (const id of areas[0].levelIds) stars[id] = 2;
    expect(starsShort(areas[1].levelIds[0], stars)).toBe(0);
  });
});

describe('전면 광고 건너뛰기 가격', () => {
  it('한 판 보상보다 싸다 — 깬 직후 바로 살 수 있어야 한다', async () => {
    const { AD_SKIP_COINS } = await import('./economy');
    expect(AD_SKIP_COINS).toBeGreaterThan(0);
    expect(AD_SKIP_COINS).toBeLessThanOrEqual(50); // 1티어 별 3개 보상
  });
});
