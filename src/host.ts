// AI 쇼호스트 "뽀득이" — 광고 제품을 라이브 커머스처럼 소개한다.
//  · 얼굴: 운영자가 올린 실사 영상/사진이 있으면 그것(avatar.ts), 없으면 내장 마스코트(청소 거품 캐릭터, 레이어 애니메이션)
//  · 멘트는 광고주가 낸 시험 성적·소구점·리뷰 수치로 자동 생성 (운영자가 직접 쓴 멘트가 있으면 그것을 우선)
//  · 음성: 브라우저/웹뷰의 speechSynthesis(TTS). 설정에서 끌 수 있고, 지원 안 되면 자막만 나온다
//  · 과장 방지: 성능 문장은 시험 성적서 수치만, 주의 재질은 라벨 그대로 항상 읽어 준다
import { track } from './analytics';
import { animateAvatar, avatarHtml, type HostMedia } from './avatar';
import { BASE_DETERGENTS, BASE_TOOLS, type DirtType, type SurfaceType } from './game/catalog';
import { performanceRatios, type SponsorProduct } from './game/sponsor';
import { expertLine } from './game/tips';
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
}

/** 결과 화면 멘트의 맥락: 직접 써 봤다 / 같은 종류를 썼다 / 이 판 오염에 맞다 / 일반 추천 */
export type PitchContext = 'used' | 'category' | 'dirt' | 'generic';

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

/** 쇼호스트(청소 전문가) 멘트 생성 — 인사 → 오염의 원리(꿀팁) → 시험 수치 → 소구점 → 리뷰 → 라벨 주의 → 제안 */
export function pitchLines(p: SponsorProduct, lang: Lang, opts: { hostName: string; placement: Placement; dirt?: DirtType; surface?: SurfaceType; context?: PitchContext; usedItem?: string }): string[] {
  const lines: string[] = [];
  const ctx = opts.placement === 'result' ? opts.context : undefined;
  const custom = p.hostLines?.[lang]?.map((l) => l.replace(/\{brand\}/g, p.brand).replace(/\{name\}/g, p.name).replace(/\{host\}/g, opts.hostName)).filter(Boolean) ?? [];
  const lab = bestLab(p, opts.dirt);
  const x = lab && lab.ratio > 1.05 ? Math.round(lab.ratio * 10) / 10 : 0;
  const dirtName = (d: DirtType) => t(`dirt_${d}`);
  const cautions = p.cautions.map((s: SurfaceType) => t(`surf_${s}`)).join(', ');
  const review = p.reviews && p.reviews.count > 0 && p.reviews.rating > 0 ? p.reviews : null;
  const claims = (p.claims ?? []).filter(Boolean).slice(0, 3);
  const expert = opts.dirt ? expertLine(opts.dirt, lang, opts.surface) : undefined;
  if (lang === 'ko') {
    lines.push(`안녕하세요, 청소 전문가 ${opts.hostName}입니다. 오늘은 ${p.brand} ${p.name} 이야기를 해볼게요.`);
    if (ctx === 'used') lines.push(`방금 이 판에서 직접 써 보셨죠? 손에 느껴진 차이, 수치로도 증명된 제품이에요.`);
    else if (ctx === 'category' && opts.usedItem) lines.push(`이번 판에 ${opts.usedItem} 쓰셨죠? 같은 종류인데 이 제품은 뭐가 다른지 보여드릴게요.`);
    if (expert) lines.push(expert);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`수치부터 볼게요. 공인 시험에서 ${dirtName(lab.dirt)}를 ${lab.removalPct}% 제거했어요${x ? ` — 일반 ${baseName(p)}보다 ${x}배 빠른 결과예요.` : '.'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`리뷰 ${fmt(review.count, lang)}개에 평점 ${review.rating}점${review.source ? ` (${review.source})` : ''} — 실사용 평도 좋은 편이에요.`);
    }
    if (cautions) lines.push(`단, ${cautions}에는 쓰지 마세요. 라벨에 있는 그대로 말씀드리는 거예요.`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`지금 막힌 ${opts.dirt ? dirtName(opts.dirt) : '오염'}에 딱 맞는 제품이에요. 이번 판에서 바로 써 보세요.`);
        break;
      case 'result':
        lines.push(`다음 판에서 무료로 써 보실 수 있어요. 마음에 들면 구매 링크도 있습니다.`);
        break;
      case 'intro':
        lines.push(`이번 판에서 무료로 써 볼 수 있어요. 광고 한 편이면 됩니다.`);
        break;
      default:
        lines.push(`한번 써 보시고 판단하세요.`);
    }
  } else if (lang === 'ja') {
    lines.push(`こんにちは、お掃除の専門家の${opts.hostName}です。今日は ${p.brand} ${p.name} のお話をします。`);
    if (ctx === 'used') lines.push(`さっきこのステージで実際に使いましたよね？手で感じた違いは、数値でも証明されています。`);
    else if (ctx === 'category' && opts.usedItem) lines.push(`このステージで${opts.usedItem}を使いましたね。同じ種類でも、この製品は何が違うのかお見せします。`);
    if (expert) lines.push(expert);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`まず数値から。公的試験で${dirtName(lab.dirt)}を${lab.removalPct}%除去${x ? ` — 一般の${baseName(p)}より${x}倍速い結果です。` : '。'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`レビュー${fmt(review.count, lang)}件、評価${review.rating}点${review.source ? `（${review.source}）` : ''} — 実際の評判も良いです。`);
    }
    if (cautions) lines.push(`ただし、${cautions}には使わないでください。ラベルどおりにお伝えしています。`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`今つまずいている${opts.dirt ? dirtName(opts.dirt) : '汚れ'}にぴったりの製品です。このステージで使ってみてください。`);
        break;
      case 'result':
        lines.push(`次のステージで無料で試せます。気に入ったら購入リンクもあります。`);
        break;
      case 'intro':
        lines.push(`このステージで無料で試せます。広告1本でOKです。`);
        break;
      default:
        lines.push(`まず使ってみて判断してください。`);
    }
  } else {
    lines.push(`Hi, I'm ${opts.hostName}, a cleaning specialist. Let's talk about the ${p.brand} ${p.name}.`);
    if (ctx === 'used') lines.push(`You just used it in this stage — the difference you felt is backed by the numbers.`);
    else if (ctx === 'category' && opts.usedItem) lines.push(`You used a ${opts.usedItem} this stage. Same category — here's what makes this one different.`);
    if (expert) lines.push(expert);
    if (custom.length) lines.push(...custom);
    else {
      if (lab) lines.push(`Numbers first: in certified lab tests it removed ${lab.removalPct}% of ${dirtName(lab.dirt)}${x ? ` — ${x}× faster than a standard ${baseName(p)}.` : '.'}`);
      for (const c of claims) lines.push(`✔ ${c}`);
      if (review) lines.push(`${fmt(review.count, lang)} reviews at ${review.rating} stars${review.source ? ` (${review.source})` : ''} — real users rate it well.`);
    }
    if (cautions) lines.push(`One caveat: don't use it on ${cautions}. That's straight from the label.`);
    switch (opts.placement) {
      case 'struggle':
        lines.push(`It's the right product for the ${opts.dirt ? dirtName(opts.dirt) : 'mess'} you're stuck on. Try it this stage.`);
        break;
      case 'result':
        lines.push(`You can try it free in the next stage — and there's a buy link if you like it.`);
        break;
      case 'intro':
        lines.push(`You can try it free in this stage. One ad, that's all.`);
        break;
      default:
        lines.push(`Try it and judge for yourself.`);
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
        <span class="tag-ad">${t('sponsored')}</span>${p.sample ? `<span class="tag-sample">${t('sample')}</span>` : ''}
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
        ${o.hideTrial || !o.onTrial ? '' : `<button class="btn btn--ad btn--block" data-act="trial" data-testid="host-trial">${trialLabel}</button>`}
        ${o.onBuy ? `<button class="btn btn--primary btn--block" data-act="buy" data-testid="host-buy">${t('mallBuy')}</button>` : ''}
      </div>
      <p class="host__foot small muted">${t('hostFoot')}</p>
    </div>`;
  document.body.appendChild(el);
  const lineEl = el.querySelector<HTMLElement>('[data-el="line"]')!;
  const dotsEl = el.querySelector<HTMLElement>('[data-el="dots"]')!;
  const avatar = animateAvatar(el.querySelector<HTMLElement>('[data-el="avatar"]')!);
  const hasVideo = el.querySelector('video') !== null;
  // 영상이 있으면 영상 음성이 목소리 — 소리 있는 재생이 막힌 경우에만 TTS 로 대체
  let speak = o.speak && !hasVideo;
  const videoReady = hasVideo ? avatar.playVideo().then((ok) => (speak = o.speak && !ok)) : Promise.resolve();
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
    if (idx === 0) await videoReady;
    if (!alive) return;
    const spoken = speak ? speakLine(text, o.lang) : Promise.resolve(false);
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
    avatar.stop();
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
