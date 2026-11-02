// 장면(깨끗한 표면) 절차적 그리기 — 이미지 자산 없이 캔버스로 생성
import type { SceneId } from '../game/levels';
import { mulberry32 } from '../game/rng';

type Ctx = CanvasRenderingContext2D;

export function paintScene(ctx: Ctx, scene: SceneId, w: number, h: number): void {
  const r = mulberry32(scene.length * 131 + w);
  ctx.save();
  switch (scene) {
    case 'floor':
    case 'table':
      wood(ctx, w, h, r.next, scene === 'table' ? '#b07a4a' : '#c89a64');
      if (scene === 'table') vignette(ctx, w, h, 0.25);
      break;
    case 'entrance':
      tiles(ctx, w, h, 4, '#d9d2c7', '#a8a093', 0.06, r.next);
      break;
    case 'kitchenTile':
      subway(ctx, w, h, '#f4f6f3', '#c9cfc9');
      break;
    case 'bathTile':
    case 'bigClean':
      tiles(ctx, w, h, 6, scene === 'bathTile' ? '#cfe4ea' : '#e9eef0', '#9fb6bd', 0.04, r.next);
      break;
    case 'stove':
      steel(ctx, w, h);
      burners(ctx, w, h);
      break;
    case 'window':
      windowScene(ctx, w, h, r.next);
      break;
    case 'bathtub':
      tub(ctx, w, h);
      break;
    case 'sofa':
      fabric(ctx, w, h, r.next);
      break;
    case 'patio':
      pavers(ctx, w, h, r.next);
      break;
    case 'car':
      carPaint(ctx, w, h);
      break;
  }
  ctx.restore();
}

function wood(ctx: Ctx, w: number, h: number, rnd: () => number, base: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const plank = w / 4;
  for (let i = 0; i < 4; i++) {
    const x = i * plank;
    const shade = (rnd() - 0.5) * 0.18;
    ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(60,30,10,${-shade})`;
    ctx.fillRect(x, 0, plank, h);
    // 결
    ctx.strokeStyle = 'rgba(90,50,20,0.18)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 9; g++) {
      ctx.beginPath();
      const gx = x + rnd() * plank;
      ctx.moveTo(gx, 0);
      for (let y = 0; y <= h; y += h / 12) ctx.lineTo(gx + Math.sin(y / (40 + rnd() * 30) + g) * 5, y);
      ctx.stroke();
    }
    // 이음매
    ctx.fillStyle = 'rgba(60,30,10,0.35)';
    ctx.fillRect(x, 0, 2, h);
    const cut = rnd() * h;
    ctx.fillRect(x, cut, plank, 2);
  }
}

function tiles(ctx: Ctx, w: number, h: number, cols: number, face: string, grout: string, var_: number, rnd: () => number) {
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, w, h);
  const s = w / cols;
  for (let y = 0; y < h; y += s) {
    for (let x = 0; x < w; x += s) {
      ctx.fillStyle = face;
      ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
      ctx.fillStyle = `rgba(255,255,255,${0.1 + rnd() * var_ * 3})`;
      ctx.fillRect(x + 4, y + 4, s - 8, (s - 8) * 0.35);
    }
  }
}

function subway(ctx: Ctx, w: number, h: number, face: string, grout: string) {
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, w, h);
  const tw = w / 3;
  const th = tw / 2.5;
  let row = 0;
  for (let y = 0; y < h; y += th, row++) {
    for (let x = row % 2 ? -tw / 2 : 0; x < w; x += tw) {
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, face);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, tw - 4, th - 4, 4);
      ctx.fill();
    }
  }
}

function steel(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#d8dde2');
  g.addColorStop(0.5, '#eef1f4');
  g.addColorStop(1, '#c4cad1');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  for (let y = 0; y < h; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + 1);
    ctx.stroke();
  }
}

function burners(ctx: Ctx, w: number, h: number) {
  const pos = [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ];
  for (const [px, py] of pos) {
    const cx = px * w;
    const cy = py * h;
    const rr = w * 0.15;
    ctx.fillStyle = '#2b2f35';
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a5058';
    ctx.lineWidth = rr * 0.18;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      ctx.moveTo(cx + Math.cos(a) * rr * 0.3, cy + Math.sin(a) * rr * 0.3);
      ctx.lineTo(cx + Math.cos(a) * rr * 1.05, cy + Math.sin(a) * rr * 1.05);
      ctx.stroke();
    }
    ctx.fillStyle = '#5c636d';
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function windowScene(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#7cc1f0');
  sky.addColorStop(1, '#d9f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 4; i++) {
    const cx = rnd() * w;
    const cy = rnd() * h * 0.5;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(cx + k * 18, cy + (k % 2) * 6, 18 + rnd() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 먼 건물
  ctx.fillStyle = '#9fb7c9';
  for (let x = 0; x < w; x += w / 7) {
    const bh = h * (0.15 + rnd() * 0.2);
    ctx.fillRect(x, h - bh, w / 8, bh);
  }
  // 유리 반사
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, 0);
  ctx.lineTo(w * 0.35, 0);
  ctx.lineTo(w * 0.05, h);
  ctx.lineTo(-w * 0.2, h);
  ctx.fill();
  // 창틀
  ctx.strokeStyle = '#f7f7f5';
  ctx.lineWidth = w * 0.04;
  ctx.strokeRect(0, 0, w, h);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}

function tub(ctx: Ctx, w: number, h: number) {
  tiles(ctx, w, h * 0.45, 5, '#e3eef2', '#b6c8ce', 0.03, () => 0.5);
  const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#e6ebee');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-10, h * 0.45, w + 20, h * 0.6, 40);
  ctx.fill();
  // 실리콘 줄눈
  ctx.fillStyle = '#f2f2ee';
  ctx.fillRect(0, h * 0.44, w, 8);
  ctx.fillStyle = 'rgba(180,200,210,0.5)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.75, w * 0.36, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9d2d8';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.86, 8, 0, Math.PI * 2);
  ctx.fill();
}

function fabric(ctx: Ctx, w: number, h: number, rnd: () => number) {
  ctx.fillStyle = '#6f8fa8';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = y % 6 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, w, 1.5);
  }
  for (let x = 0; x < w; x += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(x, 0, 1, h);
  }
  // 쿠션 이음
  ctx.strokeStyle = 'rgba(30,45,60,0.45)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h * 0.62);
  ctx.moveTo(0, h * 0.62);
  ctx.lineTo(w, h * 0.62);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.05})`;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
}

function pavers(ctx: Ctx, w: number, h: number, rnd: () => number) {
  ctx.fillStyle = '#8c8676';
  ctx.fillRect(0, 0, w, h);
  const s = w / 4;
  for (let y = 0; y < h; y += s * 0.75) {
    for (let x = ((y / (s * 0.75)) % 2) * -s * 0.5; x < w; x += s) {
      const c = 170 + Math.floor(rnd() * 30);
      ctx.fillStyle = `rgb(${c},${c - 6},${c - 18})`;
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, s - 6, s * 0.75 - 6, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let k = 0; k < 6; k++) ctx.fillRect(x + rnd() * s, y + rnd() * s * 0.7, 3, 3);
    }
  }
}

function carPaint(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#d63a3a');
  g.addColorStop(0.45, '#b22222');
  g.addColorStop(1, '#7d1414');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(w * 0.35, h * 0.2, w * 0.45, h * 0.06, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, 0);
  ctx.quadraticCurveTo(w * 0.5, h * 0.55, w * 0.8, 0);
  ctx.stroke();
  ctx.fillStyle = '#c7ced6';
  ctx.beginPath();
  ctx.roundRect(w * 0.42, h * 0.08, w * 0.16, h * 0.035, 6);
  ctx.fill();
}

function vignette(ctx: Ctx, w: number, h: number, a: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.9);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
