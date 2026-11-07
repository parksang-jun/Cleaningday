// WebAudio 합성 사운드 — 오디오 파일 없이 모든 소리를 만든다.
//  · 마스터 버스(컴프레서 + 볼륨) 위에 효과음(SFX)과 배경음악(BGM) 버스
//  · 첫 터치/클릭에서 잠금 해제. iOS 는 무음 스위치가 켜져 있으면 WebAudio 가 조용하므로
//    짧은 무음 <audio> 를 재생해 재생 카테고리로 바꾼다(unmute 트릭).
//  · 도구별 문지르는 소리(걸레 스윽, 솔 북북, 청소기 윙, 물 쏴, 고압 쐐, 스퀴지 끽, 스팀 치익, 돌돌이 찍찍)
//  · 이벤트: 분사, 반짝임(콤보 음높이), 발견, "싹!", 틀린 도구 둔탁음, 경고, 완료 팡파르, 별, 코인, 구매, 시작, 마지막 10초 째깍, 실패
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let bgmBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let sfxEnabled = true;
let bgmEnabled = true;
let unlocked = false;

// 문지르기 지속음
interface ScrubNode {
  src: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  trem?: GainNode;
  osc?: OscillatorNode;
  oscGain?: GainNode;
  lfo?: OscillatorNode;
  profile: ScrubProfile;
}
let scrub: ScrubNode | null = null;
// 마지막으로 scrubSound 가 불린 시각 — 프레임마다 갱신되지 않으면(판 종료·화면 전환) 감시 타이머가 끈다
let scrubAt = 0;
let scrubWatch: number | null = null;

export type ScrubProfile = 'cloth' | 'sponge' | 'brush' | 'vacuum' | 'water' | 'washer' | 'squeegee' | 'steam' | 'roller' | 'mitt';

const PROFILE: Record<ScrubProfile, { type: BiquadFilterType; freq: number; q: number; gain: number; hum?: number; humType?: OscillatorType; lfo?: number; lfoDepth?: number }> = {
  cloth: { type: 'bandpass', freq: 1500, q: 0.7, gain: 0.5 },
  sponge: { type: 'bandpass', freq: 1100, q: 0.9, gain: 0.55, lfo: 7, lfoDepth: 0.5 },
  mitt: { type: 'lowpass', freq: 900, q: 0.6, gain: 0.5, lfo: 5, lfoDepth: 0.4 },
  brush: { type: 'bandpass', freq: 2600, q: 1.1, gain: 0.7, lfo: 9, lfoDepth: 0.7 },
  roller: { type: 'highpass', freq: 2500, q: 0.8, gain: 0.6, lfo: 14, lfoDepth: 0.9 },
  vacuum: { type: 'lowpass', freq: 700, q: 0.5, gain: 0.55, hum: 118, humType: 'sawtooth' },
  water: { type: 'bandpass', freq: 900, q: 0.4, gain: 0.7, lfo: 3, lfoDepth: 0.35 },
  washer: { type: 'highpass', freq: 1200, q: 0.4, gain: 0.9, hum: 85, humType: 'sawtooth' },
  squeegee: { type: 'bandpass', freq: 3200, q: 6, gain: 0.45, hum: 1900, humType: 'sine', lfo: 4, lfoDepth: 0.6 },
  steam: { type: 'highpass', freq: 3800, q: 0.5, gain: 0.6, lfo: 2.5, lfoDepth: 0.3 },
};

export function setSoundEnabled(on: boolean): void {
  sfxEnabled = on;
  if (!on) stopScrub();
  if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02);
}

export function setMusicEnabled(on: boolean): void {
  bgmEnabled = on;
  if (bgmBus && ctx) bgmBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.1);
  if (on && unlocked) startMusic();
}

export function isUnlocked(): boolean {
  return unlocked && ctx?.state === 'running';
}

/** 테스트용 상태 */
export function audioDebug(): { unlocked: boolean; state: string; musicStep: number; sfx: boolean; music: boolean; scrub: string | null } {
  return { unlocked, state: ctx?.state ?? 'none', musicStep, sfx: sfxEnabled, music: bgmEnabled, scrub: scrub?.profile ?? null };
}

/** 첫 사용자 입력 안에서 호출 — 컨텍스트 생성·재개, iOS 무음 스위치 우회 */
export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 20;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.12;
      master.connect(comp).connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = sfxEnabled ? 1 : 0;
      sfxBus.connect(master);
      bgmBus = ctx.createGain();
      bgmBus.gain.value = bgmEnabled ? 1 : 0;
      bgmBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
      return;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  if (!unlocked) {
    unlocked = true;
    iosUnmute();
    // 아주 짧은 무음을 재생해 iOS/사파리가 컨텍스트를 "사용 중"으로 보게 함
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
    if (bgmEnabled) startMusic();
  }
}

/** iOS: 무음 스위치가 켜져 있어도 소리가 나도록 미디어 재생 카테고리로 전환 (짧은 무음 WAV) */
function iosUnmute(): void {
  try {
    const el = document.createElement('audio');
    el.setAttribute('playsinline', '');
    el.setAttribute('preload', 'auto');
    el.loop = false;
    // 0.05초 무음 WAV (44 바이트 헤더 + 데이터)
    el.src = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
    el.volume = 0.01;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* ignore */
  }
}

/** 페이지 어디서든 첫 입력에 잠금 해제 (한 번만) */
export function installAudioUnlock(): void {
  const once = () => {
    unlockAudio();
    if (unlocked) {
      window.removeEventListener('pointerdown', once, true);
      window.removeEventListener('touchend', once, true);
      window.removeEventListener('keydown', once, true);
    }
  };
  window.addEventListener('pointerdown', once, true);
  window.addEventListener('touchend', once, true);
  window.addEventListener('keydown', once, true);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      stopScrub();
      pauseMusic();
    } else if (bgmEnabled && unlocked) {
      void ctx.resume().then(() => startMusic());
    }
  });
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.2, delay = 0, slideTo?: number, bus: GainNode | null = sfxBus): void {
  if (!ctx || !bus) return;
  if (bus === sfxBus && !sfxEnabled) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(bus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(dur: number, gain: number, filter: { type: BiquadFilterType; from: number; to?: number; q?: number }, delay = 0): void {
  if (!ctx || !noiseBuf || !sfxBus || !sfxEnabled) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filter.type;
  f.frequency.setValueAtTime(filter.from, t0);
  if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur);
  f.Q.value = filter.q ?? 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/** 문지르기 지속음: 도구 프로필 + 세기(0~1) */
export function scrubSound(intensity: number, profile: ScrubProfile = 'cloth'): void {
  if (!sfxEnabled || !ctx || !noiseBuf || !sfxBus) return;
  const p = PROFILE[profile];
  if (scrub && scrub.profile !== profile) {
    killScrub();
  }
  if (!scrub) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = p.type;
    filter.frequency.value = p.freq;
    filter.Q.value = p.q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    // 떨림은 별도 단(trem)에 건다 — 주 게인에 직접 걸면 게인 0 에서도 ±떨림만큼 소리가 남는다
    const trem = ctx.createGain();
    trem.gain.value = 1;
    src.connect(filter).connect(trem).connect(gain).connect(sfxBus);
    src.start();
    const node: ScrubNode = { src, filter, gain, trem, profile };
    if (p.hum) {
      const osc = ctx.createOscillator();
      osc.type = p.humType ?? 'sawtooth';
      osc.frequency.value = p.hum;
      const og = ctx.createGain();
      og.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = p.hum * 6;
      osc.connect(lp).connect(og).connect(sfxBus);
      osc.start();
      node.osc = osc;
      node.oscGain = og;
    }
    if (p.lfo) {
      // 떨림(북북·찍찍·보글보글): LFO 가 게인을 흔듦
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = p.lfo;
      const depth = 0.5 * (p.lfoDepth ?? 0.5);
      trem.gain.value = 1 - depth;
      const lg = ctx.createGain();
      lg.gain.value = depth;
      lfo.connect(lg).connect(trem.gain);
      lfo.start();
      node.lfo = lfo;
    }
    scrub = node;
  }
  scrubAt = performance.now();
  if (scrubWatch === null) {
    scrubWatch = window.setInterval(() => {
      // 프레임 갱신이 끊기면(클리어·실패·모달·화면 전환) 자동으로 끈다
      if (scrub && performance.now() - scrubAt > 220) stopScrub();
      if (!scrub && scrubWatch !== null) {
        clearInterval(scrubWatch);
        scrubWatch = null;
      }
    }, 100);
  }
  const level = p.gain * (0.35 + 0.65 * Math.min(1, intensity));
  scrub.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.04);
  if (scrub.oscGain) scrub.oscGain.gain.setTargetAtTime(level * (profile === 'squeegee' ? 0.25 : 0.5), ctx.currentTime, 0.05);
  if (scrub.osc && profile === 'vacuum') scrub.osc.frequency.setTargetAtTime(118 + 40 * Math.min(1, intensity), ctx.currentTime, 0.2);
  if (scrub.osc && profile === 'squeegee') scrub.osc.frequency.setTargetAtTime(1500 + Math.random() * 900, ctx.currentTime, 0.08);
}

function killScrub(): void {
  if (!scrub || !ctx) return;
  const s = scrub;
  scrub = null;
  const t = ctx.currentTime;
  s.gain.gain.setTargetAtTime(0, t, 0.05);
  if (s.oscGain) s.oscGain.gain.setTargetAtTime(0, t, 0.05);
  setTimeout(() => {
    try {
      s.src.stop();
      s.osc?.stop();
      s.lfo?.stop();
    } catch {
      /* ignore */
    }
  }, 300);
}

/** 문지르기 소리 끄기 — 페이드 후 노드를 완전히 정지시킨다(다음 문지르기는 새로 만든다) */
export function stopScrub(): void {
  killScrub();
}

export const sfx = {
  /** 분사 — 치익 */
  spray(): void {
    noise(0.28, 0.35, { type: 'highpass', from: 3200, to: 5000, q: 0.6 });
  },
  /** 반짝임 — 콤보가 오를수록 높고 또렷하게 */
  sparkle(combo = 0): void {
    tone((1568 + Math.random() * 400) * Math.pow(1.06, Math.min(12, combo)), 0.14, 'sine', 0.12 + Math.min(0.12, combo * 0.012));
  },
  /** 발견 — 짧은 상승 아르페지오 */
  discover(): void {
    [659, 880, 1175, 1568].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, i * 0.07));
  },
  /** 오염 종류 완료 / 스팟 완료 — "싹!" */
  swoosh(): void {
    noise(0.4, 0.4, { type: 'bandpass', from: 500, to: 4500, q: 1.2 });
    tone(1046, 0.22, 'triangle', 0.22, 0.25);
    tone(1318, 0.28, 'triangle', 0.22, 0.34);
  },
  /** 25·50·75% 달성 — 빛이 쓸고 지나가는 "샤란~" (높을수록 한 음 위) */
  shine(frac = 0.25): void {
    const base = frac >= 0.75 ? 1046 : frac >= 0.5 ? 880 : 784;
    noise(0.5, 0.22, { type: 'bandpass', from: 1500, to: 6000, q: 0.8 });
    tone(base, 0.3, 'sine', 0.22, 0.02);
    tone(base * 1.25, 0.3, 'sine', 0.2, 0.12);
    tone(base * 1.5, 0.45, 'sine', 0.2, 0.22);
    tone(base * 2, 0.6, 'triangle', 0.14, 0.3);
  },
  /** 틀린 도구 — 둔탁한 "툭" */
  thud(): void {
    tone(150, 0.1, 'square', 0.16, 0, 90);
    noise(0.08, 0.2, { type: 'lowpass', from: 400 });
  },
  warn(): void {
    tone(220, 0.12, 'square', 0.16);
    tone(180, 0.2, 'square', 0.16, 0.12);
  },
  /** 실패 — 내려가는 두 음 */
  fail(): void {
    tone(330, 0.25, 'sawtooth', 0.18, 0, 260);
    tone(260, 0.45, 'sawtooth', 0.18, 0.25, 180);
  },
  complete(): void {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.24, i * 0.09));
    tone(1568, 0.5, 'sine', 0.16, 0.46);
  },
  star(i: number): void {
    tone(880 * Math.pow(1.26, i), 0.18, 'triangle', 0.22);
    tone(880 * Math.pow(1.26, i) * 2, 0.12, 'sine', 0.1, 0.03);
  },
  /** 코인 — 짤랑 */
  coin(i = 0): void {
    tone(1760 + i * 60, 0.08, 'square', 0.1);
    tone(2349 + i * 80, 0.12, 'sine', 0.12, 0.05);
  },
  /** 구매 — 땡 */
  buy(): void {
    tone(988, 0.1, 'triangle', 0.2);
    tone(1319, 0.25, 'triangle', 0.2, 0.1);
  },
  /** 스테이지 시작 — 휙 */
  start(): void {
    noise(0.3, 0.25, { type: 'bandpass', from: 300, to: 2400, q: 1 });
    tone(523, 0.12, 'triangle', 0.16, 0.05);
    tone(784, 0.18, 'triangle', 0.16, 0.14);
  },
  /** 오염이 새로 생김 — 톡 */
  plop(): void {
    tone(420, 0.1, 'sine', 0.16, 0, 240);
  },
  /** 마지막 10초 — 째깍 */
  tick(urgent = false): void {
    tone(urgent ? 1200 : 900, 0.05, 'square', urgent ? 0.14 : 0.08);
  },
  ui(): void {
    tone(620, 0.05, 'sine', 0.12);
  },
};

// ---------------------------------------------------------------------------
// 배경음악 — 가벼운 생성 음악 (C 펜타토닉 아르페지오 + 베이스), 100 BPM, 루프
// ---------------------------------------------------------------------------
let musicTimer: number | null = null;
let musicStep = 0;
let musicNextAt = 0;
const BPM = 104;
const STEP = 60 / BPM / 2; // 8분음표
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
const BASS = [130.81, 130.81, 174.61, 174.61, 196.0, 196.0, 146.83, 174.61]; // C C F F G G D F (마디별)
const MELODY_PATTERN = [0, 2, 4, 2, 5, 4, 2, 0, 1, 3, 5, 3, 6, 5, 3, 1, 2, 4, 7, 4, 5, 7, 4, 2, 3, 5, 4, 2, 1, 2, 0, 0];

function scheduleMusic(): void {
  if (!ctx || !bgmBus || !bgmEnabled || !unlocked) return;
  const ahead = 0.4;
  while (musicNextAt < ctx.currentTime + ahead) {
    const bar = Math.floor(musicStep / 8) % BASS.length;
    const idx = musicStep % MELODY_PATTERN.length;
    const t0 = Math.max(ctx.currentTime, musicNextAt);
    // 베이스(마디 첫 박과 5번째 박)
    if (musicStep % 8 === 0 || musicStep % 8 === 4) tone(BASS[bar], STEP * 1.6, 'triangle', 0.1, t0 - ctx.currentTime, undefined, bgmBus);
    // 멜로디(8분음표, 가끔 쉼)
    if (musicStep % 16 !== 15) tone(PENTA[MELODY_PATTERN[idx] % PENTA.length], STEP * 0.9, 'sine', 0.065, t0 - ctx.currentTime, undefined, bgmBus);
    // 하이햇 느낌의 짧은 노이즈 (짝수 박)
    if (musicStep % 2 === 0 && noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.02, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
      src.connect(f).connect(g).connect(bgmBus);
      src.start(t0);
      src.stop(t0 + 0.08);
    }
    musicNextAt += STEP;
    musicStep++;
  }
}

export function startMusic(): void {
  if (!ctx || !bgmEnabled || !unlocked || musicTimer !== null) return;
  musicNextAt = ctx.currentTime + 0.1;
  musicTimer = window.setInterval(scheduleMusic, 150);
  scheduleMusic();
}

export function pauseMusic(): void {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

/** 게임 중엔 음악을 살짝 줄이고, 메뉴에선 원래대로 */
export function duckMusic(duck: boolean): void {
  if (!ctx || !bgmBus) return;
  bgmBus.gain.setTargetAtTime(bgmEnabled ? (duck ? 0.55 : 1) : 0, ctx.currentTime, 0.3);
}
