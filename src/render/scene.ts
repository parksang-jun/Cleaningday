// 장면(깨끗한 표면) 절차적 그리기 — 이미지 자산 없이 캔버스로 생성
import type { LevelDef, SceneId } from '../game/levels';
import { mulberry32 } from '../game/rng';

type Ctx = CanvasRenderingContext2D;

/** 스테이지 전체 그리기 — 구역이 있으면 구역마다 해당 장면을 그리고 경계선을 긋는다 */
export function paintLevel(ctx: Ctx, level: LevelDef, w: number, h: number): void {
  if (!level.zones) {
    paintScene(ctx, level.scene, w, h);
    return;
  }
  for (const z of level.zones) {
    const x = Math.floor(z.x0 * w);
    const y = Math.floor(z.y0 * h);
    const zw = Math.ceil((z.x1 - z.x0) * w);
    const zh = Math.ceil((z.y1 - z.y0) * h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, zw, zh);
    ctx.clip();
    ctx.translate(x, y);
    paintScene(ctx, z.scene, zw, zh);
    ctx.restore();
    // 구역 경계
    ctx.save();
    ctx.strokeStyle = 'rgba(20,30,40,0.35)';
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.strokeRect(x + 1, y + 1, zw - 2, zh - 2);
    ctx.restore();
  }
}

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
    case 'tub':
      tubOnly(ctx, w, h);
      break;
    case 'kitchenMix':
    case 'bathMix':
    case 'livingMix':
    case 'roomMix':
    case 'gardenMix':
    case 'deckMix':
    case 'yardMix':
    case 'carExtMix':
    case 'carFullMix':
    case 'carIntMix':
      // 구역 장면은 paintLevel 이 구역별로 그림. 단독 호출 시 대표 장면
      tiles(ctx, w, h, 6, '#e9eef0', '#9fb6bd', 0.04, r.next);
      break;
    case 'sofa':
      fabric(ctx, w, h, r.next);
      break;
    case 'bed':
      bed(ctx, w, h, r.next);
      break;
    case 'desk':
      desk(ctx, w, h, r.next);
      break;
    case 'sink':
      sink(ctx, w, h);
      break;
    case 'basin':
      basin(ctx, w, h);
      break;
    case 'mirror':
      mirror(ctx, w, h, r.next);
      break;
    case 'patio':
      pavers(ctx, w, h, r.next);
      break;
    case 'deck':
      deck(ctx, w, h, r.next);
      break;
    case 'brickWall':
      bricks(ctx, w, h, r.next);
      break;
    case 'gardenChair':
      gardenChair(ctx, w, h);
      break;
    case 'fence':
      fence(ctx, w, h, r.next);
      break;
    case 'car':
      carPaint(ctx, w, h);
      break;
    case 'windshield':
      windshield(ctx, w, h, r.next);
      break;
    case 'wheel':
      wheel(ctx, w, h);
      break;
    case 'seat':
      seat(ctx, w, h);
      break;
    case 'dashboard':
      dashboard(ctx, w, h);
      break;
    case 'floorMat':
      floorMat(ctx, w, h);
      break;
  }
  ctx.restore();
}

/** 침대 — 이불·베개 */
function bed(ctx: Ctx, w: number, h: number, rnd: () => number) {
  ctx.fillStyle = '#e8e2d6';
  ctx.fillRect(0, 0, w, h);
  // 이불 줄무늬
  for (let y = h * 0.3; y < h; y += h * 0.08) {
    ctx.fillStyle = `rgba(120,140,170,${0.12 + rnd() * 0.06})`;
    ctx.fillRect(0, y, w, h * 0.04);
  }
  // 주름
  ctx.strokeStyle = 'rgba(80,70,60,0.12)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    const x = rnd() * w;
    ctx.moveTo(x, h * 0.3);
    ctx.quadraticCurveTo(x + (rnd() - 0.5) * 40, h * 0.65, x + (rnd() - 0.5) * 60, h);
    ctx.stroke();
  }
  // 베개 2개
  for (const px of [0.08, 0.54]) {
    ctx.fillStyle = '#fbfaf6';
    ctx.beginPath();
    ctx.roundRect(w * px, h * 0.05, w * 0.38, h * 0.2, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // 이불 접힌 끝
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(0, h * 0.28, w, h * 0.05);
}

/** 책상 — 짙은 원목 상판 + 노트북·머그 자국 */
function desk(ctx: Ctx, w: number, h: number, rnd: () => number) {
  wood(ctx, w, h, rnd, '#8a5a35');
  vignette(ctx, w, h, 0.2);
  // 노트북
  ctx.fillStyle = '#2f3540';
  ctx.beginPath();
  ctx.roundRect(w * 0.22, h * 0.12, w * 0.56, h * 0.3, 8);
  ctx.fill();
  ctx.fillStyle = '#5b86c9';
  ctx.fillRect(w * 0.25, h * 0.14, w * 0.5, h * 0.25);
  // 머그
  ctx.fillStyle = '#f2efe9';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.62, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4a2a';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.62, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // 종이
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.save();
  ctx.translate(w * 0.3, h * 0.72);
  ctx.rotate(-0.08);
  ctx.fillRect(0, 0, w * 0.3, h * 0.2);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  for (let k = 1; k < 5; k++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.03, (h * 0.2 * k) / 5);
    ctx.lineTo(w * 0.27, (h * 0.2 * k) / 5);
    ctx.stroke();
  }
  ctx.restore();
}

/** 싱크대 — 스테인리스 개수대 + 수전 */
function sink(ctx: Ctx, w: number, h: number) {
  steel(ctx, w, h);
  const g = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.95);
  g.addColorStop(0, '#b9c1c8');
  g.addColorStop(1, '#8f99a3');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(w * 0.1, h * 0.25, w * 0.8, h * 0.65, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // 배수구
  ctx.fillStyle = '#5a636c';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.62, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3c444c';
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.62, w * 0.02 * (k + 1), 0, Math.PI * 2);
    ctx.stroke();
  }
  // 수전
  ctx.strokeStyle = '#d6dde3';
  ctx.lineWidth = w * 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.2);
  ctx.quadraticCurveTo(w * 0.5, h * 0.02, w * 0.68, h * 0.08);
  ctx.stroke();
}

/** 세면대 — 흰 도기 */
function basin(ctx: Ctx, w: number, h: number) {
  tiles(ctx, w, h, 5, '#e3eef2', '#b6c8ce', 0.03, () => 0.5);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.1, w * 0.5, h * 0.55, w * 0.55);
  g.addColorStop(0, '#f3f6f7');
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.55, w * 0.44, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,170,180,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(170,190,200,0.35)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.6, w * 0.3, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b9c3ca';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.68, Math.max(6, w * 0.035), 0, Math.PI * 2);
  ctx.fill();
  // 수전
  ctx.fillStyle = '#d6dde3';
  ctx.beginPath();
  ctx.roundRect(w * 0.45, h * 0.12, w * 0.1, h * 0.12, 8);
  ctx.fill();
}

/** 거울 — 반사된 욕실 + 프레임 */
function mirror(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#dfe9ee');
  g.addColorStop(0.5, '#f4f8fa');
  g.addColorStop(1, '#cfdce3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // 반사된 타일
  ctx.globalAlpha = 0.25;
  tiles(ctx, w, h, 6, '#cfe4ea', '#9fb6bd', 0.02, rnd);
  ctx.globalAlpha = 1;
  // 빛 줄기
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(w * 0.15, 0);
  ctx.lineTo(w * 0.3, 0);
  ctx.lineTo(w * 0.05, h);
  ctx.lineTo(-w * 0.1, h);
  ctx.fill();
  // 프레임
  ctx.strokeStyle = '#8f8f8a';
  ctx.lineWidth = w * 0.05;
  ctx.strokeRect(0, 0, w, h);
}

/** 데크 — 긴 널판 + 나사 */
function deck(ctx: Ctx, w: number, h: number, rnd: () => number) {
  ctx.fillStyle = '#7c5a3a';
  ctx.fillRect(0, 0, w, h);
  const plank = h / 9;
  for (let i = 0; i < 9; i++) {
    const y = i * plank;
    const c = 150 + Math.floor(rnd() * 35);
    ctx.fillStyle = `rgb(${c},${Math.floor(c * 0.68)},${Math.floor(c * 0.42)})`;
    ctx.fillRect(0, y + 2, w, plank - 4);
    ctx.strokeStyle = 'rgba(70,40,15,0.25)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 5; g++) {
      ctx.beginPath();
      const gy = y + 3 + rnd() * (plank - 6);
      ctx.moveTo(0, gy);
      for (let x = 0; x <= w; x += w / 10) ctx.lineTo(x, gy + Math.sin(x / (50 + rnd() * 20) + g) * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,40,40,0.5)';
    for (const px of [0.08, 0.92]) {
      ctx.beginPath();
      ctx.arc(w * px, y + plank / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 벽돌 외벽 */
function bricks(ctx: Ctx, w: number, h: number, rnd: () => number) {
  ctx.fillStyle = '#b9b2a4';
  ctx.fillRect(0, 0, w, h);
  const bw = w / 5;
  const bh = bw / 2.2;
  let row = 0;
  for (let y = 0; y < h; y += bh, row++) {
    for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw) {
      const r = 150 + Math.floor(rnd() * 40);
      ctx.fillStyle = `rgb(${r},${Math.floor(r * 0.5)},${Math.floor(r * 0.38)})`;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, bw - 4, bh - 4, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 3 + rnd() * (bw - 8), y + 3 + rnd() * (bh - 8), 3, 2);
    }
  }
}

/** 플라스틱 정원 의자 */
function gardenChair(ctx: Ctx, w: number, h: number) {
  // 잔디 배경
  ctx.fillStyle = '#5f9a4a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(40,90,30,0.35)';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 160; k++) {
    const x = (k * 97) % w;
    const y = (k * 61) % h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y - 7);
    ctx.stroke();
  }
  // 의자 (위에서 본 좌판 + 등받이)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f6f6f2');
  g.addColorStop(1, '#d9dad4');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(w * 0.12, h * 0.08, w * 0.76, h * 0.4, 18);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(w * 0.1, h * 0.5, w * 0.8, h * 0.42, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 3;
  for (let k = 1; k < 6; k++) {
    const y = h * 0.08 + (h * 0.4 * k) / 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, y);
    ctx.lineTo(w * 0.84, y);
    ctx.stroke();
  }
}

/** 도장 울타리 — 흰 페인트 널판 */
function fence(ctx: Ctx, w: number, h: number, rnd: () => number) {
  ctx.fillStyle = '#6f9a52';
  ctx.fillRect(0, 0, w, h);
  const pw = w / 6;
  for (let i = 0; i < 6; i++) {
    const x = i * pw;
    const c = 236 + Math.floor(rnd() * 14);
    ctx.fillStyle = `rgb(${c},${c},${c - 8})`;
    ctx.beginPath();
    ctx.moveTo(x + 3, h);
    ctx.lineTo(x + 3, h * 0.08);
    ctx.lineTo(x + pw / 2, 0);
    ctx.lineTo(x + pw - 3, h * 0.08);
    ctx.lineTo(x + pw - 3, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(0, h * 0.3, w, h * 0.05);
  ctx.fillRect(0, h * 0.72, w, h * 0.05);
}

/** 앞유리 — 하늘 반사 + 와이퍼 */
function windshield(ctx: Ctx, w: number, h: number, rnd: () => number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#5f9fd8');
  sky.addColorStop(0.6, '#bfe0f5');
  sky.addColorStop(1, '#2b3540');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 3; i++) {
    const cx = rnd() * w;
    const cy = rnd() * h * 0.4;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(cx + k * 16, cy + (k % 2) * 5, 14 + rnd() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 와이퍼
  ctx.strokeStyle = '#1d2228';
  ctx.lineWidth = Math.max(4, w * 0.02);
  ctx.lineCap = 'round';
  for (const px of [0.3, 0.72]) {
    ctx.beginPath();
    ctx.moveTo(w * px, h * 0.98);
    ctx.lineTo(w * (px - 0.18), h * 0.55);
    ctx.stroke();
  }
  // 유리 반사띠
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(w * 0.05, 0);
  ctx.lineTo(w * 0.25, 0);
  ctx.lineTo(w * 0.0, h * 0.7);
  ctx.lineTo(-w * 0.2, h * 0.7);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = w * 0.03;
  ctx.strokeRect(0, 0, w, h);
}

/** 휠 — 알로이 스포크 + 타이어 */
function wheel(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#6b6e72';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.47;
  ctx.fillStyle = '#1e2124';
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, R * 0.1, cx, cy, R * 0.75);
  g.addColorStop(0, '#f1f3f5');
  g.addColorStop(1, '#9ea5ad');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2d31';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + Math.PI / 5;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * R * 0.42, cy + Math.sin(a) * R * 0.42, R * 0.14, R * 0.22, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#c9ced4';
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

/** 자동차 시트 — 짙은 패브릭 + 스티치 */
function seat(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#3d4450';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = y % 6 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, y, w, 1.5);
  }
  // 세로 퀼팅
  ctx.strokeStyle = 'rgba(200,205,215,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo((w * k) / 4, h * 0.05);
    ctx.lineTo((w * k) / 4, h * 0.95);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.5);
  ctx.lineTo(w * 0.95, h * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  // 사이드 볼스터
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, w * 0.08, h);
  ctx.fillRect(w * 0.92, 0, w * 0.08, h);
}

/** 대시보드 — 비닐 + 계기판·송풍구 */
function dashboard(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2c2f33');
  g.addColorStop(1, '#1b1d20');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // 비닐 결
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let k = 0; k < 400; k++) ctx.fillRect((k * 37) % w, (k * 53) % h, 2, 2);
  // 계기판
  ctx.fillStyle = '#0f1114';
  ctx.beginPath();
  ctx.roundRect(w * 0.08, h * 0.15, w * 0.42, h * 0.45, 12);
  ctx.fill();
  for (const px of [0.2, 0.38]) {
    ctx.strokeStyle = '#7fd1ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w * px, h * 0.38, w * 0.07, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    ctx.strokeStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.moveTo(w * px, h * 0.38);
    ctx.lineTo(w * px + w * 0.05, h * 0.33);
    ctx.stroke();
  }
  // 송풍구
  for (const px of [0.62, 0.8]) {
    ctx.fillStyle = '#111317';
    ctx.beginPath();
    ctx.roundRect(w * px, h * 0.2, w * 0.14, h * 0.3, 8);
    ctx.fill();
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 2;
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(w * px + 4, h * 0.2 + (h * 0.3 * k) / 5);
      ctx.lineTo(w * (px + 0.14) - 4, h * 0.2 + (h * 0.3 * k) / 5);
      ctx.stroke();
    }
  }
  // 하단 몰딩
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, h * 0.72, w, h * 0.04);
}

/** 바닥 매트 — 고무 홈 + 카펫 */
function floorMat(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = '#2a2c30';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3a3d42';
  ctx.beginPath();
  ctx.roundRect(w * 0.06, h * 0.05, w * 0.88, h * 0.9, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let y = h * 0.12; y < h * 0.9; y += h * 0.06) {
    ctx.beginPath();
    ctx.moveTo(w * 0.12, y);
    ctx.lineTo(w * 0.88, y);
    ctx.stroke();
  }
  for (let x = w * 0.12; x < w * 0.9; x += w * 0.1) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.12);
    ctx.lineTo(x, h * 0.88);
    ctx.stroke();
  }
  // 발꿈치 패드
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(w * 0.3, h * 0.55, w * 0.4, h * 0.28, 10);
  ctx.fill();
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

/** 욕조 표면만 (복합 욕실 장면의 아래 구역) */
function tubOnly(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#e3e9ec');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(180,200,210,0.45)';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.55, w * 0.38, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9d2d8';
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.78, Math.max(6, w * 0.025), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2f2ee';
  ctx.fillRect(0, 0, w, Math.max(6, h * 0.03));
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
