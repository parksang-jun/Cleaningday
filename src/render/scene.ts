// 장면(깨끗한 표면) — 이미지 자산 없이 캔버스로 "사진처럼" 그린다.
//  · 재질(materials.ts): 결·짜임·베벨·유약·헤어라인·클리어코트 + 작은 노이즈 타일
//  · 소품(props.ts): 수전·배수구·버너·손잡이·책·화분·쿠션·와이퍼·휠너트·송풍구·계기 …
//  · 조명: 모든 장면이 왼쪽 위 키 라이트 하나를 받고(keyLight), 구석은 어둡다(vignette·innerShadow)
//  · 오염층이 위에 얹히므로 표면은 밝은 중간톤을 유지한다. 격자 56×72 → 세로가 긴 캔버스(7:9).
//  · 결정적: 같은 장면·크기면 항상 같은 그림 (mulberry32)
import type { LevelDef, SceneId } from '../game/levels';
import { mulberry32 } from '../game/rng';
import * as M from './materials';
import * as P from './props';

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;

/** 스테이지 전체 그리기 — 구역이 있으면 구역마다 해당 장면을 그리고, 경계는 그늘(단차)로 표현 */
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
    const inset = z.x0 > 0 || z.y0 > 0 || z.x1 < 1 || z.y1 < 1;
    // 바닥 위에 놓인 가구(소파·침대·바퀴)는 아래로 그림자를 떨어뜨린다
    if (inset) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.max(8, w * 0.03);
      ctx.shadowOffsetX = w * 0.01;
      ctx.shadowOffsetY = w * 0.018;
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, zw, zh);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, zw, zh);
    ctx.clip();
    ctx.translate(x, y);
    paintScene(ctx, z.scene, zw, zh);
    ctx.restore();
    // 구역 경계: 단차 그늘 + 가는 하이라이트
    ctx.save();
    M.innerShadow(ctx, x, y, zw, zh, Math.max(6, w * 0.018), inset ? 0.18 : 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, zw - 1, zh - 1);
    ctx.restore();
  }
}

export function paintScene(ctx: Ctx, scene: SceneId, w: number, h: number): void {
  const r = mulberry32(scene.length * 131 + 977);
  const rnd = r.next;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  switch (scene) {
    case 'floor':
      floorScene(ctx, w, h, rnd);
      break;
    case 'table':
      tableScene(ctx, w, h, rnd);
      break;
    case 'entrance':
      entranceScene(ctx, w, h, rnd);
      break;
    case 'kitchenTile':
      kitchenTileScene(ctx, w, h, rnd);
      break;
    case 'bathTile':
      bathTileScene(ctx, w, h, rnd);
      break;
    case 'bigClean':
      M.tiles(ctx, w, h, rnd, { cols: 6, face: '#eaeeef', grout: '#aab6bb', variation: 0.04 });
      finish(ctx, w, h, 0.1, 0.14);
      break;
    case 'stove':
      stoveScene(ctx, w, h);
      break;
    case 'window':
      windowScene(ctx, w, h, rnd);
      break;
    case 'bathtub':
      bathtubScene(ctx, w, h, rnd);
      break;
    case 'tub':
      tubScene(ctx, w, h);
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
      M.tiles(ctx, w, h, rnd, { cols: 6, face: '#eaeeef', grout: '#aab6bb', variation: 0.04 });
      finish(ctx, w, h, 0.1, 0.14);
      break;
    case 'sofa':
      sofaScene(ctx, w, h, rnd);
      break;
    case 'bed':
      bedScene(ctx, w, h, rnd);
      break;
    case 'desk':
      deskScene(ctx, w, h, rnd);
      break;
    case 'sink':
      sinkScene(ctx, w, h);
      break;
    case 'basin':
      basinScene(ctx, w, h);
      break;
    case 'mirror':
      mirrorScene(ctx, w, h, rnd);
      break;
    case 'patio':
      patioScene(ctx, w, h, rnd);
      break;
    case 'deck':
      deckScene(ctx, w, h, rnd);
      break;
    case 'brickWall':
      brickScene(ctx, w, h, rnd);
      break;
    case 'gardenChair':
      gardenChairScene(ctx, w, h);
      break;
    case 'fence':
      fenceScene(ctx, w, h, rnd);
      break;
    case 'car':
      carScene(ctx, w, h);
      break;
    case 'windshield':
      windshieldScene(ctx, w, h, rnd);
      break;
    case 'wheel':
      wheelScene(ctx, w, h);
      break;
    case 'seat':
      seatScene(ctx, w, h);
      break;
    case 'dashboard':
      dashboardScene(ctx, w, h);
      break;
    case 'floorMat':
      floorMatScene(ctx, w, h);
      break;
    case 'rug':
      rugScene(ctx, w, h, rnd);
      break;
    case 'shelf':
      shelfScene(ctx, w, h, rnd);
      break;
    case 'closet':
      closetScene(ctx, w, h, rnd);
      break;
    case 'fridge':
      fridgeScene(ctx, w, h);
      break;
    case 'toilet':
      toiletScene(ctx, w, h, rnd);
      break;
    case 'showerglass':
      showerGlassScene(ctx, w, h, rnd);
      break;
    case 'grill':
      grillScene(ctx, w, h);
      break;
    case 'headlight':
      headlightScene(ctx, w, h);
      break;
    case 'trunk':
      trunkScene(ctx, w, h);
      break;
  }
  ctx.restore();
}

/** 마무리 조명: 키 라이트 + 비네트 */
function finish(ctx: Ctx, w: number, h: number, light = 0.12, vig = 0.16): void {
  M.keyLight(ctx, w, h, light);
  M.vignette(ctx, w, h, vig);
}

/** 영역 안에서만 그리기 */
function clipped(ctx: Ctx, x: number, y: number, w: number, h: number, draw: () => void, radius = 0): void {
  ctx.save();
  if (radius > 0) M.rr(ctx, x, y, w, h, radius);
  else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
  ctx.clip();
  ctx.translate(x, y);
  draw();
  ctx.restore();
}

/** 벽 띠 + 걸레받이: 바닥 장면 위쪽의 깊이감 */
function wallBand(ctx: Ctx, w: number, bandH: number, color = '#ebe7df'): void {
  clipped(ctx, 0, 0, w, bandH, () => M.paint(ctx, w, bandH, color, 0.6));
  // 걸레받이
  const bb = bandH * 0.22;
  ctx.fillStyle = '#f6f5f1';
  ctx.fillRect(0, bandH - bb, w, bb);
  const g = ctx.createLinearGradient(0, bandH - bb, 0, bandH);
  g.addColorStop(0, 'rgba(255,255,255,0.5)');
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, bandH - bb, w, bb);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, bandH - bb - 1, w, 1.5);
  // 벽과 바닥이 만나는 그늘
  const s = ctx.createLinearGradient(0, bandH, 0, bandH + bb * 1.6);
  s.addColorStop(0, 'rgba(0,0,0,0.3)');
  s.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, bandH, w, bb * 1.6);
}

function woodFloor(ctx: Ctx, w: number, h: number, rnd: Rnd, base = '#c99b66'): void {
  M.wood(ctx, w, h, rnd, { base, planks: 7, dir: 'v', gloss: 0.4, knots: 0.2, grain: 8 });
}

// ───────────────────────── 아파트: 거실·방 ─────────────────────────

function floorScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const band = h * 0.13;
  clipped(ctx, 0, band, w, h - band, () => woodFloor(ctx, w, h - band, rnd));
  wallBand(ctx, w, band);
  // 콘센트
  P.outlet(ctx, w * 0.78, band * 0.3, band * 0.28);
  finish(ctx, w, h, 0.12, 0.18);
}

function tableScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  M.wood(ctx, w, h, rnd, { base: '#b8804f', planks: 2, dir: 'v', gloss: 0.6, knots: 0, grain: 12, joints: false });
  // 테이블 가장자리(위쪽 모서리 둥근 하이라이트)
  const e = ctx.createLinearGradient(0, 0, 0, h * 0.04);
  e.addColorStop(0, 'rgba(255,240,220,0.45)');
  e.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = e;
  ctx.fillRect(0, 0, w, h * 0.04);
  // 테이블 매트(짜임) + 접시·머그
  M.softShadow(ctx, w * 0.02, w * 0.004, w * 0.008, 0.3, () => {
    ctx.fillStyle = '#cfc2a8';
    M.rr(ctx, w * 0.56, h * 0.06, w * 0.38, h * 0.3, w * 0.01);
    ctx.fill();
  });
  M.texture(ctx, w * 0.56, h * 0.06, w * 0.38, h * 0.3, 'weave', 0.7, 1.4, 'overlay', 60);
  M.softShadow(ctx, w * 0.025, w * 0.006, w * 0.012, 0.35, () => {
    ctx.fillStyle = '#f6f4ef';
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.21, w * 0.11, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.21, w * 0.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#5b8fd6';
  ctx.lineWidth = Math.max(1.5, w * 0.005);
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.21, w * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  P.mug(ctx, w * 0.9, h * 0.42, w * 0.05, '#f3efe8');
  // 컵 자국(물기 링)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.beginPath();
  ctx.arc(w * 0.28, h * 0.3, w * 0.05, 0, Math.PI * 2);
  ctx.stroke();
  finish(ctx, w, h, 0.12, 0.26);
}

function sofaScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const col = '#bfb6a9';
  const arm = w * 0.09;
  // 바닥(틈새로 보이는 그늘) 대신 소파 본체가 꽉 참: 등받이 영역
  M.fabric(ctx, 0, 0, w, h, M.shade(col, -0.15), 'weave');
  // 등쿠션 3개
  const backY = h * 0.05;
  const backH = h * 0.3;
  const inner = w - arm * 2;
  for (let k = 0; k < 3; k++) P.cushion(ctx, arm + (inner * k) / 3 + w * 0.012, backY, inner / 3 - w * 0.024, backH, col);
  // 좌석 쿠션 2개
  const seatY = backY + backH + h * 0.015;
  const seatH = h * 0.46;
  for (let k = 0; k < 2; k++) P.cushion(ctx, arm + (inner * k) / 2 + w * 0.012, seatY, inner / 2 - w * 0.024, seatH, M.shade(col, 0.04));
  // 쿠션 사이 깊은 틈
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(arm + inner / 2 - w * 0.012, seatY, w * 0.024, seatH);
  // 앞 치마
  clipped(ctx, 0, seatY + seatH, w, h - seatY - seatH, () => {
    M.fabric(ctx, 0, 0, w, h, M.shade(col, -0.06), 'weave');
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.1);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.1);
  });
  // 팔걸이(둥근 롤)
  for (const side of [0, 1]) {
    const x = side ? w - arm : 0;
    clipped(ctx, x, 0, arm, h, () => {
      M.fabric(ctx, 0, 0, arm, h, col, 'weave');
      const g = ctx.createLinearGradient(0, 0, arm, 0);
      g.addColorStop(0, side ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      g.addColorStop(1, side ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.32)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, arm, h);
      // 솔기
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = Math.max(1, w * 0.003);
      ctx.beginPath();
      ctx.moveTo(arm * 0.5, 0);
      ctx.lineTo(arm * 0.5, h);
      ctx.stroke();
    });
  }
  // 던진 쿠션(작은 장식 쿠션, 줄무늬)
  ctx.save();
  ctx.translate(w * 0.72, h * 0.3);
  ctx.rotate(0.18);
  P.cushion(ctx, -w * 0.11, -h * 0.085, w * 0.22, h * 0.17, '#d9a44c');
  M.rr(ctx, -w * 0.11, -h * 0.085, w * 0.22, h * 0.17, w * 0.02);
  ctx.clip();
  ctx.fillStyle = 'rgba(120,60,20,0.35)';
  for (let k = -3; k < 4; k++) ctx.fillRect(-w * 0.11 + k * w * 0.06 + w * 0.02, -h * 0.1, w * 0.02, h * 0.2);
  ctx.restore();
  // 담요 끝자락
  ctx.save();
  ctx.translate(w * 0.1, h * 0.72);
  ctx.rotate(-0.08);
  M.softShadow(ctx, w * 0.02, 0, w * 0.01, 0.35, () => {
    ctx.fillStyle = '#9fb2a4';
    M.rr(ctx, 0, 0, w * 0.22, h * 0.1, w * 0.01);
    ctx.fill();
  });
  M.texture(ctx, 0, 0, w * 0.22, h * 0.1, 'pile', 0.5, 1, 'overlay', 40);
  ctx.restore();
  rnd();
  finish(ctx, w, h, 0.1, 0.2);
}

function windowScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const f = w * 0.06; // 틀
  // 바깥 풍경
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
  sky.addColorStop(0, '#5fa6e3');
  sky.addColorStop(0.55, '#a9d3f1');
  sky.addColorStop(1, '#e7f2f8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  P.cloud(ctx, w * 0.12, h * 0.16, w * 0.09, 0.9);
  P.cloud(ctx, w * 0.55, h * 0.26, w * 0.12, 0.85);
  P.cloud(ctx, w * 0.78, h * 0.1, w * 0.07, 0.7);
  // 먼 건물
  ctx.fillStyle = 'rgba(120,140,165,0.45)';
  for (const [bx, bw, bh] of [
    [0.05, 0.12, 0.3],
    [0.2, 0.08, 0.22],
    [0.62, 0.1, 0.26],
    [0.74, 0.16, 0.34],
  ]) ctx.fillRect(w * bx, h * (0.78 - bh), w * bw, h * bh);
  P.treeLine(ctx, 0, h * 0.58, w, h * 0.25, rnd);
  // 유리 효과(틴트·반사)
  M.glass(ctx, w, h, 'rgba(200,225,235,0.14)');
  // 창틀: 바깥 틀 + 가운데 십자 살
  const frame = '#f1f0ea';
  const drawBar = (x: number, y: number, bw: number, bh: number) => {
    M.softShadow(ctx, f * 0.35, f * 0.08, f * 0.12, 0.35, () => {
      ctx.fillStyle = frame;
      ctx.fillRect(x, y, bw, bh);
    });
    const g = bw > bh ? ctx.createLinearGradient(0, y, 0, y + bh) : ctx.createLinearGradient(x, 0, x + bw, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.4, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, bw, bh);
  };
  drawBar(0, 0, w, f);
  drawBar(0, h - f * 1.6, w, f * 1.6);
  drawBar(0, 0, f, h);
  drawBar(w - f, 0, f, h);
  drawBar(w / 2 - f * 0.4, 0, f * 0.8, h);
  drawBar(0, h * 0.5 - f * 0.4, w, f * 0.8);
  // 창턱(나무)
  clipped(ctx, 0, h - f * 1.6, w, f * 1.6, () => M.wood(ctx, w, f * 1.6, rnd, { base: '#d9c7a8', planks: 1, dir: 'h', gloss: 0.3, knots: 0, grain: 4 }));
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, h - f * 1.6, w, 2);
  // 잠금 손잡이
  M.chromeBar(ctx, w / 2 - f * 0.18, h * 0.5 - f * 1.2, f * 0.36, f * 1.1, true);
  // 커튼 자락(왼쪽)
  clipped(ctx, f, f, w * 0.14, h - f * 2.6, () => {
    const g = ctx.createLinearGradient(0, 0, w * 0.14, 0);
    g.addColorStop(0, 'rgba(236,228,214,0.95)');
    g.addColorStop(0.7, 'rgba(236,228,214,0.85)');
    g.addColorStop(1, 'rgba(236,228,214,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w * 0.14, h);
    M.texture(ctx, 0, 0, w * 0.14, h, 'weave', 0.4, 1, 'overlay', 36);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = Math.max(1, w * 0.004);
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo((w * 0.14 * k) / 5, 0);
      ctx.quadraticCurveTo((w * 0.14 * k) / 5 + w * 0.01, h * 0.5, (w * 0.14 * k) / 5, h);
      ctx.stroke();
    }
  });
  finish(ctx, w, h, 0.06, 0.12);
}

function rugScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  woodFloor(ctx, w, h, rnd, '#c6965f');
  const x = w * 0.06;
  const y = h * 0.07;
  const rw = w * 0.88;
  const rh = h * 0.86;
  M.softShadow(ctx, w * 0.03, w * 0.008, w * 0.014, 0.45, () => {
    ctx.fillStyle = '#c56b4f';
    ctx.fillRect(x, y, rw, rh);
  });
  clipped(ctx, x, y, rw, rh, () => {
    const field = '#e3d2b4';
    const rust = '#bd5e45';
    const navy = '#3d4f6b';
    M.carpet(ctx, 0, 0, rw, rh, rust);
    // 바깥 띠 → 안쪽 필드
    const b1 = rw * 0.05;
    ctx.fillStyle = field;
    ctx.fillRect(b1, b1, rw - b1 * 2, rh - b1 * 2);
    ctx.fillStyle = navy;
    ctx.fillRect(b1 * 1.7, b1 * 1.7, rw - b1 * 3.4, rh - b1 * 3.4);
    ctx.fillStyle = field;
    ctx.fillRect(b1 * 2.3, b1 * 2.3, rw - b1 * 4.6, rh - b1 * 4.6);
    // 킬림 무늬: 띠 안의 작은 삼각형 열
    ctx.fillStyle = rust;
    const step = rw * 0.06;
    for (let tx = b1 * 1.2; tx < rw - b1 * 1.2; tx += step) {
      for (const ty of [b1 * 0.25, rh - b1 * 0.75]) {
        ctx.beginPath();
        ctx.moveTo(tx, ty + b1 * 0.5);
        ctx.lineTo(tx + step * 0.45, ty);
        ctx.lineTo(tx + step * 0.9, ty + b1 * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    // 중앙 메달리온(마름모 겹침)
    const cx = rw / 2;
    const cy = rh / 2;
    const dia = (rx: number, ry: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry);
      ctx.lineTo(cx + rx, cy);
      ctx.lineTo(cx, cy + ry);
      ctx.lineTo(cx - rx, cy);
      ctx.closePath();
      ctx.fill();
    };
    dia(rw * 0.3, rh * 0.26, navy);
    dia(rw * 0.25, rh * 0.215, field);
    dia(rw * 0.2, rh * 0.17, rust);
    dia(rw * 0.12, rh * 0.1, field);
    dia(rw * 0.06, rh * 0.05, navy);
    // 모서리 장식
    for (const [sx, sy] of [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.2, 0.8],
      [0.8, 0.8],
    ]) {
      ctx.fillStyle = navy;
      ctx.beginPath();
      ctx.moveTo(rw * sx, rh * sy - rh * 0.05);
      ctx.lineTo(rw * sx + rw * 0.05, rh * sy);
      ctx.lineTo(rw * sx, rh * sy + rh * 0.05);
      ctx.lineTo(rw * sx - rw * 0.05, rh * sy);
      ctx.closePath();
      ctx.fill();
    }
    // 직물 파일 결이 무늬 위에도 보이게
    M.texture(ctx, 0, 0, rw, rh, 'pile', 0.55, 1.3, 'overlay', 50);
    M.texture(ctx, 0, 0, rw, rh, 'weave', 0.25, 1, 'overlay', 30);
    M.innerShadow(ctx, 0, 0, rw, rh, rw * 0.02, 0.12);
  });
  // 술(프린지)
  ctx.strokeStyle = '#ece3d2';
  ctx.lineWidth = Math.max(1.2, w * 0.004);
  ctx.lineCap = 'round';
  for (let fx = x + w * 0.01; fx < x + rw; fx += w * 0.014) {
    const wig = (rnd() - 0.5) * w * 0.01;
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.lineTo(fx + wig, y - h * 0.035);
    ctx.moveTo(fx, y + rh);
    ctx.lineTo(fx - wig, y + rh + h * 0.035);
    ctx.stroke();
  }
  finish(ctx, w, h, 0.1, 0.18);
}

function shelfScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  // 뒤판(도장 합판)
  M.paint(ctx, w, h, '#e4dccd', 0.5);
  const side = w * 0.05;
  const shelfT = h * 0.03;
  const rows = 3;
  const rowH = (h - shelfT) / rows;
  // 선반 칸마다: 안쪽 그늘 + 물건 + 선반판
  for (let k = 0; k < rows; k++) {
    const top = k * rowH;
    const bottom = top + rowH;
    const g = ctx.createLinearGradient(0, top, 0, top + rowH * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(side, top, w - side * 2, rowH * 0.5);
    const baseY = bottom - shelfT * 0.2;
    const itemH = rowH * 0.78;
    if (k === 0) {
      const end = P.bookRow(ctx, side + w * 0.03, baseY, w * 0.5, itemH, rnd);
      P.pottedPlant(ctx, end + w * 0.14, baseY, itemH * 0.5, rnd);
      // 액자
      M.softShadow(ctx, w * 0.02, w * 0.006, w * 0.01, 0.35, () => {
        ctx.fillStyle = '#2c2a28';
        ctx.fillRect(w - side - w * 0.2, baseY - itemH * 0.6, w * 0.16, itemH * 0.6);
      });
      ctx.fillStyle = '#9fc3d9';
      ctx.fillRect(w - side - w * 0.185, baseY - itemH * 0.56, w * 0.13, itemH * 0.52);
      ctx.fillStyle = '#e9c46a';
      ctx.beginPath();
      ctx.arc(w - side - w * 0.12, baseY - itemH * 0.42, w * 0.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5f8f4a';
      ctx.fillRect(w - side - w * 0.185, baseY - itemH * 0.2, w * 0.13, itemH * 0.16);
    } else if (k === 1) {
      // 수납 상자 2개 + 책 몇 권
      for (let b = 0; b < 2; b++) {
        const bx = side + w * 0.04 + b * w * 0.3;
        M.softShadow(ctx, w * 0.02, w * 0.006, w * 0.01, 0.35, () => {
          ctx.fillStyle = b ? '#8e9aa8' : '#c7b7a2';
          M.rr(ctx, bx, baseY - itemH * 0.62, w * 0.26, itemH * 0.62, w * 0.008);
          ctx.fill();
        });
        M.texture(ctx, bx, baseY - itemH * 0.62, w * 0.26, itemH * 0.62, 'weave', 0.35, 1, 'overlay', 36);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        M.rr(ctx, bx + w * 0.09, baseY - itemH * 0.5, w * 0.08, itemH * 0.08, w * 0.01);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(bx + w * 0.06, baseY - itemH * 0.36, w * 0.14, itemH * 0.14);
      }
      P.bookRow(ctx, side + w * 0.66, baseY, w * 0.26, itemH * 0.9, rnd);
    } else {
      P.bookRow(ctx, side + w * 0.03, baseY, w * 0.38, itemH * 0.95, rnd);
      // 쌓인 책
      for (let s = 0; s < 4; s++) {
        const bh = itemH * 0.09;
        const by = baseY - bh * (s + 1);
        const bw = w * 0.22 - s * w * 0.01;
        ctx.fillStyle = ['#b23a3a', '#2d6fb0', '#e2d8c4', '#2f8f5b'][s];
        M.softShadow(ctx, w * 0.01, 0, w * 0.004, 0.3, () => {
          ctx.fillRect(side + w * 0.48 + s * w * 0.004, by, bw, bh);
        });
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(side + w * 0.48 + s * w * 0.004, by, bw, bh * 0.15);
      }
      P.pottedPlant(ctx, w - side - w * 0.14, baseY, itemH * 0.42, rnd);
    }
    // 선반판(원목): 앞면 + 윗면 하이라이트
    clipped(ctx, side, bottom - shelfT, w - side * 2, shelfT, () => M.wood(ctx, w - side * 2, shelfT, rnd, { base: '#b98a5c', planks: 1, dir: 'h', gloss: 0.3, knots: 0, grain: 3 }));
    ctx.fillStyle = 'rgba(255,245,230,0.45)';
    ctx.fillRect(side, bottom - shelfT, w - side * 2, Math.max(1, shelfT * 0.12));
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(side, bottom, w - side * 2, Math.max(1, shelfT * 0.1));
  }
  // 옆판
  for (const x of [0, w - side]) {
    clipped(ctx, x, 0, side, h, () => M.wood(ctx, side, h, rnd, { base: '#b4855a', planks: 1, dir: 'v', gloss: 0.25, knots: 0, grain: 2 }));
    ctx.fillStyle = x ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, 0, side, h);
  }
  finish(ctx, w, h, 0.1, 0.22);
}

function deskScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  M.wood(ctx, w, h, rnd, { base: '#c8a070', planks: 1, dir: 'h', gloss: 0.5, knots: 0.15, grain: 14 });
  // 책상 뒤쪽 벽 그늘(위쪽)
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.08);
  g.addColorStop(0, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.08);
  // 스탠드 받침(왼쪽 위)
  M.softShadow(ctx, w * 0.03, w * 0.01, w * 0.015, 0.4, () => {
    ctx.fillStyle = M.chrome(ctx, w * 0.05, 0, w * 0.25, 0, '#cfd5da');
    M.ellipsePath(ctx, w * 0.15, h * 0.13, w * 0.1, h * 0.05);
    ctx.fill();
  });
  P.tube(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(w * 0.15, h * 0.13);
      ctx.lineTo(w * 0.09, h * 0.02);
    },
    w * 0.02,
  );
  P.laptop(ctx, w * 0.3, h * 0.1, w * 0.46, h * 0.36);
  P.mouse(ctx, w * 0.87, h * 0.38, w * 0.08);
  P.mug(ctx, w * 0.84, h * 0.17, w * 0.055);
  P.notebook(ctx, w * 0.1, h * 0.6, w * 0.3, h * 0.3, -0.1);
  // 케이블
  ctx.strokeStyle = '#2b2f33';
  ctx.lineWidth = Math.max(1.5, w * 0.006);
  ctx.beginPath();
  ctx.moveTo(w * 0.76, h * 0.24);
  ctx.bezierCurveTo(w * 0.9, h * 0.22, w * 0.95, h * 0.1, w, h * 0.06);
  ctx.stroke();
  // 메모지 + 펜
  ctx.save();
  ctx.translate(w * 0.62, h * 0.66);
  ctx.rotate(0.12);
  M.softShadow(ctx, w * 0.015, w * 0.004, w * 0.008, 0.3, () => {
    ctx.fillStyle = '#f7e27a';
    ctx.fillRect(0, 0, w * 0.14, w * 0.14);
  });
  ctx.strokeStyle = 'rgba(60,60,80,0.5)';
  ctx.lineWidth = Math.max(1, w * 0.003);
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.02, (w * 0.14 * k) / 4);
    ctx.lineTo(w * (0.05 + k * 0.025), (w * 0.14 * k) / 4);
    ctx.stroke();
  }
  ctx.restore();
  finish(ctx, w, h, 0.12, 0.22);
}

function bedScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  // 헤드보드(패브릭, 단추)
  const hb = h * 0.14;
  M.fabric(ctx, 0, 0, w, hb, '#9aa7b3', 'velvet');
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 2; j++) {
      const bx = w * (0.125 + k * 0.25);
      const by = hb * (0.3 + j * 0.42);
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, w * 0.05);
      bg.addColorStop(0, 'rgba(0,0,0,0.32)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, w * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6f7b86';
      ctx.beginPath();
      ctx.arc(bx, by, w * 0.008, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, hb - 2, w, 3);
  // 매트리스·시트
  M.fabric(ctx, 0, hb, w, h - hb, '#eef0ee', 'weave');
  // 이불: 아래 70% — 접힌 윗단
  const duvY = h * 0.36;
  clipped(ctx, 0, duvY, w, h - duvY, () => {
    M.fabric(ctx, 0, 0, w, h, '#d9e3ea', 'weave');
    // 누빔(퀼팅) 사각 패턴
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = Math.max(1, w * 0.003);
    const q = w * 0.16;
    for (let x = q * 0.5; x < w; x += q) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + w * 0.01, h * 0.3, x, h);
      ctx.stroke();
    }
    for (let y = q * 0.5; y < h; y += q) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(w * 0.5, y + h * 0.01, w, y);
      ctx.stroke();
    }
    // 큰 주름(부드러운 밝기 띠)
    for (let k = 0; k < 4; k++) {
      const fx = w * (0.15 + k * 0.22 + (rnd() - 0.5) * 0.1);
      const g = ctx.createLinearGradient(fx - w * 0.08, 0, fx + w * 0.08, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fx - w * 0.08, 0, w * 0.16, h);
    }
  });
  // 접힌 단(시트가 넘어온 흰 띠) + 그림자
  M.softShadow(ctx, h * 0.02, 0, h * 0.012, 0.35, () => {
    ctx.fillStyle = '#f7f8f6';
    ctx.fillRect(0, duvY - h * 0.005, w, h * 0.075);
  });
  M.texture(ctx, 0, duvY, w, h * 0.07, 'weave', 0.4, 1, 'overlay', 30);
  const fg = ctx.createLinearGradient(0, duvY, 0, duvY + h * 0.075);
  fg.addColorStop(0, 'rgba(255,255,255,0.4)');
  fg.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = fg;
  ctx.fillRect(0, duvY, w, h * 0.075);
  // 베개 2개
  P.pillow(ctx, w * 0.07, hb + h * 0.03, w * 0.4, h * 0.16, '#fbfaf6');
  P.pillow(ctx, w * 0.53, hb + h * 0.03, w * 0.4, h * 0.16, '#fbfaf6');
  // 발치 담요
  clipped(ctx, 0, h * 0.84, w, h * 0.16, () => {
    M.fabric(ctx, 0, 0, w, h * 0.16, '#b89a7a', 'pile');
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.03);
    g.addColorStop(0, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.03);
  });
  finish(ctx, w, h, 0.1, 0.16);
}

function closetScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  M.paint(ctx, w, h, '#e6e2d8', 0.55);
  // 옆판·윗선반 그늘
  const side = w * 0.05;
  for (const x of [0, w - side]) {
    clipped(ctx, x, 0, side, h, () => M.wood(ctx, side, h, rnd, { base: '#d8c9ae', planks: 1, dir: 'v', gloss: 0.2, knots: 0, grain: 2 }));
    ctx.fillStyle = x ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, 0, side, h);
  }
  const shelfY = h * 0.13;
  clipped(ctx, side, shelfY, w - side * 2, h * 0.028, () => M.wood(ctx, w - side * 2, h * 0.028, rnd, { base: '#d2bf9f', planks: 1, dir: 'h', gloss: 0.25, knots: 0, grain: 2 }));
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(side, shelfY + h * 0.028, w - side * 2, 2);
  // 윗선반 상자
  for (let b = 0; b < 3; b++) {
    const bx = side + w * 0.03 + b * w * 0.3;
    M.softShadow(ctx, w * 0.015, w * 0.004, w * 0.008, 0.3, () => {
      ctx.fillStyle = ['#c9b8a2', '#9fb0b8', '#d8cdb8'][b];
      ctx.fillRect(bx, shelfY - h * 0.11, w * 0.26, h * 0.11);
    });
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(bx, shelfY - h * 0.11, w * 0.26, h * 0.012);
  }
  // 봉 + 옷걸이 + 옷(왼쪽 60%)
  const railY = shelfY + h * 0.08;
  P.hangerRail(ctx, side + w * 0.02, railY, w - side * 2 - w * 0.04, w * 0.1, 7);
  const cols = ['#5b7fa6', '#d9d2c5', '#8a6f5c', '#c4525b', '#45554f'];
  for (let k = 0; k < 5; k++) {
    const cx = side + w * 0.04 + k * w * 0.12;
    const cw = w * 0.17;
    const ch = h * (0.42 + (k % 2) * 0.08);
    M.softShadow(ctx, w * 0.02, w * 0.005, w * 0.01, 0.3, () => {
      ctx.fillStyle = cols[k];
      ctx.beginPath();
      ctx.moveTo(cx + cw * 0.5, railY + w * 0.03);
      ctx.lineTo(cx + cw * 0.95, railY + w * 0.1);
      ctx.lineTo(cx + cw, railY + ch);
      ctx.lineTo(cx, railY + ch);
      ctx.lineTo(cx + cw * 0.05, railY + w * 0.1);
      ctx.closePath();
      ctx.fill();
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, railY, cw, ch);
    ctx.clip();
    M.texture(ctx, cx, railY, cw, ch, 'weave', 0.4, 1, 'overlay', 36);
    const g = ctx.createLinearGradient(cx, 0, cx + cw, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(cx, railY, cw, ch);
    ctx.restore();
  }
  // 바닥 신발 선반
  const rackY = h * 0.84;
  clipped(ctx, side, rackY, w - side * 2, h * 0.028, () => M.wood(ctx, w - side * 2, h * 0.028, rnd, { base: '#d2bf9f', planks: 1, dir: 'h', gloss: 0.25, knots: 0, grain: 2 }));
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(side, rackY + h * 0.028, w - side * 2, 2);
  for (let s = 0; s < 3; s++) {
    const sx = side + w * 0.08 + s * w * 0.3;
    M.softShadow(ctx, w * 0.015, w * 0.004, w * 0.006, 0.35, () => {
      ctx.fillStyle = ['#2f3136', '#7a4b2e', '#e8e4dc'][s];
      M.rr(ctx, sx, rackY - h * 0.05, w * 0.2, h * 0.05, w * 0.02);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    M.rr(ctx, sx + w * 0.02, rackY - h * 0.045, w * 0.1, h * 0.012, w * 0.006);
    ctx.fill();
  }
  finish(ctx, w, h, 0.08, 0.24);
}

// ───────────────────────── 아파트: 주방 ─────────────────────────

function kitchenTileScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  M.tiles(ctx, w, h, rnd, { cols: 4, face: '#f3f4f1', grout: '#bfc5c2', ratio: 0.5, stagger: true, variation: 0.03, bevel: 0.7, gloss: 0.6 });
  // 조리도구 걸이 봉(위쪽)
  const railY = h * 0.08;
  P.tube(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(w * 0.08, railY);
      ctx.lineTo(w * 0.92, railY);
    },
    w * 0.022,
  );
  for (const x of [0.1, 0.9]) {
    ctx.fillStyle = M.chrome(ctx, w * x - w * 0.02, 0, w * x + w * 0.02, 0);
    M.rr(ctx, w * x - w * 0.02, railY - w * 0.02, w * 0.04, w * 0.04, w * 0.01);
    ctx.fill();
  }
  // 국자·뒤집개·거품기
  const hook = (x: number) => {
    ctx.strokeStyle = '#9aa3aa';
    ctx.lineWidth = Math.max(1.5, w * 0.006);
    ctx.beginPath();
    ctx.arc(x, railY + w * 0.02, w * 0.02, Math.PI * 1.1, Math.PI * 1.9, false);
    ctx.stroke();
  };
  const utensil = (x: number, kind: number) => {
    hook(x);
    const top = railY + w * 0.04;
    P.tube(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, top + h * 0.2);
      },
      w * 0.022,
      '#3a3f45',
    );
    if (kind === 0) {
      // 국자
      ctx.fillStyle = M.chrome(ctx, x - w * 0.05, 0, x + w * 0.05, 0);
      M.ellipsePath(ctx, x, top + h * 0.23, w * 0.05, h * 0.03);
      ctx.fill();
    } else if (kind === 1) {
      // 뒤집개
      ctx.fillStyle = M.chrome(ctx, x - w * 0.05, 0, x + w * 0.05, 0);
      M.rr(ctx, x - w * 0.045, top + h * 0.19, w * 0.09, h * 0.07, w * 0.012);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x - w * 0.03 + k * w * 0.025, top + h * 0.205, w * 0.008, h * 0.04);
    } else {
      // 거품기
      ctx.strokeStyle = '#d7dde2';
      ctx.lineWidth = Math.max(1, w * 0.004);
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x, top + h * 0.19);
        ctx.quadraticCurveTo(x + k * w * 0.035, top + h * 0.25, x, top + h * 0.3);
        ctx.stroke();
      }
    }
  };
  utensil(w * 0.3, 0);
  utensil(w * 0.5, 1);
  utensil(w * 0.7, 2);
  // 콘센트
  P.outlet(ctx, w * 0.8, h * 0.55, w * 0.09);
  // 조리대 끝(아래 가장자리) 스테인리스 턱
  clipped(ctx, 0, h * 0.94, w, h * 0.06, () => M.steel(ctx, w, h * 0.06, 'h'));
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h * 0.94, w, 2);
  finish(ctx, w, h, 0.1, 0.16);
}

function stoveScene(ctx: Ctx, w: number, h: number): void {
  M.steel(ctx, w, h, 'h', '#d9dee2');
  // 상판 테두리 단차
  M.innerShadow(ctx, 0, 0, w, h * 0.8, w * 0.015, 0.2);
  // 버너 4개
  const r = w * 0.17;
  for (const [cx, cy, k] of [
    [0.27, 0.22, 1],
    [0.73, 0.22, 0.82],
    [0.27, 0.58, 0.82],
    [0.73, 0.58, 1],
  ]) P.burner(ctx, w * cx, h * cy, r * k);
  // 조작부
  const panelY = h * 0.8;
  const pg = ctx.createLinearGradient(0, panelY, 0, h);
  pg.addColorStop(0, '#2a2f34');
  pg.addColorStop(0.08, '#4a5158');
  pg.addColorStop(1, '#23272b');
  ctx.fillStyle = pg;
  ctx.fillRect(0, panelY, w, h - panelY);
  M.texture(ctx, 0, panelY, w, h - panelY, 'brush', 0.25, 1, 'overlay', 30);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, panelY, w, 2);
  for (let k = 0; k < 4; k++) P.knob(ctx, w * (0.2 + k * 0.2), panelY + (h - panelY) * 0.5, w * 0.045, -Math.PI / 2 + (k === 1 ? 1.2 : 0));
  // 표시등
  ctx.fillStyle = '#ff7b3a';
  ctx.shadowColor = '#ff7b3a';
  ctx.shadowBlur = w * 0.02;
  ctx.beginPath();
  ctx.arc(w * 0.92, panelY + (h - panelY) * 0.5, w * 0.008, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  finish(ctx, w, h, 0.1, 0.16);
}

function sinkScene(ctx: Ctx, w: number, h: number): void {
  M.steel(ctx, w, h, 'h', '#d5dbe0');
  // 뒷벽 턱(백스플래시 밑단) 그늘
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.06);
  g.addColorStop(0, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.06);
  // 개수대 2칸
  const bowl = (x: number, y: number, bw: number, bh: number) => {
    M.rr(ctx, x, y, bw, bh, w * 0.03);
    const bg = ctx.createLinearGradient(x, y, x + bw * 0.4, y + bh);
    bg.addColorStop(0, '#7f8a93');
    bg.addColorStop(0.45, '#aeb8c0');
    bg.addColorStop(1, '#8d979f');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.save();
    M.rr(ctx, x, y, bw, bh, w * 0.03);
    ctx.clip();
    M.texture(ctx, x, y, bw, bh, 'brush', 0.45, 1, 'overlay', 40);
    M.innerShadow(ctx, x, y, bw, bh, bw * 0.18, 0.45);
    // 바닥 경사 하이라이트
    const hl = ctx.createRadialGradient(x + bw * 0.5, y + bh * 0.55, bw * 0.05, x + bw * 0.5, y + bh * 0.55, bw * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,0.18)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(x, y, bw, bh);
    ctx.restore();
    // 테두리 하이라이트
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1.5, w * 0.004);
    M.rr(ctx, x, y, bw, bh, w * 0.03);
    ctx.stroke();
    P.drain(ctx, x + bw * 0.5, y + bh * 0.58, bw * 0.09);
  };
  bowl(w * 0.07, h * 0.3, w * 0.4, h * 0.52);
  bowl(w * 0.53, h * 0.3, w * 0.4, h * 0.52);
  // 수전
  P.faucet(ctx, w * 0.5, h * 0.27, w * 0.5, 'goose');
  // 세제 병·스펀지
  P.soapBottle(ctx, w * 0.83, h * 0.05, w * 0.1, h * 0.22, '#58b0d6');
  M.softShadow(ctx, w * 0.015, w * 0.004, w * 0.008, 0.4, () => {
    ctx.fillStyle = '#f0d04a';
    M.rr(ctx, w * 0.06, h * 0.16, w * 0.14, h * 0.07, w * 0.012);
    ctx.fill();
  });
  ctx.fillStyle = '#4e9a52';
  M.rr(ctx, w * 0.06, h * 0.16, w * 0.14, h * 0.022, w * 0.008);
  ctx.fill();
  M.texture(ctx, w * 0.06, h * 0.16, w * 0.14, h * 0.07, 'speckle', 0.5, 1, 'overlay', 60);
  // 조리대 앞 가장자리
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, h * 0.92, w, 2);
  const eg = ctx.createLinearGradient(0, h * 0.92, 0, h);
  eg.addColorStop(0, 'rgba(255,255,255,0.3)');
  eg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = eg;
  ctx.fillRect(0, h * 0.92, w, h * 0.08);
  finish(ctx, w, h, 0.1, 0.14);
}

function fridgeScene(ctx: Ctx, w: number, h: number): void {
  M.steel(ctx, w, h, 'v', '#d6dce0');
  // 문 이음새(가로) + 양문 세로 이음새
  const seamY = h * 0.3;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, seamY, w, Math.max(2, h * 0.006));
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(0, seamY + Math.max(2, h * 0.006), w, 1.5);
  // 손잡이 2개(세로 바)
  P.barHandle(ctx, w * 0.1, h * 0.04, w * 0.045, h * 0.2);
  P.barHandle(ctx, w * 0.1, seamY + h * 0.05, w * 0.045, h * 0.5);
  // 자석·메모
  ctx.save();
  ctx.translate(w * 0.45, h * 0.44);
  ctx.rotate(-0.05);
  M.softShadow(ctx, w * 0.012, w * 0.003, w * 0.006, 0.35, () => {
    ctx.fillStyle = '#fbfaf4';
    ctx.fillRect(0, 0, w * 0.3, h * 0.2);
  });
  ctx.strokeStyle = 'rgba(40,50,70,0.5)';
  ctx.lineWidth = Math.max(1, w * 0.003);
  for (let k = 1; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.03, (h * 0.2 * k) / 6);
    ctx.lineTo(w * (0.08 + ((k * 3) % 4) * 0.045), (h * 0.2 * k) / 6);
    ctx.stroke();
  }
  ctx.fillStyle = '#d84a4a';
  ctx.beginPath();
  ctx.arc(w * 0.15, 0, w * 0.018, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 사진 + 자석 몇 개
  ctx.save();
  ctx.translate(w * 0.55, h * 0.7);
  ctx.rotate(0.08);
  M.softShadow(ctx, w * 0.012, w * 0.003, w * 0.006, 0.35, () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w * 0.2, h * 0.14);
  });
  const pg = ctx.createLinearGradient(0, 0, 0, h * 0.12);
  pg.addColorStop(0, '#8ec5ee');
  pg.addColorStop(1, '#5fa36a');
  ctx.fillStyle = pg;
  ctx.fillRect(w * 0.012, h * 0.008, w * 0.176, h * 0.11);
  ctx.restore();
  for (const [mx, my, c] of [
    [0.82, 0.36, '#3c8ad6'],
    [0.86, 0.56, '#f2b134'],
    [0.76, 0.82, '#56b36a'],
  ]) {
    M.softShadow(ctx, w * 0.01, w * 0.002, w * 0.004, 0.35, () => {
      ctx.fillStyle = c as string;
      ctx.beginPath();
      ctx.arc(w * (mx as number), h * (my as number), w * 0.022, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(w * (mx as number) - w * 0.006, h * (my as number) - w * 0.006, w * 0.008, 0, Math.PI * 2);
    ctx.fill();
  }
  finish(ctx, w, h, 0.1, 0.16);
}

// ───────────────────────── 아파트: 욕실 ─────────────────────────

function bathTileScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  M.tiles(ctx, w, h, rnd, { cols: 5, face: '#d8e8ec', grout: '#9fb3ba', variation: 0.05, bevel: 0.6, gloss: 0.55 });
  P.showerHead(ctx, w * 0.06, h * 0.04, w * 0.3);
  // 수건 봉 + 수건(오른쪽)
  const barY = h * 0.5;
  M.chromeBar(ctx, w * 0.56, barY, w * 0.4, w * 0.022);
  P.towel(ctx, w * 0.6, barY + w * 0.008, w * 0.3, h * 0.3, '#e8dfd0');
  // 비누 받침 + 비누
  M.softShadow(ctx, w * 0.02, w * 0.005, w * 0.01, 0.35, () => {
    ctx.fillStyle = M.chrome(ctx, 0, h * 0.78, 0, h * 0.84);
    M.rr(ctx, w * 0.1, h * 0.78, w * 0.24, h * 0.05, w * 0.01);
    ctx.fill();
  });
  ctx.fillStyle = '#f3e9d2';
  M.rr(ctx, w * 0.14, h * 0.755, w * 0.14, h * 0.045, w * 0.02);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  M.rr(ctx, w * 0.16, h * 0.76, w * 0.06, h * 0.012, w * 0.006);
  ctx.fill();
  finish(ctx, w, h, 0.1, 0.16);
}

function basinScene(ctx: Ctx, w: number, h: number): void {
  // 상판(인조대리석)
  M.concrete(ctx, 0, 0, w, h, '#e6e4de');
  M.texture(ctx, 0, 0, w, h, 'speckle', 0.2, 1, 'overlay', 30);
  // 세면볼(타원)
  const cx = w * 0.5;
  const cy = h * 0.55;
  const rx = w * 0.36;
  const ry = h * 0.25;
  M.softShadow(ctx, w * 0.02, 0, w * 0.006, 0.25, () => {
    ctx.fillStyle = '#f7f9fa';
    M.ellipsePath(ctx, cx, cy, rx * 1.06, ry * 1.08);
    ctx.fill();
  });
  M.ellipsePath(ctx, cx, cy, rx, ry);
  M.glazeFill(ctx, cx, cy, Math.max(rx, ry), '#e9eff1', '#aebcc4');
  ctx.save();
  M.ellipsePath(ctx, cx, cy, rx, ry);
  ctx.clip();
  // 볼 안쪽: 위쪽은 깊은 그늘, 바닥은 밝음
  const d = ctx.createRadialGradient(cx, cy + ry * 0.2, ry * 0.2, cx, cy, ry * 1.3);
  d.addColorStop(0, 'rgba(255,255,255,0.35)');
  d.addColorStop(0.7, 'rgba(0,0,0,0)');
  d.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = d;
  ctx.fillRect(0, 0, w, h);
  const top = ctx.createLinearGradient(0, cy - ry, 0, cy - ry * 0.3);
  top.addColorStop(0, 'rgba(0,0,0,0.35)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // 테두리 하이라이트
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(1.5, w * 0.005);
  M.ellipsePath(ctx, cx, cy, rx, ry);
  ctx.stroke();
  P.drain(ctx, cx, cy + ry * 0.25, w * 0.045, false);
  // 수전(원홀 레버) — 볼 위쪽 상판
  P.faucet(ctx, cx, h * 0.27, w * 0.4, 'lever');
  // 비누 디스펜서·칫솔컵
  P.soapBottle(ctx, w * 0.8, h * 0.06, w * 0.1, h * 0.22, '#7fb7a9');
  M.softShadow(ctx, w * 0.02, w * 0.005, w * 0.01, 0.35, () => {
    ctx.fillStyle = '#eef1f3';
    M.rr(ctx, w * 0.08, h * 0.12, w * 0.11, h * 0.14, w * 0.02);
    ctx.fill();
  });
  for (const [k, c] of [
    [0, '#3b7dd8'],
    [1, '#d84a6a'],
  ] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(2, w * 0.012);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * (0.115 + k * 0.03), h * 0.13);
    ctx.lineTo(w * (0.125 + k * 0.03), h * 0.02);
    ctx.stroke();
  }
  // 접은 수건(왼쪽 아래)
  P.towel(ctx, w * 0.05, h * 0.84, w * 0.26, h * 0.12, '#dfe6ea');
  finish(ctx, w, h, 0.1, 0.14);
}

function mirrorScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const f = w * 0.045;
  // 거울 속: 밝은 욕실 반사(흐릿한 타일 + 조명 + 수건)
  const bg = ctx.createLinearGradient(0, 0, w * 0.4, h);
  bg.addColorStop(0, '#f2f6f7');
  bg.addColorStop(0.5, '#dfe8eb');
  bg.addColorStop(1, '#c9d6db');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.35;
  M.tiles(ctx, w, h, rnd, { cols: 5, face: '#e4eef1', grout: '#aebfc5', variation: 0.03, bevel: 0.2, gloss: 0.2 });
  ctx.restore();
  // 반사된 수건·세면대·수전 (거울 속 풍경)
  ctx.save();
  ctx.globalAlpha = 0.5;
  P.towel(ctx, w * 0.7, h * 0.4, w * 0.18, h * 0.26, '#d9c7b4');
  ctx.fillStyle = '#f2f5f6';
  M.ellipsePath(ctx, w * 0.42, h * 0.82, w * 0.3, h * 0.08);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  M.ellipsePath(ctx, w * 0.42, h * 0.82, w * 0.3, h * 0.08);
  ctx.stroke();
  P.faucet(ctx, w * 0.42, h * 0.74, w * 0.22, 'lever');
  ctx.restore();
  // 조명 바(위쪽) 글로우
  for (let k = 0; k < 3; k++) {
    const lx = w * (0.25 + k * 0.25);
    const ly = h * 0.11;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 0.16);
    g.addColorStop(0, 'rgba(255,250,235,0.95)');
    g.addColorStop(0.25, 'rgba(255,245,220,0.5)');
    g.addColorStop(1, 'rgba(255,245,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.4);
    const bulb = ctx.createRadialGradient(lx - w * 0.01, ly - w * 0.012, 0, lx, ly, w * 0.038);
    bulb.addColorStop(0, '#ffffff');
    bulb.addColorStop(0.6, '#fff4d6');
    bulb.addColorStop(1, '#f1d9a0');
    ctx.fillStyle = bulb;
    ctx.beginPath();
    ctx.arc(lx, ly, w * 0.038, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9aa3aa';
    M.rr(ctx, lx - w * 0.016, ly - w * 0.06, w * 0.032, w * 0.028, w * 0.006);
    ctx.fill();
  }
  M.chromeBar(ctx, w * 0.15, h * 0.055, w * 0.7, h * 0.022);
  // 유리 반사 띠
  M.glass(ctx, w, h, 'rgba(210,230,236,0.1)');
  // 틀(검은 금속)
  M.softShadow(ctx, f, 0, f * 0.3, 0.4, () => {
    ctx.fillStyle = '#2b2d30';
    ctx.fillRect(0, 0, w, f);
    ctx.fillRect(0, h - f, w, f);
    ctx.fillRect(0, 0, f, h);
    ctx.fillRect(w - f, 0, f, h);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(f, f, w - f * 2, 1.5);
  ctx.fillRect(f, f, 1.5, h - f * 2);
  // 아래 선반(유리) + 물건
  ctx.fillStyle = 'rgba(200,225,235,0.55)';
  ctx.fillRect(f, h * 0.84, w - f * 2, h * 0.025);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(f, h * 0.84, w - f * 2, 1.5);
  P.soapBottle(ctx, w * 0.12, h * 0.63, w * 0.08, h * 0.21, '#9aa8d6');
  M.softShadow(ctx, w * 0.01, w * 0.003, w * 0.006, 0.3, () => {
    ctx.fillStyle = '#f1f3f5';
    M.rr(ctx, w * 0.24, h * 0.73, w * 0.07, h * 0.11, w * 0.012);
    ctx.fill();
  });
  finish(ctx, w, h, 0.05, 0.1);
}

function bathtubScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  // 바닥 타일
  M.tiles(ctx, w, h, rnd, { cols: 7, face: '#dfe4e2', grout: '#a9b3b1', variation: 0.05, bevel: 0.4, gloss: 0.3 });
  // 욕조 외곽(위에서)
  const x = w * 0.06;
  const y = h * 0.05;
  const tw = w * 0.88;
  const th = h * 0.9;
  M.softShadow(ctx, w * 0.03, w * 0.006, w * 0.014, 0.4, () => {
    ctx.fillStyle = '#f6f8f8';
    M.rr(ctx, x, y, tw, th, w * 0.12);
    ctx.fill();
  });
  // 테두리 유약 음영
  ctx.save();
  M.rr(ctx, x, y, tw, th, w * 0.12);
  ctx.clip();
  const rim = ctx.createLinearGradient(x, y, x + tw * 0.4, y + th);
  rim.addColorStop(0, 'rgba(255,255,255,0.6)');
  rim.addColorStop(0.5, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = rim;
  ctx.fillRect(x, y, tw, th);
  ctx.restore();
  tubInner(ctx, x + w * 0.09, y + h * 0.1, tw - w * 0.18, th - h * 0.16, w);
  // 벽 수전(위쪽 가운데) + 오버플로
  P.faucet(ctx, w * 0.5, y + h * 0.015, w * 0.2, 'wall');
  // 고무 오리(원창작, 장식)
  const dx = w * 0.72;
  const dy = h * 0.72;
  M.softShadow(ctx, w * 0.015, w * 0.004, w * 0.008, 0.35, () => {
    ctx.fillStyle = '#f7c531';
    M.ellipsePath(ctx, dx, dy, w * 0.06, h * 0.035);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx + w * 0.035, dy - h * 0.035, w * 0.03, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#f08a2a';
  M.ellipsePath(ctx, dx + w * 0.065, dy - h * 0.03, w * 0.016, h * 0.007);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(dx + w * 0.045, dy - h * 0.042, w * 0.004, 0, Math.PI * 2);
  ctx.fill();
  finish(ctx, w, h, 0.1, 0.16);
}

/** 욕조 안쪽(유약 깊이감 + 배수구) */
function tubInner(ctx: Ctx, x: number, y: number, iw: number, ih: number, w: number): void {
  const r = w * 0.1;
  M.rr(ctx, x, y, iw, ih, r);
  const g = ctx.createRadialGradient(x + iw * 0.5, y + ih * 0.62, iw * 0.1, x + iw * 0.5, y + ih * 0.5, iw * 0.8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#e8eef0');
  g.addColorStop(1, '#b6c4ca');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  M.rr(ctx, x, y, iw, ih, r);
  ctx.clip();
  M.innerShadow(ctx, x, y, iw, ih, iw * 0.2, 0.3);
  // 벽면 곡률: 위쪽은 더 어둡게(머리 쪽 경사)
  const t = ctx.createLinearGradient(0, y, 0, y + ih * 0.35);
  t.addColorStop(0, 'rgba(0,0,0,0.25)');
  t.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = t;
  ctx.fillRect(x, y, iw, ih);
  // 물기 반사
  M.sheen(ctx, x + iw, y + ih, 0.14, -0.5, 0.3, 0.2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1.5, w * 0.005);
  M.rr(ctx, x, y, iw, ih, r);
  ctx.stroke();
  P.drain(ctx, x + iw * 0.5, y + ih * 0.86, w * 0.04);
  // 오버플로 구멍
  ctx.fillStyle = '#5a6369';
  M.ellipsePath(ctx, x + iw * 0.5, y + ih * 0.1, w * 0.025, w * 0.012);
  ctx.fill();
}

function tubScene(ctx: Ctx, w: number, h: number): void {
  // 구역(욕실 복합의 아래 45%): 욕조 테두리 + 안쪽
  ctx.fillStyle = '#f5f7f7';
  ctx.fillRect(0, 0, w, h);
  const rim = ctx.createLinearGradient(0, 0, w * 0.4, h);
  rim.addColorStop(0, 'rgba(255,255,255,0.5)');
  rim.addColorStop(0.5, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);
  tubInner(ctx, w * 0.07, h * 0.16, w * 0.86, h * 0.76, w);
  P.faucet(ctx, w * 0.5, h * 0.02, w * 0.18, 'wall');
  finish(ctx, w, h, 0.08, 0.14);
}

function toiletScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  M.tiles(ctx, w, h, rnd, { cols: 5, face: '#e3e6e3', grout: '#aeb6b4', variation: 0.05, bevel: 0.4, gloss: 0.3 });
  const cx = w * 0.5;
  // 바닥 그림자
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = w * 0.05;
  ctx.shadowOffsetX = w * 0.015;
  ctx.shadowOffsetY = w * 0.03;
  ctx.fillStyle = '#f4f6f6';
  M.rr(ctx, w * 0.16, h * 0.04, w * 0.68, h * 0.3, w * 0.05);
  ctx.fill();
  M.ellipsePath(ctx, cx, h * 0.62, w * 0.32, h * 0.3);
  ctx.fill();
  ctx.restore();
  // 물탱크
  M.rr(ctx, w * 0.16, h * 0.04, w * 0.68, h * 0.3, w * 0.05);
  M.glazeFill(ctx, w * 0.4, h * 0.12, w * 0.7, '#eef2f3', '#c3ced3');
  ctx.save();
  M.rr(ctx, w * 0.16, h * 0.04, w * 0.68, h * 0.3, w * 0.05);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(w * 0.16, h * 0.085, w * 0.68, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(w * 0.16, h * 0.09, w * 0.68, 1.5);
  ctx.restore();
  // 물내림 버튼(이중)
  M.softShadow(ctx, w * 0.012, w * 0.003, w * 0.006, 0.35, () => {
    ctx.fillStyle = M.chrome(ctx, cx - w * 0.06, 0, cx + w * 0.06, 0);
    M.ellipsePath(ctx, cx + w * 0.2, h * 0.065, w * 0.055, h * 0.02);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx + w * 0.2 - 1, h * 0.05, 2, h * 0.03);
  // 좌대(시트) — 둥근 링
  M.ellipsePath(ctx, cx, h * 0.62, w * 0.32, h * 0.3);
  M.glazeFill(ctx, cx - w * 0.1, h * 0.5, w * 0.45, '#eef2f3', '#c0cbd1');
  // 경첩
  for (const dx of [-0.12, 0.12]) {
    ctx.fillStyle = M.chrome(ctx, 0, h * 0.33, 0, h * 0.36);
    M.rr(ctx, cx + w * dx - w * 0.035, h * 0.33, w * 0.07, h * 0.03, w * 0.01);
    ctx.fill();
  }
  // 시트 안쪽 구멍(변기 보울)
  M.ellipsePath(ctx, cx, h * 0.64, w * 0.2, h * 0.19);
  const bg = ctx.createRadialGradient(cx, h * 0.66, w * 0.02, cx, h * 0.64, w * 0.22);
  bg.addColorStop(0, '#b9d6e2');
  bg.addColorStop(0.45, '#d5e6ee');
  bg.addColorStop(0.8, '#f1f5f7');
  bg.addColorStop(1, '#aab8bf');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  M.ellipsePath(ctx, cx, h * 0.64, w * 0.2, h * 0.19);
  ctx.clip();
  const sh = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.6);
  sh.addColorStop(0, 'rgba(0,0,0,0.35)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, h);
  // 물(아래쪽 타원) + 반사
  const wg = ctx.createRadialGradient(cx, h * 0.72, 0, cx, h * 0.72, w * 0.16);
  wg.addColorStop(0, 'rgba(120,180,215,0.5)');
  wg.addColorStop(0.7, 'rgba(140,195,225,0.3)');
  wg.addColorStop(1, 'rgba(160,205,230,0)');
  ctx.fillStyle = wg;
  M.ellipsePath(ctx, cx, h * 0.72, w * 0.16, h * 0.09);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  M.ellipsePath(ctx, cx - w * 0.05, h * 0.7, w * 0.04, h * 0.01, -0.3);
  ctx.fill();
  ctx.restore();
  // 시트 테두리 선
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  M.ellipsePath(ctx, cx, h * 0.62, w * 0.3, h * 0.28);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  M.ellipsePath(ctx, cx, h * 0.62, w * 0.32, h * 0.3);
  ctx.stroke();
  finish(ctx, w, h, 0.1, 0.16);
}

function showerGlassScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  // 유리 뒤: 흐릿한 타일 벽 + 샤워기
  ctx.save();
  M.tiles(ctx, w, h, rnd, { cols: 6, face: '#dde9ec', grout: '#a7b9bf', variation: 0.04, bevel: 0.3, gloss: 0.3 });
  ctx.globalAlpha = 0.45;
  P.showerHead(ctx, w * 0.1, h * 0.06, w * 0.34);
  P.towel(ctx, w * 0.66, h * 0.5, w * 0.22, h * 0.3, '#cfd9dc');
  ctx.restore();
  // 유리(틴트·반사) — 살짝 뿌연 느낌
  ctx.fillStyle = 'rgba(225,240,245,0.35)';
  ctx.fillRect(0, 0, w, h);
  M.glass(ctx, w, h, 'rgba(200,230,240,0.12)');
  // 물방울·흐른 자국
  ctx.save();
  for (let k = 0; k < 70; k++) {
    const dx = rnd() * w;
    const dy = rnd() * h;
    const r = w * (0.004 + rnd() * 0.008);
    const g = ctx.createRadialGradient(dx - r * 0.3, dy - r * 0.3, 0, dx, dy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.6, 'rgba(200,220,230,0.25)');
    g.addColorStop(1, 'rgba(120,150,165,0.35)');
    ctx.fillStyle = g;
    M.ellipsePath(ctx, dx, dy, r, r * 1.3);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, w * 0.003);
  for (let k = 0; k < 6; k++) {
    const sx = w * (0.1 + rnd() * 0.8);
    const sy = h * rnd() * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + w * 0.01, sy + h * (0.1 + rnd() * 0.3));
    ctx.stroke();
  }
  ctx.restore();
  // 프레임(왼쪽 세로 바) + 손잡이
  M.chromeBar(ctx, 0, 0, w * 0.045, h, true);
  M.chromeBar(ctx, w * 0.045, 0, w - w * 0.045, h * 0.03);
  M.chromeBar(ctx, w * 0.84, h * 0.44, w * 0.035, h * 0.18, true);
  ctx.fillStyle = '#7d868d';
  M.rr(ctx, w * 0.8, h * 0.455, w * 0.05, h * 0.02, w * 0.008);
  ctx.fill();
  M.rr(ctx, w * 0.8, h * 0.595, w * 0.05, h * 0.02, w * 0.008);
  ctx.fill();
  finish(ctx, w, h, 0.06, 0.12);
}

function entranceScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  M.tiles(ctx, w, h, rnd, { cols: 4, face: '#d8d1c6', grout: '#9d968a', variation: 0.08, bevel: 0.3, gloss: 0.25, rough: 0.6 });
  M.texture(ctx, 0, 0, w, h, 'speckle', 0.4, 1, 'overlay', 50);
  // 현관 매트(코이어)
  M.softShadow(ctx, w * 0.02, w * 0.005, w * 0.01, 0.4, () => {
    ctx.fillStyle = '#9a7b55';
    M.rr(ctx, w * 0.15, h * 0.68, w * 0.7, h * 0.26, w * 0.01);
    ctx.fill();
  });
  M.texture(ctx, w * 0.15, h * 0.68, w * 0.7, h * 0.26, 'pile', 0.7, 1.6, 'overlay', 60);
  ctx.strokeStyle = 'rgba(40,30,20,0.5)';
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.strokeRect(w * 0.18, h * 0.7, w * 0.64, h * 0.22);
  finish(ctx, w, h, 0.1, 0.18);
}

// ───────────────────────── 단독주택: 정원 ─────────────────────────

function patioScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  // 모래 줄눈 위 석재 포장(큰 판석, 톤 편차 큼)
  ctx.fillStyle = '#b9ad98';
  ctx.fillRect(0, 0, w, h);
  M.texture(ctx, 0, 0, w, h, 'speckle', 0.6, 1, 'overlay', 60);
  const cols = 3;
  const tw = w / cols;
  const th = tw * 0.7;
  const gw = w * 0.012;
  let row = 0;
  for (let y = -th * 0.3; y < h; y += th, row++) {
    const off = row % 2 ? -tw / 2 : 0;
    for (let x = off; x < w; x += tw) {
      const tone = ['#c8bfae', '#bdb3a2', '#d2c9b8', '#b4aa98', '#c0b7a6'][Math.floor(rnd() * 5)];
      ctx.fillStyle = tone;
      M.rr(ctx, x + gw, y + gw, tw - gw * 2, th - gw * 2, w * 0.006);
      ctx.fill();
      ctx.save();
      M.rr(ctx, x + gw, y + gw, tw - gw * 2, th - gw * 2, w * 0.006);
      ctx.clip();
      M.texture(ctx, x, y, tw, th, 'plaster', 0.5, 2, 'overlay', 50);
      M.texture(ctx, x, y, tw, th, 'speckle', 0.3, 1, 'overlay', 40);
      // 풍화된 가장자리 그늘
      M.innerShadow(ctx, x + gw, y + gw, tw - gw * 2, th - gw * 2, gw * 2.5, 0.2);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      M.rr(ctx, x + gw + 0.5, y + gw + 0.5, tw - gw * 2 - 1, th - gw * 2 - 1, w * 0.006);
      ctx.stroke();
    }
  }
  // 잔디 가장자리(왼쪽 아래 모서리)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.quadraticCurveTo(w * 0.25, h * 0.7, w * 0.3, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.clip();
  M.grass(ctx, 0, h * 0.55, w * 0.4, h * 0.45, 3);
  ctx.restore();
  // 낙엽 두 장
  for (const [lx, ly, rot, col] of [
    [0.72, 0.3, 0.6, '#b2652b'],
    [0.4, 0.5, -1.1, '#c98a2c'],
  ] as const) {
    ctx.save();
    ctx.translate(w * lx, h * ly);
    ctx.rotate(rot);
    M.softShadow(ctx, w * 0.01, w * 0.003, w * 0.005, 0.4, () => {
      ctx.fillStyle = col;
      M.ellipsePath(ctx, 0, 0, w * 0.04, w * 0.018);
      ctx.fill();
    });
    ctx.strokeStyle = 'rgba(80,40,10,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.04, 0);
    ctx.lineTo(w * 0.045, 0);
    ctx.stroke();
    ctx.restore();
  }
  finish(ctx, w, h, 0.12, 0.16);
}

function deckScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  M.wood(ctx, w, h, rnd, { base: '#b08a62', planks: 6, dir: 'v', gloss: 0.08, knots: 0.07, gap: Math.max(2, w * 0.012), grain: 9, weather: 0.45 });
  // 나사못(장선 줄마다 두 개씩)
  const planks = 6;
  for (let p = 0; p < planks; p++) {
    const px = (w * (p + 0.5)) / planks;
    for (const jy of [0.12, 0.5, 0.88]) {
      for (const dx of [-0.25, 0.25]) {
        const sx = px + (w / planks) * dx;
        const sy = h * jy;
        const g = ctx.createRadialGradient(sx - w * 0.003, sy - w * 0.003, 0, sx, sy, w * 0.009);
        g.addColorStop(0, '#d6d9dc');
        g.addColorStop(0.7, '#7c8388');
        g.addColorStop(1, '#3f4549');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, w * 0.009, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - w * 0.005, sy - w * 0.005);
        ctx.lineTo(sx + w * 0.005, sy + w * 0.005);
        ctx.moveTo(sx + w * 0.005, sy - w * 0.005);
        ctx.lineTo(sx - w * 0.005, sy + w * 0.005);
        ctx.stroke();
      }
    }
  }
  // 화분 그늘 + 잎 한 장
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  M.ellipsePath(ctx, w * 0.85, h * 0.12, w * 0.18, h * 0.06);
  ctx.fill();
  ctx.save();
  ctx.translate(w * 0.3, h * 0.78);
  ctx.rotate(0.4);
  ctx.fillStyle = '#6f9a3c';
  M.ellipsePath(ctx, 0, 0, w * 0.05, w * 0.02);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,60,10,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, 0);
  ctx.lineTo(w * 0.055, 0);
  ctx.stroke();
  ctx.restore();
  finish(ctx, w, h, 0.12, 0.16);
}

function brickScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  // 모르타르
  ctx.fillStyle = '#c9c0b0';
  ctx.fillRect(0, 0, w, h);
  M.texture(ctx, 0, 0, w, h, 'speckle', 0.6, 1, 'overlay', 60);
  const cols = 4;
  const bw = w / cols;
  const bh = bw * 0.42;
  const m = Math.max(2, w * 0.012);
  const reds = ['#b86b4f', '#a85c44', '#c3765a', '#9f5640', '#b27054', '#c88a6a'];
  let row = 0;
  for (let y = -bh * 0.4; y < h; y += bh, row++) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let x = off; x < w; x += bw) {
      const col = reds[Math.floor(rnd() * reds.length)];
      const g = ctx.createLinearGradient(x, y, x + bw * 0.3, y + bh);
      g.addColorStop(0, M.shade(col, 0.1));
      g.addColorStop(1, M.shade(col, -0.12));
      ctx.fillStyle = g;
      M.rr(ctx, x + m / 2, y + m / 2, bw - m, bh - m, w * 0.004);
      ctx.fill();
      ctx.save();
      M.rr(ctx, x + m / 2, y + m / 2, bw - m, bh - m, w * 0.004);
      ctx.clip();
      M.texture(ctx, x, y, bw, bh, 'speckle', 0.45, 1, 'overlay', 56);
      M.texture(ctx, x, y, bw, bh, 'plaster', 0.3, 1.5, 'overlay', 40);
      // 벽돌 아래·오른쪽 그늘(모르타르가 움푹)
      const s = ctx.createLinearGradient(0, y + bh - m * 2.5, 0, y + bh);
      s.addColorStop(0, 'rgba(0,0,0,0)');
      s.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = s;
      ctx.fillRect(x, y, bw, bh);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + m / 2, y + m / 2, bw - m, 1.5);
    }
  }
  // 빗물받이 홈통(오른쪽)
  P.tube(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(w * 0.92, 0);
      ctx.lineTo(w * 0.92, h);
    },
    w * 0.05,
    '#cfd3d6',
  );
  for (const y of [0.18, 0.62]) {
    ctx.fillStyle = '#9aa0a5';
    M.rr(ctx, w * 0.885, h * y, w * 0.07, h * 0.02, w * 0.005);
    ctx.fill();
  }
  finish(ctx, w, h, 0.12, 0.16);
}

function gardenChairScene(ctx: Ctx, w: number, h: number): void {
  M.grass(ctx, 0, 0, w, h, 7);
  const col = '#eceae2';
  // 의자 그림자
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = w * 0.05;
  ctx.shadowOffsetX = w * 0.02;
  ctx.shadowOffsetY = w * 0.04;
  ctx.fillStyle = col;
  M.rr(ctx, w * 0.08, h * 0.04, w * 0.84, h * 0.92, w * 0.08);
  ctx.fill();
  ctx.restore();
  // 등받이(위 38%): 살
  const part = (x: number, y: number, pw: number, ph: number, r: number) => {
    M.rr(ctx, x, y, pw, ph, r);
    M.plastic(ctx, x, y, pw, ph, col, 0.55);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = Math.max(1, w * 0.003);
    M.rr(ctx, x, y, pw, ph, r);
    ctx.stroke();
  };
  part(w * 0.08, h * 0.04, w * 0.84, h * 0.38, w * 0.08);
  for (let k = 0; k < 5; k++) {
    const sy = h * (0.08 + k * 0.064);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    M.rr(ctx, w * 0.16, sy, w * 0.68, h * 0.028, h * 0.014);
    ctx.fill();
    const g = ctx.createLinearGradient(0, sy, 0, sy + h * 0.028);
    g.addColorStop(0, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0.3)');
    ctx.fillStyle = g;
    M.rr(ctx, w * 0.16, sy, w * 0.68, h * 0.028, h * 0.014);
    ctx.fill();
  }
  // 팔걸이
  part(w * 0.08, h * 0.4, w * 0.13, h * 0.5, w * 0.05);
  part(w * 0.79, h * 0.4, w * 0.13, h * 0.5, w * 0.05);
  // 좌판: 배수 구멍 격자
  part(w * 0.21, h * 0.42, w * 0.58, h * 0.54, w * 0.04);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      const hx = w * (0.27 + i * 0.092);
      const hy = h * (0.49 + j * 0.065);
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, w * 0.012);
      g.addColorStop(0, '#5c6a4a');
      g.addColorStop(0.7, '#8f9a7a');
      g.addColorStop(1, 'rgba(255,255,255,0.4)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, w * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 좌판 앞 가장자리 음영
  const eg = ctx.createLinearGradient(0, h * 0.9, 0, h * 0.96);
  eg.addColorStop(0, 'rgba(0,0,0,0)');
  eg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = eg;
  ctx.fillRect(w * 0.21, h * 0.9, w * 0.58, h * 0.06);
  finish(ctx, w, h, 0.1, 0.14);
}

function fenceScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  // 뒤: 잔디·흙(틈으로 보임)
  M.grass(ctx, 0, 0, w, h, 11);
  ctx.fillStyle = 'rgba(40,50,30,0.55)';
  ctx.fillRect(0, 0, w, h * 0.9);
  // 가로 받침대 2개
  for (const ry of [0.2, 0.68]) {
    clipped(ctx, 0, h * ry, w, h * 0.07, () => M.wood(ctx, w, h * 0.07, rnd, { base: '#a08462', planks: 1, dir: 'h', gloss: 0, knots: 0, grain: 3, weather: 0.5 }));
  }
  // 세로 판자(도장)
  const n = 6;
  const gap = w * 0.012;
  const bw = (w - gap * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    const x = k * (bw + gap);
    const top = h * (0.02 + rnd() * 0.02);
    const bottom = h * (0.9 + rnd() * 0.04);
    clipped(ctx, x, top, bw, bottom - top, () => {
      M.paint(ctx, bw, bottom - top, ['#f1efe6', '#ebe8de', '#f4f2ea'][k % 3], 0.9);
      M.texture(ctx, 0, 0, bw, bottom - top, 'brush', 0.3, 1, 'overlay', 30);
      // 페인트 벗겨진 자국·나뭇결 비침
      ctx.strokeStyle = 'rgba(120,95,60,0.18)';
      ctx.lineWidth = Math.max(1, w * 0.002);
      for (let g = 0; g < 5; g++) {
        ctx.beginPath();
        ctx.moveTo(bw * (0.15 + g * 0.17), 0);
        ctx.quadraticCurveTo(bw * (0.15 + g * 0.17) + bw * 0.05, (bottom - top) * 0.5, bw * (0.15 + g * 0.17), bottom - top);
        ctx.stroke();
      }
      // 판자 옆면 음영
      const g = ctx.createLinearGradient(0, 0, bw, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.15, 'rgba(255,255,255,0)');
      g.addColorStop(0.85, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, bw, bottom - top);
    });
    // 판자 위 끝(뾰족·둥근)
    ctx.fillStyle = '#efede4';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + bw / 2, top - h * 0.02);
    ctx.lineTo(x + bw, top);
    ctx.closePath();
    ctx.fill();
    // 못
    for (const ry of [0.235, 0.715]) {
      for (const dx of [0.3, 0.7]) {
        const nx = x + bw * dx;
        const ny = h * ry;
        ctx.fillStyle = '#6b6f73';
        ctx.beginPath();
        ctx.arc(nx, ny, w * 0.006, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(120,70,40,0.4)';
        ctx.fillRect(nx - w * 0.004, ny, w * 0.008, h * 0.03);
      }
    }
  }
  // 바닥 잔디 앞쪽
  M.grass(ctx, 0, h * 0.92, w, h * 0.08, 11);
  finish(ctx, w, h, 0.12, 0.14);
}

function grillScene(ctx: Ctx, w: number, h: number): void {
  // 뚜껑 안쪽(위 12%) 어두운 돔
  const lid = ctx.createLinearGradient(0, 0, 0, h * 0.14);
  lid.addColorStop(0, '#3a3f44');
  lid.addColorStop(1, '#1b1e21');
  ctx.fillStyle = lid;
  ctx.fillRect(0, 0, w, h * 0.14);
  M.chromeBar(ctx, w * 0.3, h * 0.04, w * 0.4, h * 0.035);
  // 화구(그릴 통) 테두리 스테인리스
  M.steel(ctx, w, h, 'h', '#d2d8dd');
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h * 0.14);
  ctx.clip();
  ctx.fillStyle = lid;
  ctx.fillRect(0, 0, w, h * 0.14);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(0, h * 0.14, w, 2);
  // 통 안: 숯·열판(어두움)
  const inX = w * 0.06;
  const inY = h * 0.18;
  const inW = w * 0.88;
  const inH = h * 0.7;
  ctx.fillStyle = '#2a2d30';
  M.rr(ctx, inX, inY, inW, inH, w * 0.02);
  ctx.fill();
  ctx.save();
  M.rr(ctx, inX, inY, inW, inH, w * 0.02);
  ctx.clip();
  // 숯 불빛
  for (let k = 0; k < 9; k++) {
    const cx = inX + inW * (0.1 + (k % 3) * 0.4) + (k * 37) % 50;
    const cy = inY + inH * (0.2 + Math.floor(k / 3) * 0.3);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.09);
    g.addColorStop(0, 'rgba(255,120,40,0.55)');
    g.addColorStop(0.5, 'rgba(180,50,10,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // 석쇠: 가로 봉(스테인리스) + 세로 지지 봉
  const bars = 14;
  for (let k = 0; k < bars; k++) {
    const by = inY + inH * ((k + 0.5) / bars);
    const bh = (inH / bars) * 0.55;
    const g = ctx.createLinearGradient(0, by - bh / 2, 0, by + bh / 2);
    g.addColorStop(0, '#f1f4f6');
    g.addColorStop(0.35, '#b6bec4');
    g.addColorStop(0.7, '#8a9399');
    g.addColorStop(1, '#5a6368');
    M.softShadow(ctx, bh * 0.6, 0, bh * 0.4, 0.5, () => {
      ctx.fillStyle = g;
      M.rr(ctx, inX, by - bh / 2, inW, bh, bh / 2);
      ctx.fill();
    });
  }
  for (const vx of [0.25, 0.5, 0.75]) {
    const g = ctx.createLinearGradient(inX + inW * vx - w * 0.012, 0, inX + inW * vx + w * 0.012, 0);
    g.addColorStop(0, '#6f787e');
    g.addColorStop(0.4, '#e8ecee');
    g.addColorStop(1, '#5a6368');
    ctx.fillStyle = g;
    M.rr(ctx, inX + inW * vx - w * 0.012, inY, w * 0.024, inH, w * 0.012);
    ctx.fill();
  }
  ctx.restore();
  M.innerShadow(ctx, inX, inY, inW, inH, w * 0.03, 0.35);
  // 손잡이(앞) + 온도계
  M.chromeBar(ctx, w * 0.3, h * 0.92, w * 0.4, h * 0.035);
  P.gauge(ctx, w * 0.88, h * 0.94, w * 0.045, 0.35, '#e74c3c');
  finish(ctx, w, h, 0.1, 0.14);
}

// ───────────────────────── 자동차 ─────────────────────────

function carScene(ctx: Ctx, w: number, h: number): void {
  const paint = '#b9c6cf';
  M.carPaint(ctx, w, h, paint, 0.46);
  // 창 하단(위 12%): 어두운 유리 + 몰딩
  const win = ctx.createLinearGradient(0, 0, 0, h * 0.12);
  win.addColorStop(0, '#2f3b45');
  win.addColorStop(1, '#152028');
  ctx.fillStyle = win;
  ctx.fillRect(0, 0, w, h * 0.12);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, 0);
  ctx.lineTo(w * 0.3, 0);
  ctx.lineTo(w * 0.22, h * 0.12);
  ctx.lineTo(w * 0.05, h * 0.12);
  ctx.closePath();
  ctx.fill();
  M.chromeBar(ctx, 0, h * 0.115, w, h * 0.018);
  // 캐릭터 라인(프레스 라인): 밝은 선 + 어두운 선
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.46);
  ctx.quadraticCurveTo(w * 0.5, h * 0.44, w, h * 0.47);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.465);
  ctx.quadraticCurveTo(w * 0.5, h * 0.445, w, h * 0.475);
  ctx.stroke();
  // 문 이음새(세로) — 오른쪽
  const seamX = w * 0.82;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(seamX, h * 0.12, Math.max(2, w * 0.006), h * 0.88);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(seamX + Math.max(2, w * 0.006), h * 0.12, 1.5, h * 0.88);
  // 문 손잡이
  M.softShadow(ctx, w * 0.02, w * 0.005, w * 0.012, 0.45, () => {
    ctx.fillStyle = M.chrome(ctx, 0, h * 0.3, 0, h * 0.35, '#dfe6ec');
    M.rr(ctx, w * 0.52, h * 0.3, w * 0.24, h * 0.05, h * 0.025);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  M.rr(ctx, w * 0.5, h * 0.305, w * 0.08, h * 0.04, h * 0.02);
  ctx.fill();
  // 휠 아치(왼쪽 아래 곡선) + 타이어 어둠
  ctx.save();
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 1.08, w * 0.3, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#121416';
  ctx.fillRect(0, h * 0.7, w * 0.5, h * 0.3);
  M.texture(ctx, 0, h * 0.7, w * 0.5, h * 0.3, 'speckle', 0.4, 1, 'overlay', 40);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(2, w * 0.01);
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 1.08, w * 0.31, 0, Math.PI * 2);
  ctx.stroke();
  // 하단 몰딩(검정 플라스틱)
  ctx.fillStyle = '#1e2224';
  ctx.fillRect(0, h * 0.95, w, h * 0.05);
  M.texture(ctx, 0, h * 0.95, w, h * 0.05, 'speckle', 0.4, 1, 'overlay', 40);
  // 주변 반사(나무·하늘)
  M.sheen(ctx, w, h, 0.12, -0.75, 0.25, 0.25);
  finish(ctx, w, h, 0.06, 0.12);
}

function windshieldScene(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  // 유리 너머: 어두운 실내 반사 + 하늘 반사
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7fb0d8');
  g.addColorStop(0.45, '#c7dde9');
  g.addColorStop(0.7, '#8ea3b2');
  g.addColorStop(1, '#4e5a63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  P.cloud(ctx, w * 0.2, h * 0.12, w * 0.1, 0.6);
  P.cloud(ctx, w * 0.65, h * 0.2, w * 0.08, 0.5);
  // 대시보드 반사(아래쪽 어두운 띠에 비친 송풍구·계기)
  ctx.save();
  ctx.globalAlpha = 0.35;
  P.vent(ctx, w * 0.1, h * 0.72, w * 0.18, h * 0.07);
  P.vent(ctx, w * 0.72, h * 0.72, w * 0.18, h * 0.07);
  ctx.restore();
  // 유리 반사 띠
  M.glass(ctx, w, h, 'rgba(190,215,230,0.1)');
  // 룸미러(위 가운데)
  M.softShadow(ctx, w * 0.02, w * 0.004, w * 0.01, 0.5, () => {
    ctx.fillStyle = '#1b1f23';
    M.rr(ctx, w * 0.36, h * 0.03, w * 0.28, h * 0.09, w * 0.015);
    ctx.fill();
  });
  const mg = ctx.createLinearGradient(w * 0.36, h * 0.03, w * 0.64, h * 0.12);
  mg.addColorStop(0, '#9fb6c4');
  mg.addColorStop(1, '#5a6d7a');
  ctx.fillStyle = mg;
  M.rr(ctx, w * 0.375, h * 0.04, w * 0.25, h * 0.07, w * 0.01);
  ctx.fill();
  ctx.fillStyle = '#1b1f23';
  M.rr(ctx, w * 0.48, 0, w * 0.04, h * 0.04, w * 0.005);
  ctx.fill();
  // 와이퍼 2개(아래)
  P.wiper(ctx, w * 0.08, h * 0.95, w * 0.5, h * 0.78, w * 0.018);
  P.wiper(ctx, w * 0.52, h * 0.95, w * 0.92, h * 0.8, w * 0.018);
  // A필러(양옆 어두운 사선) + 보닛 끝(아래)
  ctx.fillStyle = '#1f2428';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.07, 0);
  ctx.lineTo(w * 0.02, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w * 0.93, 0);
  ctx.lineTo(w * 0.98, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  clipped(ctx, 0, h * 0.955, w, h * 0.045, () => M.carPaint(ctx, w, h * 0.045, '#b9c6cf', 0.5));
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, h * 0.95, w, 3);
  rnd();
  finish(ctx, w, h, 0.05, 0.1);
}

function wheelScene(ctx: Ctx, w: number, h: number): void {
  // 주변: 차체 하단(도장) + 휠 아치 어둠
  M.carPaint(ctx, w, h, '#b9c6cf', 0.3);
  const cx = w * 0.5;
  const cy = h * 0.52;
  const R = Math.min(w, h) * 0.47;
  ctx.fillStyle = '#17191b';
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
  ctx.fill();
  // 타이어
  const tire = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R);
  tire.addColorStop(0, '#2b2e31');
  tire.addColorStop(0.7, '#1a1c1e');
  tire.addColorStop(0.95, '#34383b');
  tire.addColorStop(1, '#101214');
  ctx.fillStyle = tire;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  M.texture(ctx, cx - R, cy - R, R * 2, R * 2, 'speckle', 0.4, 1, 'overlay', 40);
  ctx.restore();
  // 사이드월 양각 띠
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = R * 0.02;
  for (const k of [0.8, 0.86, 0.93]) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 림(알로이) 바탕 + 브레이크 디스크
  const rimR = R * 0.68;
  const disc = ctx.createRadialGradient(cx, cy, rimR * 0.2, cx, cy, rimR);
  disc.addColorStop(0, '#4a5056');
  disc.addColorStop(1, '#23272b');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, rimR, 0, Math.PI * 2);
  ctx.fill();
  // 캘리퍼(빨강, 왼쪽 위)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-2.2);
  ctx.fillStyle = '#c0392b';
  M.rr(ctx, rimR * 0.55, -rimR * 0.22, rimR * 0.3, rimR * 0.44, rimR * 0.06);
  ctx.fill();
  ctx.restore();
  // 스포크 5개 + 림 테두리
  const spokes = 5;
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const sg = ctx.createLinearGradient(0, -rimR * 0.16, 0, rimR * 0.16);
    sg.addColorStop(0, '#f4f6f8');
    sg.addColorStop(0.5, '#c9d0d5');
    sg.addColorStop(1, '#7e878e');
    M.softShadow(ctx, rimR * 0.08, rimR * 0.02, rimR * 0.04, 0.55, () => {
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(rimR * 0.12, -rimR * 0.13);
      ctx.lineTo(rimR * 0.98, -rimR * 0.2);
      ctx.lineTo(rimR * 0.98, rimR * 0.2);
      ctx.lineTo(rimR * 0.12, rimR * 0.13);
      ctx.closePath();
      ctx.fill();
    });
    // 스포크 가운데 홈
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(rimR * 0.3, -rimR * 0.04);
    ctx.lineTo(rimR * 0.9, -rimR * 0.06);
    ctx.lineTo(rimR * 0.9, rimR * 0.06);
    ctx.lineTo(rimR * 0.3, rimR * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // 림 바깥 테두리
  ctx.strokeStyle = M.chrome(ctx, cx - rimR, 0, cx + rimR, 0, '#d9e0e6');
  ctx.lineWidth = rimR * 0.1;
  ctx.beginPath();
  ctx.arc(cx, cy, rimR * 0.97, 0, Math.PI * 2);
  ctx.stroke();
  // 허브 + 너트 + 센터 캡
  const hub = ctx.createRadialGradient(cx - rimR * 0.08, cy - rimR * 0.08, 0, cx, cy, rimR * 0.3);
  hub.addColorStop(0, '#f2f4f6');
  hub.addColorStop(1, '#9aa3ab');
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(cx, cy, rimR * 0.3, 0, Math.PI * 2);
  ctx.fill();
  P.lugNuts(ctx, cx, cy, rimR * 0.21, 5, rimR * 0.045);
  P.emblem(ctx, cx, cy, rimR * 0.1);
  finish(ctx, w, h, 0.08, 0.14);
}

function headlightScene(ctx: Ctx, w: number, h: number): void {
  M.carPaint(ctx, w, h, '#b9c6cf', 0.35);
  // 헤드라이트 하우징(쐐기형) 경로
  const lamp = () => {
    ctx.beginPath();
    ctx.moveTo(w * 0.03, h * 0.34);
    ctx.quadraticCurveTo(w * 0.4, h * 0.24, w * 0.97, h * 0.3);
    ctx.quadraticCurveTo(w * 0.99, h * 0.5, w * 0.95, h * 0.66);
    ctx.quadraticCurveTo(w * 0.5, h * 0.76, w * 0.06, h * 0.7);
    ctx.quadraticCurveTo(w * 0.02, h * 0.5, w * 0.03, h * 0.34);
    ctx.closePath();
  };
  // 보닛 이음선(위) + 범퍼 그릴(아래)
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, h * 0.12, w, Math.max(2, h * 0.005));
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(0, h * 0.12 + Math.max(2, h * 0.005), w, 1.5);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.84);
  ctx.lineTo(w, h * 0.8);
  ctx.lineTo(w, h);
  ctx.lineTo(w * 0.2, h);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#15181b';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  for (let k = 0; k < 4; k++) {
    const gy = h * (0.84 + k * 0.045);
    const gg = ctx.createLinearGradient(0, gy, 0, gy + h * 0.025);
    gg.addColorStop(0, '#6c757c');
    gg.addColorStop(1, '#2d3338');
    ctx.fillStyle = gg;
    ctx.fillRect(w * 0.2, gy, w, h * 0.025);
  }
  ctx.restore();
  // 하우징 틈(검은 테두리)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = w * 0.03;
  ctx.fillStyle = '#0e1114';
  lamp();
  ctx.fill();
  ctx.restore();
  ctx.save();
  lamp();
  ctx.clip();
  // 안쪽: 반사판(검정 크롬 보울) + 프로젝터 렌즈 + LED 띠
  const inner = ctx.createLinearGradient(w * 0.1, h * 0.1, w * 0.9, h * 0.9);
  inner.addColorStop(0, '#2b3238');
  inner.addColorStop(0.5, '#4f5a63');
  inner.addColorStop(1, '#1c2126');
  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, w, h);
  // 반사 보울 2개
  for (const [bx, by, br] of [
    [0.3, 0.5, 0.15],
    [0.62, 0.48, 0.11],
  ]) {
    const g = ctx.createRadialGradient(w * bx - w * br * 0.4, h * by - w * br * 0.4, w * br * 0.1, w * bx, h * by, w * br);
    g.addColorStop(0, '#f3f6f8');
    g.addColorStop(0.35, '#9fabb4');
    g.addColorStop(0.7, '#3e474e');
    g.addColorStop(1, '#0f1316');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w * bx, h * by, w * br, 0, Math.PI * 2);
    ctx.fill();
    // 보울 안 동심 링
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(1, w * 0.003);
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(w * bx, h * by, (w * br * k) / 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 프로젝터 렌즈(볼록 유리)
    const lg = ctx.createRadialGradient(w * bx - w * br * 0.15, h * by - w * br * 0.15, 0, w * bx, h * by, w * br * 0.45);
    lg.addColorStop(0, 'rgba(230,245,255,0.95)');
    lg.addColorStop(0.5, 'rgba(120,160,200,0.9)');
    lg.addColorStop(1, 'rgba(20,40,70,0.95)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(w * bx, h * by, w * br * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // LED 주간등(위쪽 띠, 빛남)
  ctx.save();
  ctx.shadowColor = 'rgba(210,235,255,0.9)';
  ctx.shadowBlur = w * 0.03;
  ctx.strokeStyle = '#eaf6ff';
  ctx.lineWidth = w * 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.37);
  ctx.quadraticCurveTo(w * 0.45, h * 0.3, w * 0.92, h * 0.34);
  ctx.stroke();
  ctx.restore();
  // 렌즈(투명 플라스틱): 세로 굴절 리브 + 반사
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#ffffff';
  for (let x = w * 0.08; x < w * 0.96; x += w * 0.03) ctx.fillRect(x, 0, w * 0.006, h);
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, w * 0.004);
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(w * (0.15 + k * 0.2), h * 0.76);
    ctx.lineTo(w * (0.35 + k * 0.2), h * 0.24);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  M.glass(ctx, w, h, 'rgba(200,225,240,0.12)');
  ctx.restore();
  // 하우징 테두리 하이라이트
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  lamp();
  ctx.stroke();
  finish(ctx, w, h, 0.08, 0.12);
}

function seatScene(ctx: Ctx, w: number, h: number): void {
  const base = '#b4b9bd';
  const bolster = '#7f868c';
  M.fabric(ctx, 0, 0, w, h, bolster, 'weave');
  // 헤드레스트
  M.softShadow(ctx, w * 0.02, 0, w * 0.012, 0.4, () => {
    M.rr(ctx, w * 0.3, h * 0.02, w * 0.4, h * 0.13, w * 0.05);
    ctx.fillStyle = bolster;
    ctx.fill();
  });
  ctx.save();
  M.rr(ctx, w * 0.3, h * 0.02, w * 0.4, h * 0.13, w * 0.05);
  ctx.clip();
  M.fabric(ctx, w * 0.3, h * 0.02, w * 0.4, h * 0.13, base, 'weave');
  M.innerShadow(ctx, w * 0.3, h * 0.02, w * 0.4, h * 0.13, w * 0.04, 0.3);
  ctx.restore();
  for (const dx of [0.42, 0.58]) {
    ctx.fillStyle = M.chrome(ctx, w * dx - w * 0.012, 0, w * dx + w * 0.012, 0);
    ctx.fillRect(w * dx - w * 0.012, h * 0.15, w * 0.024, h * 0.04);
  }
  // 등받이 가운데 패널(밝은 패브릭) + 볼스터(어두움)
  const panel = (x: number, y: number, pw: number, ph: number, r: number, ribs: number) => {
    M.softShadow(ctx, w * 0.02, w * 0.004, w * 0.01, 0.4, () => {
      ctx.fillStyle = base;
      M.rr(ctx, x, y, pw, ph, r);
      ctx.fill();
    });
    ctx.save();
    M.rr(ctx, x, y, pw, ph, r);
    ctx.clip();
    M.fabric(ctx, x, y, pw, ph, base, 'weave');
    // 세로 누빔 골
    for (let k = 1; k < ribs; k++) {
      const rx = x + (pw * k) / ribs;
      const g = ctx.createLinearGradient(rx - pw * 0.05, 0, rx + pw * 0.05, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.22)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(rx - pw * 0.05, y, pw * 0.1, ph);
    }
    M.innerShadow(ctx, x, y, pw, ph, w * 0.05, 0.28);
    ctx.restore();
    P.stitch(
      ctx,
      () => {
        M.rr(ctx, x + w * 0.015, y + w * 0.015, pw - w * 0.03, ph - w * 0.03, r * 0.8);
      },
      Math.max(1.5, w * 0.004),
    );
  };
  panel(w * 0.2, h * 0.2, w * 0.6, h * 0.42, w * 0.04, 3);
  // 등받이 볼스터 하이라이트
  for (const [x, flip] of [
    [0.06, 0],
    [0.8, 1],
  ] as const) {
    const g = ctx.createLinearGradient(w * x, 0, w * x + w * 0.14, 0);
    g.addColorStop(0, flip ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.28)');
    g.addColorStop(1, flip ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(w * x, h * 0.18, w * 0.14, h * 0.46);
  }
  // 좌판
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, h * 0.64, w, h * 0.012);
  panel(w * 0.16, h * 0.67, w * 0.68, h * 0.28, w * 0.04, 3);
  // 안전벨트 버클(오른쪽 아래)
  M.softShadow(ctx, w * 0.015, w * 0.004, w * 0.008, 0.45, () => {
    ctx.fillStyle = '#2a2e32';
    M.rr(ctx, w * 0.86, h * 0.72, w * 0.1, h * 0.14, w * 0.012);
    ctx.fill();
  });
  ctx.fillStyle = '#d64545';
  M.rr(ctx, w * 0.885, h * 0.75, w * 0.05, h * 0.03, w * 0.006);
  ctx.fill();
  finish(ctx, w, h, 0.1, 0.16);
}

function dashboardScene(ctx: Ctx, w: number, h: number): void {
  const vin = '#aaa79e';
  M.vinyl(ctx, 0, 0, w, h, vin, 0.25);
  // 위쪽(앞유리 아래) 어두운 띠 + 반사
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.14);
  top.addColorStop(0, 'rgba(0,0,0,0.35)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.14);
  // 송풍구 2개
  P.vent(ctx, w * 0.06, h * 0.16, w * 0.22, h * 0.09);
  P.vent(ctx, w * 0.72, h * 0.16, w * 0.22, h * 0.09);
  // 계기판(검은 후드 안 두 계기)
  M.softShadow(ctx, w * 0.02, 0, w * 0.01, 0.5, () => {
    ctx.fillStyle = '#1a1d20';
    M.rr(ctx, w * 0.04, h * 0.3, w * 0.5, h * 0.2, w * 0.03);
    ctx.fill();
  });
  P.gauge(ctx, w * 0.17, h * 0.4, w * 0.085, 0.3, '#ff6a3d');
  P.gauge(ctx, w * 0.4, h * 0.4, w * 0.085, 0.55, '#4fa3ff');
  // 인포테인먼트 화면
  P.infoScreen(ctx, w * 0.58, h * 0.3, w * 0.38, h * 0.22);
  // 센터 콘솔 버튼·다이얼
  for (let k = 0; k < 3; k++) P.knob(ctx, w * (0.64 + k * 0.13), h * 0.6, w * 0.03, -Math.PI / 2 + k * 0.5);
  ctx.fillStyle = '#2d3135';
  M.rr(ctx, w * 0.58, h * 0.66, w * 0.38, h * 0.05, w * 0.008);
  ctx.fill();
  for (let k = 0; k < 5; k++) {
    ctx.fillStyle = k === 2 ? '#4fa3ff' : '#8c9399';
    M.rr(ctx, w * (0.6 + k * 0.072), h * 0.675, w * 0.05, h * 0.02, w * 0.004);
    ctx.fill();
  }
  // 글로브박스 이음선(오른쪽 아래)
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(w * 0.56, h * 0.78, w * 0.44, 2);
  ctx.fillRect(w * 0.56, h * 0.78, 2, h * 0.22);
  // 스티어링 휠(왼쪽 아래 일부, 가죽 링)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, h * 0.52, w * 0.56, h * 0.48);
  ctx.clip();
  M.softShadow(ctx, w * 0.03, w * 0.01, w * 0.02, 0.5, () => {
    ctx.strokeStyle = '#1f2326';
    ctx.lineWidth = w * 0.07;
    ctx.beginPath();
    ctx.arc(w * 0.26, h * 0.98, w * 0.3, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = w * 0.012;
  ctx.beginPath();
  ctx.arc(w * 0.26, h * 0.98, w * 0.325, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  P.stitch(
    ctx,
    () => {
      ctx.beginPath();
      ctx.arc(w * 0.26, h * 0.98, w * 0.3, Math.PI * 1.05, Math.PI * 1.95);
    },
    Math.max(1.5, w * 0.004),
    'rgba(200,170,120,0.8)',
  );
  ctx.restore();
  finish(ctx, w, h, 0.1, 0.16);
}

function floorMatScene(ctx: Ctx, w: number, h: number): void {
  // 주변 카펫(어두운 회색) + 페달
  M.carpet(ctx, 0, 0, w, h, '#4b4f53');
  const pedal = (x: number, pw: number) => {
    M.softShadow(ctx, w * 0.02, w * 0.005, w * 0.012, 0.5, () => {
      ctx.fillStyle = '#1d2023';
      M.rr(ctx, x, h * 0.03, pw, h * 0.12, w * 0.01);
      ctx.fill();
    });
    M.rubber(ctx, x, h * 0.03, pw, h * 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.01, h * 0.03 + (h * 0.12 * k) / 5);
      ctx.lineTo(x + pw - w * 0.01, h * 0.03 + (h * 0.12 * k) / 5);
      ctx.stroke();
    }
  };
  pedal(w * 0.18, w * 0.26);
  pedal(w * 0.56, w * 0.14);
  // 매트(고무, 밝은 회색) — 테두리 둑 + 골
  const mx = w * 0.06;
  const my = h * 0.2;
  const mw = w * 0.88;
  const mh = h * 0.76;
  const matCol = '#8f9398';
  M.softShadow(ctx, w * 0.03, w * 0.006, w * 0.014, 0.5, () => {
    ctx.fillStyle = matCol;
    M.rr(ctx, mx, my, mw, mh, w * 0.03);
    ctx.fill();
  });
  ctx.save();
  M.rr(ctx, mx, my, mw, mh, w * 0.03);
  ctx.clip();
  M.rubber(ctx, mx, my, mw, mh, matCol);
  // 골(가로 리브)
  const ribs = 22;
  for (let k = 0; k < ribs; k++) {
    const ry = my + mh * 0.08 + (mh * 0.84 * k) / ribs;
    const rh = (mh * 0.84) / ribs;
    const g = ctx.createLinearGradient(0, ry, 0, ry + rh);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(mx + mw * 0.06, ry, mw * 0.88, rh);
  }
  // 발꿈치 패드
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  M.rr(ctx, mx + mw * 0.25, my + mh * 0.42, mw * 0.4, mh * 0.3, w * 0.02);
  ctx.fill();
  M.texture(ctx, mx + mw * 0.25, my + mh * 0.42, mw * 0.4, mh * 0.3, 'speckle', 0.6, 0.8, 'overlay', 60);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = Math.max(1, w * 0.003);
  M.rr(ctx, mx + mw * 0.25, my + mh * 0.42, mw * 0.4, mh * 0.3, w * 0.02);
  ctx.stroke();
  // 테두리 둑
  M.innerShadow(ctx, mx, my, mw, mh, w * 0.06, 0.3);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  M.rr(ctx, mx + w * 0.03, my + w * 0.03, mw - w * 0.06, mh - w * 0.06, w * 0.02);
  ctx.stroke();
  // 고정 클립
  for (const cx of [0.3, 0.7]) {
    ctx.fillStyle = '#1b1e21';
    ctx.beginPath();
    ctx.arc(w * cx, my + h * 0.03, w * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
  finish(ctx, w, h, 0.1, 0.16);
}

function trunkScene(ctx: Ctx, w: number, h: number): void {
  M.carpet(ctx, 0, 0, w, h, '#8a8d8a');
  // 양옆 플라스틱 트림
  for (const [x, flip] of [
    [0, 0],
    [w * 0.9, 1],
  ] as const) {
    ctx.beginPath();
    ctx.rect(x, 0, w * 0.1, h);
    M.plastic(ctx, x, 0, w * 0.1, h, '#3f4448', 0.2);
    const g = ctx.createLinearGradient(x, 0, x + w * 0.1, 0);
    g.addColorStop(0, flip ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.1)');
    g.addColorStop(1, flip ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w * 0.1, h);
  }
  // 바닥판 이음선(스페어타이어 커버) + 당김 손잡이
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(w * 0.1, h * 0.3, w * 0.8, 2);
  M.softShadow(ctx, w * 0.015, w * 0.004, w * 0.008, 0.45, () => {
    ctx.fillStyle = '#2b2f33';
    M.rr(ctx, w * 0.42, h * 0.33, w * 0.16, h * 0.05, h * 0.025);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  M.rr(ctx, w * 0.45, h * 0.34, w * 0.1, h * 0.012, h * 0.006);
  ctx.fill();
  // 고정 고리(D링) 4개
  for (const [rx, ry] of [
    [0.16, 0.42],
    [0.84, 0.42],
    [0.16, 0.86],
    [0.84, 0.86],
  ]) {
    const x = w * rx;
    const y = h * ry;
    ctx.fillStyle = '#1f2327';
    M.rr(ctx, x - w * 0.035, y - w * 0.03, w * 0.07, w * 0.06, w * 0.008);
    ctx.fill();
    ctx.strokeStyle = M.chrome(ctx, x - w * 0.03, 0, x + w * 0.03, 0, '#d9dee3');
    ctx.lineWidth = w * 0.012;
    ctx.beginPath();
    ctx.arc(x, y, w * 0.022, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  // 그물망(카고넷) 일부(오른쪽 위)
  ctx.strokeStyle = 'rgba(20,20,20,0.55)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.save();
  ctx.beginPath();
  ctx.rect(w * 0.55, h * 0.05, w * 0.35, h * 0.2);
  ctx.clip();
  for (let k = -6; k < 12; k++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.55 + k * w * 0.05, h * 0.05);
    ctx.lineTo(w * 0.55 + k * w * 0.05 + w * 0.2, h * 0.25);
    ctx.moveTo(w * 0.55 + k * w * 0.05 + w * 0.2, h * 0.05);
    ctx.lineTo(w * 0.55 + k * w * 0.05, h * 0.25);
    ctx.stroke();
  }
  ctx.restore();
  // 트렁크 문턱(스커프 플레이트)
  clipped(ctx, 0, h * 0.92, w, h * 0.08, () => M.steel(ctx, w, h * 0.08, 'h', '#cfd5da'));
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, h * 0.92, w, 3);
  finish(ctx, w, h, 0.08, 0.16);
}
