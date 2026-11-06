// WebAudio 합성 효과음 — 문지르는 소리(필터 노이즈), 분사음, 반짝임, 완료 팡파르. 첫 입력 후 생성.
let ctx: AudioContext | null = null;
let enabled = true;
let noiseBuf: AudioBuffer | null = null;
let scrubSrc: AudioBufferSourceNode | null = null;
let scrubGain: GainNode | null = null;
let scrubFilter: BiquadFilterNode | null = null;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on) stopScrub();
}

export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.07, delay = 0, slideTo?: number): void {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 문지르기 소리: 도구별 음색(필터 주파수), intensity 0~1 */
export function scrubSound(intensity: number, freq = 1800): void {
  if (!enabled || !ctx || !noiseBuf) return;
  if (!scrubSrc) {
    scrubSrc = ctx.createBufferSource();
    scrubSrc.buffer = noiseBuf;
    scrubSrc.loop = true;
    scrubFilter = ctx.createBiquadFilter();
    scrubFilter.type = 'bandpass';
    scrubFilter.Q.value = 0.8;
    scrubGain = ctx.createGain();
    scrubGain.gain.value = 0;
    scrubSrc.connect(scrubFilter).connect(scrubGain).connect(ctx.destination);
    scrubSrc.start();
  }
  scrubFilter!.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
  scrubGain!.gain.setTargetAtTime(0.09 * Math.min(1, intensity), ctx.currentTime, 0.04);
}

export function stopScrub(): void {
  if (scrubGain && ctx) scrubGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
}

export const sfx = {
  spray(): void {
    if (!enabled || !ctx || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3500;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + 0.3);
  },
  /** 반짝임 — 콤보가 오를수록 높은 음 */
  sparkle(combo = 0): void {
    tone((1568 + Math.random() * 400) * Math.pow(1.06, Math.min(12, combo)), 0.12, 'sine', 0.035 + Math.min(0.03, combo * 0.003));
  },
  /** 발견 — 짧은 상승 아르페지오 */
  discover(): void {
    [659, 880, 1175].forEach((f, i) => tone(f, 0.14, 'triangle', 0.07, i * 0.07));
  },
  /** 오염 종류 완료 — "싹!" */
  swoosh(): void {
    if (!enabled || !ctx || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(600, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.35);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + 0.45);
    tone(1046, 0.2, 'triangle', 0.07, 0.25);
    tone(1318, 0.25, 'triangle', 0.07, 0.33);
  },
  /** 틀린 도구 — 둔탁한 소리 */
  thud(): void {
    tone(140, 0.08, 'square', 0.04);
  },
  warn(): void {
    tone(220, 0.12, 'square', 0.05);
    tone(180, 0.18, 'square', 0.05, 0.12);
  },
  complete(): void {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, i * 0.09));
  },
  star(i: number): void {
    tone(880 * Math.pow(1.26, i), 0.15, 'triangle', 0.07);
  },
  ui(): void {
    tone(620, 0.04, 'sine', 0.04);
  },
};
