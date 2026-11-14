// 렌더러 — 깨끗한 장면 위에 고해상도 오염 질감(종류별 텍스처 × 격자 마스크), 세정제 거품, 파편·반짝임·콤보, 닦는 자국(광), 전체 칙칙함 → 밝아짐, 도구 커서, 전후 리빌
import { DIRT_TYPES, type ItemSpec } from '../game/catalog';
import type { CleanSession } from '../game/engine';
import { DEBRIS, makeGrimeTexture } from './grime';
import { makeResidueTexture, sprayLook, type SprayStyle } from './sprayfx';
import { paintLevel } from './scene';
import { levelPhotoKey, loadScenePhotos } from './photos';

interface Sparkle {
  x: number;
  y: number;
  life: number;
  size: number;
  hue: number;
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
  shape: 'puff' | 'speck' | 'chip' | 'strand' | 'drop' | 'bubble' | 'tuft' | 'flash' | 'dot';
  suck: boolean;
}

interface TrailPt {
  x: number;
  y: number;
  t: number;
  r: number;
  wet: boolean;
}

/** 마스크 세부 해상도 — 격자 한 칸을 MS×MS 로 쪼개 가장자리를 울퉁불퉁하게 */
const MS = 3;
/** 오염층 최대 픽셀 수 (휴대폰 성능) */
const LAYER_MAX_PX = 1.15e6;
const LIQUID = new Set(['hose', 'rinse', 'washer', 'steam']);
const BRUSHY = new Set(['scrubpad', 'tilebrush', 'deckbrush', 'wheelbrush']);
const SUCKY = new Set(['vacuum', 'lintroller']);

function smooth(a: number): number {
  // 완만한 곡선: 얼룩 가장자리(옅은 칸)는 자연스럽게 번지고, 닦여 옅어진 칸은 잔여로 남다가 사라진다
  if (a <= 0.03) return 0;
  return Math.min(1, Math.pow(a, 0.65) * 1.2);
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private layer = document.createElement('canvas');
  private tmp = document.createElement('canvas');
  private foamMask = document.createElement('canvas');
  private gloss = document.createElement('canvas');
  private snap = document.createElement('canvas');
  private masks = new Map<number, { canvas: HTMLCanvasElement; img: ImageData }>();
  private textures = new Map<number, HTMLCanvasElement>();
  private foamTex = new Map<SprayStyle, HTMLCanvasElement>();
  private lastSprayFx = 0;
  private foamImg: ImageData | null = null;
  private glossImg: ImageData | null = null;
  private glossCount = -1;
  private subNoise: Float32Array | null = null;
  private warpX: Float32Array | null = null;
  private warpY: Float32Array | null = null;
  private layerVersion = -1;
  private layerAt = 0;
  private sparkles: Sparkle[] = [];
  private debris: Debris[] = [];
  private trail: TrailPt[] = [];
  private session: CleanSession | null = null;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private shakeUntil = 0;
  private reveal: { t: number; done: () => void } | null = null;
  private hasSnap = false;
  private sweepT = -1;
  private lastClean = 0;
  private hotUntil = 0;
  private prevCursor: { x: number; y: number } | null = null;
  cursor: { x: number; y: number; item: ItemSpec; active: boolean } | null = null;
  /** 콤보 단계(0~) — 반짝임 양과 색에 반영 */
  combo = 0;
  /** 정전 모드: 손전등 반경(칸) 밖은 어둡게 */
  dark = false;
  /** 25·50·75% 를 넘을 때 (소리용) */
  onMilestone: ((frac: number) => void) | null = null;
  private flashlight: { x: number; y: number } | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setSession(s: CleanSession) {
    this.session = s;
    this.foamMask.width = s.w;
    this.foamMask.height = s.h;
    this.gloss.width = s.w;
    this.gloss.height = s.h;
    this.foamImg = this.foamMask.getContext('2d')!.createImageData(s.w, s.h);
    this.glossImg = this.gloss.getContext('2d')!.createImageData(s.w, s.h);
    this.glossCount = -1;
    this.masks.clear();
    this.textures.clear();
    this.foamTex.clear();
    this.layerVersion = -1;
    this.sparkles = [];
    this.debris = [];
    this.trail = [];
    this.reveal = null;
    this.hasSnap = false;
    this.combo = 0;
    this.dark = s.level.mode === 'dark';
    this.flashlight = null;
    this.sweepT = -1;
    this.lastClean = 0;
    this.prevCursor = null;
    // 세부 노이즈(농담)와 가장자리 흔들기(샘플 위치 비틀기) — 값 노이즈를 보간해 블록 느낌 없이 울퉁불퉁한 얼룩 윤곽
    let seed = (s.level.seed * 2654435761) >>> 0;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const MW = s.w * MS;
    const MH = s.h * MS;
    const valueNoise = (cellsPerKnot: number, lo: number, hi: number): Float32Array => {
      const kw = Math.ceil(s.w / cellsPerKnot) + 2;
      const kh = Math.ceil(s.h / cellsPerKnot) + 2;
      const knots = new Float32Array(kw * kh);
      for (let i = 0; i < knots.length; i++) knots[i] = lo + rnd() * (hi - lo);
      const out = new Float32Array(MW * MH);
      for (let sy = 0; sy < MH; sy++) {
        const py = (sy + 0.5) / MS / cellsPerKnot;
        const y0 = Math.floor(py);
        const fy = py - y0;
        const ty = fy * fy * (3 - 2 * fy);
        for (let sx = 0; sx < MW; sx++) {
          const px = (sx + 0.5) / MS / cellsPerKnot;
          const x0 = Math.floor(px);
          const fx = px - x0;
          const tx = fx * fx * (3 - 2 * fx);
          const a = knots[y0 * kw + x0];
          const b = knots[y0 * kw + x0 + 1];
          const c = knots[(y0 + 1) * kw + x0];
          const d = knots[(y0 + 1) * kw + x0 + 1];
          out[sy * MW + sx] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
        }
      }
      return out;
    };
    this.subNoise = valueNoise(1, 0.62, 1.12);
    this.warpX = valueNoise(1.5, -0.55, 0.55);
    this.warpY = valueNoise(1.5, -0.55, 0.55);
    this.resize();
    // 이 판에 나오는 오염 질감을 미리 만들어 둔다 (플레이 중 끊김 방지)
    const types = new Set<number>();
    for (let i = 0; i < s.amount.length; i++) {
      if (s.amount[i] > 0) types.add(s.type[i]);
      if (s.under[i] > 0) types.add(s.underType[i]);
    }
    for (const p of s.level.patches) types.add(DIRT_TYPES.indexOf(p.type));
    if (s.level.spawn) types.add(DIRT_TYPES.indexOf(s.level.spawn.type));
    for (const ti of types) if (ti >= 0) this.texture(ti);
  }

  /** 컨테이너 크기에 맞춰 격자 비율 캔버스 */
  resize() {
    const s = this.session;
    const parent = this.canvas.parentElement;
    if (!s || !parent) return;
    const availW = parent.clientWidth;
    const availH = parent.clientHeight;
    const ratio = s.w / s.h;
    let w = availW;
    let h = w / ratio;
    if (h > availH) {
      h = availH;
      w = h * ratio;
    }
    this.cssW = Math.floor(w);
    this.cssH = Math.floor(h);
    // 배율 3배는 자동 검사에서 시간 제한 판이 느려져 실패했다 — 실제 기기에서 속도를 확인하기 전까지 2배 유지
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.canvas.width = Math.floor(this.cssW * this.dpr);
    this.canvas.height = Math.floor(this.cssH * this.dpr);
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    paintLevel(this.base.getContext('2d')!, s.level, this.base.width, this.base.height);
    // 실사 사진이 뒤늦게 도착하면 바탕만 다시 그린다
    const lv = s.level;
    void loadScenePhotos([levelPhotoKey(lv.id), ...(lv.zones ? lv.zones.map((z) => z.scene) : [lv.scene])]).then((fresh) => {
      if (!fresh || this.session?.level !== lv || !this.base.width) return;
      paintLevel(this.base.getContext('2d')!, lv, this.base.width, this.base.height);
      this.hasSnap = false;
    });
    // 오염층 해상도 (상한 적용)
    const scale = Math.min(1, Math.sqrt(LAYER_MAX_PX / (this.canvas.width * this.canvas.height)));
    this.layer.width = Math.max(1, Math.round(this.canvas.width * scale));
    this.layer.height = Math.max(1, Math.round(this.canvas.height * scale));
    this.tmp.width = this.layer.width;
    this.tmp.height = this.layer.height;
    this.textures.clear();
    this.foamTex.clear();
    this.layerVersion = -1;
    this.hasSnap = false;
  }

  /** 화면 좌표 → 격자 좌표 */
  toGrid(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const s = this.session!;
    return { x: ((clientX - r.left) / r.width) * s.w, y: ((clientY - r.top) / r.height) * s.h };
  }

  private texture(typeIdx: number): HTMLCanvasElement {
    let t = this.textures.get(typeIdx);
    if (!t) {
      const s = this.session!;
      t = makeGrimeTexture(DIRT_TYPES[typeIdx], this.layer.width, this.layer.height, s.level.seed + typeIdx * 17, this.layer.width / s.w);
      this.textures.set(typeIdx, t);
    }
    return t;
  }

  private mask(typeIdx: number): { canvas: HTMLCanvasElement; img: ImageData } {
    let m = this.masks.get(typeIdx);
    if (!m) {
      const s = this.session!;
      const canvas = document.createElement('canvas');
      canvas.width = s.w * MS;
      canvas.height = s.h * MS;
      m = { canvas, img: canvas.getContext('2d')!.createImageData(s.w * MS, s.h * MS) };
      this.masks.set(typeIdx, m);
    }
    return m;
  }

  /** 지워진 칸에서 반짝임 + 종류별 파편 — 콤보가 높을수록 많이, 황금빛으로 */
  burst(cells: number[]) {
    const s = this.session!;
    if (!cells.length) return;
    this.hotUntil = performance.now() + 160;
    const max = Math.min(cells.length, 5 + Math.min(10, this.combo));
    for (let k = 0; k < max; k++) {
      const i = cells[Math.floor(Math.random() * cells.length)];
      this.sparkles.push({ x: (i % s.w) + 0.5, y: Math.floor(i / s.w) + 0.5, life: 1, size: 0.6 + Math.random() * (0.9 + this.combo * 0.08), hue: this.combo >= 5 ? 48 : 200 });
    }
    if (this.sparkles.length > 220) this.sparkles.splice(0, this.sparkles.length - 220);
    // 파편: 닦는 방향으로 튀고(걸레·솔), 청소기류는 커서로 빨려 들어감
    const item = this.cursor?.item;
    const suck = Boolean(item && item.kind === 'tool' && item.families.some((f) => SUCKY.has(f)));
    let dx = 0;
    let dy = 0;
    if (this.cursor && this.prevCursor) {
      dx = this.cursor.x - this.prevCursor.x;
      dy = this.cursor.y - this.prevCursor.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }
    const sample = Math.min(cells.length, 26);
    for (let k = 0; k < sample; k++) {
      const i = cells[Math.floor(Math.random() * cells.length)];
      const type = DIRT_TYPES[s.type[i]];
      const st = DEBRIS[type];
      const n = Math.random() < st.count ? Math.ceil(st.count) : Math.floor(st.count);
      for (let q = 0; q < n; q++) {
        const a = Math.random() * Math.PI * 2;
        const sp = st.speed * (0.4 + Math.random() * 0.9);
        this.debris.push({
          x: (i % s.w) + Math.random(),
          y: Math.floor(i / s.w) + Math.random(),
          vx: Math.cos(a) * sp + dx * sp * 1.4,
          vy: Math.sin(a) * sp + dy * sp * 1.4 - (st.shape === 'chip' || st.shape === 'speck' ? sp * 0.6 : 0),
          g: st.gravity,
          life: st.life * (0.7 + Math.random() * 0.6),
          max: st.life,
          size: st.size * (0.6 + Math.random() * 0.8),
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 12,
          color: st.colors[Math.floor(Math.random() * st.colors.length)],
          shape: st.shape,
          suck,
        });
      }
    }
    if (this.debris.length > 520) this.debris.splice(0, this.debris.length - 520);
  }

  /** 세정제를 뿌리는 순간의 입자 — 제품마다 나오는 모양이 다르다. (x, y) 는 격자 좌표, radius 는 분사 반경(칸) */
  sprayFx(det: { base: string; family: string }, x: number, y: number, radius: number) {
    const now = performance.now();
    const look = sprayLook(det as never);
    const gap = look.style === 'gel' ? 90 : look.style === 'foam' ? 45 : 35;
    if (now - this.lastSprayFx < gap) return;
    this.lastSprayFx = now;
    const push = (o: Partial<Debris> & { shape: Debris['shape'] }) =>
      this.debris.push({ x, y, vx: 0, vy: 0, g: 0, life: 0.4, max: 0.4, size: 0.2, rot: 0, spin: 0, color: look.particle, suck: false, ...o });
    const R = radius;
    switch (look.style) {
      case 'mist':
        // 분무: 고운 물방울이 부채꼴로 확 퍼졌다가 금방 사라진다
        for (let q = 0; q < 14; q++) {
          const a = Math.random() * Math.PI * 2;
          const sp = R * (2.2 + Math.random() * 3.2);
          const life = 0.22 + Math.random() * 0.2;
          push({ shape: 'dot', x: x + Math.cos(a) * 0.3, y: y + Math.sin(a) * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 3, life, max: life, size: 0.05 + Math.random() * 0.1 });
        }
        break;
      case 'foam':
        // 폼건: 굵은 거품 덩어리가 뭉게뭉게 쌓이고 한참 머문다
        for (let q = 0; q < 7; q++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * R * 0.9;
          const life = 0.7 + Math.random() * 0.7;
          push({ shape: Math.random() < 0.55 ? 'puff' : 'bubble', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2 - 0.6, g: 1.2, life, max: life, size: 0.35 + Math.random() * 0.55, color: look.particle });
        }
        break;
      case 'bleach':
        // 락스: 가는 줄기로 곧게 쏘이고, 닿은 자리에서 아래로 주르륵 흘러내린다
        for (let q = 0; q < 6; q++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
          const sp = 9 + Math.random() * 6;
          push({ shape: 'drop', x: x + (Math.random() - 0.5) * 0.8, y: y + R * 0.9 + Math.random() * 1.5, vx: Math.cos(a) * sp * 0.3, vy: Math.sin(a) * sp, g: 0, life: 0.16, max: 0.16, size: 0.16 });
        }
        for (let q = 0; q < 3; q++) {
          const life = 0.6 + Math.random() * 0.5;
          push({ shape: 'drop', x: x + (Math.random() - 0.5) * R * 1.4, y: y + (Math.random() - 0.5) * R, vx: 0, vy: 1 + Math.random() * 1.5, g: 9, life, max: life, size: 0.13 + Math.random() * 0.1 });
        }
        break;
      case 'gel':
        // 점성 세제: 굵은 방울이 묵직하게 뚝, 뚝 — 튀지 않고 그 자리에 늘어진다
        for (let q = 0; q < 2; q++) {
          const life = 0.55 + Math.random() * 0.35;
          push({ shape: 'dot', x: x + (Math.random() - 0.5) * R * 0.7, y: y - 1.6 - Math.random(), vx: (Math.random() - 0.5) * 0.6, vy: 2.5, g: 16, life, max: life, size: 0.34 + Math.random() * 0.22 });
        }
        break;
      case 'powder':
        // 가루: 알갱이가 위에서 솔솔 흩뿌려진다
        for (let q = 0; q < 16; q++) {
          const life = 0.35 + Math.random() * 0.3;
          push({ shape: 'speck', x: x + (Math.random() - 0.5) * R * 1.8, y: y - 2.2 - Math.random() * 1.5, vx: (Math.random() - 0.5) * 2.5, vy: 3 + Math.random() * 3, g: 14, life, max: life, size: 0.07 + Math.random() * 0.07, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10 });
        }
        break;
      case 'oil':
        // 기름: 굵은 방울 몇 개가 떨어져 번진다
        for (let q = 0; q < 3; q++) {
          const life = 0.5 + Math.random() * 0.3;
          push({ shape: 'dot', x: x + (Math.random() - 0.5) * R, y: y - 1.2 - Math.random(), vx: (Math.random() - 0.5) * 1.2, vy: 3, g: 12, life, max: life, size: 0.2 + Math.random() * 0.18 });
        }
        break;
    }
    if (this.debris.length > 520) this.debris.splice(0, this.debris.length - 520);
  }

  /** 세정제가 섞였을 때 — 거품이 솟는다 (중화면 더 요란하게 거품만) */
  fizz(cells: number[], neutralized = false) {
    const s = this.session!;
    const sample = Math.min(cells.length, neutralized ? 40 : 24);
    for (let k = 0; k < sample; k++) {
      const i = cells[Math.floor(Math.random() * cells.length)];
      const n = neutralized ? 3 : 2;
      for (let q = 0; q < n; q++) {
        this.debris.push({
          x: (i % s.w) + Math.random(),
          y: Math.floor(i / s.w) + Math.random(),
          vx: (Math.random() - 0.5) * 2,
          vy: -3 - Math.random() * 5,
          g: -4,
          life: 0.6 + Math.random() * 0.6,
          max: 1.1,
          size: 0.18 + Math.random() * 0.3,
          rot: 0,
          spin: 0,
          color: neutralized ? 'rgba(255,255,255,0.85)' : 'rgba(225,245,255,0.9)',
          shape: 'bubble',
          suck: false,
        });
      }
    }
    if (this.debris.length > 520) this.debris.splice(0, this.debris.length - 520);
  }

  /** 재오염이 떨어짐 — 새로 생긴 자리에서 그 오염의 파편이 위에서 툭 떨어져 흩어진다 */
  splat(cells: number[]) {
    const s = this.session!;
    if (!cells.length) return;
    const sample = Math.min(cells.length, 36);
    for (let k = 0; k < sample; k++) {
      const i = cells[Math.floor(Math.random() * cells.length)];
      const type = DIRT_TYPES[s.type[i]];
      const st = DEBRIS[type];
      for (let q = 0; q < 2; q++) {
        const a = Math.random() * Math.PI * 2;
        const sp = st.speed * (0.3 + Math.random() * 0.5);
        this.debris.push({
          x: (i % s.w) + Math.random(),
          y: Math.floor(i / s.w) + Math.random() - 1.5,
          vx: Math.cos(a) * sp,
          vy: 4 + Math.random() * 6, // 아래로 떨어진다
          g: 18,
          life: 0.35 + Math.random() * 0.35,
          max: 0.7,
          size: st.size * (0.7 + Math.random() * 0.8),
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 10,
          color: st.colors[Math.floor(Math.random() * st.colors.length)],
          shape: st.shape,
          suck: false,
        });
      }
    }
    if (this.debris.length > 520) this.debris.splice(0, this.debris.length - 520);
  }

  /** 큰 반짝임 (종류 완료·발견) */
  celebrate(count = 40) {
    const s = this.session!;
    for (let k = 0; k < count; k++) {
      this.sparkles.push({ x: Math.random() * s.w, y: Math.random() * s.h, life: 1, size: 0.8 + Math.random() * 1.6, hue: 48 });
    }
  }

  /** 화면을 가로지르는 빛 쓸기 (25·50·75% 달성, 종류 완료) */
  sweep() {
    this.sweepT = 0;
  }

  /** 틀린 도구: 커서가 잠깐 붉게 흔들림 */
  shake() {
    this.shakeUntil = performance.now() + 450;
  }

  /** 전후 리빌 시작 — 현재(더러운) 화면 스냅샷을 닦아내듯 사선으로 지움 */
  startReveal(done: () => void) {
    if (!this.hasSnap) this.snapshot();
    this.reveal = { t: 0, done };
  }

  /** 시작 직후 더러운 화면 저장 (전후 비교용) */
  snapshot() {
    this.snap.width = this.canvas.width;
    this.snap.height = this.canvas.height;
    this.snap.getContext('2d')!.drawImage(this.canvas, 0, 0);
    this.hasSnap = true;
  }

  /** 오염층 합성 — 종류별로 (마스크 × 텍스처). 오염이 바뀌었을 때만, 최대 ~40Hz */
  private composeDirt(force = false) {
    const s = this.session!;
    const now = performance.now();
    if (!force && s.version === this.layerVersion) return;
    if (!force && now - this.layerAt < 24) return;
    this.layerVersion = s.version;
    this.layerAt = now;
    const w = s.w;
    const present = new Set<number>();
    for (let i = 0; i < s.amount.length; i++) if (s.amount[i] > 0) present.add(s.type[i]);
    const lctx = this.layer.getContext('2d')!;
    lctx.clearRect(0, 0, this.layer.width, this.layer.height);
    if (!present.size) return;
    const sub = this.subNoise!;
    const wx = this.warpX!;
    const wy = this.warpY!;
    const h = s.h;
    const MW = w * MS;
    const MH = h * MS;
    const field = new Float32Array(w * h);
    for (const ti of present) {
      const m = this.mask(ti);
      const d = m.img.data;
      // 이 종류의 칸 농도장 (다른 종류는 0) — 범위를 좁혀 빈 줄은 건너뛴다
      let minY = h;
      let maxY = -1;
      for (let i = 0; i < s.amount.length; i++) {
        const v = s.amount[i] > 0 && s.type[i] === ti ? smooth(s.amount[i]) * (0.85 + 0.15 * s.grain[i]) : 0;
        field[i] = v;
        if (v > 0) {
          const y = (i / w) | 0;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      d.fill(0);
      const sy0 = Math.max(0, (minY - 1) * MS);
      const sy1 = Math.min(MH, (maxY + 2) * MS);
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = 0; sx < MW; sx++) {
          const si = sy * MW + sx;
          // 비틀린 위치에서 농도장을 겹선형 보간 → 칸 격자가 보이지 않는 울퉁불퉁한 윤곽
          const px = (sx + 0.5) / MS - 0.5 + wx[si];
          const py = (sy + 0.5) / MS - 0.5 + wy[si];
          let x0 = Math.floor(px);
          let y0 = Math.floor(py);
          const fx = px - x0;
          const fy = py - y0;
          if (x0 < 0) x0 = 0;
          if (y0 < 0) y0 = 0;
          const x1 = x0 + 1 < w ? x0 + 1 : x0;
          const y1 = y0 + 1 < h ? y0 + 1 : y0;
          const a = field[y0 * w + x0];
          const b = field[y0 * w + x1];
          const c = field[y1 * w + x0];
          const e = field[y1 * w + x1];
          const v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
          if (v <= 0.004) continue;
          d[si * 4 + 3] = Math.min(255, 255 * v * sub[si]);
        }
      }
      m.canvas.getContext('2d')!.putImageData(m.img, 0, 0);
      const t = this.tmp.getContext('2d')!;
      t.globalCompositeOperation = 'source-over';
      t.clearRect(0, 0, this.tmp.width, this.tmp.height);
      t.imageSmoothingEnabled = true;
      t.imageSmoothingQuality = 'medium';
      t.drawImage(m.canvas, 0, 0, this.tmp.width, this.tmp.height);
      t.globalCompositeOperation = 'source-in';
      t.drawImage(this.texture(ti), 0, 0);
      t.globalCompositeOperation = 'source-over';
      lctx.drawImage(this.tmp, 0, 0);
    }
  }

  /** 세정제 잔여층 — 제품마다 남는 모양이 다르다(거품·물방울·흘러내림·점성 띠·가루·기름막). 모양별로 한 겹씩 그린다 */
  private drawFoam(W: number, H: number) {
    const s = this.session!;
    const f = this.foamImg!.data;
    // 지금 화면에 있는 모양 종류
    const styles = new Set<SprayStyle>();
    const looks: (ReturnType<typeof sprayLook> | null)[] = new Array(s.amount.length);
    for (let i = 0; i < s.amount.length; i++) {
      if (s.soakLevel(i) > 0) {
        const l = sprayLook(s.soak[i]!.det);
        looks[i] = l;
        styles.add(l.style);
      } else looks[i] = null;
    }
    if (!styles.size) return;
    const t = this.tmp.getContext('2d')!;
    for (const style of styles) {
      for (let i = 0; i < s.amount.length; i++) {
        const o = i * 4;
        const l = looks[i];
        if (l && l.style === style) {
          f[o] = l.color[0];
          f[o + 1] = l.color[1];
          f[o + 2] = l.color[2];
          // 반투명: 잔여층 아래 오염이 비쳐 보여야 어디를 문지를지 안다
          f[o + 3] = Math.min(255, l.alpha * s.soakLevel(i) * (0.65 + 0.35 * s.grain[i]));
        } else f[o + 3] = 0;
      }
      this.foamMask.getContext('2d')!.putImageData(this.foamImg!, 0, 0);
      let tex = this.foamTex.get(style);
      if (!tex) {
        tex = makeResidueTexture(style, this.layer.width, this.layer.height, s.level.seed, this.layer.width / s.w);
        this.foamTex.set(style, tex);
      }
      t.globalCompositeOperation = 'source-over';
      t.clearRect(0, 0, this.tmp.width, this.tmp.height);
      t.imageSmoothingEnabled = true;
      t.drawImage(this.foamMask, 0, 0, this.tmp.width, this.tmp.height);
      // 질감은 뿌린 자리 안에서만 (바깥까지 번지면 화면 전체가 뿌옇게 보인다)
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(tex, 0, 0);
      if (style !== 'powder') {
        // 젖은 것은 윤기를 한 겹 더 (가루는 무광)
        t.globalCompositeOperation = 'source-atop';
        t.globalAlpha = style === 'gel' || style === 'oil' ? 0.3 : 0.45;
        t.drawImage(tex, 0, 0);
        t.globalAlpha = 1;
      }
      t.globalCompositeOperation = 'source-over';
      this.ctx.globalAlpha = style === 'foam' ? 0.95 : 0.88;
      this.ctx.drawImage(this.tmp, 0, 0, W, H);
      this.ctx.globalAlpha = 1;
    }
  }

  draw(dt: number) {
    const s = this.session;
    if (!s || !this.foamImg) return;
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cw = W / s.w;
    const now = performance.now();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.base, 0, 0);

    if (this.reveal) {
      // 리빌: 스냅샷(더러운 화면)을 사선으로 닦아내며 깨끗한 장면을 드러냄
      this.reveal.t += dt;
      const p = Math.min(1, this.reveal.t / 1.1);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const edge = (W + H) * e;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(edge, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(edge - H, H);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(this.snap, 0, 0);
      ctx.restore();
      // 닦이는 경계의 빛
      const g = ctx.createLinearGradient(edge - 40 * this.dpr, 0, edge + 10 * this.dpr, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(edge - 60 * this.dpr, 0);
      ctx.lineTo(edge + 20 * this.dpr, 0);
      ctx.lineTo(edge + 20 * this.dpr - H, H);
      ctx.lineTo(edge - 60 * this.dpr - H, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (Math.random() < 0.6) this.sparkles.push({ x: ((edge - Math.random() * H) / W) * s.w, y: Math.random() * s.h, life: 1, size: 0.8 + Math.random() * 1.4, hue: 48 });
      if (p >= 1) {
        const done = this.reveal.done;
        this.reveal = null;
        done();
      }
      this.drawSparkles(dt, W);
      return;
    }

    // 광택 마감: 고성능 장비로 지운 칸은 은은한 광이 돌고 드문드문 반짝인다
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (s.shineCells > 0 && this.glossImg) {
      if (this.glossCount !== s.shineCells) {
        this.glossCount = s.shineCells;
        const gdata = this.glossImg.data;
        for (let i = 0; i < s.shine.length; i++) {
          const o = i * 4;
          gdata[o] = 255;
          gdata[o + 1] = 255;
          gdata[o + 2] = 255;
          gdata[o + 3] = s.shine[i] && s.amount[i] <= 0 ? 34 + 26 * s.grain[i] : 0;
        }
        this.gloss.getContext('2d')!.putImageData(this.glossImg, 0, 0);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.gloss, 0, 0, W, H);
      ctx.restore();
      const tnow = now / 1000;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < s.shine.length; i += 1) {
        if (!s.shine[i] || s.amount[i] > 0) continue;
        const h = (i * 2654435761) >>> 0;
        if (h % 47 !== 0) continue;
        const tw = 0.5 + 0.5 * Math.sin(tnow * 2.2 + (h % 628) / 100);
        if (tw < 0.55) continue;
        const r = cw * (0.5 + tw * 0.9);
        const x = ((i % s.w) + 0.5) * cw;
        const y = (Math.floor(i / s.w) + 0.5) * cw;
        ctx.globalAlpha = (tw - 0.55) * 1.6;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          ctx.lineTo(x + Math.cos(a + Math.PI / 4) * r * 0.22, y + Math.sin(a + Math.PI / 4) * r * 0.22);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 젖은 자국(물·스팀·세정제): 닦은 자리가 잠시 촉촉하게 빛남
    this.drawTrail(now, cw, true);

    // 오염층
    this.composeDirt();
    ctx.drawImage(this.layer, 0, 0, W, H);
    this.drawFoam(W, H);

    // 전체 칙칙함: 남은 오염만큼 장면이 어둡고 누르스름 → 닦을수록 환해진다
    const dirty = Math.max(0, Math.min(1, 1 - s.cleanliness));
    if (dirty > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(108,110,116,${(0.3 * dirty).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // 25·50·75% 달성 → 빛 쓸기
    const clean = s.cleanliness;
    for (const m of [0.25, 0.5, 0.75]) {
      if (this.lastClean < m && clean >= m) {
        this.sweep();
        this.onMilestone?.(m);
      }
    }
    this.lastClean = clean;

    // 닦는 자국(광): 지금 닦이는 중이면 커서 궤적이 하얗게 빛난다
    this.drawTrail(now, cw, false);

    // 스팟 모드: 표적 링 (완료되면 체크)
    if (s.spots.length) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 300);
      for (const sp of s.spots) {
        ctx.save();
        ctx.lineWidth = 2.5 * this.dpr;
        ctx.setLineDash(sp.done ? [] : [6 * this.dpr, 5 * this.dpr]);
        ctx.strokeStyle = sp.done ? 'rgba(40,200,120,0.95)' : `rgba(255,255,255,${0.55 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(sp.x * cw, sp.y * cw, (sp.r + 0.6) * cw, 0, Math.PI * 2);
        ctx.stroke();
        if (sp.done) {
          ctx.setLineDash([]);
          ctx.lineWidth = 3 * this.dpr;
          ctx.beginPath();
          ctx.moveTo(sp.x * cw - 7 * this.dpr, sp.y * cw);
          ctx.lineTo(sp.x * cw - 2 * this.dpr, sp.y * cw + 6 * this.dpr);
          ctx.lineTo(sp.x * cw + 8 * this.dpr, sp.y * cw - 6 * this.dpr);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 정전 모드: 손전등 밖은 어둡게
    if (this.dark) {
      if (this.cursor) this.flashlight = { x: this.cursor.x, y: this.cursor.y };
      const f = this.flashlight;
      ctx.save();
      if (f) {
        const r = 11 * cw;
        const g = ctx.createRadialGradient(f.x * cw, f.y * cw, r * 0.35, f.x * cw, f.y * cw, r);
        g.addColorStop(0, 'rgba(6,8,14,0)');
        g.addColorStop(0.75, 'rgba(6,8,14,0.55)');
        g.addColorStop(1, 'rgba(6,8,14,0.93)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(f.x * cw, f.y * cw, r, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(6,8,14,0.93)';
        ctx.fill('evenodd');
      } else {
        ctx.fillStyle = 'rgba(6,8,14,0.9)';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    // 빛 쓸기
    if (this.sweepT >= 0) {
      this.sweepT += dt / 0.75;
      const p = Math.min(1, this.sweepT);
      const e = p * p * (3 - 2 * p);
      const edge = -H + (W + H * 2) * e;
      const g = ctx.createLinearGradient(edge - 90 * this.dpr, 0, edge + 90 * this.dpr, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.42)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(edge - 120 * this.dpr, 0);
      ctx.lineTo(edge + 120 * this.dpr, 0);
      ctx.lineTo(edge + 120 * this.dpr - H * 0.6, H);
      ctx.lineTo(edge - 120 * this.dpr - H * 0.6, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (Math.random() < 0.5) this.sparkles.push({ x: ((edge - Math.random() * H * 0.6) / W) * s.w, y: Math.random() * s.h, life: 1, size: 0.6 + Math.random() * 1.2, hue: 48 });
      if (p >= 1) this.sweepT = -1;
    }

    this.drawDebris(dt, cw);
    this.drawSparkles(dt, W);

    // 커서
    if (this.cursor) {
      const { x, y, item, active } = this.cursor;
      const r = item.radius * cw;
      const shaking = now < this.shakeUntil;
      const hot = active && now < this.hotUntil;
      const jx = shaking ? (Math.random() - 0.5) * 6 * this.dpr : 0;
      ctx.save();
      if (hot) {
        // 닦이는 중: 접촉면이 환하게
        const g = ctx.createRadialGradient(x * cw, y * cw, 0, x * cw, y * cw, r);
        g.addColorStop(0, 'rgba(255,255,255,0.28)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x * cw, y * cw, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = 2 * this.dpr;
      ctx.strokeStyle = shaking ? 'rgba(255,90,70,0.95)' : active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
      ctx.fillStyle = shaking ? 'rgba(255,90,70,0.18)' : item.kind === 'detergent' ? 'rgba(160,220,255,0.18)' : 'rgba(255,255,255,0.12)';
      ctx.setLineDash(item.kind === 'detergent' ? [4 * this.dpr, 4 * this.dpr] : []);
      ctx.beginPath();
      ctx.arc(x * cw + jx, y * cw, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (active && item.kind === 'detergent' && !shaking) {
        // 분사 물방울
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(210,240,255,0.8)';
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * r * 0.9;
          ctx.beginPath();
          ctx.arc(x * cw + Math.cos(a) * d, y * cw + Math.sin(a) * d, (0.8 + Math.random() * 1.6) * this.dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (active && item.kind === 'tool' && item.families.some((f) => BRUSHY.has(f)) && !shaking) {
        // 솔: 빗살 점
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const ph = (now / 60) % (Math.PI * 2);
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2 + ph;
          const d = r * (0.3 + ((k * 37) % 5) / 8);
          ctx.beginPath();
          ctx.arc(x * cw + Math.cos(a) * d, y * cw + Math.sin(a) * d, 1.2 * this.dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (active && item.kind === 'tool' && item.families.some((f) => SUCKY.has(f)) && !shaking) {
        // 청소기: 안으로 빨려 드는 선
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.2 * this.dpr;
        const ph = (now / 240) % 1;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const d0 = r * (0.95 - ph * 0.5);
          const d1 = d0 - r * 0.25;
          ctx.beginPath();
          ctx.moveTo(x * cw + Math.cos(a) * d0, y * cw + Math.sin(a) * d0);
          ctx.lineTo(x * cw + Math.cos(a) * d1, y * cw + Math.sin(a) * d1);
          ctx.stroke();
        }
      }
      if (shaking) {
        ctx.setLineDash([]);
        ctx.lineWidth = 3 * this.dpr;
        ctx.beginPath();
        ctx.moveTo(x * cw + jx - r * 0.4, y * cw - r * 0.4);
        ctx.lineTo(x * cw + jx + r * 0.4, y * cw + r * 0.4);
        ctx.moveTo(x * cw + jx + r * 0.4, y * cw - r * 0.4);
        ctx.lineTo(x * cw + jx - r * 0.4, y * cw + r * 0.4);
        ctx.stroke();
      }
      ctx.restore();
      // 궤적 기록 (닦이는 중일 때만 광이 남는다; 액체 도구는 젖은 자국)
      if (active) {
        const wet = item.kind === 'detergent' || item.families.some((f) => LIQUID.has(f)) || item.families.includes('sponge');
        if (hot || wet) this.trail.push({ x, y, t: now, r: item.radius, wet });
        if (this.trail.length > 90) this.trail.splice(0, this.trail.length - 90);
      }
      this.prevCursor = { x, y };
    } else this.prevCursor = null;
  }

  /** 커서 궤적: wet=true 면 오염층 아래 젖은 광택, false 면 위에 닦는 빛 */
  private drawTrail(now: number, cw: number, wet: boolean) {
    const life = wet ? 1500 : 420;
    const pts = this.trail.filter((p) => p.wet === wet && now - p.t < life);
    if (!wet) this.trail = this.trail.filter((p) => now - p.t < 1500);
    if (pts.length < 2) return;
    const { ctx } = this;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (wet) {
      // 젖은 자국은 한 번의 획으로 — 점마다 겹쳐 그리면 밝기가 쌓여 뿌연 흰 덩어리가 된다
      const age = pts.reduce((a, p) => a + (now - p.t) / life, 0) / pts.length;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(205,236,255,${(0.2 * (1 - age)).toFixed(3)})`;
      ctx.lineWidth = pts[0].r * cw * 1.6;
      ctx.beginPath();
      let open = false;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[i - 1];
        if (!b || Math.hypot(a.x - b.x, a.y - b.y) > 6) {
          ctx.moveTo(a.x * cw, a.y * cw);
          open = true;
        } else ctx.lineTo(a.x * cw, a.y * cw);
      }
      if (open) ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[i - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 6) continue;
      const age = (now - a.t) / life;
      const alpha = wet ? 0.16 * (1 - age) : 0.32 * (1 - age) * (1 - age);
      ctx.strokeStyle = wet ? `rgba(200,235,255,${alpha.toFixed(3)})` : `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = a.r * cw * (wet ? 1.7 : 1.5);
      ctx.beginPath();
      ctx.moveTo(b.x * cw, b.y * cw);
      ctx.lineTo(a.x * cw, a.y * cw);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDebris(dt: number, cw: number) {
    if (!this.debris.length) return;
    const { ctx } = this;
    const c = this.cursor;
    for (const p of this.debris) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.suck && c) {
        // 빨려 들어감
        const dx = c.x - p.x;
        const dy = c.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 60 * dt;
        p.vy += (dy / d) * 60 * dt;
        if (d < 0.6) p.life = 0;
      } else p.vy += p.g * dt;
      p.vx *= 1 - 2.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const k = p.life / p.max;
      const x = p.x * cw;
      const y = p.y * cw;
      const sz = p.size * cw;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.shape) {
        case 'puff': {
          const r = sz * (1.2 - k * 0.7);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(180,170,160,0)');
          ctx.fillStyle = g;
          ctx.globalAlpha = k * 0.9;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'speck':
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, sz), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'chip':
          ctx.translate(x, y);
          ctx.rotate(p.rot);
          ctx.fillRect(-sz, -sz * 0.6, sz * 2, sz * 1.2);
          break;
        case 'strand':
          ctx.translate(x, y);
          ctx.rotate(p.rot);
          ctx.lineWidth = Math.max(1, cw * 0.09);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-sz, 0);
          ctx.quadraticCurveTo(0, -sz * 0.5, sz, 0);
          ctx.stroke();
          break;
        case 'drop': {
          const ang = Math.atan2(p.vy, p.vx);
          ctx.translate(x, y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, sz * 1.5, sz * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'dot':
          ctx.beginPath();
          ctx.arc(x, y, sz, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'bubble':
          ctx.lineWidth = Math.max(1, cw * 0.08);
          ctx.beginPath();
          ctx.arc(x, y, sz * (1 + (1 - k) * 0.6), 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(x - sz * 0.35, y - sz * 0.35, sz * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'tuft':
          ctx.translate(x, y);
          ctx.rotate(p.rot);
          ctx.lineWidth = Math.max(1, cw * 0.1);
          ctx.lineCap = 'round';
          for (let q = -1; q <= 1; q++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(q * sz * 0.7, -sz * 1.4);
            ctx.stroke();
          }
          break;
        case 'flash': {
          const r = sz * (0.5 + (1 - k) * 0.8);
          ctx.translate(x, y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          for (let q = 0; q < 4; q++) {
            const a = (q * Math.PI) / 2;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.25, Math.sin(a + Math.PI / 4) * r * 0.25);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
    this.debris = this.debris.filter((p) => p.life > 0);
  }

  private drawSparkles(dt: number, W: number) {
    const s = this.session!;
    const { ctx } = this;
    const cw = W / s.w;
    for (const p of this.sparkles) {
      p.life -= dt * 1.6;
      if (p.life <= 0) continue;
      const x = p.x * cw;
      const y = p.y * cw;
      const r = p.size * cw * (0.6 + (1 - p.life) * 0.8);
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.hue === 48 ? '#ffe082' : '#ffffff';
      ctx.translate(x, y);
      ctx.rotate((1 - p.life) * 2);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.25, Math.sin(a + Math.PI / 4) * r * 0.25);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    this.sparkles = this.sparkles.filter((p) => p.life > 0);
  }
}
