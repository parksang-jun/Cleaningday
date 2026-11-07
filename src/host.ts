// AI 쇼호스트 "반디" — 광고 제품을 라이브 커머스처럼 소개한다.
//  · 멘트는 광고주가 낸 시험 성적·소구점·리뷰 수치로 자동 생성 (운영자가 직접 쓴 멘트가 있으면 그것을 우선)
//  · 음성: 브라우저/웹뷰의 speechSynthesis(TTS). 설정에서 끌 수 있고, 지원 안 되면 자막만 나온다
//  · 과장 방지: 성능 문장은 시험 성적서 수치만, 주의 재질은 라벨 그대로 항상 읽어 준다
import { track } from './analytics';
import { BASE_DETERGENTS, BASE_TOOLS, type DirtType, type SurfaceType } from './game/catalog';
import { performanceRatios, type SponsorProduct } from './game/sponsor';
import { t, type Lang } from './i18n';
import { iconFor } from './ui/icons';

export type Placement = 'intro' | 'struggle' | 'result' | 'shop' | 'preview';

export interface HostShowOptions {
  product: SponsorProduct;
  placement: Placement;
  lang: Lang;
  hostName: string;
  /** 지금 막힌 오염 (멘트에 반영) */
  dirt?: DirtType;
  speak: boolean;
  /** 무료 체험(보상형 광고) — 성공하면 true */
  onTrial?: () => Promise<boolean>;
  onBuy?: () => void;
  onEvidence?: () => void;
  onClose?: () => void;
  /** 체험 버튼 문구를 바꿀 때 (결과 화면: "다음 판에서 체험") */
  trialLabel?: string;
  hideTrial?: boolean;
}

const LANG_TAG: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

function fmt(n: number, lang: Lang): string {
  try {
    return n.toLocaleString(LANG_TAG[lang]);
  } catch {
    return String(n);
  }
}

function baseName(p: SponsorProduct): string {
  return t(`item_${p.base}`);
}

/** 가장 좋은 시험 결과 (지정 오염이 있으면 그것, 없으면 제거율이 가장 높은 것) */
export function bestLab(p: SponsorProduct, dirt?: DirtType): { dirt: DirtType; removalPct: number; ratio: number } | null {
  const ratios = performanceRatios(p);
  const pick = (dirt && p.lab.find((l) => l.dirt === dirt)) || [...p.lab].sort((a, b) => b.removalPct - a.removalPct)[0];
  if (!pick) return null;
  return { dirt: pick.dirt, removalPct: pick.removalPct, ratio: ratios[pick.dirt] };
}

/** 쇼호스트 멘트 생성 */
export function pitchLines(p: SponsorProduct, lang: Lang, opts: { hostName: string; placement: Placement; dirt?: DirtType }): string[] {
  const lines: string[] = [];
  const custom = p.hostLines?.[lang]?.map((l) => l.replace(/\{brand\}/g, p.brand).replace(/\{name\}/g, p.name).replace(/\{host\}/g, opts.hostName)).filter(Boolean) ?? [];
  const lab = bestLab(p, opts.dirt);
  const x = lab && lab.ratio > 1.05 ? Math.round(lab.ratio * 10) / 10 : 0;
  const dirtName = (d: DirtType) => t(`dirt_${d}`);
  const cautions = p.cautions.map((s: SurfaceType) => t(`surf_${s}`)).join(', ');
  const review = p.reviews && p.reviews.count > 0 && p.reviews.rating > 0 ? p.reviews : null;
  const claims = (p.claims ?? []).filter(Boolean).slice(0, 3);
  if (lang === 'ko') {
    lines.push(`안녕하세요, 라이브 쇼호스트 ${opts.hostName}예요 ✨ 오늘은 ${p.brand} ${p.name}를 소개해 드릴게요!`);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`공인 시험에서 ${dirtName(lab.dirt)}를 ${lab.removalPct}% 제거했어요${x ? ` — 일반 ${baseName(p)}보다 ${x}배 빨라요!` : '!'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`리뷰 ${fmt(review.count, lang)}개, 평점 ${review.rating}점${review.source ? ` (${review.source})` : ''} — 사용자 평이 아주 좋아요!`);
    }
    if (cautions) lines.push(`단, ${cautions}에는 쓰지 마세요. 라벨 주의사항이에요.`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`지금 막힌 ${opts.dirt ? dirtName(opts.dirt) : '오염'}, 이 제품이면 바로 지워져요. 이번 판에서 무료로 써보세요!`);
        break;
      case 'result':
        lines.push(`다음 판에서 무료로 써보실 수 있어요. 지금 바로 구매도 가능해요!`);
        break;
      case 'intro':
        lines.push(`이번 판에서 무료로 써볼 수 있어요. 광고 한 편이면 끝!`);
        break;
      default:
        lines.push(`지금 바로 체험해 보세요!`);
    }
  } else if (lang === 'ja') {
    lines.push(`こんにちは、ライブホストの${opts.hostName}です ✨ 今日は ${p.brand} ${p.name} をご紹介します！`);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`公的試験で${dirtName(lab.dirt)}を${lab.removalPct}%除去${x ? ` — 一般の${baseName(p)}より${x}倍速い！` : '！'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`レビュー${fmt(review.count, lang)}件、評価${review.rating}点${review.source ? `（${review.source}）` : ''} — 評判がとても良いです！`);
    }
    if (cautions) lines.push(`ただし、${cautions}には使わないでください。ラベルの注意事項です。`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`今つまずいている${opts.dirt ? dirtName(opts.dirt) : '汚れ'}、この製品ならすぐ落ちます。このステージで無料で試そう！`);
        break;
      case 'result':
        lines.push(`次のステージで無料で試せます。今すぐ購入も！`);
        break;
      case 'intro':
        lines.push(`このステージで無料で試せます。広告1本でOK！`);
        break;
      default:
        lines.push(`今すぐ試してみよう！`);
    }
  } else {
    lines.push(`Hi, I'm ${opts.hostName}, your live host ✨ Today I'm showing you the ${p.brand} ${p.name}!`);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`In certified lab tests it removed ${lab.removalPct}% of ${dirtName(lab.dirt)}${x ? ` — ${x}× faster than a standard ${baseName(p)}!` : '!'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`${fmt(review.count, lang)} reviews, rated ${review.rating}${review.source ? ` (${review.source})` : ''} — people love it!`);
    }
    if (cautions) lines.push(`One thing: don't use it on ${cautions}. That's straight from the label.`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`Stuck on ${opts.dirt ? dirtName(opts.dirt) : 'that mess'}? This takes it right off. Try it free this stage!`);
        break;
      case 'result':
        lines.push(`Try it free in the next stage — or grab it now!`);
        break;
      case 'intro':
        lines.push(`You can try it free in this stage. One ad and it's yours!`);
        break;
      default:
        lines.push(`Try it now!`);
    }
  }
  return lines;
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

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const tag = LANG_TAG[lang];
  const pref = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(tag.slice(0, 2)));
  if (!pref.length) return null;
  // 여성·자연스러운 목소리 우선 (이름 휴리스틱), 그다음 기본 목소리
  const fav = pref.find((v) => /female|woman|yuna|sora|heami|kyoko|samantha|aria|jenny|google/i.test(v.name)) ?? pref.find((v) => v.default) ?? pref[0];
  return fav;
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
      u.rate = lang === 'ko' ? 1.05 : 1.0;
      u.pitch = 1.15;
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

/** 쇼호스트 캐릭터 (원창작 마스코트 "반디": 반짝이 요정 + 헤드셋) */
export function hostAvatarSvg(): string {
  return `<svg viewBox="0 0 120 120" class="host__svg" aria-hidden="true">
    <defs><radialGradient id="hb" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#ffe9f3"/><stop offset="1" stop-color="#ffc6dd"/></radialGradient>
    <linearGradient id="hr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fd4c4"/><stop offset="1" stop-color="#2aa897"/></linearGradient></defs>
    <path class="host__spark" d="M60 4 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#ffd54f"/>
    <path d="M30 118 Q60 62 90 118 Z" fill="url(#hr)"/>
    <ellipse cx="60" cy="112" rx="34" ry="6" fill="rgba(0,0,0,0.12)"/>
    <circle cx="60" cy="60" r="32" fill="url(#hb)" stroke="#f3a9c6" stroke-width="2"/>
    <path d="M30 56 Q34 30 60 28 Q86 30 90 56 Q78 46 60 50 Q42 46 30 56Z" fill="#6b4a3a"/>
    <path d="M26 64 a34 34 0 0 1 68 0" fill="none" stroke="#2d3b4a" stroke-width="5" stroke-linecap="round"/>
    <circle cx="26" cy="66" r="6" fill="#2d3b4a"/><circle cx="94" cy="66" r="6" fill="#2d3b4a"/>
    <path d="M94 70 q4 14 -12 18" fill="none" stroke="#2d3b4a" stroke-width="3.5" stroke-linecap="round"/><circle cx="80" cy="89" r="3.2" fill="#2d3b4a"/>
    <ellipse cx="48" cy="62" rx="4.6" ry="6" fill="#2b2f3a"/><ellipse cx="72" cy="62" rx="4.6" ry="6" fill="#2b2f3a"/>
    <circle cx="50" cy="59" r="1.6" fill="#fff"/><circle cx="74" cy="59" r="1.6" fill="#fff"/>
    <ellipse cx="40" cy="72" rx="6" ry="3.4" fill="#ffb0c8" opacity=".8"/><ellipse cx="80" cy="72" rx="6" ry="3.4" fill="#ffb0c8" opacity=".8"/>
    <path class="host__mouth" d="M53 78 Q60 86 67 78" fill="#d9475f" stroke="#c23a52" stroke-width="1.5"/>
    <g class="host__hand"><circle cx="100" cy="96" r="8" fill="#ffd8e6" stroke="#f3a9c6" stroke-width="2"/></g>
  </svg>`;
}

/** 쇼호스트 등장 — 반환값은 닫기 함수 */
export function showHost(o: HostShowOptions): () => void {
  closeHost();
  const p = o.product;
  const lines = pitchLines(p, o.lang, { hostName: o.hostName, placement: o.placement, dirt: o.dirt });
  const base = p.kind === 'tool' ? BASE_TOOLS[p.base as keyof typeof BASE_TOOLS] : BASE_DETERGENTS[p.base as keyof typeof BASE_DETERGENTS];
  const el = document.createElement('div');
  el.className = `host host--${o.placement}`;
  el.dataset.testid = 'host';
  el.dataset.placement = o.placement;
  el.dataset.sponsor = p.id;
  const trialLabel = o.trialLabel ?? t('hostTrial');
  el.innerHTML = `
    <div class="host__card" role="dialog" aria-label="${t('hostTitle', { name: o.hostName })}">
      <div class="host__top">
        <span class="host__live">● LIVE</span>
        <span class="host__name">${t('hostTitle', { name: o.hostName })}</span>
        <span class="tag-ad">${t('sponsored')}</span>${p.sample ? `<span class="tag-sample">${t('sample')}</span>` : ''}
        <button class="host__close" data-act="close" aria-label="${t('close')}" data-testid="host-close">✕</button>
      </div>
      <div class="host__body">
        <div class="host__avatar is-talking">${hostAvatarSvg()}</div>
        <div class="host__bubble"><p class="host__line" data-el="line" data-testid="host-line"></p><div class="host__dots" data-el="dots"></div></div>
      </div>
      <div class="host__product">
        <span class="host__icon">${iconFor(base?.base ?? p.base)}</span>
        <span class="host__pname"><b>${p.brand} ${p.name}</b><span class="small muted">${p.tagline ?? t(`item_${p.base}`)}</span></span>
        ${o.onEvidence ? `<button class="btn btn--sm" data-act="evidence" data-testid="host-evidence">${t('evidence')}</button>` : ''}
      </div>
      <div class="host__cta">
        ${o.hideTrial || !o.onTrial ? '' : `<button class="btn btn--ad btn--block" data-act="trial" data-testid="host-trial">${trialLabel}</button>`}
        ${o.onBuy ? `<button class="btn btn--primary btn--block" data-act="buy" data-testid="host-buy">${t('mallBuy')}</button>` : ''}
      </div>
      <p class="host__foot small muted">${t('hostFoot')}</p>
    </div>`;
  document.body.appendChild(el);
  const lineEl = el.querySelector<HTMLElement>('[data-el="line"]')!;
  const dotsEl = el.querySelector<HTMLElement>('[data-el="dots"]')!;
  const avatar = el.querySelector<HTMLElement>('.host__avatar')!;
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
      avatar.classList.remove('is-talking');
      return;
    }
    renderDots();
    const text = lines[idx];
    avatar.classList.add('is-talking');
    const spoken = o.speak ? speakLine(text, o.lang) : Promise.resolve(false);
    await typeLine(text);
    const ok = await spoken;
    if (!alive) return;
    // 음성이 없으면 읽을 시간을 준다
    if (!ok) await new Promise((r) => (timer = setTimeout(r, Math.max(1400, text.length * 55))));
    if (!alive) return;
    idx++;
    void next();
  };
  const close = () => {
    if (!alive) return;
    alive = false;
    if (timer) clearTimeout(timer);
    stopSpeaking();
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
