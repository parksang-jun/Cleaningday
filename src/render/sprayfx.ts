// 세정제마다 "쓰는 느낌"이 다르다 — 나오는 모양(분사 입자)과 표면에 남는 모양(잔여층)을 제품별로 정한다.
//  · mist   분무기: 고운 물방울이 부채꼴로 퍼지고, 표면엔 작은 물방울이 맺힌다 (다목적·유리·기름때 제거제 …)
//  · foam   폼건: 눈처럼 두꺼운 거품이 덩어리로 쌓인다 (카샴푸·욕실 세정제·데크 클리너)
//  · bleach 락스 분사: 묽고 투명한 액이 줄기로 쏘이고 아래로 흘러내린다 (곰팡이 제거제)
//  · gel    짜서 쓰는 점성 세제: 굵은 방울이 뚝뚝, 표면엔 윤기 나는 띠로 남는다 (주방세제·젤·치약)
//  · powder 가루: 알갱이가 솔솔 떨어져 하얗게 쌓인다 (베이킹소다·구연산·과탄산소다)
//  · oil    기름: 번들거리는 얇은 막 (식용유·타르 리무버)
import type { DetergentSpec } from '../game/catalog';

export type SprayStyle = 'mist' | 'foam' | 'bleach' | 'gel' | 'powder' | 'oil';

export interface SprayLook {
  style: SprayStyle;
  /** 잔여층 색 (RGB) */
  color: [number, number, number];
  /** 잔여층 불투명도 (0~255, 불림 정도에 곱해진다) */
  alpha: number;
  /** 분사 입자 색 */
  particle: string;
}

const STYLE_DEFAULT: Record<SprayStyle, Omit<SprayLook, 'style'>> = {
  mist: { color: [205, 236, 255], alpha: 95, particle: 'rgba(215,240,255,0.85)' },
  foam: { color: [255, 255, 255], alpha: 215, particle: 'rgba(255,255,255,0.95)' },
  bleach: { color: [240, 246, 205], alpha: 80, particle: 'rgba(238,246,190,0.9)' },
  gel: { color: [120, 215, 120], alpha: 185, particle: 'rgba(110,210,110,0.95)' },
  powder: { color: [250, 250, 246], alpha: 205, particle: 'rgba(252,252,248,0.98)' },
  oil: { color: [235, 200, 90], alpha: 110, particle: 'rgba(235,195,80,0.9)' },
};

type Look = { style: SprayStyle } & Partial<Omit<SprayLook, 'style'>>;
/** 기본 제품(base) → 모양. 광고·프리미엄 제품은 base 를 따라간다 */
const BY_BASE: Record<string, Look> = {
  allpurpose: { style: 'mist' },
  glass: { style: 'mist', color: [190, 225, 255], particle: 'rgba(170,215,255,0.9)' },
  degreaser: { style: 'mist', color: [255, 232, 170], particle: 'rgba(255,225,150,0.9)' },
  heavydegreaser: { style: 'foam', color: [255, 240, 200], alpha: 190, particle: 'rgba(255,238,195,0.95)' },
  descaler: { style: 'mist', color: [205, 250, 215], particle: 'rgba(195,245,205,0.9)' },
  limescalegel: { style: 'gel', color: [90, 150, 235], particle: 'rgba(90,150,235,0.95)' },
  bathroom: { style: 'foam', color: [225, 245, 255], alpha: 190, particle: 'rgba(230,246,255,0.95)' },
  moldremover: { style: 'bleach' },
  fabric: { style: 'foam', color: [255, 250, 240], alpha: 150, particle: 'rgba(255,250,240,0.9)' },
  deckcleaner: { style: 'foam', color: [245, 250, 235], alpha: 170, particle: 'rgba(245,250,235,0.92)' },
  mossremover: { style: 'bleach', color: [215, 240, 200], particle: 'rgba(205,235,185,0.9)' },
  carshampoo: { style: 'foam' },
  wheelcleaner: { style: 'mist', color: [200, 160, 235], alpha: 120, particle: 'rgba(195,150,235,0.9)' }, // 철분과 만나 보랏빛
  tarremover: { style: 'oil', color: [240, 225, 200], alpha: 85, particle: 'rgba(240,225,195,0.85)' },
  interior: { style: 'mist', color: [225, 240, 250], alpha: 80 },
  bakingsoda: { style: 'powder' },
  citric: { style: 'powder', color: [255, 252, 225] },
  percarbonate: { style: 'powder', color: [240, 248, 255] },
  vinegar: { style: 'bleach', color: [250, 245, 215], alpha: 65, particle: 'rgba(250,244,205,0.85)' },
  toothpaste: { style: 'gel', color: [250, 250, 255], alpha: 215, particle: 'rgba(250,250,255,0.98)' },
  cookingoil: { style: 'oil' },
  dishsoap: { style: 'gel' },
};
/** 섞어 만든 세제 */
const BY_FAMILY: Record<string, Look> = {
  soapsoda: { style: 'gel', color: [255, 236, 200], alpha: 200, particle: 'rgba(255,236,200,0.95)' },
  soapvinegar: { style: 'mist', color: [214, 255, 214], alpha: 110 },
  fizz: { style: 'foam', color: [255, 255, 255], alpha: 235 },
};

export function sprayLook(det: Pick<DetergentSpec, 'base' | 'family'>): SprayLook {
  const l = BY_FAMILY[det.family] ?? BY_BASE[det.base] ?? { style: 'mist' as SprayStyle };
  return { ...STYLE_DEFAULT[l.style], ...l };
}

function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** 잔여층 질감 (흰색 알파 텍스처). px = 격자 한 칸의 픽셀 수 */
export function makeResidueTexture(style: SprayStyle, w: number, h: number, seed: number, px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rnd = lcg(seed * 31 + style.length * 977 + style.charCodeAt(0));
  const u = Math.max(1, px);
  const cells = (w * h) / (u * u);
  const blob = (x: number, y: number, r: number, a0: number, a1: number) => {
    const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,255,255,${a0})`);
    rg.addColorStop(0.6, `rgba(255,255,255,${a1})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  switch (style) {
    case 'foam': {
      // 두꺼운 거품: 꽉 찬 바탕 + 크고 작은 방울이 겹겹이
      g.fillStyle = 'rgba(255,255,255,0.72)';
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < cells * 1.6; k++) {
        const r = u * (0.12 + rnd() * rnd() * 0.85);
        const x = rnd() * w;
        const y = rnd() * h;
        blob(x, y, r, 1, 0.5);
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = Math.max(0.5, u * 0.035);
        g.beginPath();
        g.arc(x, y, r * 0.82, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case 'mist': {
      // 얇은 물기 + 맺힌 물방울
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < cells * 2.4; k++) blob(rnd() * w, rnd() * h, u * (0.05 + rnd() * rnd() * 0.22), 1, 0.55);
      break;
    }
    case 'bleach': {
      // 묽은 액: 얇은 막 + 아래로 흘러내린 줄기
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < cells * 0.55; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (0.8 + rnd() * 2.6);
        const wd = u * (0.07 + rnd() * 0.12);
        const lg = g.createLinearGradient(0, y, 0, y + len);
        lg.addColorStop(0, 'rgba(255,255,255,0.15)');
        lg.addColorStop(0.85, 'rgba(255,255,255,0.8)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.fillRect(x - wd / 2, y, wd, len);
        blob(x, y + len * 0.88, wd * 1.5, 1, 0.6); // 줄기 끝에 맺힌 방울
      }
      break;
    }
    case 'gel': {
      // 점성 세제: 굵고 매끈한 띠 + 길게 번쩍이는 윤기
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(0, 0, w, h);
      g.lineCap = 'round';
      for (let k = 0; k < cells * 0.35; k++) {
        let x = rnd() * w;
        let y = rnd() * h;
        g.strokeStyle = 'rgba(255,255,255,0.95)';
        g.lineWidth = u * (0.35 + rnd() * 0.45);
        g.beginPath();
        g.moveTo(x, y);
        for (let q = 0; q < 4; q++) {
          x += (rnd() - 0.5) * u * 2.4;
          y += (rnd() - 0.2) * u * 1.6;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    }
    case 'powder': {
      // 가루: 고운 알갱이가 빽빽이 (윤기 없음)
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      const d = Math.max(1, u * 0.09);
      for (let k = 0; k < cells * 16; k++) g.fillRect(rnd() * w, rnd() * h, d * (0.6 + rnd()), d * (0.6 + rnd()));
      break;
    }
    case 'oil': {
      // 기름막: 넓게 번진 얼룩무늬 광택
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < cells * 0.5; k++) blob(rnd() * w, rnd() * h, u * (0.6 + rnd() * 1.4), 0.7, 0.35);
      break;
    }
  }
  return c;
}
