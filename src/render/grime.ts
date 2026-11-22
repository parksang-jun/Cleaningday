// 오염 질감 — 종류별 고해상도 "때" 텍스처를 판마다 한 번 그려 두고, 격자 마스크로 잘라 쓴다.
// 먼지 보풀·머리카락 가닥·갈라진 진흙·번들거리는 기름·커피 링·석회 결정·물방울 자국·곰팡이 점·이끼 포기·분진 알갱이·타르 방울·지문 얼룩.
import type { DirtType } from '../game/catalog';
import { noiseTile } from './materials';

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;

function lcg(seed: number): Rnd {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function grainOver(g: Ctx, w: number, h: number, kind: 'grain' | 'speckle' | 'plaster', alpha: number, scale = 1, mode: GlobalCompositeOperation = 'overlay') {
  const t = noiseTile(kind, 128, 60);
  if (!t) return;
  const p = g.createPattern(t, 'repeat');
  if (!p) return;
  g.save();
  g.globalCompositeOperation = mode;
  g.globalAlpha = alpha;
  if (scale !== 1 && 'setTransform' in p) {
    const m = new DOMMatrix();
    m.a = scale;
    m.d = scale;
    p.setTransform(m);
  }
  g.fillStyle = p;
  g.fillRect(0, 0, w, h);
  g.restore();
}

const holeCache = new Map<string, HTMLCanvasElement>();
/** 작은 구멍 타일(투명 배경 + 검은 점) — destination-out 으로 찍으면 질감에 구멍이 뚫려 가장자리가 부서진다 */
function holeTile(density: number, seed: number): HTMLCanvasElement {
  const key = `${density}:${seed}`;
  const hit = holeCache.get(key);
  if (hit) return hit;
  const size = 160;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const rnd = lcg(seed);
  const n = Math.round(density * 900);
  for (let k = 0; k < n; k++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 0.5 + rnd() * rnd() * 3;
    g.fillStyle = `rgba(0,0,0,${0.5 + rnd() * 0.5})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    // 타일 경계 넘김
    if (x < 4 || y < 4) {
      g.beginPath();
      g.arc(x + (x < 4 ? size : 0), y + (y < 4 ? size : 0), r, 0, Math.PI * 2);
      g.fill();
    }
  }
  holeCache.set(key, c);
  return c;
}
function holes(g: Ctx, w: number, h: number, density: number, scale = 1, seed = 1) {
  const p = g.createPattern(holeTile(density, seed), 'repeat');
  if (!p) return;
  g.save();
  g.globalCompositeOperation = 'destination-out';
  if (scale !== 1 && 'setTransform' in p) {
    const m = new DOMMatrix();
    m.a = scale;
    m.d = scale;
    p.setTransform(m);
  }
  g.fillStyle = p;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/** 불규칙한 얼룩(blob) 경로 — 반지름 r, 울퉁불퉁함 j */
function blob(g: Ctx, rnd: Rnd, x: number, y: number, r: number, j = 0.35, n = 9) {
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * (1 - j / 2 + rnd() * j);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * (0.75 + rnd() * 0.4);
    if (k === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** 종류별 질감 — 배경 투명, 알파에 구멍·농담이 들어 있어 격자 마스크와 곱해지면 가장자리가 자연스럽게 부서진다 */
export function makeGrimeTexture(type: DirtType, w: number, h: number, seed: number, px: number): HTMLCanvasElement {
  // px: 격자 한 칸의 픽셀 크기 (장식 크기 기준)
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const rnd = lcg(seed * 7 + type.length * 131);
  const area = w * h;
  const u = Math.max(1, px); // 1칸
  switch (type) {
    case 'dust': {
      g.fillStyle = 'rgba(138,128,112,0.9)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'plaster', 0.9, 1.3, 'overlay');
      holes(g, w, h, 0.35, 0.8, 35); // 구멍
      // 보풀·실오라기
      const n = (area / (u * u)) * 0.9;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const v = 170 + rnd() * 70;
        g.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.35 + rnd() * 0.45})`;
        g.beginPath();
        g.arc(x, y, 0.4 + rnd() * u * 0.12, 0, Math.PI * 2);
        g.fill();
      }
      g.lineCap = 'round';
      for (let k = 0; k < n * 0.12; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (0.5 + rnd() * 1.6);
        const a = rnd() * Math.PI * 2;
        g.strokeStyle = `rgba(215,210,200,${0.35 + rnd() * 0.4})`;
        g.lineWidth = 0.5 + rnd() * 0.6;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a + 0.8) * len * 0.5, y + Math.sin(a + 0.8) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      // 먼지 뭉치
      for (let k = 0; k < n * 0.015; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.5 + rnd() * 0.9);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(120,110,96,0.7)');
        rg.addColorStop(1, 'rgba(120,110,96,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      break;
    }
    case 'hair': {
      g.fillStyle = 'rgba(110,98,86,0.45)';
      g.fillRect(0, 0, w, h);
      holes(g, w, h, 0.5, 1, 50);
      g.lineCap = 'round';
      const n = (area / (u * u)) * 0.5;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (1.5 + rnd() * 5);
        const a = rnd() * Math.PI * 2;
        const curl = (rnd() - 0.5) * 2.4;
        const dark = rnd() < 0.75;
        g.strokeStyle = dark ? `rgba(${30 + rnd() * 30},${22 + rnd() * 20},${18 + rnd() * 16},${0.75 + rnd() * 0.25})` : `rgba(${150 + rnd() * 60},${130 + rnd() * 50},${100 + rnd() * 40},0.8)`;
        g.lineWidth = 0.7 + rnd() * 0.9;
        g.beginPath();
        g.moveTo(x, y);
        const cx1 = x + Math.cos(a + curl) * len * 0.4;
        const cy1 = y + Math.sin(a + curl) * len * 0.4;
        const cx2 = x + Math.cos(a - curl) * len * 0.7;
        const cy2 = y + Math.sin(a - curl) * len * 0.7;
        g.bezierCurveTo(cx1, cy1, cx2, cy2, x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      // 먼지 뭉치
      for (let k = 0; k < n * 0.06; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.4 + rnd() * 0.7);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(100,90,80,0.6)');
        rg.addColorStop(1, 'rgba(100,90,80,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      break;
    }
    case 'mud': {
      g.fillStyle = 'rgba(92,62,34,0.96)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'grain', 0.8, 1.6, 'overlay');
      // 마른 덩어리(밝은 테두리) + 갈라진 금
      const n = (area / (u * u)) * 0.12;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.5 + rnd() * 1.4);
        blob(g, rnd, x, y, r, 0.5, 8);
        g.fillStyle = `rgba(${70 + rnd() * 30},${46 + rnd() * 20},${24 + rnd() * 14},0.85)`;
        g.fill();
        g.strokeStyle = 'rgba(176,140,100,0.55)';
        g.lineWidth = 0.8;
        g.stroke();
      }
      g.strokeStyle = 'rgba(190,160,120,0.5)';
      g.lineWidth = 0.7;
      for (let k = 0; k < n * 1.5; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        g.beginPath();
        g.moveTo(x, y);
        let cx = x;
        let cy = y;
        for (let s = 0; s < 4; s++) {
          cx += (rnd() - 0.5) * u * 1.4;
          cy += (rnd() - 0.5) * u * 1.4;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
      // 튄 방울
      for (let k = 0; k < n * 4; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        g.fillStyle = `rgba(${60 + rnd() * 40},${40 + rnd() * 24},${20 + rnd() * 14},${0.5 + rnd() * 0.5})`;
        g.beginPath();
        g.arc(x, y, 0.5 + rnd() * u * 0.18, 0, Math.PI * 2);
        g.fill();
      }
      holes(g, w, h, 0.22, 1, 22);
      break;
    }
    case 'grease': {
      g.fillStyle = 'rgba(146,96,18,0.9)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'plaster', 0.5, 2, 'overlay');
      // 탄 자국(어두운) + 번들거리는 하이라이트 + 흘러내린 줄
      const n = (area / (u * u)) * 0.08;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.4 + rnd() * 1.3);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(70,40,8,0.75)');
        rg.addColorStop(1, 'rgba(70,40,8,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let k = 0; k < n * 0.7; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (1 + rnd() * 3);
        const wd = 0.8 + rnd() * u * 0.25;
        const lg = g.createLinearGradient(x, y, x, y + len);
        lg.addColorStop(0, 'rgba(120,76,10,0)');
        lg.addColorStop(0.5, 'rgba(120,76,10,0.7)');
        lg.addColorStop(1, 'rgba(90,56,6,0.9)');
        g.fillStyle = lg;
        g.beginPath();
        g.ellipse(x, y + len / 2, wd, len / 2, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(90,56,6,0.9)';
        g.beginPath();
        g.arc(x, y + len, wd * 1.4, 0, Math.PI * 2);
        g.fill();
      }
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < n * 1.2; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.3 + rnd() * 0.9);
        const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        rg.addColorStop(0, 'rgba(255,220,140,0.55)');
        rg.addColorStop(0.4, 'rgba(255,200,100,0.18)');
        rg.addColorStop(1, 'rgba(255,200,100,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.restore();
      holes(g, w, h, 0.12, 1.5, 12);
      break;
    }
    case 'stain': {
      g.fillStyle = 'rgba(112,48,34,0.8)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'plaster', 0.6, 1.5, 'overlay');
      // 커피·와인 링: 테두리 진하고 안쪽 옅음
      const n = (area / (u * u)) * 0.045;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.8 + rnd() * 2.2);
        g.strokeStyle = `rgba(${90 + rnd() * 30},${30 + rnd() * 20},${20 + rnd() * 16},${0.6 + rnd() * 0.35})`;
        g.lineWidth = u * (0.12 + rnd() * 0.18);
        g.beginPath();
        g.ellipse(x, y, r, r * (0.8 + rnd() * 0.3), rnd() * 3, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(140,70,50,0.14)';
        g.fill();
      }
      // 튄 자국
      for (let k = 0; k < n * 6; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        blob(g, rnd, x, y, u * (0.15 + rnd() * 0.5), 0.6, 7);
        g.fillStyle = `rgba(${100 + rnd() * 40},${40 + rnd() * 24},${26 + rnd() * 16},${0.45 + rnd() * 0.5})`;
        g.fill();
      }
      holes(g, w, h, 0.3, 1.2, 30);
      break;
    }
    case 'scale': {
      g.fillStyle = 'rgba(232,228,208,0.96)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'plaster', 1, 0.9, 'overlay');
      // 석회 결정 알갱이 + 흘러내린 자국
      const n = (area / (u * u)) * 1.4;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const v = 200 + rnd() * 55;
        g.fillStyle = `rgba(${v},${v - 2},${v - 20},${0.5 + rnd() * 0.5})`;
        g.beginPath();
        g.arc(x, y, 0.4 + rnd() * u * 0.14, 0, Math.PI * 2);
        g.fill();
      }
      for (let k = 0; k < n * 0.03; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (2 + rnd() * 6);
        const lg = g.createLinearGradient(x, y, x, y + len);
        lg.addColorStop(0, 'rgba(255,255,245,0)');
        lg.addColorStop(0.6, 'rgba(250,248,235,0.8)');
        lg.addColorStop(1, 'rgba(225,220,200,0)');
        g.fillStyle = lg;
        g.fillRect(x - u * 0.12, y, u * 0.24, len);
      }
      for (let k = 0; k < n * 0.02; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        g.strokeStyle = 'rgba(170,165,145,0.5)';
        g.lineWidth = 0.6;
        g.beginPath();
        g.arc(x, y, u * (0.4 + rnd() * 1), 0, Math.PI * 2);
        g.stroke();
      }
      holes(g, w, h, 0.3, 0.9, 30);
      break;
    }
    case 'soap': {
      g.fillStyle = 'rgba(208,200,166,0.85)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'plaster', 0.5, 1.8, 'overlay');
      // 물방울 자국(테두리 밝음) + 흘러내린 줄
      const n = (area / (u * u)) * 0.2;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.2 + rnd() * 0.8);
        g.strokeStyle = `rgba(245,240,225,${0.5 + rnd() * 0.4})`;
        g.lineWidth = 0.7 + rnd() * 0.8;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(190,180,150,0.25)';
        g.fill();
      }
      for (let k = 0; k < n * 0.08; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (2 + rnd() * 5);
        g.fillStyle = 'rgba(235,228,205,0.45)';
        g.fillRect(x, y, 0.8 + rnd() * u * 0.12, len);
      }
      holes(g, w, h, 0.25, 1.4, 25);
      break;
    }
    case 'mold': {
      g.fillStyle = 'rgba(46,58,50,0.72)';
      g.fillRect(0, 0, w, h);
      // 검은 점 군집 + 보송한 테두리 + 초록빛 반점
      const n = (area / (u * u)) * 0.55;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.12 + rnd() * rnd() * 0.9);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        const dark = rnd() < 0.7;
        rg.addColorStop(0, dark ? 'rgba(12,16,14,1)' : 'rgba(50,86,52,0.95)');
        rg.addColorStop(0.6, dark ? 'rgba(22,30,24,0.9)' : 'rgba(60,100,62,0.7)');
        rg.addColorStop(1, 'rgba(30,38,32,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let k = 0; k < n * 2; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        g.fillStyle = `rgba(${20 + rnd() * 30},${26 + rnd() * 34},${22 + rnd() * 24},${0.6 + rnd() * 0.4})`;
        g.beginPath();
        g.arc(x, y, 0.4 + rnd() * 1.4, 0, Math.PI * 2);
        g.fill();
      }
      holes(g, w, h, 0.3, 1.1, 30);
      break;
    }
    case 'moss': {
      g.fillStyle = 'rgba(66,100,36,0.95)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'grain', 0.6, 1.2, 'overlay');
      // 포기(짧은 잎 다발)
      const n = (area / (u * u)) * 0.6;
      g.lineCap = 'round';
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const gcol = `rgba(${60 + rnd() * 60},${110 + rnd() * 70},${30 + rnd() * 40},${0.6 + rnd() * 0.4})`;
        g.strokeStyle = gcol;
        g.lineWidth = 0.8 + rnd() * 1;
        for (let s = 0; s < 4; s++) {
          const a = -Math.PI / 2 + (rnd() - 0.5) * 1.6;
          const len = u * (0.25 + rnd() * 0.5);
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
          g.stroke();
        }
      }
      for (let k = 0; k < n * 0.1; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.4 + rnd() * 0.8);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(40,70,22,0.6)');
        rg.addColorStop(1, 'rgba(40,70,22,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      holes(g, w, h, 0.2, 1, 20);
      break;
    }
    case 'iron': {
      g.fillStyle = 'rgba(62,40,26,0.92)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'speckle', 0.9, 0.7, 'overlay');
      // 분진 알갱이(검은/금속 반짝)
      const n = (area / (u * u)) * 2.2;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const metal = rnd() < 0.12;
        g.fillStyle = metal ? `rgba(${180 + rnd() * 60},${170 + rnd() * 50},${150 + rnd() * 40},0.8)` : `rgba(${20 + rnd() * 40},${16 + rnd() * 24},${12 + rnd() * 16},${0.5 + rnd() * 0.5})`;
        g.beginPath();
        g.arc(x, y, 0.35 + rnd() * u * 0.1, 0, Math.PI * 2);
        g.fill();
      }
      for (let k = 0; k < n * 0.01; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.6 + rnd() * 1.2);
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(20,14,10,0.7)');
        rg.addColorStop(1, 'rgba(20,14,10,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      holes(g, w, h, 0.18, 1, 18);
      break;
    }
    case 'tar': {
      g.fillStyle = 'rgba(28,24,26,0.7)';
      g.fillRect(0, 0, w, h);
      holes(g, w, h, 0.5, 1.3, 50);
      // 타르 방울(번들) + 벌레 자국(노르스름)
      const n = (area / (u * u)) * 0.22;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.2 + rnd() * 0.9);
        blob(g, rnd, x, y, r, 0.4, 8);
        g.fillStyle = `rgba(${12 + rnd() * 16},${10 + rnd() * 12},${12 + rnd() * 14},0.96)`;
        g.fill();
        const hg = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x - r * 0.35, y - r * 0.35, r * 0.6);
        hg.addColorStop(0, 'rgba(255,255,255,0.55)');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = hg;
        g.fill();
      }
      for (let k = 0; k < n * 0.35; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        blob(g, rnd, x, y, u * (0.15 + rnd() * 0.4), 0.7, 7);
        g.fillStyle = `rgba(${200 + rnd() * 40},${190 + rnd() * 40},${120 + rnd() * 40},0.85)`;
        g.fill();
        g.fillStyle = 'rgba(60,40,20,0.8)';
        g.beginPath();
        g.arc(x, y, u * 0.08, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'crumbs': {
      // 과자·빵 부스러기: 바탕 없이 낱알만 — 큰 조각 몇 개와 잔가루
      const n = (area / (u * u)) * 1.5;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const big = rnd() < 0.28;
        const r = u * (big ? 0.42 + rnd() * 0.42 : 0.1 + rnd() * 0.2);
        const tone = rnd();
        const cr = tone < 0.5 ? [214, 164, 92] : tone < 0.8 ? [176, 118, 54] : [240, 214, 160];
        // 바닥에 떨어진 그림자
        g.fillStyle = 'rgba(40,26,10,0.35)';
        blob(g, rnd, x + r * 0.25, y + r * 0.35, r, 0.5, 6);
        g.fill();
        g.fillStyle = `rgba(${cr[0]},${cr[1]},${cr[2]},1)`;
        blob(g, rnd, x, y, r, 0.55, 6);
        g.fill();
        if (big) {
          g.fillStyle = 'rgba(255,240,205,0.7)';
          blob(g, rnd, x - r * 0.25, y - r * 0.25, r * 0.4, 0.4, 5);
          g.fill();
          g.fillStyle = 'rgba(110,66,24,0.55)';
          g.beginPath();
          g.arc(x + r * 0.2, y + r * 0.15, r * 0.14, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case 'spill': {
      // 쏟은 음료: 젖어 번들거리는 웅덩이 — 가장자리가 진하고 빛이 비친다
      g.fillStyle = 'rgba(146,82,40,0.86)';
      g.fillRect(0, 0, w, h);
      const n = (area / (u * u)) * 0.05;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (1.4 + rnd() * 2.6);
        const rg = g.createRadialGradient(x, y, r * 0.2, x, y, r);
        rg.addColorStop(0, 'rgba(196,128,66,0.55)');
        rg.addColorStop(1, 'rgba(196,128,66,0)');
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // 물결 같은 반사광
      g.lineCap = 'round';
      for (let k = 0; k < n * 5; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (0.8 + rnd() * 2.4);
        const a = -0.5 + rnd() * 0.5;
        g.strokeStyle = `rgba(255,246,232,${0.3 + rnd() * 0.4})`;
        g.lineWidth = u * (0.07 + rnd() * 0.12);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 - u * 0.25, x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      // 잔거품
      for (let k = 0; k < n * 4; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = u * (0.08 + rnd() * 0.16);
        g.strokeStyle = 'rgba(255,240,220,0.6)';
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case 'sticker': {
      // 스티커 더미: 흰 테두리가 있는 작은 스티커들이 겹쳐 붙어 있다 (바탕은 투명 — 사이로 바닥이 보인다)
      const palette = ['#ef5350', '#42a5f5', '#ffca28', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da', '#f48fb1'];
      const n = (area / (u * u)) * 0.16;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const sw = u * (1.7 + rnd() * 1.6);
        const sh = sw * (0.62 + rnd() * 0.5);
        const col = palette[Math.floor(rnd() * palette.length)];
        const kind = Math.floor(rnd() * 4);
        g.save();
        g.translate(x, y);
        g.rotate((rnd() - 0.5) * 1.1);
        g.shadowColor = 'rgba(0,0,0,0.35)';
        g.shadowBlur = u * 0.25;
        g.shadowOffsetY = u * 0.08;
        g.fillStyle = '#fbf7ec';
        const rr = Math.min(sw, sh) * (kind === 1 ? 0.5 : 0.18);
        g.beginPath();
        g.roundRect(-sw / 2, -sh / 2, sw, sh, rr);
        g.fill();
        g.shadowColor = 'transparent';
        const m = u * 0.16;
        g.fillStyle = col;
        g.beginPath();
        g.roundRect(-sw / 2 + m, -sh / 2 + m, sw - m * 2, sh - m * 2, Math.max(1, rr - m));
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.92)';
        if (kind === 0) {
          // 별
          const R = Math.min(sw, sh) * 0.26;
          g.beginPath();
          for (let q = 0; q < 10; q++) {
            const a = (q / 10) * Math.PI * 2 - Math.PI / 2;
            const rad = q % 2 ? R * 0.45 : R;
            if (q === 0) g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
            else g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          g.closePath();
          g.fill();
        } else if (kind === 1) {
          // 웃는 얼굴
          g.fillStyle = 'rgba(40,30,20,0.8)';
          g.beginPath();
          g.arc(-sw * 0.14, -sh * 0.08, u * 0.09, 0, Math.PI * 2);
          g.arc(sw * 0.14, -sh * 0.08, u * 0.09, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(40,30,20,0.8)';
          g.lineWidth = u * 0.08;
          g.beginPath();
          g.arc(0, sh * 0.02, Math.min(sw, sh) * 0.2, 0.2, Math.PI - 0.2);
          g.stroke();
        } else if (kind === 2) {
          // 가격표 줄
          for (let q = 0; q < 3; q++) g.fillRect(-sw * 0.3, -sh * 0.22 + q * sh * 0.18, sw * (0.6 - q * 0.14), sh * 0.08);
        } else {
          // 하트
          const R = Math.min(sw, sh) * 0.2;
          g.beginPath();
          g.moveTo(0, R * 0.9);
          g.bezierCurveTo(-R * 1.6, -R * 0.2, -R * 0.6, -R * 1.3, 0, -R * 0.4);
          g.bezierCurveTo(R * 0.6, -R * 1.3, R * 1.6, -R * 0.2, 0, R * 0.9);
          g.fill();
        }
        // 종이 광택
        g.fillStyle = 'rgba(255,255,255,0.16)';
        g.fillRect(-sw / 2, -sh / 2, sw, sh * 0.35);
        g.restore();
      }
      break;
    }
    case 'glue': {
      // 끈끈이: 스티커를 뗀 자리의 누런 접착제 — 반투명하고 먼지·종이 찌꺼기가 달라붙어 있다
      g.fillStyle = 'rgba(214,196,142,0.5)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'plaster', 0.5, 1.8, 'overlay');
      const n = (area / (u * u)) * 0.5;
      g.lineCap = 'round';
      // 뜯긴 종이 찌꺼기
      for (let k = 0; k < n * 0.5; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        g.fillStyle = `rgba(250,246,236,${0.45 + rnd() * 0.4})`;
        blob(g, rnd, x, y, u * (0.12 + rnd() * 0.3), 0.7, 6);
        g.fill();
      }
      // 끈적하게 늘어난 결
      for (let k = 0; k < n * 0.6; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (0.6 + rnd() * 1.8);
        const a = rnd() * Math.PI;
        g.strokeStyle = `rgba(255,244,205,${0.3 + rnd() * 0.35})`;
        g.lineWidth = u * (0.05 + rnd() * 0.1);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      // 달라붙은 먼지
      for (let k = 0; k < n; k++) {
        g.fillStyle = `rgba(90,80,66,${0.3 + rnd() * 0.4})`;
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, 0.5 + rnd() * u * 0.08, 0, Math.PI * 2);
        g.fill();
      }
      holes(g, w, h, 0.25, 1.2, 28);
      break;
    }
    case 'crayon': {
      // 크레파스 낙서: 바탕 없이 색색의 굵은 선 — 지그재그·동그라미·꼬불꼬불
      const colors = [
        [226, 64, 84],
        [63, 122, 216],
        [242, 178, 51],
        [63, 174, 106],
        [150, 90, 200],
        [240, 120, 50],
      ];
      // 손에 묻어 번진 옅은 왁스 자국 (낙서가 있는 자리를 알아볼 수 있게)
      g.fillStyle = 'rgba(226,120,120,0.1)';
      g.fillRect(0, 0, w, h);
      const n = (area / (u * u)) * 0.12;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let k = 0; k < n; k++) {
        const c = colors[Math.floor(rnd() * colors.length)];
        let x = rnd() * w;
        let y = rnd() * h;
        const kind = rnd();
        const lw = u * (0.22 + rnd() * 0.2);
        // 크레파스 질감: 같은 선을 살짝 어긋나게 여러 번, 알파를 낮춰 겹친다
        for (let pass = 0; pass < 3; pass++) {
          const jx = (rnd() - 0.5) * u * 0.12;
          const jy = (rnd() - 0.5) * u * 0.12;
          g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.5 + rnd() * 0.3})`;
          g.lineWidth = lw * (0.7 + rnd() * 0.5);
          g.beginPath();
          if (kind < 0.4) {
            // 지그재그 색칠
            const a = rnd() * Math.PI;
            const step = u * (0.35 + rnd() * 0.2);
            const amp = u * (1.2 + rnd() * 1.6);
            g.moveTo(x + jx, y + jy);
            for (let q = 1; q < 9; q++) {
              const along = q * step;
              const side = (q % 2 ? 1 : -1) * amp * 0.5;
              g.lineTo(x + jx + Math.cos(a) * along - Math.sin(a) * side, y + jy + Math.sin(a) * along + Math.cos(a) * side);
            }
          } else if (kind < 0.7) {
            // 빙글빙글
            const R = u * (0.7 + rnd() * 1.1);
            for (let q = 0; q <= 40; q++) {
              const a = (q / 40) * Math.PI * 4.5;
              const rad = R * (0.35 + (q / 40) * 0.65);
              const px = x + jx + Math.cos(a) * rad;
              const py = y + jy + Math.sin(a) * rad * 0.85;
              if (q === 0) g.moveTo(px, py);
              else g.lineTo(px, py);
            }
          } else {
            // 꼬불꼬불 긴 선
            g.moveTo(x + jx, y + jy);
            let a = rnd() * Math.PI * 2;
            let cx2 = x;
            let cy2 = y;
            for (let q = 0; q < 6; q++) {
              a += (rnd() - 0.5) * 1.6;
              const len = u * (0.9 + rnd() * 1.2);
              const nx = cx2 + Math.cos(a) * len;
              const ny = cy2 + Math.sin(a) * len;
              g.quadraticCurveTo(cx2 + Math.cos(a + 1) * len * 0.5 + jx, cy2 + Math.sin(a + 1) * len * 0.5 + jy, nx + jx, ny + jy);
              cx2 = nx;
              cy2 = ny;
            }
          }
          g.stroke();
        }
        x = y = 0;
      }
      // 왁스 가루
      for (let k = 0; k < n * 14; k++) {
        const c = colors[Math.floor(rnd() * colors.length)];
        g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.35 + rnd() * 0.4})`;
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, 0.5 + rnd() * u * 0.07, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'film':
    default: {
      g.fillStyle = 'rgba(196,212,222,0.6)';
      g.fillRect(0, 0, w, h);
      grainOver(g, w, h, 'plaster', 0.5, 2.2, 'overlay');
      // 지문·손자국(타원 + 결 선) + 닦다 만 줄무늬
      const n = (area / (u * u)) * 0.04;
      for (let k = 0; k < n; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const rx = u * (0.5 + rnd() * 0.8);
        const ry = rx * (1.2 + rnd() * 0.5);
        const a = rnd() * Math.PI;
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.fillStyle = 'rgba(225,235,242,0.35)';
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(150,170,185,0.4)';
        g.lineWidth = 0.6;
        for (let s = 0.25; s < 1; s += 0.18) {
          g.beginPath();
          g.ellipse(0, 0, rx * s, ry * s, 0, 0.3, Math.PI * 1.7);
          g.stroke();
        }
        g.restore();
      }
      for (let k = 0; k < n * 1.5; k++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const len = u * (2 + rnd() * 6);
        const a = rnd() * Math.PI;
        g.strokeStyle = `rgba(235,242,248,${0.25 + rnd() * 0.3})`;
        g.lineWidth = u * (0.1 + rnd() * 0.3);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
      holes(g, w, h, 0.3, 1.6, 30);
      break;
    }
  }
  return c;
}

/** 지워질 때 튀는 파편 스타일 */
export interface DebrisStyle {
  shape: 'puff' | 'speck' | 'chip' | 'strand' | 'drop' | 'bubble' | 'tuft' | 'flash';
  colors: string[];
  count: number; // 칸당 입자 수
  gravity: number; // 칸/s²
  speed: number; // 초기 속도(칸/s)
  size: number; // 칸 단위
  life: number; // s
}
export const DEBRIS: Record<DirtType, DebrisStyle> = {
  dust: { shape: 'puff', colors: ['rgba(190,182,168,0.55)', 'rgba(160,150,136,0.5)'], count: 0.7, gravity: -1.5, speed: 2.5, size: 0.9, life: 0.7 },
  hair: { shape: 'strand', colors: ['#2b221c', '#4a3a2e', '#8a7a62'], count: 0.5, gravity: 0, speed: 7, size: 1.4, life: 0.55 },
  mud: { shape: 'chip', colors: ['#5b3f26', '#7a5636', '#3f2a18'], count: 0.9, gravity: 22, speed: 6, size: 0.35, life: 0.7 },
  grease: { shape: 'drop', colors: ['rgba(170,110,20,0.9)', 'rgba(120,76,10,0.9)'], count: 0.5, gravity: 14, speed: 3, size: 0.3, life: 0.6 },
  stain: { shape: 'drop', colors: ['rgba(120,50,36,0.85)', 'rgba(150,70,50,0.8)'], count: 0.5, gravity: 10, speed: 3.5, size: 0.28, life: 0.55 },
  scale: { shape: 'chip', colors: ['#f2efe4', '#d9d4c2', '#ffffff'], count: 0.9, gravity: 20, speed: 5, size: 0.3, life: 0.7 },
  soap: { shape: 'bubble', colors: ['rgba(255,255,255,0.85)'], count: 0.6, gravity: -6, speed: 2, size: 0.35, life: 0.9 },
  mold: { shape: 'speck', colors: ['#1a211c', '#3b5a3c', '#26302a'], count: 1.1, gravity: 8, speed: 5, size: 0.18, life: 0.5 },
  moss: { shape: 'tuft', colors: ['#4f7a2a', '#7aa23a', '#355a1c'], count: 0.8, gravity: 16, speed: 5, size: 0.3, life: 0.65 },
  iron: { shape: 'speck', colors: ['#2a2018', '#5a4634', '#c8b89c'], count: 1.4, gravity: 12, speed: 7, size: 0.14, life: 0.5 },
  tar: { shape: 'drop', colors: ['#141214', '#2a2628'], count: 0.5, gravity: 12, speed: 3, size: 0.28, life: 0.6 },
  film: { shape: 'flash', colors: ['rgba(255,255,255,0.9)', 'rgba(220,240,255,0.8)'], count: 0.35, gravity: 0, speed: 1.5, size: 0.6, life: 0.4 },
  crumbs: { shape: 'chip', colors: ['#d9a85c', '#b98238', '#f0d49a', '#8a5a26'], count: 1.3, gravity: 18, speed: 7, size: 0.22, life: 0.6 },
  spill: { shape: 'drop', colors: ['rgba(150,84,40,0.85)', 'rgba(190,120,60,0.8)'], count: 0.7, gravity: 12, speed: 3, size: 0.3, life: 0.6 },
  sticker: { shape: 'chip', colors: ['#f4e8be', '#ffffff', '#e8c24a', '#e56b6b'], count: 0.9, gravity: 14, speed: 6, size: 0.42, life: 0.75 },
  glue: { shape: 'drop', colors: ['rgba(214,196,150,0.8)', 'rgba(240,226,180,0.7)'], count: 0.5, gravity: 8, speed: 2.5, size: 0.26, life: 0.6 },
  crayon: { shape: 'speck', colors: ['#e2405a', '#3f7ad8', '#f2b233', '#3fae6a'], count: 1.2, gravity: 10, speed: 5, size: 0.16, life: 0.5 },
};
