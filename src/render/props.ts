// 소품·설비 — 장면을 "어느 집의 어디"로 알아보게 하는 것들. 모두 왼쪽 위 키 라이트 기준으로 음영.
import { chrome, ellipsePath, fabric, rr, shade, softShadow, texture, withAlpha, type Ctx, type Rnd } from './materials';

/** 원통형 파이프 느낌의 선: 어두운 본체 + 밝은 하이라이트 + 그림자선 */
export function tube(ctx: Ctx, path: () => void, width: number, tone = '#cfd6dc'): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = shade(tone, -0.55);
  ctx.lineWidth = width;
  path();
  ctx.stroke();
  ctx.strokeStyle = shade(tone, 0.05);
  ctx.lineWidth = width * 0.72;
  ctx.translate(-width * 0.06, -width * 0.08);
  path();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = width * 0.22;
  ctx.translate(-width * 0.14, -width * 0.14);
  path();
  ctx.stroke();
  ctx.restore();
}

/** 수전 — goose(주방 구스넥) · lever(세면대 원홀) · wall(욕조 벽부착) */
export function faucet(ctx: Ctx, x: number, y: number, s: number, style: 'goose' | 'lever' | 'wall' = 'goose'): void {
  if (style === 'goose') {
    // 받침
    softShadow(ctx, s * 0.12, s * 0.03, s * 0.05, 0.4, () => {
      ctx.fillStyle = chrome(ctx, x - s * 0.14, 0, x + s * 0.14, 0);
      rr(ctx, x - s * 0.14, y - s * 0.1, s * 0.28, s * 0.12, s * 0.04);
      ctx.fill();
    });
    // 몸통(아치)
    tube(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.06);
        ctx.lineTo(x, y - s * 0.62);
        ctx.bezierCurveTo(x, y - s * 1.05, x + s * 0.55, y - s * 1.05, x + s * 0.55, y - s * 0.62);
        ctx.lineTo(x + s * 0.55, y - s * 0.5);
      },
      s * 0.12,
    );
    // 토수구
    ctx.fillStyle = '#2b3136';
    ellipsePath(ctx, x + s * 0.55, y - s * 0.49, s * 0.06, s * 0.025);
    ctx.fill();
    // 레버
    tube(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.02, y - s * 0.45);
        ctx.lineTo(x - s * 0.3, y - s * 0.58);
      },
      s * 0.07,
    );
  } else if (style === 'lever') {
    softShadow(ctx, s * 0.15, s * 0.04, s * 0.06, 0.35, () => {
      ctx.fillStyle = chrome(ctx, x - s * 0.2, 0, x + s * 0.2, 0);
      rr(ctx, x - s * 0.2, y - s * 0.55, s * 0.4, s * 0.62, s * 0.12);
      ctx.fill();
    });
    // 토수구(앞으로 튀어나옴)
    ctx.fillStyle = chrome(ctx, 0, y - s * 0.1, 0, y + s * 0.12);
    rr(ctx, x - s * 0.09, y - s * 0.12, s * 0.18, s * 0.34, s * 0.07);
    ctx.fill();
    ctx.fillStyle = '#2b3136';
    ellipsePath(ctx, x, y + s * 0.18, s * 0.055, s * 0.025);
    ctx.fill();
    // 손잡이
    tube(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.5);
        ctx.lineTo(x + s * 0.28, y - s * 0.72);
      },
      s * 0.08,
    );
  } else {
    // 벽부착: 토수구 + 십자 손잡이 두 개
    tube(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + s * 0.45);
        ctx.lineTo(x + s * 0.06, y + s * 0.5);
      },
      s * 0.14,
    );
    for (const dx of [-0.45, 0.45]) {
      const cx = x + s * dx;
      const cy = y + s * 0.1;
      softShadow(ctx, s * 0.1, s * 0.03, s * 0.04, 0.35, () => {
        ctx.fillStyle = chrome(ctx, cx - s * 0.12, 0, cx + s * 0.12, 0);
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = '#eef2f4';
      ctx.lineWidth = s * 0.045;
      ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * s * 0.17, cy + Math.sin(a) * s * 0.17);
        ctx.stroke();
      }
      ctx.fillStyle = dx < 0 ? '#2d7fd6' : '#d64b3a';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 배수구: 크롬 링 + 어두운 구멍 + 거름망 */
export function drain(ctx: Ctx, cx: number, cy: number, r: number, holes = true): void {
  const ring = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  ring.addColorStop(0, '#f4f7f9');
  ring.addColorStop(0.6, '#aeb8c0');
  ring.addColorStop(1, '#5f6a72');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#33393e';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  if (holes) {
    ctx.fillStyle = '#121517';
    for (let ringI = 1; ringI <= 2; ringI++) {
      const rr0 = r * 0.25 * ringI;
      const n = 6 * ringI;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr0, cy + Math.sin(a) * rr0, r * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#8b949b';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.7);
    inner.addColorStop(0, '#0d1012');
    inner.addColorStop(1, '#3a4146');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 펌프형 세제·비누 병 */
export function soapBottle(ctx: Ctx, x: number, y: number, w: number, h: number, color = '#5aa6e0', label = true): void {
  softShadow(ctx, w * 0.35, w * 0.12, w * 0.18, 0.35, () => {
    ctx.fillStyle = withAlpha(color, 0.9);
    rr(ctx, x, y + h * 0.3, w, h * 0.7, w * 0.22);
    ctx.fill();
  });
  // 액체 선·반사
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  rr(ctx, x + w * 0.12, y + h * 0.36, w * 0.14, h * 0.55, w * 0.06);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  rr(ctx, x + w * 0.78, y + h * 0.36, w * 0.12, h * 0.58, w * 0.05);
  ctx.fill();
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    rr(ctx, x + w * 0.16, y + h * 0.52, w * 0.68, h * 0.26, w * 0.05);
    ctx.fill();
    ctx.fillStyle = withAlpha(color, 0.9);
    ctx.fillRect(x + w * 0.26, y + h * 0.6, w * 0.48, h * 0.035);
    ctx.fillStyle = 'rgba(80,90,100,0.6)';
    ctx.fillRect(x + w * 0.26, y + h * 0.66, w * 0.34, h * 0.025);
  }
  // 목 + 펌프
  ctx.fillStyle = chrome(ctx, x + w * 0.35, 0, x + w * 0.65, 0, '#e5e9ec');
  rr(ctx, x + w * 0.36, y + h * 0.2, w * 0.28, h * 0.14, w * 0.04);
  ctx.fill();
  ctx.fillStyle = '#2f3438';
  rr(ctx, x + w * 0.42, y + h * 0.04, w * 0.16, h * 0.2, w * 0.05);
  ctx.fill();
  rr(ctx, x + w * 0.42, y + h * 0.04, w * 0.42, h * 0.07, w * 0.03);
  ctx.fill();
}

/** 샤워 헤드(벽 위쪽) */
export function showerHead(ctx: Ctx, x: number, y: number, s: number): void {
  tube(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.5, y + s * 0.25);
    },
    s * 0.11,
  );
  const cx = x + s * 0.62;
  const cy = y + s * 0.5;
  softShadow(ctx, s * 0.12, s * 0.04, s * 0.06, 0.35, () => {
    ctx.fillStyle = chrome(ctx, cx - s * 0.3, 0, cx + s * 0.3, 0);
    ellipsePath(ctx, cx, cy, s * 0.3, s * 0.2, 0.35);
    ctx.fill();
  });
  ctx.fillStyle = '#5e676e';
  ellipsePath(ctx, cx + s * 0.02, cy + s * 0.04, s * 0.22, s * 0.14, 0.35);
  ctx.fill();
  ctx.fillStyle = '#20252a';
  for (let i = -2; i <= 2; i++) {
    for (let j = -1; j <= 1; j++) {
      ctx.beginPath();
      ctx.arc(cx + s * 0.02 + i * s * 0.07 - j * s * 0.03, cy + s * 0.04 + j * s * 0.06 + i * s * 0.02, s * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 가스레인지 손잡이 */
export function knob(ctx: Ctx, cx: number, cy: number, r: number, angle = -Math.PI / 2): void {
  softShadow(ctx, r * 0.5, r * 0.12, r * 0.2, 0.4, () => {
    ctx.fillStyle = chrome(ctx, cx - r, 0, cx + r, 0, '#d2d8dd');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 0.85);
  g.addColorStop(0, '#4a5058');
  g.addColorStop(1, '#15181b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e9edf0';
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle) * r * 0.25, cy + Math.sin(angle) * r * 0.25);
  ctx.lineTo(cx + Math.cos(angle) * r * 0.7, cy + Math.sin(angle) * r * 0.7);
  ctx.stroke();
}

/** 가스 버너: 받침 팬 + 버너 캡 + 주철 삼발이 */
export function burner(ctx: Ctx, cx: number, cy: number, r: number): void {
  // 받침(움푹)
  const pan = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.05);
  pan.addColorStop(0, '#9aa3ab');
  pan.addColorStop(0.8, '#b8c0c6');
  pan.addColorStop(1, '#77808a');
  ctx.fillStyle = pan;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  // 버너 몸체
  ctx.fillStyle = '#4c535a';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7f8890';
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36, r * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  const cap = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.1, 0, cx, cy, r * 0.3);
  cap.addColorStop(0, '#3b4249');
  cap.addColorStop(1, '#0f1215');
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // 삼발이(주철): 4 방향 팔 + 바깥 링
  ctx.save();
  ctx.lineCap = 'round';
  for (const [col, wd, off] of [
    ['#101315', 0.16, 0],
    ['#3a4046', 0.09, -0.02],
  ] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = r * wd;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.5 + off * r, cy + Math.sin(a) * r * 0.5 + off * r);
      ctx.lineTo(cx + Math.cos(a) * r * 1.12 + off * r, cy + Math.sin(a) * r * 1.12 + off * r);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx + off * r, cy + off * r, r * 1.12, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** 긴 바 손잡이(냉장고·오븐): 양끝 마운트 + 크롬 바 */
export function barHandle(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const vertical = h > w;
  const t = vertical ? w : h;
  softShadow(ctx, t * 0.9, t * 0.35, t * 0.5, 0.4, () => {
    ctx.fillStyle = vertical ? chrome(ctx, x, 0, x + w, 0) : chrome(ctx, 0, y, 0, y + h);
    rr(ctx, x, y, w, h, t / 2);
    ctx.fill();
  });
  ctx.fillStyle = '#9ea7ae';
  if (vertical) {
    rr(ctx, x + w * 0.2, y + t * 0.6, w * 0.6, t * 1.1, w * 0.2);
    ctx.fill();
    rr(ctx, x + w * 0.2, y + h - t * 1.7, w * 0.6, t * 1.1, w * 0.2);
    ctx.fill();
  } else {
    rr(ctx, x + t * 0.6, y + h * 0.2, t * 1.1, h * 0.6, h * 0.2);
    ctx.fill();
    rr(ctx, x + w - t * 1.7, y + h * 0.2, t * 1.1, h * 0.6, h * 0.2);
    ctx.fill();
  }
}

/** 책등 한 줄 */
export function bookRow(ctx: Ctx, x: number, baseY: number, maxW: number, maxH: number, rnd: Rnd): number {
  const cols = ['#b23a3a', '#2d6fb0', '#2f8f5b', '#d08a2a', '#6a4aa0', '#1f8c8c', '#e2d8c4', '#3b3f46', '#8c5a3c', '#c7c2b8'];
  let cx = x;
  while (cx < x + maxW - 4) {
    const bw = maxH * (0.1 + rnd() * 0.13);
    if (cx + bw > x + maxW) break;
    const bh = maxH * (0.62 + rnd() * 0.36);
    const col = cols[Math.floor(rnd() * cols.length)];
    const lean = rnd() < 0.12 ? (rnd() - 0.5) * 0.12 : 0;
    ctx.save();
    ctx.translate(cx + bw / 2, baseY);
    ctx.rotate(lean);
    softShadow(ctx, bw * 0.4, bw * 0.15, 0, 0.35, () => {
      const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      g.addColorStop(0, shade(col, -0.25));
      g.addColorStop(0.35, shade(col, 0.12));
      g.addColorStop(1, shade(col, -0.2));
      ctx.fillStyle = g;
      ctx.fillRect(-bw / 2, -bh, bw, bh);
    });
    // 제목 띠·장식선
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.3)';
    ctx.fillRect(-bw * 0.3, -bh * 0.85, bw * 0.6, bh * 0.025);
    ctx.fillRect(-bw * 0.3, -bh * 0.2, bw * 0.6, bh * 0.025);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-bw * 0.1, -bh * 0.75, bw * 0.2, bh * 0.45);
    ctx.restore();
    cx += bw + Math.max(1, bw * 0.08);
  }
  return cx;
}

/** 화분 식물 */
export function pottedPlant(ctx: Ctx, cx: number, baseY: number, s: number, rnd: Rnd): void {
  // 화분
  softShadow(ctx, s * 0.2, s * 0.05, s * 0.06, 0.35, () => {
    const g = ctx.createLinearGradient(cx - s * 0.3, 0, cx + s * 0.3, 0);
    g.addColorStop(0, '#9a4e2e');
    g.addColorStop(0.4, '#d0774a');
    g.addColorStop(1, '#8f4426');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, baseY - s * 0.5);
    ctx.lineTo(cx + s * 0.3, baseY - s * 0.5);
    ctx.lineTo(cx + s * 0.24, baseY);
    ctx.lineTo(cx - s * 0.24, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8603b';
    rr(ctx, cx - s * 0.33, baseY - s * 0.56, s * 0.66, s * 0.1, s * 0.02);
    ctx.fill();
  });
  // 잎
  const greens = ['#3f8a3f', '#5aa64c', '#2f7a35', '#73b85e'];
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
    const len = s * (0.35 + rnd() * 0.4);
    const ex = cx + Math.cos(a) * len;
    const ey = baseY - s * 0.55 + Math.sin(a) * len;
    ctx.fillStyle = greens[k % greens.length];
    ctx.save();
    ctx.translate((cx + ex) / 2, (baseY - s * 0.55 + ey) / 2);
    ctx.rotate(a);
    ellipsePath(ctx, 0, 0, len / 2, s * (0.07 + rnd() * 0.06));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(0.8, s * 0.01);
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(len / 2, 0);
    ctx.stroke();
    ctx.restore();
  }
}

/** 베개 */
export function pillow(ctx: Ctx, x: number, y: number, w: number, h: number, color = '#fbfaf6'): void {
  softShadow(ctx, h * 0.2, h * 0.04, h * 0.08, 0.3, () => {
    ctx.fillStyle = color;
    rr(ctx, x, y, w, h, h * 0.32);
    ctx.fill();
  });
  ctx.save();
  rr(ctx, x, y, w, h, h * 0.32);
  ctx.clip();
  // 볼록한 가운데 + 가장자리 음영
  const g = ctx.createRadialGradient(x + w * 0.42, y + h * 0.4, h * 0.1, x + w * 0.5, y + h * 0.5, w * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  texture(ctx, x, y, w, h, 'weave', 0.3, 1, 'overlay', 30);
  // 솔기(안쪽 테두리) + 주름
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = Math.max(1, h * 0.012);
  rr(ctx, x + w * 0.05, y + h * 0.09, w * 0.9, h * 0.82, h * 0.26);
  ctx.stroke();
  for (const [sx, sy, ex, ey] of [
    [0.08, 0.3, 0.3, 0.42],
    [0.92, 0.7, 0.7, 0.6],
    [0.2, 0.92, 0.35, 0.72],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x + w * sx, y + h * sy);
    ctx.quadraticCurveTo(x + w * ((sx + ex) / 2), y + h * ((sy + ey) / 2 + 0.05), x + w * ex, y + h * ey);
    ctx.stroke();
  }
  ctx.restore();
}

/** 소파 쿠션: 패브릭 + 파이핑 + 가장자리 주름 + 그림자 */
export function cushion(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, tufted = false): void {
  const r = Math.min(w, h) * 0.12;
  softShadow(ctx, r * 1.2, r * 0.3, r * 0.5, 0.35, () => {
    ctx.fillStyle = color;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
  });
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  fabric(ctx, x, y, w, h, color, 'weave');
  // 볼록 음영
  const g = ctx.createRadialGradient(x + w * 0.4, y + h * 0.38, Math.min(w, h) * 0.1, x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.65);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // 파이핑
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1.2, r * 0.18);
  rr(ctx, x + r * 0.5, y + r * 0.5, w - r, h - r, r * 0.7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, r * 0.1);
  rr(ctx, x + r * 0.5 + ctx.lineWidth * 1.5, y + r * 0.5 + ctx.lineWidth * 1.5, w - r - ctx.lineWidth * 3, h - r - ctx.lineWidth * 3, r * 0.6);
  ctx.stroke();
  // 주름
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  for (let k = 0; k < 3; k++) {
    const sx = x + w * (0.15 + k * 0.3);
    ctx.beginPath();
    ctx.moveTo(sx, y + h * 0.88);
    ctx.quadraticCurveTo(sx + w * 0.06, y + h * 0.7, sx + w * 0.02, y + h * 0.55);
    ctx.stroke();
  }
  if (tufted) {
    for (const [px, py] of [
      [0.33, 0.4],
      [0.67, 0.4],
    ]) {
      const bx = x + w * px;
      const by = y + h * py;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, r * 1.4);
      bg.addColorStop(0, 'rgba(0,0,0,0.3)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(color, -0.3);
      ctx.beginPath();
      ctx.arc(bx, by, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** 옷걸이 봉 + 옷걸이 */
export function hangerRail(ctx: Ctx, x: number, y: number, w: number, s: number, n: number): void {
  tube(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
    },
    s * 0.08,
  );
  ctx.strokeStyle = '#c8ccd0';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < n; k++) {
    const hx = x + (w * (k + 0.5)) / n;
    ctx.beginPath();
    ctx.arc(hx, y + s * 0.12, s * 0.1, Math.PI * 1.1, Math.PI * 1.95);
    ctx.moveTo(hx, y + s * 0.22);
    ctx.lineTo(hx, y + s * 0.3);
    ctx.lineTo(hx - s * 0.38, y + s * 0.55);
    ctx.lineTo(hx + s * 0.38, y + s * 0.55);
    ctx.closePath();
    ctx.stroke();
  }
}

/** 와이퍼: 암 + 고무 블레이드 */
export function wiper(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, width: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = width * 1.3;
  ctx.beginPath();
  ctx.moveTo(x0 + width * 0.3, y0 + width * 0.4);
  ctx.lineTo(x1 + width * 0.3, y1 + width * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#15191c';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = width * 0.22;
  ctx.beginPath();
  ctx.moveTo(x0 - width * 0.2, y0 - width * 0.2);
  ctx.lineTo(x1 - width * 0.2, y1 - width * 0.2);
  ctx.stroke();
  ctx.restore();
}

/** 엠블럼(가상): 크롬 링 + 가로 바 */
export function emblem(ctx: Ctx, cx: number, cy: number, r: number): void {
  softShadow(ctx, r * 0.4, r * 0.1, r * 0.15, 0.4, () => {
    ctx.fillStyle = chrome(ctx, 0, cy - r, 0, cy + r);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#1d2226';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = chrome(ctx, 0, cy - r * 0.2, 0, cy + r * 0.2);
  rr(ctx, cx - r * 0.55, cy - r * 0.14, r * 1.1, r * 0.28, r * 0.1);
  ctx.fill();
}

/** 휠 너트(육각) */
export function lugNuts(ctx: Ctx, cx: number, cy: number, radius: number, n: number, size: number): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2;
    const nx = cx + Math.cos(a) * radius;
    const ny = cy + Math.sin(a) * radius;
    const g = ctx.createRadialGradient(nx - size * 0.3, ny - size * 0.3, size * 0.1, nx, ny, size);
    g.addColorStop(0, '#f2f5f7');
    g.addColorStop(0.6, '#9aa3ab');
    g.addColorStop(1, '#4f575e');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const b = (i / 6) * Math.PI * 2;
      const px = nx + Math.cos(b) * size;
      const py = ny + Math.sin(b) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2f33';
    ctx.beginPath();
    ctx.arc(nx, ny, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 송풍구: 움푹 들어간 틀 + 루버 */
export function vent(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#0c0e10';
  rr(ctx, x, y, w, h, Math.min(w, h) * 0.12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(1, h * 0.02);
  rr(ctx, x, y, w, h, Math.min(w, h) * 0.12);
  ctx.stroke();
  const n = 5;
  for (let k = 0; k < n; k++) {
    const ly = y + (h * (k + 0.5)) / n;
    const g = ctx.createLinearGradient(0, ly - h * 0.06, 0, ly + h * 0.06);
    g.addColorStop(0, '#5a6168');
    g.addColorStop(0.5, '#2b3034');
    g.addColorStop(1, '#0f1214');
    ctx.fillStyle = g;
    rr(ctx, x + w * 0.08, ly - h * 0.055, w * 0.84, h * 0.11, h * 0.03);
    ctx.fill();
  }
  // 조절 휠
  ctx.fillStyle = '#3a4046';
  rr(ctx, x + w * 0.42, y + h * 0.84, w * 0.16, h * 0.1, h * 0.03);
  ctx.fill();
}

/** 계기(속도계 등) */
export function gauge(ctx: Ctx, cx: number, cy: number, r: number, needle: number, accent = '#ff6a3d'): void {
  const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  g.addColorStop(0, '#15181c');
  g.addColorStop(1, '#05070a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3c434a';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();
  // 눈금
  const a0 = Math.PI * 0.75;
  const a1 = Math.PI * 2.25;
  for (let k = 0; k <= 24; k++) {
    const a = a0 + ((a1 - a0) * k) / 24;
    const major = k % 4 === 0;
    ctx.strokeStyle = major ? '#e9eef2' : '#8d969e';
    ctx.lineWidth = Math.max(1, r * (major ? 0.04 : 0.02));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * (major ? 0.72 : 0.8), cy + Math.sin(a) * r * (major ? 0.72 : 0.8));
    ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
    ctx.stroke();
  }
  ctx.fillStyle = '#e9eef2';
  ctx.font = `${Math.max(6, r * 0.16)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 0; k <= 6; k++) {
    const a = a0 + ((a1 - a0) * k) / 6;
    ctx.fillText(String(k * 20), cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58);
  }
  // 바늘
  const na = a0 + (a1 - a0) * needle;
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(na) * r * 0.12, cy - Math.sin(na) * r * 0.12);
  ctx.lineTo(cx + Math.cos(na) * r * 0.8, cy + Math.sin(na) * r * 0.8);
  ctx.stroke();
  ctx.fillStyle = '#2b3136';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // 유리 반사
  const s = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.3, cy + r * 0.3);
  s.addColorStop(0, 'rgba(255,255,255,0.18)');
  s.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** 인포테인먼트 화면 */
export function infoScreen(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#0a0c0f';
  rr(ctx, x, y, w, h, Math.min(w, h) * 0.08);
  ctx.fill();
  ctx.save();
  rr(ctx, x + w * 0.04, y + h * 0.07, w * 0.92, h * 0.86, Math.min(w, h) * 0.05);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#13233a');
  g.addColorStop(1, '#0b1522');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // 지도 느낌의 선들
  ctx.strokeStyle = 'rgba(120,170,220,0.35)';
  ctx.lineWidth = Math.max(1, h * 0.02);
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.moveTo(x + w * (0.1 + k * 0.2), y + h * 0.1);
    ctx.lineTo(x + w * (0.05 + k * 0.22), y + h * 0.9);
    ctx.stroke();
  }
  ctx.strokeStyle = '#4fa3ff';
  ctx.lineWidth = Math.max(2, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.85);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.5, x + w * 0.8, y + h * 0.2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let k = 0; k < 4; k++) {
    rr(ctx, x + w * 0.08 + k * w * 0.22, y + h * 0.74, w * 0.16, h * 0.14, h * 0.03);
    ctx.fill();
  }
  ctx.restore();
  const s = ctx.createLinearGradient(x, y, x + w * 0.5, y + h);
  s.addColorStop(0, 'rgba(255,255,255,0.14)');
  s.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  rr(ctx, x, y, w, h, Math.min(w, h) * 0.08);
  ctx.fill();
}

/** 스티치(바느질선) */
export function stitch(ctx: Ctx, draw: () => void, size: number, color = 'rgba(225,228,232,0.75)'): void {
  ctx.save();
  ctx.setLineDash([size * 1.4, size * 0.9]);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = size * 1.1;
  draw();
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.55;
  draw();
  ctx.stroke();
  ctx.restore();
}

/** 노트북(위에서 본 모습) */
export function laptop(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  // 화면(뒤로 살짝 눕힘 → 위쪽 짧은 사다리꼴)
  softShadow(ctx, w * 0.06, w * 0.02, w * 0.03, 0.4, () => {
    ctx.fillStyle = '#1b1f24';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.05, y);
    ctx.lineTo(x + w * 0.95, y);
    ctx.lineTo(x + w, y + h * 0.42);
    ctx.lineTo(x, y + h * 0.42);
    ctx.closePath();
    ctx.fill();
  });
  const sg = ctx.createLinearGradient(x, y, x + w, y + h * 0.4);
  sg.addColorStop(0, '#2d5c9c');
  sg.addColorStop(1, '#6fb1e8');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.08, y + h * 0.03);
  ctx.lineTo(x + w * 0.92, y + h * 0.03);
  ctx.lineTo(x + w * 0.96, y + h * 0.39);
  ctx.lineTo(x + w * 0.04, y + h * 0.39);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < 4; k++) {
    rr(ctx, x + w * 0.12, y + h * (0.08 + k * 0.07), w * (0.3 + (k % 2) * 0.3), h * 0.035, h * 0.01);
    ctx.fill();
  }
  // 본체
  softShadow(ctx, w * 0.08, w * 0.03, w * 0.05, 0.45, () => {
    ctx.fillStyle = chrome(ctx, 0, y + h * 0.42, 0, y + h, '#d9dee3');
    rr(ctx, x, y + h * 0.42, w, h * 0.58, w * 0.03);
    ctx.fill();
  });
  // 키보드
  const kx = x + w * 0.08;
  const ky = y + h * 0.48;
  const kw = w * 0.84;
  const kh = h * 0.3;
  const cols = 14;
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wide = r === rows - 1 && c > 3 && c < 10;
      if (r === rows - 1 && c > 4 && c < 10) continue;
      const keyW = (kw / cols) * (wide ? 5.6 : 0.9);
      ctx.fillStyle = '#2a2f35';
      rr(ctx, kx + (kw * c) / cols, ky + (kh * r) / rows, keyW, (kh / rows) * 0.86, w * 0.006);
      ctx.fill();
    }
  }
  // 터치패드
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  rr(ctx, x + w * 0.35, y + h * 0.82, w * 0.3, h * 0.14, w * 0.015);
  ctx.fill();
}

/** 머그(위에서): 커피 + 손잡이 */
export function mug(ctx: Ctx, cx: number, cy: number, r: number, color = '#f3efe8'): void {
  softShadow(ctx, r * 0.6, r * 0.15, r * 0.25, 0.4, () => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // 손잡이
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.arc(cx + r * 1.15, cy, r * 0.42, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
  });
  const cg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r * 0.82);
  cg.addColorStop(0, '#7a4a28');
  cg.addColorStop(1, '#3a2010');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipsePath(ctx, cx - r * 0.3, cy - r * 0.35, r * 0.22, r * 0.1, -0.6);
  ctx.fill();
}

/** 노트 + 펜 */
export function notebook(ctx: Ctx, x: number, y: number, w: number, h: number, rot = -0.08): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  softShadow(ctx, w * 0.05, w * 0.015, w * 0.02, 0.35, () => {
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(0, 0, w, h);
  });
  ctx.strokeStyle = 'rgba(70,90,140,0.35)';
  ctx.lineWidth = Math.max(0.8, h * 0.008);
  for (let k = 1; k < 9; k++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.06, (h * k) / 9);
    ctx.lineTo(w * 0.94, (h * k) / 9);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,60,60,0.5)';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, 0);
  ctx.lineTo(w * 0.12, h);
  ctx.stroke();
  // 손글씨 느낌의 짧은 선
  ctx.strokeStyle = 'rgba(40,50,70,0.55)';
  ctx.lineWidth = Math.max(1, h * 0.012);
  for (let k = 1; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.16, (h * k) / 9 - h * 0.03);
    ctx.lineTo(w * (0.3 + ((k * 7) % 5) * 0.12), (h * k) / 9 - h * 0.03);
    ctx.stroke();
  }
  // 펜
  softShadow(ctx, w * 0.04, w * 0.01, w * 0.02, 0.4, () => {
    ctx.fillStyle = '#1c2a44';
    rr(ctx, w * 0.62, h * 0.18, w * 0.05, h * 0.7, w * 0.025);
    ctx.fill();
  });
  ctx.fillStyle = '#c9ced6';
  rr(ctx, w * 0.62, h * 0.18, w * 0.05, h * 0.1, w * 0.02);
  ctx.fill();
  ctx.restore();
}

/** 마우스(위에서) */
export function mouse(ctx: Ctx, cx: number, cy: number, s: number): void {
  softShadow(ctx, s * 0.3, s * 0.08, s * 0.12, 0.4, () => {
    const g = ctx.createLinearGradient(cx - s * 0.4, cy, cx + s * 0.4, cy);
    g.addColorStop(0, '#d7dbe0');
    g.addColorStop(0.5, '#f4f6f8');
    g.addColorStop(1, '#c3c9cf');
    ctx.fillStyle = g;
    ellipsePath(ctx, cx, cy, s * 0.4, s * 0.62);
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.6);
  ctx.lineTo(cx, cy - s * 0.1);
  ctx.stroke();
  ctx.fillStyle = '#5b636b';
  rr(ctx, cx - s * 0.04, cy - s * 0.42, s * 0.08, s * 0.16, s * 0.03);
  ctx.fill();
}

/** 구름(부드러운 가장자리) */
export function cloud(ctx: Ctx, x: number, y: number, s: number, alpha = 0.9): void {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.shadowColor = `rgba(255,255,255,${alpha})`;
  ctx.shadowBlur = s * 0.5;
  for (const [dx, dy, r] of [
    [0, 0, 0.5],
    [0.45, -0.15, 0.62],
    [0.95, 0, 0.48],
    [1.3, 0.1, 0.35],
    [0.5, 0.2, 0.5],
  ]) {
    ctx.beginPath();
    ctx.arc(x + s * dx, y + s * dy, s * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 먼 나무·수풀 (초점 밖) */
export function treeLine(ctx: Ctx, x: number, y: number, w: number, h: number, rnd: Rnd): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const greens = ['#4f8a3e', '#3e7331', '#6aa052', '#2f5f28'];
  ctx.shadowColor = 'rgba(40,80,30,0.8)';
  ctx.shadowBlur = h * 0.25;
  for (let k = 0; k < 14; k++) {
    ctx.fillStyle = greens[k % greens.length];
    const cx = x + rnd() * w;
    const cy = y + h * (0.55 + rnd() * 0.5);
    ellipsePath(ctx, cx, cy, w * (0.08 + rnd() * 0.12), h * (0.35 + rnd() * 0.4));
    ctx.fill();
  }
  ctx.restore();
}

/** 벽 콘센트 플레이트 */
export function outlet(ctx: Ctx, x: number, y: number, s: number): void {
  softShadow(ctx, s * 0.15, s * 0.03, s * 0.05, 0.3, () => {
    ctx.fillStyle = '#f4f3ee';
    rr(ctx, x, y, s, s * 1.5, s * 0.08);
    ctx.fill();
  });
  ctx.fillStyle = '#2b2f33';
  for (const py of [0.3, 0.72]) {
    ctx.fillRect(x + s * 0.34, y + s * py, s * 0.08, s * 0.22);
    ctx.fillRect(x + s * 0.58, y + s * py, s * 0.08, s * 0.22);
  }
  ctx.fillStyle = '#b9bcc0';
  ctx.beginPath();
  ctx.arc(x + s * 0.5, y + s * 0.75, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

/** 수건(걸린) */
export function towel(ctx: Ctx, x: number, y: number, w: number, h: number, color = '#e8dfd0'): void {
  softShadow(ctx, w * 0.1, w * 0.03, w * 0.05, 0.35, () => {
    ctx.fillStyle = color;
    rr(ctx, x, y, w, h, w * 0.06);
    ctx.fill();
  });
  ctx.save();
  rr(ctx, x, y, w, h, w * 0.06);
  ctx.clip();
  texture(ctx, x, y, w, h, 'pile', 0.5, 1.2, 'overlay', 44);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = Math.max(1, w * 0.012);
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * k) / 4, y);
    ctx.quadraticCurveTo(x + (w * k) / 4 + w * 0.03, y + h / 2, x + (w * k) / 4, y + h);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x, y + h * 0.75, w, h * 0.03);
  ctx.fillRect(x, y + h * 0.82, w, h * 0.03);
  ctx.restore();
}
