import { describe, expect, it } from 'vitest';
import { grayCentered, woodGrainTile } from './materials';
import { MATERIAL_PHOTOS, materialPhoto, materialPhotoKeys } from './photos';

function px(...rgb: [number, number, number][]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(rgb.length * 4);
  rgb.forEach(([r, g, b], i) => d.set([r, g, b, 200], i * 4));
  return d;
}

describe('사진 재질 — grayCentered', () => {
  it('회색으로 바꾸고 평균을 128 에 맞춘다(사진 색이 장면 색을 바꾸지 않게)', () => {
    const d = grayCentered(px([200, 120, 60], [180, 100, 40], [220, 150, 90], [160, 90, 30]));
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i + 1]).toBe(d[i + 2]);
      expect(d[i + 3]).toBe(255);
      sum += d[i];
    }
    expect(Math.abs(sum / 4 - 128)).toBeLessThanOrEqual(1);
  });

  it('밝기 순서(결의 명암)는 유지한다', () => {
    const d = grayCentered(px([40, 40, 40], [120, 120, 120], [230, 230, 230]));
    expect(d[0]).toBeLessThan(d[4]);
    expect(d[4]).toBeLessThan(d[8]);
  });

  it('contrast 로 명암 폭을 키운다', () => {
    const a = grayCentered(px([100, 100, 100], [160, 160, 160]), 128, 1);
    const b = grayCentered(px([100, 100, 100], [160, 160, 160]), 128, 1.5);
    expect(b[4] - b[0]).toBeGreaterThan(a[4] - a[0]);
  });

  it('빈 배열은 그대로', () => {
    expect(grayCentered(new Uint8ClampedArray(0)).length).toBe(0);
  });
});

describe('사진 재질 — 자리(슬롯)', () => {
  it('마루·타일·스테인리스 세 자리가 있다', () => {
    expect([...MATERIAL_PHOTOS]).toEqual(['wood', 'tile', 'steel']);
  });

  it('사진이 아직 안 불러졌으면 null — 기존 캔버스 무늬로 그린다', () => {
    expect(materialPhoto('wood')).toBeNull();
  });

  it('저장소에 있는 사진 키만 불러오기 목록에 들어간다', () => {
    for (const k of materialPhotoKeys()) expect(k).toMatch(/^mat:(wood|tile|steel)$/);
  });

  it('DOM 이 없는 환경에서도 나뭇결 타일 요청이 깨지지 않는다', () => {
    expect(() => woodGrainTile(0)).not.toThrow();
  });
});
