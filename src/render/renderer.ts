// 렌더러 — 깨끗한 장면 위에 오염층(종류별 질감, 저해상도 격자를 부드럽게 확대), 세정제 거품, 반짝임·콤보, 도구 커서(무효과 흔들림), 전후 리빌
import { DIRT_COLOR, DIRT_TEXTURE, DIRT_TYPES, type ItemSpec } from '../game/catalog';
import type { CleanSession } from '../game/engine';
import { paintLevel } from './scene';

interface Sparkle {
  x: number;
  y: number;
  life: number;
  size: number;
  hue: number;
}

const FOAM: Record<string, [number, number, number]> = {
  neutral: [200, 235, 255],
  alkaline: [255, 240, 190],
  acid: [210, 255, 210],
  chlorine: [235, 225, 255],
  solvent: [255, 220, 235],
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private dirt = document.createElement('canvas');
  private foam = document.createElement('canvas');
  private gloss = document.createElement('canvas');
  private snap = document.createElement('canvas');
  private dirtImg: ImageData | null = null;
  private foamImg: ImageData | null = null;
  private glossImg: ImageData | null = null;
  private glossCount = -1;
  private sparkles: Sparkle[] = [];
  private session: CleanSession | null = null;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private shakeUntil = 0;
  private reveal: { t: number; done: () => void } | null = null;
  private hasSnap = false;
  cursor: { x: number; y: number; item: ItemSpec; active: boolean } | null = null;
  /** 콤보 단계(0~) — 반짝임 양과 색에 반영 */
  combo = 0;
  /** 정전 모드: 손전등 반경(칸) 밖은 어둡게 */
  dark = false;
  private flashlight: { x: number; y: number } | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setSession(s: CleanSession) {
    this.session = s;
    this.dirt.width = s.w;
    this.dirt.height = s.h;
    this.foam.width = s.w;
    this.foam.height = s.h;
    this.gloss.width = s.w;
    this.gloss.height = s.h;
    this.dirtImg = this.dirt.getContext('2d')!.createImageData(s.w, s.h);
    this.foamImg = this.foam.getContext('2d')!.createImageData(s.w, s.h);
    this.glossImg = this.gloss.getContext('2d')!.createImageData(s.w, s.h);
    this.glossCount = -1;
    this.sparkles = [];
    this.reveal = null;
    this.hasSnap = false;
    this.combo = 0;
    this.dark = s.level.mode === 'dark';
    this.flashlight = null;
    this.resize();
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
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.canvas.width = Math.floor(this.cssW * this.dpr);
    this.canvas.height = Math.floor(this.cssH * this.dpr);
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    paintLevel(this.base.getContext('2d')!, s.level, this.base.width, this.base.height);
    this.hasSnap = false;
  }

  /** 화면 좌표 → 격자 좌표 */
  toGrid(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const s = this.session!;
    return { x: ((clientX - r.left) / r.width) * s.w, y: ((clientY - r.top) / r.height) * s.h };
  }

  /** 지워진 칸에서 반짝임 — 콤보가 높을수록 많이, 황금빛으로 */
  burst(cells: number[]) {
    const s = this.session!;
    const max = Math.min(cells.length, 5 + Math.min(10, this.combo));
    for (let k = 0; k < max; k++) {
      const i = cells[Math.floor(Math.random() * cells.length)];
      this.sparkles.push({ x: (i % s.w) + 0.5, y: Math.floor(i / s.w) + 0.5, life: 1, size: 0.6 + Math.random() * (0.9 + this.combo * 0.08), hue: this.combo >= 5 ? 48 : 200 });
    }
    if (this.sparkles.length > 220) this.sparkles.splice(0, this.sparkles.length - 220);
  }

  /** 큰 반짝임 (종류 완료·발견) */
  celebrate(count = 40) {
    const s = this.session!;
    for (let k = 0; k < count; k++) {
      this.sparkles.push({ x: Math.random() * s.w, y: Math.random() * s.h, life: 1, size: 0.8 + Math.random() * 1.6, hue: 48 });
    }
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

  draw(dt: number) {
    const s = this.session;
    if (!s || !this.dirtImg || !this.foamImg) return;
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;
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

    // 오염층 — 종류별 질감
    const d = this.dirtImg.data;
    const f = this.foamImg.data;
    const w = s.w;
    for (let i = 0; i < s.amount.length; i++) {
      const a = s.amount[i];
      const o = i * 4;
      if (a > 0) {
        const type = DIRT_TYPES[s.type[i]];
        const [r, g, b, k] = DIRT_COLOR[type];
        const gr = s.grain[i];
        let alpha = k * Math.pow(a, 0.7);
        let shade = gr;
        const x = i % w;
        const y = (i - x) / w;
        switch (DIRT_TEXTURE[type]) {
          case 'strand':
            alpha *= (x * 7 + y * 11) % 5 === 0 || gr > 1.12 ? 1 : 0.22;
            shade = 0.9;
            break;
          case 'dots':
            alpha *= gr > 1.02 ? 1 : 0.4;
            shade = gr > 1.02 ? 0.85 : 1.05;
            break;
          case 'film':
            alpha *= 0.85;
            shade = 0.9 + (gr - 1) * 0.3;
            break;
          case 'sheen':
            alpha *= 0.7 + 0.3 * Math.sin((x + y) * 0.9);
            shade = 1.1;
            break;
          case 'powder':
            alpha *= 0.8 + 0.2 * gr;
            break;
          default:
            shade = 0.75 + 0.25 * gr;
        }
        d[o] = Math.min(255, r * shade);
        d[o + 1] = Math.min(255, g * shade);
        d[o + 2] = Math.min(255, b * shade);
        d[o + 3] = Math.min(255, 255 * alpha);
      } else d[o + 3] = 0;
      const sl = s.soakLevel(i);
      if (sl > 0) {
        const c = FOAM[s.soak[i]!.det.chemistry] ?? FOAM.neutral;
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
    const cw = W / s.w;
    // 광택 마감: 고성능 장비로 지운 칸은 은은한 광이 돌고 드문드문 반짝인다
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
      // 반짝임: 고정 위치의 작은 별이 번갈아 빛남
      const now = performance.now() / 1000;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < s.shine.length; i += 1) {
        if (!s.shine[i] || s.amount[i] > 0) continue;
        const h = (i * 2654435761) >>> 0;
        if (h % 47 !== 0) continue;
        const tw = 0.5 + 0.5 * Math.sin(now * 2.2 + (h % 628) / 100);
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
    ctx.drawImage(this.dirt, 0, 0, W, H);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(this.foam, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // 스팟 모드: 표적 링 (완료되면 체크)
    if (s.spots.length) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
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
        // 손전등 바깥 전체를 더 어둡게
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

    this.drawSparkles(dt, W);

    // 커서
    if (this.cursor) {
      const { x, y, item, active } = this.cursor;
      const r = item.radius * cw;
      const shaking = performance.now() < this.shakeUntil;
      const jx = shaking ? (Math.random() - 0.5) * 6 * this.dpr : 0;
      ctx.save();
      ctx.lineWidth = 2 * this.dpr;
      ctx.strokeStyle = shaking ? 'rgba(255,90,70,0.95)' : active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
      ctx.fillStyle = shaking ? 'rgba(255,90,70,0.18)' : item.kind === 'detergent' ? 'rgba(160,220,255,0.18)' : 'rgba(255,255,255,0.12)';
      ctx.setLineDash(item.kind === 'detergent' ? [4 * this.dpr, 4 * this.dpr] : []);
      ctx.beginPath();
      ctx.arc(x * cw + jx, y * cw, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
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
    }
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
