import { describe, expect, it } from 'vitest';
import { LEVELS } from '../game/levels';
import { applyLook, isPlain, levelLook, lookFor, sceneRepeat, zoneLook } from './looks';

const key = (id: number): string => {
  const lv = LEVELS.find((l) => l.id === id)!;
  if (!lv.zones) {
    const { look, flip } = levelLook(lv);
    return JSON.stringify([lv.scene, look, flip]);
  }
  return JSON.stringify([lv.scene, lv.zones.map((z, i) => zoneLook(lv, i, z.surface))]);
};

describe('판마다 다른 배경', () => {
  it('장면이 처음 나오는 판은 원래 그림 그대로', () => {
    expect(sceneRepeat(LEVELS[0])).toBe(0);
    expect(isPlain(levelLook(LEVELS[0]).look)).toBe(true);
  });

  it('모든 판의 배경(장면+변형)이 서로 다르다', () => {
    const seen = new Set(LEVELS.map((l) => key(l.id)));
    expect(seen.size).toBe(LEVELS.length);
  });

  it('같은 장면이 이어지는 판(1→2 마루, 10→11→12 거실)은 변형이 다르다', () => {
    expect(key(2)).not.toBe(key(1));
    expect(key(11)).not.toBe(key(10));
    expect(key(12)).not.toBe(key(11));
  });

  it('오염이 묻히지 않도록 너무 어둡게 만들지 않는다', () => {
    for (const s of ['wood', 'fabric', 'tile', 'brick', 'glass'] as const) for (let n = 1; n <= 6; n++) expect(lookFor(s, n).light).toBeGreaterThanOrEqual(0.8);
  });

  it('변형은 알파를 건드리지 않고 색만 바꾼다', () => {
    const px = new Uint8ClampedArray([200, 150, 100, 255]);
    applyLook(px, lookFor('fabric', 1));
    expect(px[3]).toBe(255);
    expect([px[0], px[1], px[2]]).not.toEqual([200, 150, 100]);
  });
});
