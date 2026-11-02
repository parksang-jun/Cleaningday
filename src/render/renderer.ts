// 렌더러 — 깨끗한 장면 위에 오염층(저해상도 격자를 부드럽게 확대), 세제 거품, 반짝임, 도구 커서
import { DIRT_COLOR, DIRT_TYPES, type ItemSpec } from '../game/catalog';
import type { CleanSession } from '../game/engine';
import { paintScene } from './scene';

interface Sparkle {
  x: number;
  y: number;
  life: number;
  size: number;
}

const FOAM: Record<string, [number, number, number]> = {
  neutral: [200, 235, 255],
  alkaline: [255, 240, 190],
  acid: [210, 255, 210],
  chlorine: [235, 225, 255],
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private dirt = document.createElement('canvas');
  private foam = document.createElement('canvas');
  private dirtImg: ImageData | null = null;
  private foamImg: ImageData | null = null;
  private sparkles: Sparkle[] = [];
  private session: CleanSession | null = null;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  cursor: { x: number; y: number; item: ItemSpec; active: boolean } | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setSession(s: CleanSession) {
    this.session = s;
    this.dirt.width = s.w;
    this.dirt.height = s.h;
    this.foam.width = s.w;
    this.foam.height = s.h;
    this.dirtImg = this.dirt.getContext('2d')!.createImageData(s.w, s.h);
    this.foamImg = this.foam.getContext('2d')!.createImageData(s.w, s.h);
    this.sparkles = [];
    this.resize();
  }

  /** 컨테이너 크기에 맞춰 3:4 비율 캔버스 */
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
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.canvas.width = Math.floor(this.cssW * this.dpr);
    this.canvas.height = Math.floor(this.cssH * this.dpr);
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    paintScene(this.base.getContext('2d')!, s.level.scene, this.base.width, this.base.height);
  }

  /** 화면 좌표 → 격자 좌표 */
  toGrid(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const s = this.session!;
    return { x: ((clientX - r.left) / r.width) * s.w, y: ((clientY - r.top) / r.height) * s.h };
  }

  burst(cells: number[]) {
    const s = this.session!;
    const max = Math.min(cells.length, 6);
    for (let k = 0; k < max; k++) {
      const i = cells[Math.floor(Math.random() * cells.length)];
      this.sparkles.push({ x: (i % s.w) + 0.5, y: Math.floor(i / s.w) + 0.5, life: 1, size: 0.6 + Math.random() * 0.9 });
    }
    if (this.sparkles.length > 160) this.sparkles.splice(0, this.sparkles.length - 160);
  }

  draw(dt: number) {
    const s = this.session;
    if (!s || !this.dirtImg || !this.foamImg) return;
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.base, 0, 0);

    // 오염층
    const d = this.dirtImg.data;
    const f = this.foamImg.data;
    for (let i = 0; i < s.amount.length; i++) {
      const a = s.amount[i];
      const o = i * 4;
      if (a > 0) {
        const [r, g, b, k] = DIRT_COLOR[DIRT_TYPES[s.type[i]]];
        const gr = s.grain[i];
        d[o] = r * gr;
        d[o + 1] = g * gr;
        d[o + 2] = b * gr;
        d[o + 3] = Math.min(255, 255 * k * Math.pow(a, 0.7));
      } else d[o + 3] = 0;
      const sl = s.soakLevel(i);
      if (sl > 0) {
        const c = FOAM[s.soak[i]!.det.chemistry];
        f[o] = c[0];
        f[o + 1] = c[1];
        f[o + 2] = c[2];
        f[o + 3] = 150 * sl * (0.6 + 0.4 * s.grain[i]);
      } else f[o + 3] = 0;
    }
    this.dirt.getContext('2d')!.putImageData(this.dirtImg, 0, 0);
    this.foam.getContext('2d')!.putImageData(this.foamImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.dirt, 0, 0, W, H);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(this.foam, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // 반짝임
    const cw = W / s.w;
    for (const p of this.sparkles) {
      p.life -= dt * 1.6;
      if (p.life <= 0) continue;
      const x = p.x * cw;
      const y = p.y * cw;
      const r = p.size * cw * (0.6 + (1 - p.life) * 0.8);
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#ffffff';
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

    // 커서
    if (this.cursor) {
      const { x, y, item, active } = this.cursor;
      const r = item.radius * cw;
      ctx.save();
      ctx.lineWidth = 2 * this.dpr;
      ctx.strokeStyle = active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
      ctx.fillStyle = item.kind === 'detergent' ? 'rgba(160,220,255,0.18)' : 'rgba(255,255,255,0.12)';
      ctx.setLineDash(item.kind === 'detergent' ? [4 * this.dpr, 4 * this.dpr] : []);
      ctx.beginPath();
      ctx.arc(x * cw, y * cw, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
