// 판마다 다른 배경 — 같은 장면이 여러 판에 쓰여도 판마다 색·방향이 달라 보이게 한다.
//  · 어떤 장면이 처음 나오는 판은 원래 그림 그대로, 두 번째부터는 표면 재질에 맞는 색 변형을 차례로 입힌다
//    (나무는 호두·애쉬·체리처럼, 천·페인트는 색 자체가, 타일·도기는 은은한 색조가 바뀐다)
//  · 홀수 번째 반복은 좌우도 뒤집는다(글자·계기가 있는 장면과 구역 판은 제외 — 구역은 오염 위치와 맞아야 한다)
//  · 결정적: 같은 판은 언제나 같은 그림. 오염 배치·난이도에는 영향이 없다(그림만 바뀐다)
import type { SurfaceType } from '../game/catalog';
import { LEVELS, type LevelDef, type SceneId } from '../game/levels';

export interface Look {
  /** 색상 회전(도) */
  hue: number
  /** 채도 배수 */
  sat: number
  /** 밝기 배수 */
  light: number
  /** 곱해 입히는 색조 [r, g, b, 세기 0..1] */
  tint?: [number, number, number, number]
}

const PLAIN: Look = { hue: 0, sat: 1, light: 1 };

/** 나무: 색상은 조금만, 밝기·채도로 수종이 달라 보이게. 오염이 잘 보이도록 너무 어둡게는 하지 않는다 */
const WOOD: Look[] = [
  { hue: -6, sat: 0.9, light: 0.82 }, // 호두
  { hue: 8, sat: 0.5, light: 1.08 }, // 애쉬
  { hue: -14, sat: 1.2, light: 0.9 }, // 체리
  { hue: 0, sat: 0.25, light: 0.97 }, // 회색 워시
  { hue: 12, sat: 1.25, light: 1.02 }, // 허니 오크
];
/** 천·페인트·플라스틱·비닐: 색 자체를 바꾼다(회색 천도 물들도록 색조를 함께 곱한다) */
const COLOR: Look[] = [
  { hue: 150, sat: 0.9, light: 1, tint: [176, 206, 240, 0.6] }, // 블루
  { hue: -80, sat: 0.9, light: 1, tint: [244, 200, 206, 0.6] }, // 로즈
  { hue: 55, sat: 0.85, light: 1.02, tint: [190, 226, 196, 0.6] }, // 세이지
  { hue: -150, sat: 0.9, light: 1, tint: [246, 224, 176, 0.6] }, // 머스터드
  { hue: 100, sat: 0.8, light: 0.98, tint: [214, 200, 238, 0.6] }, // 라벤더
];
/** 타일·도기·돌·유리·금속: 무채색에 가까우니 색조를 곱한다 */
const TINT: Look[] = [
  { hue: 0, sat: 1, light: 1, tint: [255, 222, 178, 0.7] }, // 따뜻한 베이지
  { hue: 0, sat: 1, light: 1, tint: [170, 228, 208, 0.7] }, // 민트
  { hue: 0, sat: 1, light: 1, tint: [178, 200, 246, 0.7] }, // 푸른 회색
  { hue: 0, sat: 1, light: 1, tint: [246, 196, 208, 0.65] }, // 로즈
  { hue: 0, sat: 1, light: 0.94, tint: [206, 196, 240, 0.65] }, // 라벤더
];
/** 벽돌: 붉은 기를 유지한 채 */
const BRICK: Look[] = [
  { hue: 14, sat: 0.75, light: 1.08 }, // 샌드
  { hue: -10, sat: 1.1, light: 0.84 }, // 짙은 적벽돌
  { hue: 0, sat: 0.3, light: 0.97 }, // 회벽돌
  { hue: 22, sat: 0.9, light: 0.97 }, // 황토
];

const BY_SURFACE: Record<SurfaceType, Look[]> = {
  wood: WOOD,
  fabric: COLOR,
  paint: COLOR,
  plastic: COLOR,
  vinyl: COLOR,
  tile: TINT,
  ceramic: TINT,
  stone: TINT,
  glass: TINT,
  steel: TINT,
  metal: TINT,
  brick: BRICK,
};

/** 좌우를 뒤집어도 어색하지 않은 장면(글자·숫자·계기·손잡이 방향이 없는 것) */
const FLIP_OK = new Set<SceneId>(['floor', 'sofa', 'rug', 'bed', 'table', 'kitchenTile', 'bathTile', 'bathtub', 'patio', 'deck', 'brickWall', 'fence', 'gardenChair', 'window', 'mirror', 'showerglass', 'seat', 'floorMat']);

let repeats: Map<number, number> | null = null;

/** 이 판의 장면이 앞선 판에서 몇 번 쓰였는가 (0 = 처음) */
export function sceneRepeat(level: LevelDef): number {
  if (!repeats) {
    repeats = new Map();
    const seen = new Map<SceneId, number>();
    for (const lv of LEVELS) {
      const n = seen.get(lv.scene) ?? 0;
      repeats.set(lv.id, n);
      seen.set(lv.scene, n + 1);
    }
  }
  return repeats.get(level.id) ?? 0;
}

/** n번째 반복의 색 변형 (0 = 원래 그림) */
export function lookFor(surface: SurfaceType, n: number): Look {
  if (n <= 0) return PLAIN;
  const list = BY_SURFACE[surface];
  return list[(n - 1) % list.length];
}

/** 구역이 없는 판의 변형 */
export function levelLook(level: LevelDef): { look: Look; flip: boolean } {
  const n = sceneRepeat(level);
  return { look: lookFor(level.surface, n), flip: n % 2 === 1 && FLIP_OK.has(level.scene) };
}

/** 구역 판의 구역별 변형 — 구역마다 한 칸씩 어긋나게 골라 같은 조합이 되풀이되지 않게 한다 */
export function zoneLook(level: LevelDef, zoneIndex: number, surface: SurfaceType): Look {
  const n = sceneRepeat(level);
  return n <= 0 ? PLAIN : lookFor(surface, n + zoneIndex);
}

export function isPlain(look: Look): boolean {
  return look.hue === 0 && look.sat === 1 && look.light === 1 && !look.tint;
}

/** 색상 회전·채도·밝기를 한 번에 하는 3×3 행렬 (CSS hue-rotate·saturate 와 같은 식) */
export function lookMatrix(look: Look): number[] {
  const a = (look.hue * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const h = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
  const k = look.sat;
  const m = [
    0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k,
    0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k,
    0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k,
  ];
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) out[r * 3 + q] = (m[r * 3] * h[q] + m[r * 3 + 1] * h[3 + q] + m[r * 3 + 2] * h[6 + q]) * look.light;
  return out;
}

/** RGBA 바이트 배열에 변형을 입힌다 (알파는 그대로) */
export function applyLook(px: Uint8ClampedArray, look: Look): void {
  const m = lookMatrix(look);
  const t = look.tint;
  const tr = t ? 1 - t[3] + (t[3] * t[0]) / 255 : 1;
  const tg = t ? 1 - t[3] + (t[3] * t[1]) / 255 : 1;
  const tb = t ? 1 - t[3] + (t[3] * t[2]) / 255 : 1;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    px[i] = (m[0] * r + m[1] * g + m[2] * b) * tr;
    px[i + 1] = (m[3] * r + m[4] * g + m[5] * b) * tg;
    px[i + 2] = (m[6] * r + m[7] * g + m[8] * b) * tb;
  }
}

/** 캔버스의 한 영역에 변형을 입힌다 */
export function recolor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, look: Look): void {
  if (isPlain(look) || w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x, y, w, h);
  applyLook(img.data, look);
  ctx.putImageData(img, x, y);
}
