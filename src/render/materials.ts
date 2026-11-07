// 재질·조명 라이브러리 — 이미지 자산 없이 캔버스로 "사진 같은" 표면을 만든다.
// 원칙: 전체 캔버스 픽셀 루프 금지(작은 노이즈 타일 + createPattern), 그라디언트·스트로크·블렌드 모드로 질감.
// 조명은 항상 왼쪽 위에서 오는 부드러운 키 라이트 하나 — 모든 장면이 같은 빛을 받아야 한 집처럼 보인다.

export type Ctx = CanvasRenderingContext2D;
export type Rnd = () => number;

// ───────────────────────── 색 ─────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** k>0 밝게, k<0 어둡게 (-1~1) */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** 'rgb(r,g,b)' 또는 '#hex' 에 알파를 붙인다 */
export function withAlpha(color: string, a: number): string {
  if (color.startsWith('#')) return rgba(color, a);
  return color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ───────────────────────── 노이즈 타일 ─────────────────────────

export type NoiseKind = 'grain' | 'speckle' | 'weave' | 'brush' | 'pile' | 'leather' | 'plaster';

const tileCache = new Map<string, HTMLCanvasElement>();

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function lcg(seed: number): Rnd {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 중간 회색(128)이 중립인 노이즈 타일 — overlay/soft-light 로 얹으면 밝기만 흔든다 */
export function noiseTile(kind: NoiseKind, size = 128, amp = 40): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${kind}:${size}:${amp}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const d = img.data;
  const r = lcg(hashSeed(key));
  const put = (i: number, v: number) => {
    const x = Math.max(0, Math.min(255, Math.round(v)));
    d[i] = x;
    d[i + 1] = x;
    d[i + 2] = x;
    d[i + 3] = 255;
  };
  if (kind === 'grain' || kind === 'plaster') {
    const soft = kind === 'plaster';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 128 + (r() - 0.5) * amp;
        if (soft) v = 128 + (r() + r() + r() - 1.5) * amp * 0.5;
        put((y * size + x) * 4, v);
      }
    }
  } else if (kind === 'speckle') {
    for (let i = 0; i < size * size * 4; i += 4) put(i, 128);
    const n = Math.floor(size * size * 0.06);
    for (let k = 0; k < n; k++) {
      const x = Math.floor(r() * size);
      const y = Math.floor(r() * size);
      put((y * size + x) * 4, 128 + (r() - 0.5) * amp * 2);
    }
  } else if (kind === 'weave') {
    // 날실·씨실: 2px 주기의 가로·세로 줄 + 노이즈
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const wx = ((x >> 1) & 1) === 0 ? 1 : -1;
        const wy = ((y >> 1) & 1) === 0 ? 1 : -1;
        const v = 128 + (wx * 0.6 + wy * 0.4) * amp * 0.35 + (r() - 0.5) * amp * 0.5;
        put((y * size + x) * 4, v);
      }
    }
  } else if (kind === 'brush') {
    // 헤어라인: 가로 줄마다 밝기가 다르고 x 로 천천히 변한다
    for (let y = 0; y < size; y++) {
      let v = 128 + (r() - 0.5) * amp;
      const drift = (r() - 0.5) * 0.3;
      for (let x = 0; x < size; x++) {
        v += drift + (r() - 0.5) * 2;
        put((y * size + x) * 4, v);
      }
    }
  } else if (kind === 'pile') {
    // 카펫 파일: 짧은 세로 점선
    for (let i = 0; i < size * size * 4; i += 4) put(i, 128 + (r() - 0.5) * amp * 0.4);
    const n = Math.floor(size * size * 0.08);
    for (let k = 0; k < n; k++) {
      const x = Math.floor(r() * size);
      const y = Math.floor(r() * size);
      const v = 128 + (r() - 0.5) * amp * 2;
      for (let j = 0; j < 3; j++) if (y + j < size) put(((y + j) * size + x) * 4, v);
    }
  } else if (kind === 'leather') {
    // 가죽·비닐 결: 작은 셀 경계가 어둡고 가운데가 밝다
    for (let i = 0; i < size * size * 4; i += 4) put(i, 128);
    const cells = 14;
    const cs = size / cells;
    const pts: [number, number][] = [];
    for (let k = 0; k < cells * cells; k++) pts.push([(k % cells) * cs + r() * cs, Math.floor(k / cells) * cs + r() * cs]);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let best = 1e9;
        let second = 1e9;
        for (const [px, py] of pts) {
          const dx = Math.min(Math.abs(px - x), size - Math.abs(px - x));
          const dy = Math.min(Math.abs(py - y), size - Math.abs(py - y));
          const dd = dx * dx + dy * dy;
          if (dd < best) {
            second = best;
            best = dd;
          } else if (dd < second) second = dd;
        }
        const edge = Math.sqrt(second) - Math.sqrt(best);
        put((y * size + x) * 4, 128 + Math.min(1, edge / 2.2) * amp * 0.55 - amp * 0.3 + (r() - 0.5) * amp * 0.25);
      }
    }
  }
  g.putImageData(img, 0, 0);
  tileCache.set(key, c);
  return c;
}

/**
 * 노이즈를 영역 위에 얹는다. mode 'overlay'(기본) 는 중간 회색 중립 — 밝기만 흔든다.
 * scale 로 패턴 배율(2 = 굵은 결).
 */
export function texture(ctx: Ctx, x: number, y: number, w: number, h: number, kind: NoiseKind, alpha: number, scale = 1, mode: GlobalCompositeOperation = 'overlay', amp = 40): void {
  const t = noiseTile(kind, 128, amp);
  if (!t) return;
  const p = ctx.createPattern(t, 'repeat');
  if (!p) return;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  if (scale !== 1 && 'setTransform' in p) {
    const m = new DOMMatrix();
    m.a = scale;
    m.d = scale;
    p.setTransform(m);
  }
  ctx.fillStyle = p;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ───────────────────────── 조명 ─────────────────────────

/** 왼쪽 위 키 라이트: 위·왼쪽 밝게, 아래·오른쪽 어둡게 */
export function keyLight(ctx: Ctx, w: number, h: number, strength = 0.12): void {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `rgba(255,255,255,${strength})`);
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength * 1.3})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 가장자리 비네트(곱하기) */
export function vignette(ctx: Ctx, w: number, h: number, a = 0.18): void {
  const R = Math.max(w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, R * 0.35, w / 2, h / 2, R * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 넓고 부드러운 반사 띠(광택) — screen 블렌드 */
export function sheen(ctx: Ctx, w: number, h: number, alpha = 0.16, angle = -0.6, pos = 0.35, width = 0.35): void {
  const L = Math.hypot(w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
  const c = pos - 0.5;
  g.addColorStop(Math.max(0, c + 0.5 - width), 'rgba(255,255,255,0)');
  g.addColorStop(Math.max(0, Math.min(1, c + 0.5)), `rgba(255,255,255,${alpha})`);
  g.addColorStop(Math.min(1, c + 0.5 + width), 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(-L, -L, L * 2, L * 2);
  ctx.restore();
}

/** 사각 영역 안쪽 가장자리 그늘(앰비언트 오클루전) */
export function innerShadow(ctx: Ctx, x: number, y: number, w: number, h: number, size: number, a = 0.22): void {
  ctx.save();
  const edges: [number, number, number, number][] = [
    [x, y, x, y + size],
    [x, y + h, x, y + h - size],
    [x, y, x + size, y],
    [x + w, y, x + w - size, y],
  ];
  for (const [x0, y0, x1, y1] of edges) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** 소품 아래 부드러운 그림자: draw 콜백이 그리는 모양을 그림자로만 찍는다 */
export function softShadow(ctx: Ctx, blur: number, dx: number, dy: number, alpha: number, draw: () => void): void {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = dx;
  ctx.shadowOffsetY = dy;
  draw();
  ctx.restore();
}

// ───────────────────────── 기본 도형 ─────────────────────────

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

export function ellipsePath(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

/** 크롬 그라디언트(세로 방향 기본) */
export function chrome(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, tint = '#dfe6ec'): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#f9fbfc');
  g.addColorStop(0.18, shade(tint, 0.3));
  g.addColorStop(0.4, '#7b858f');
  g.addColorStop(0.55, '#f2f5f7');
  g.addColorStop(0.75, shade(tint, -0.25));
  g.addColorStop(1, '#9ea8b1');
  return g;
}

/** 금속 바(파이프·손잡이): 둥근 모서리 + 크롬 그라디언트 + 그림자 */
export function chromeBar(ctx: Ctx, x: number, y: number, w: number, h: number, vertical = false): void {
  const g = vertical ? chrome(ctx, x, 0, x + w, 0) : chrome(ctx, 0, y, 0, y + h);
  softShadow(ctx, Math.max(2, Math.min(w, h) * 0.6), Math.min(w, h) * 0.15, Math.min(w, h) * 0.25, 0.35, () => {
    ctx.fillStyle = g;
    rr(ctx, x, y, w, h, Math.min(w, h) / 2);
    ctx.fill();
  });
}

// ───────────────────────── 재질 ─────────────────────────

export interface WoodOpts {
  base: string;
  /** 널판 수(가로 방향 'h' 면 세로로 쌓이는 수) */
  planks?: number;
  dir?: 'h' | 'v';
  /** 광택(바니시) 0~1 */
  gloss?: number;
  /** 원근: 아래쪽 널판이 커지는 정도 0~1 */
  perspective?: number;
  /** 옹이 확률 */
  knots?: number;
  /** 널판 사이 틈(어두운 선) 두께, 0이면 미세 V홈만 */
  gap?: number;
  /** 결 선 수 */
  grain?: number;
  /** 풍화(회색빛·거침) 0~1 */
  weather?: number;
  /** 널판 길이 방향 이음매 (false 면 통널) */
  joints?: boolean;
}

/** 원목: 널판·결·옹이·V홈·바니시 광택 */
export function wood(ctx: Ctx, w: number, h: number, rnd: Rnd, o: WoodOpts): void {
  ctx.save();
  let W = w;
  let H = h;
  if ((o.dir ?? 'v') === 'v') {
    // 세로 널판: 가로 널판을 90° 돌려 그린다
    ctx.translate(w, 0);
    ctx.rotate(Math.PI / 2);
    W = h;
    H = w;
  }
  const n = o.planks ?? 6;
  const persp = o.perspective ?? 0;
  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const k = 1 + persp * t * 1.2;
    weights.push(k);
    sum += k;
  }
  ctx.fillStyle = o.base;
  ctx.fillRect(0, 0, W, H);
  const dark = shade(o.base, -0.55);
  const weather = o.weather ?? 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const ph = (H * weights[i]) / sum;
    // 널판 길이 방향 이음매(1~3개)
    const joints: number[] = [0];
    const nj = o.joints === false ? 0 : 1 + Math.floor(rnd() * 2.6);
    for (let k = 0; k < nj; k++) joints.push(W * (0.1 + rnd() * 0.8));
    joints.sort((a, b) => a - b);
    joints.push(W);
    for (let j = 0; j < joints.length - 1; j++) {
      const x0 = joints[j];
      const x1 = joints[j + 1];
      const pw = x1 - x0;
      if (pw < 2) continue;
      // 널판 톤
      const tone = (rnd() - 0.5) * 0.22;
      const grey = weather * (0.35 + rnd() * 0.3);
      ctx.fillStyle = tone > 0 ? `rgba(255,245,225,${tone})` : `rgba(50,30,15,${-tone})`;
      ctx.fillRect(x0, y, pw, ph);
      if (grey > 0) {
        ctx.fillStyle = `rgba(160,160,150,${grey * 0.5})`;
        ctx.fillRect(x0, y, pw, ph);
      }
      // 결: 널판을 따라 흐르는 곡선(캐세드럴 무늬 포함)
      const G = o.grain ?? 7;
      const lw = Math.max(0.7, Math.min(W, H) * 0.0016);
      ctx.lineWidth = lw;
      const cathedral = rnd() < 0.35;
      const cx = x0 + pw * (0.2 + rnd() * 0.6);
      for (let g = 0; g < G; g++) {
        const gy = y + ph * ((g + 0.5 + (rnd() - 0.5) * 0.6) / G);
        const amp = ph * (0.04 + rnd() * 0.08);
        const freq = 60 + rnd() * 120;
        const a = 0.08 + rnd() * 0.16;
        ctx.strokeStyle = withAlpha(dark, a);
        ctx.beginPath();
        const steps = Math.max(6, Math.floor(pw / 18));
        for (let s = 0; s <= steps; s++) {
          const x = x0 + (pw * s) / steps;
          let yy = gy + Math.sin(x / freq + g * 1.7) * amp;
          if (cathedral) {
            // 가운데가 솟는 포물선 — 널판 중심 근처에서 결이 벌어짐
            const d = (x - cx) / (pw * 0.5);
            yy += (gy - (y + ph / 2)) * 0.8 * Math.exp(-d * d * 2.5);
          }
          if (s === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      // 옹이
      if (rnd() < (o.knots ?? 0.22)) {
        const kx = x0 + pw * (0.15 + rnd() * 0.7);
        const ky = y + ph * (0.3 + rnd() * 0.4);
        const kr = ph * (0.08 + rnd() * 0.1);
        const kg = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr * 1.6);
        kg.addColorStop(0, shade(o.base, -0.6));
        kg.addColorStop(0.5, shade(o.base, -0.35));
        kg.addColorStop(1, rgba(o.base, 0));
        ctx.fillStyle = kg;
        ellipsePath(ctx, kx, ky, kr * 1.7, kr * 1.1, rnd() * 0.6);
        ctx.fill();
        ctx.strokeStyle = withAlpha(dark, 0.25);
        for (let k = 1; k <= 3; k++) {
          ellipsePath(ctx, kx, ky, kr * 1.7 * (1 + k * 0.35), kr * 1.1 * (1 + k * 0.4));
          ctx.stroke();
        }
      }
      // 이음매(끝단): 어두운 선 + 하이라이트
      if (j > 0) {
        ctx.fillStyle = 'rgba(40,22,8,0.45)';
        ctx.fillRect(x0 - lw, y, lw * 2, ph);
        ctx.fillStyle = 'rgba(255,240,220,0.25)';
        ctx.fillRect(x0 + lw, y, lw, ph);
      }
    }
    // 널판 사이: 틈 또는 V홈
    const gap = o.gap ?? 0;
    const lw = Math.max(1, Math.min(W, H) * 0.0025);
    if (gap > 0) {
      ctx.fillStyle = 'rgba(25,15,8,0.9)';
      ctx.fillRect(0, y + ph - gap / 2, W, gap);
      ctx.fillStyle = 'rgba(255,245,230,0.22)';
      ctx.fillRect(0, y + ph + gap / 2, W, lw);
    } else if (i < n - 1) {
      ctx.fillStyle = 'rgba(30,18,8,0.5)';
      ctx.fillRect(0, y + ph - lw, W, lw * 1.2);
      ctx.fillStyle = 'rgba(255,245,230,0.3)';
      ctx.fillRect(0, y + ph + lw * 0.2, W, lw);
    }
    y += ph;
  }
  ctx.restore();
  texture(ctx, 0, 0, w, h, 'grain', 0.22 + weather * 0.2, 1);
  if ((o.gloss ?? 0.35) > 0) sheen(ctx, w, h, (o.gloss ?? 0.35) * 0.45, -0.55, 0.3, 0.3);
}

export interface TileOpts {
  cols: number;
  face: string;
  grout: string;
  /** 타일 세로/가로 비 */
  ratio?: number;
  /** 줄눈 폭(px) */
  groutW?: number;
  /** 어긋나게(벽돌식) */
  stagger?: boolean;
  /** 타일별 톤 편차 0~1 */
  variation?: number;
  /** 모서리 베벨 강도 */
  bevel?: number;
  /** 유약 광택 */
  gloss?: number;
  /** 줄눈 거칠기 */
  rough?: number;
}

/** 타일: 베벨·톤 편차·줄눈 노이즈·유약 반사 */
export function tiles(ctx: Ctx, w: number, h: number, rnd: Rnd, o: TileOpts): void {
  const tw = w / o.cols;
  const th = tw * (o.ratio ?? 1);
  const gw = o.groutW ?? Math.max(1.5, tw * 0.035);
  ctx.save();
  ctx.fillStyle = o.grout;
  ctx.fillRect(0, 0, w, h);
  texture(ctx, 0, 0, w, h, 'grain', 0.35 + (o.rough ?? 0.3) * 0.4, 1, 'overlay', 60);
  const bevel = o.bevel ?? 0.5;
  const variation = o.variation ?? 0.05;
  let row = 0;
  for (let y = -th * 0.01; y < h; y += th, row++) {
    const off = o.stagger && row % 2 ? -tw / 2 : 0;
    for (let x = off; x < w; x += tw) {
      const x0 = x + gw / 2;
      const y0 = y + gw / 2;
      const ww = tw - gw;
      const hh = th - gw;
      const v = (rnd() - 0.5) * variation * 2;
      ctx.fillStyle = shade(o.face, v);
      const rad = Math.max(1, gw * 0.9);
      rr(ctx, x0, y0, ww, hh, rad);
      ctx.fill();
      // 유약: 위쪽이 살짝 밝고 아래가 살짝 어두운 그라디언트
      const g = ctx.createLinearGradient(x0, y0, x0 + ww * 0.3, y0 + hh);
      g.addColorStop(0, `rgba(255,255,255,${0.16 + (o.gloss ?? 0.4) * 0.25})`);
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.05 + (o.gloss ?? 0.4) * 0.08})`);
      ctx.fillStyle = g;
      rr(ctx, x0, y0, ww, hh, rad);
      ctx.fill();
      if (bevel > 0) {
        const bw = Math.max(1, gw * 0.8);
        // 왼쪽·위 밝은 베벨
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * bevel})`;
        ctx.lineWidth = bw;
        ctx.beginPath();
        ctx.moveTo(x0 + bw / 2, y0 + hh - rad);
        ctx.lineTo(x0 + bw / 2, y0 + rad);
        ctx.quadraticCurveTo(x0 + bw / 2, y0 + bw / 2, x0 + rad, y0 + bw / 2);
        ctx.lineTo(x0 + ww - rad, y0 + bw / 2);
        ctx.stroke();
        // 오른쪽·아래 어두운 베벨
        ctx.strokeStyle = `rgba(0,0,0,${0.22 * bevel})`;
        ctx.beginPath();
        ctx.moveTo(x0 + rad, y0 + hh - bw / 2);
        ctx.lineTo(x0 + ww - rad, y0 + hh - bw / 2);
        ctx.quadraticCurveTo(x0 + ww - bw / 2, y0 + hh - bw / 2, x0 + ww - bw / 2, y0 + hh - rad);
        ctx.lineTo(x0 + ww - bw / 2, y0 + rad);
        ctx.stroke();
      }
      // 타일마다 작은 반사점(유약) — 가끔
      if (rnd() < 0.35) {
        ctx.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.12})`;
        ellipsePath(ctx, x0 + ww * (0.2 + rnd() * 0.2), y0 + hh * (0.15 + rnd() * 0.15), ww * 0.12, hh * 0.05, -0.5);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  texture(ctx, 0, 0, w, h, 'plaster', 0.12, 2);
}

/** 도기(세면대·변기·욕조) 유약: 흰색 바탕에 부드러운 음영 + 하이라이트. path 는 미리 잡혀 있어야 한다 */
export function glazeFill(ctx: Ctx, cx: number, cy: number, r: number, tint = '#eef2f4', dark = '#b9c6cd'): void {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, tint);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
}

/** 스테인리스: 헤어라인 + 이방성 하이라이트 띠 */
export function steel(ctx: Ctx, w: number, h: number, dir: 'h' | 'v' = 'h', tone = '#d7dde2'): void {
  const g = dir === 'h' ? ctx.createLinearGradient(0, 0, 0, h) : ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, shade(tone, -0.08));
  g.addColorStop(0.3, shade(tone, 0.25));
  g.addColorStop(0.5, shade(tone, 0.05));
  g.addColorStop(0.7, shade(tone, 0.3));
  g.addColorStop(1, shade(tone, -0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  if (dir === 'v') {
    ctx.translate(w, 0);
    ctx.rotate(Math.PI / 2);
    texture(ctx, 0, 0, h, w, 'brush', 0.5, 1, 'overlay', 46);
  } else texture(ctx, 0, 0, w, h, 'brush', 0.5, 1, 'overlay', 46);
  ctx.restore();
  // 이방성 반사: 결 방향과 직각인 밝은 띠
  const band = dir === 'h' ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.3, 'rgba(255,255,255,0.22)');
  band.addColorStop(0.42, 'rgba(255,255,255,0)');
  band.addColorStop(0.7, 'rgba(0,0,0,0.08)');
  band.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 페인트 벽·문: 미세 질감 + 은은한 조명 */
export function paint(ctx: Ctx, w: number, h: number, color: string, roughness = 0.5): void {
  const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
  g.addColorStop(0, shade(color, 0.08));
  g.addColorStop(1, shade(color, -0.08));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  texture(ctx, 0, 0, w, h, 'plaster', 0.3 * roughness + 0.1, 1.5, 'overlay', 34);
}

/** 플라스틱(무광): 매끈한 그라디언트 + 미세 반점 */
export function plastic(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, glossy = 0.5): void {
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, shade(color, 0.12));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  texture(ctx, x, y, w, h, 'speckle', 0.25, 1, 'overlay', 30);
  if (glossy > 0) {
    const s = ctx.createLinearGradient(x, y, x, y + h * 0.5);
    s.addColorStop(0, `rgba(255,255,255,${glossy * 0.35})`);
    s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** 고무(바닥 매트·타이어): 매우 무광 + 거친 반점 */
export function rubber(ctx: Ctx, x: number, y: number, w: number, h: number, color = '#2c2e31'): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  texture(ctx, x, y, w, h, 'speckle', 0.5, 1, 'overlay', 50);
  texture(ctx, x, y, w, h, 'grain', 0.25, 1, 'overlay', 30);
}

/** 패브릭(소파·침구·시트): 짜임 + 파일 노이즈 + 부드러운 음영 */
export function fabric(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, kind: 'weave' | 'pile' | 'velvet' = 'weave'): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (kind === 'pile') texture(ctx, x, y, w, h, 'pile', 0.5, 1.5, 'overlay', 46);
  else if (kind === 'velvet') texture(ctx, x, y, w, h, 'grain', 0.35, 1, 'overlay', 28);
  else texture(ctx, x, y, w, h, 'weave', 0.55, 1, 'overlay', 44);
  ctx.restore();
}

/** 비닐·가죽: 잔주름 셀 + 은은한 광 */
export function vinyl(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, gloss = 0.3): void {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, shade(color, 0.14));
  g.addColorStop(1, shade(color, -0.14));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  texture(ctx, x, y, w, h, 'leather', 0.55, 1, 'overlay', 44);
  if (gloss > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    sheen(ctx, x + w, y + h, gloss * 0.4, -0.7, 0.35, 0.3);
    ctx.restore();
  }
}

/** 유리: 틴트 + 사선 반사 띠 두 줄 + 가장자리 밝은 선 */
export function glass(ctx: Ctx, w: number, h: number, tint = 'rgba(190,215,225,0.18)'): void {
  ctx.save();
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'screen';
  for (const [p, a, wd] of [
    [0.22, 0.28, 0.08],
    [0.36, 0.14, 0.05],
  ] as const) {
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.moveTo(w * (p + 0.28), 0);
    ctx.lineTo(w * (p + 0.28 + wd), 0);
    ctx.lineTo(w * (p - 0.2 + wd), h);
    ctx.lineTo(w * (p - 0.2), h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 잔디: 흙 바탕 위 풀잎 스트로크(타일 패턴) */
export function grass(ctx: Ctx, x: number, y: number, w: number, h: number, seed = 1): void {
  if (typeof document === 'undefined') {
    ctx.fillStyle = '#5f9a4a';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const key = `grass:${seed}`;
  let t = tileCache.get(key);
  if (!t) {
    const size = 160;
    t = document.createElement('canvas');
    t.width = size;
    t.height = size;
    const g = t.getContext('2d')!;
    const r = lcg(hashSeed(key));
    g.fillStyle = '#4f7d3a';
    g.fillRect(0, 0, size, size);
    // 흙·그늘 얼룩
    for (let k = 0; k < 18; k++) {
      g.fillStyle = `rgba(60,45,25,${0.08 + r() * 0.12})`;
      g.beginPath();
      g.ellipse(r() * size, r() * size, 10 + r() * 22, 6 + r() * 12, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    const greens = ['#6fae4e', '#5c9a40', '#86c05e', '#4e8a35', '#9ad168'];
    g.lineCap = 'round';
    for (let k = 0; k < 900; k++) {
      const bx = r() * size;
      const by = r() * size;
      const len = 5 + r() * 9;
      const ang = -Math.PI / 2 + (r() - 0.5) * 1.1;
      g.strokeStyle = greens[Math.floor(r() * greens.length)];
      g.lineWidth = 1 + r() * 1.2;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + Math.cos(ang) * len * 0.5 + (r() - 0.5) * 3, by + Math.sin(ang) * len * 0.5, bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
      g.stroke();
    }
    // 타일 이음 숨기기: 가장자리로 갈수록 알파 0 되는 복제본 대신, 랜덤 위치 스트로크가 가장자리를 넘도록 두 번 그린다
    tileCache.set(key, t);
  }
  const p = ctx.createPattern(t, 'repeat');
  if (!p) return;
  ctx.save();
  ctx.fillStyle = p;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  texture(ctx, x, y, w, h, 'grain', 0.2, 2, 'overlay', 40);
}

/** 콘크리트·석재 면 */
export function concrete(ctx: Ctx, x: number, y: number, w: number, h: number, color = '#b8b2a6'): void {
  const g = ctx.createLinearGradient(x, y, x + w * 0.5, y + h);
  g.addColorStop(0, shade(color, 0.06));
  g.addColorStop(1, shade(color, -0.08));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  texture(ctx, x, y, w, h, 'speckle', 0.5, 1, 'overlay', 46);
  texture(ctx, x, y, w, h, 'plaster', 0.3, 2.5, 'overlay', 40);
}

/** 카펫: 파일 노이즈 + 결 */
export function carpet(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  texture(ctx, x, y, w, h, 'pile', 0.6, 1.3, 'overlay', 52);
  texture(ctx, x, y, w, h, 'grain', 0.2, 1, 'overlay', 30);
}

/** 자동차 도장: 베이스 + 클리어코트 반사(하늘·지평선) + 메탈릭 반점 */
export function carPaint(ctx: Ctx, w: number, h: number, color = '#b42a2a', horizon = 0.42): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(color, 0.32));
  g.addColorStop(Math.max(0.01, horizon - 0.06), shade(color, 0.12));
  g.addColorStop(horizon, shade(color, -0.3));
  g.addColorStop(Math.min(0.99, horizon + 0.25), shade(color, -0.05));
  g.addColorStop(1, shade(color, -0.45));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  texture(ctx, 0, 0, w, h, 'speckle', 0.22, 0.8, 'overlay', 26);
  // 하늘 반사(위쪽 밝은 띠)
  const s = ctx.createLinearGradient(0, 0, 0, h * horizon);
  s.addColorStop(0, 'rgba(255,255,255,0.35)');
  s.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  s.addColorStop(1, 'rgba(255,255,255,0.28)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, w, h * horizon);
  ctx.restore();
}
