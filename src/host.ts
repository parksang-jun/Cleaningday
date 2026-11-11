// AI 쇼호스트 "뽀득이" — 광고 제품을 라이브 커머스처럼 소개한다.
//  · 얼굴: 운영자가 올린 실사 영상/사진이 있으면 그것(avatar.ts), 없으면 내장 마스코트(청소 거품 캐릭터, 레이어 애니메이션)
//  · 멘트는 광고주가 낸 시험 성적·소구점·리뷰 수치로 자동 생성 (운영자가 직접 쓴 멘트가 있으면 그것을 우선)
//  · 음성: 브라우저/웹뷰의 speechSynthesis(TTS). 설정에서 끌 수 있고, 지원 안 되면 자막만 나온다
//  · 과장 방지: 성능 문장은 시험 성적서 수치만, 주의 재질은 라벨 그대로 항상 읽어 준다
import { track } from './analytics';
import { animateAvatar, avatarHtml, type HostMedia } from './avatar';
import { BASE_DETERGENTS, BASE_TOOLS, type DirtType, type SurfaceType } from './game/catalog';
import { type SponsorProduct } from './game/sponsor';
import { LANG_TAG, pitchLines, type Placement, type PitchContext } from './pitch';
import { t, type Lang } from './i18n';
export { bestLab, pitchLines, type Placement, type PitchContext } from './pitch';
import { iconFor } from './ui/icons';


export interface HostShowOptions {
  product: SponsorProduct;
  placement: Placement;
  lang: Lang;
  hostName: string;
  /** 지금 막힌 오염 (멘트에 반영) */
  dirt?: DirtType;
  surface?: SurfaceType;
  speak: boolean;
  /** 무료 체험(보상형 광고) — 성공하면 true */
  onTrial?: () => Promise<boolean>;
  onBuy?: () => void;
  onEvidence?: () => void;
  onClose?: () => void;
  /** 체험 버튼 문구를 바꿀 때 (결과 화면: "다음 판에서 체험") */
  trialLabel?: string;
  hideTrial?: boolean;
  /** 실사 사진·영상 (운영자 설정) — 없으면 내장 초상 */
  media?: HostMedia;
  /** 결과 화면: 이 제품을 이번 판에서 어떻게 만났나 */
  context?: PitchContext;
  /** context='category' 일 때 플레이어가 쓴 일반 제품 이름 */
  usedItem?: string;
  /** 미리 녹음·생성한 쇼호스트 음성(mp3 URL) — 있으면 브라우저 TTS 대신 재생하고 자막을 길이에 맞춰 넘긴다 */
  audio?: string;
  /** 구매 버튼 문구 (예: "쿠팡에서 보기") */
  buyLabel?: string;
}



// ---------- TTS ----------
let voices: SpeechSynthesisVoice[] = [];
function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  } catch {
    return null;
  }
}
function loadVoices(): void {
  const s = synth();
  if (!s) return;
  try {
    voices = s.getVoices();
    s.onvoiceschanged = () => {
      voices = s.getVoices();
    };
  } catch {
    /* ignore */
  }
}
loadVoices();

/**
 * 가장 사람 같은 목소리 고르기 — 기기마다 설치된 목소리가 다르다.
 *  점수: 신경망·프리미엄·네트워크 목소리(Google/Microsoft 온라인, iOS "향상된 품질") > 여성 이름 휴리스틱 > 기본 목소리.
 *  iOS 는 설정 > 손쉬운 사용 > 음성 콘텐츠에서 "유나(향상됨)" 등을 받아 두면 훨씬 자연스럽다.
 */
function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const tag = LANG_TAG[lang];
  const pref = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(tag.slice(0, 2)));
  if (!pref.length) return null;
  const score = (v: SpeechSynthesisVoice) => {
    let n = 0;
    const name = v.name;
    if (/neural|natural|premium|enhanced|향상|プレミアム|online|wavenet|studio/i.test(name)) n += 40;
    if (!v.localService) n += 25; // 온라인(서버) 목소리는 대개 신경망 TTS
    if (/google|microsoft|siri/i.test(name)) n += 15;
    if (/yuna|유나|sora|소라|heami|kyoko|nanami|samantha|aria|jenny|sunhi|선히|injoon|female|woman/i.test(name)) n += 10;
    if (/compact|eloquence|novelty|whisper|bells|bad news|bubbles/i.test(name)) n -= 30;
    if (v.default) n += 2;
    return n;
  };
  return [...pref].sort((a, b) => score(b) - score(a))[0];
}

export function ttsAvailable(): boolean {
  return Boolean(synth());
}

/** 한 줄 말하기 — 끝나면 resolve (TTS 가 없거나 실패하면 즉시 false) */
export function speakLine(text: string, lang: Lang): Promise<boolean> {
  const s = synth();
  if (!s) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[✔✨—]/g, ' '));
      u.lang = LANG_TAG[lang];
      const v = pickVoice(lang);
      if (v) u.voice = v;
      // 자연스러움: 속도는 보통, 음높이는 기본 — 높이면 기계음이 두드러진다
      u.rate = lang === 'ko' ? 1.0 : 0.98;
      u.pitch = 1.0;
      u.volume = 1;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      // 일부 웹뷰는 onend 가 안 오므로 안전 타임아웃
      setTimeout(() => finish(true), Math.max(2500, text.length * 140));
      s.speak(u);
    } catch {
      resolve(false);
    }
  });
}

export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}

// ---------- 화면 ----------
let current: { el: HTMLElement; close: () => void } | null = null;

export function hostOpen(): boolean {
  return current !== null;
}

export function closeHost(): void {
  current?.close();
}

/** 목록·결과 카드용 작은 아바타 (애니메이션 없음) */
export function hostAvatarSmall(media?: HostMedia): string {
  return avatarHtml(media, { small: true });
}

/** 쇼호스트 등장 — 반환값은 닫기 함수 */
export function showHost(o: HostShowOptions): () => void {
  closeHost();
  const p = o.product;
  const lines = pitchLines(p, o.lang, { hostName: o.hostName, placement: o.placement, dirt: o.dirt, surface: o.surface });
  const base = p.kind === 'tool' ? BASE_TOOLS[p.base as keyof typeof BASE_TOOLS] : BASE_DETERGENTS[p.base as keyof typeof BASE_DETERGENTS];
  const el = document.createElement('div');
  el.className = `host host--${o.placement}`;
  el.dataset.testid = 'host';
  el.dataset.placement = o.placement;
  el.dataset.sponsor = p.id;
  if (o.context) el.dataset.context = o.context;
  const trialLabel = o.trialLabel ?? t('hostTrial');
  el.innerHTML = `
    <div class="host__card" role="dialog" aria-label="${t('hostTitle', { name: o.hostName })}">
      <div class="host__top">
        <span class="host__live">● LIVE</span>
        <span class="host__name">${t('hostTitle', { name: o.hostName })} <span class="host__ai" title="${t('hostAiTag')}">${t('hostAiTag')}</span></span>
        ${p.affiliate ? `<span class="tag-affiliate" data-testid="host-affiliate">${t('affiliateBadge')}</span>` : `<span class="tag-ad">${t('sponsored')}</span>`}${p.sample ? `<span class="tag-sample">${t('sample')}</span>` : ''}
        <button class="host__close" data-act="close" aria-label="${t('close')}" data-testid="host-close">✕</button>
      </div>
      <div class="host__body">
        <div class="host__avatar">${avatarHtml(o.media)}</div>
        <div class="host__bubble"><p class="host__line" data-el="line" data-testid="host-line"></p><div class="host__dots" data-el="dots"></div></div>
      </div>
      <div class="host__product">
        <span class="host__icon">${iconFor(base?.base ?? p.base)}</span>
        <span class="host__pname"><b>${p.brand} ${p.name}</b><span class="small muted">${p.tagline ?? t(`item_${p.base}`)}</span></span>
        ${o.onEvidence ? `<button class="btn btn--sm" data-act="evidence" data-testid="host-evidence">${t('evidence')}</button>` : ''}
      </div>
      <div class="host__cta">
        ${o.hideTrial || !o.onTrial || p.affiliate ? '' : `<button class="btn btn--ad btn--block" data-act="trial" data-testid="host-trial">${trialLabel}</button>`}
        ${o.onBuy ? `<button class="btn btn--primary btn--block" data-act="buy" data-testid="host-buy">${o.buyLabel ?? t('mallBuy')}</button>` : ''}
      </div>
      <p class="host__foot small muted" data-testid="host-foot">${p.affiliate ? (o.lang === 'ko' ? t('coupangDisclosure') : t('mallDisclosure')) : t('hostFoot')}</p>
    </div>`;
  document.body.appendChild(el);
  const lineEl = el.querySelector<HTMLElement>('[data-el="line"]')!;
  const dotsEl = el.querySelector<HTMLElement>('[data-el="dots"]')!;
  const avatar = animateAvatar(el.querySelector<HTMLElement>('[data-el="avatar"]')!);
  const hasVideo = el.querySelector('video') !== null;
  // 영상이 있으면 영상 음성이 목소리 — 소리 있는 재생이 막힌 경우에만 TTS 로 대체
  let speak = o.speak && !hasVideo;
  const videoReady = hasVideo ? avatar.playVideo().then((ok) => (speak = o.speak && !ok)) : Promise.resolve();
  // 미리 만든 음성(mp3)이 있으면 그것이 목소리 — 자막은 음성 길이를 멘트 글자 수로 나눠 맞춘다
  const audio = !hasVideo && o.audio && o.speak ? new Audio(o.audio) : null;
  let audioOn = false;
  const totalChars = lines.reduce((n, l) => n + l.length, 0) || 1;
  const audioReady = audio
    ? audio
        .play()
        .then(() => {
          audioOn = true;
          speak = false;
        })
        .catch(() => {
          audioOn = false;
        })
    : Promise.resolve();
  const waitAudioUntil = (share: number) =>
    new Promise<void>((resolve) => {
      const tick = () => {
        if (!alive || !audio || audio.ended || audio.error) return resolve();
        const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
        if (dur && audio.currentTime >= dur * share - 0.05) return resolve();
        timer = setTimeout(tick, 100);
      };
      tick();
    });
  let idx = 0;
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const renderDots = () => {
    dotsEl.innerHTML = lines.map((_, i) => `<i class="${i === idx ? 'is-on' : i < idx ? 'is-done' : ''}"></i>`).join('');
  };
  const typeLine = (text: string): Promise<void> =>
    new Promise((resolve) => {
      let n = 0;
      lineEl.textContent = '';
      const step = () => {
        if (!alive) return resolve();
        n = Math.min(text.length, n + 2);
        lineEl.innerHTML = esc(text.slice(0, n)) + (n < text.length ? '<span class="host__caret">▍</span>' : '');
        if (n < text.length) timer = setTimeout(step, 28);
        else resolve();
      };
      step();
    });
  const next = async () => {
    if (!alive) return;
    if (idx >= lines.length) {
      avatar.talking(false);
      return;
    }
    renderDots();
    const text = lines[idx];
    avatar.talking(true);
    // 문장이 시작될 때 눈썹을 살짝 올려 강조
    avatar.emph();
    if (idx === 0) await Promise.all([videoReady, audioReady]);
    if (!alive) return;
    const spoken = speak ? speakLine(text, o.lang) : Promise.resolve(false);
    await typeLine(text);
    const ok = await spoken;
    if (!alive) return;
    if (audioOn) {
      // 이 멘트까지의 글자 비율만큼 음성이 진행될 때까지 기다린다
      const upTo = lines.slice(0, idx + 1).reduce((n, l) => n + l.length, 0) / totalChars;
      await waitAudioUntil(upTo);
    } else if (!ok) await new Promise((r) => (timer = setTimeout(r, Math.max(1400, text.length * 55)))); // 음성이 없으면 읽을 시간을 준다
    if (!alive) return;
    idx++;
    void next();
  };
  const close = () => {
    if (!alive) return;
    alive = false;
    if (timer) clearTimeout(timer);
    avatar.stop();
    stopSpeaking();
    try {
      audio?.pause();
    } catch {
      /* ignore */
    }
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
    current = null;
    o.onClose?.();
  };
  current = { el, close };
  el.querySelector('[data-act="close"]')!.addEventListener('click', () => {
    track('host_close', { sponsor: p.id, placement: o.placement, line: idx });
    close();
  });
  // 말풍선을 누르면 다음 멘트로
  el.querySelector('.host__bubble')!.addEventListener('click', () => {
    if (timer) clearTimeout(timer);
    stopSpeaking();
    idx++;
    void next();
  });
  el.querySelector('[data-act="trial"]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true;
    track('host_cta_trial', { sponsor: p.id, placement: o.placement });
    stopSpeaking();
    const ok = await o.onTrial!();
    if (ok) close();
    else b.disabled = false;
  });
  el.querySelector('[data-act="buy"]')?.addEventListener('click', () => {
    track('host_cta_buy', { sponsor: p.id, placement: o.placement });
    o.onBuy?.();
  });
  el.querySelector('[data-act="evidence"]')?.addEventListener('click', () => o.onEvidence?.());
  track('host_show', { sponsor: p.id, placement: o.placement, lines: lines.length });
  requestAnimationFrame(() => el.classList.add('is-in'));
  void next();
  return close;
}
