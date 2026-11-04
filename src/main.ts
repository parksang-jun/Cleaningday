// 싹싹 클린 — 앱 셸: 홈(월드·구역) · 구역(스테이지) · 게임 · 결과 · 상점(게임 도구 / 실제 제품 몰) · 설정
import './style.css';
import { Capacitor } from '@capacitor/core';
import { AdsController } from './ads';
import { track } from './analytics';
import { scrubSound, setSoundEnabled, sfx, stopScrub, unlockAudio } from './audio';
import { resolveTiming } from './game/bot';
import type { DetergentId, ToolId } from './game/catalog';
import { CleanSession, scoreSession, type Result, type SessionEvent, type Timing } from './game/engine';
import { allItems, findItem, grantsUpTo, strengths, type ItemEntry } from './game/items';
import { getLevel, LEVELS, tierFor, WORLDS, type AreaInfo, type LevelDef, type WorldInfo } from './game/levels';
import { performanceRatios, REFERENCE_REMOVAL } from './game/sponsor';
import { detectLang, getLang, setLang, t, type Lang } from './i18n';
import { CATEGORY_QUERY, defaultMarket, DIRT_TO_ITEM, isSafeUrl, mallEnabled, MALL_PRODUCTS, MARKET_LABEL, marketsFor, searchUrl, sponsorBuyUrl, type Market } from './mall';
import { Renderer } from './render/renderer';
import { getStore, loadStore, persist, resetStore } from './storage';
import { iconFor } from './ui/icons';

const app = document.getElementById('app')!;
const ads = new AdsController();
let items: ItemEntry[] = allItems();
const EXTEND_SEC = 30;
const REFILL_SEC = 6;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function itemName(e: ItemEntry | undefined): string {
  if (!e) return '';
  if (e.sponsor) return `${e.sponsor.brand} ${e.sponsor.name}`;
  return t(`item_${e.spec.base}`);
}

function haptic() {
  if (!getStore().settings.haptics || !Capacitor.isNativePlatform()) return;
  void import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {});
}

function owns(id: string): boolean {
  const e = findItem(id, items);
  if (!e) return false;
  if (e.sponsor) return true; // 스폰서 아이템은 무료 사용 (광고 표시)
  return e.spec.cost === 0 || getStore().owned.includes(id);
}

/** 외부 링크 — 네이티브는 인앱 브라우저, 웹은 새 탭 */
function openExternal(url: string) {
  if (!isSafeUrl(url)) return;
  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/browser').then(({ Browser }) => Browser.open({ url })).catch(() => window.open(url, '_blank', 'noopener'));
    return;
  }
  window.open(url, '_blank', 'noopener');
}

// ---------- 모달 ----------
function modal(html: string, onMount?: (root: HTMLElement, close: () => void) => void): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="modal__card" role="dialog">${html}</div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap && wrap.dataset.dismiss !== 'no') close();
  });
  onMount?.(wrap.querySelector('.modal__card') as HTMLElement, close);
  return close;
}

function toast(text: string, kind: 'info' | 'warn' = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('is-out'), 1900);
  setTimeout(() => el.remove(), 2400);
}

// ---------- 진행 ----------
function areaUnlocked(a: AreaInfo): boolean {
  return a.levelIds[0] <= getStore().progress.unlocked;
}
function areaStars(a: AreaInfo): number {
  const st = getStore();
  return a.levelIds.reduce((n, id) => n + (st.progress.stars[id] ?? 0), 0);
}
function nextLevelId(): number {
  return Math.min(getStore().progress.unlocked, LEVELS.length);
}

// ---------- 홈: 월드·구역 ----------
function renderHome() {
  stopGame();
  const st = getStore();
  const totalStars = Object.values(st.progress.stars).reduce((a, b) => a + b, 0);
  const next = getLevel(nextLevelId())!;
  const worldCard = (w: WorldInfo) => `
    <section class="world" data-testid="world-${w.id}">
      <h2 class="section-title">${esc(t(`world_${w.id}`))}</h2>
      <div class="areas">
        ${w.areas
          .map((a) => {
            const locked = !areaUnlocked(a);
            const stars = areaStars(a);
            const done = a.levelIds.filter((id) => (st.progress.stars[id] ?? 0) > 0).length;
            return `<button class="area${locked ? ' is-locked' : ''}" data-area="${a.id}" ${locked ? 'disabled' : ''} data-testid="area-${a.id}">
              <span class="area__icon">${AREA_ICON[a.id]}</span>
              <span class="area__name">${esc(t(`area_${a.id}`))}</span>
              <span class="area__meta">${locked ? '🔒' : `${done}/${a.levelIds.length} · ★${stars}`}</span>
            </button>`;
          })
          .join('')}
      </div>
    </section>`;
  app.innerHTML = `
    <div class="home">
      <header class="home__top">
        <div class="coins" data-testid="coins">● ${st.coins}</div>
        <div class="home__actions">
          <button class="icon-btn" data-act="shop" aria-label="${t('shop')}">🧴</button>
          <button class="icon-btn" data-act="settings" aria-label="${t('settings')}">⚙︎</button>
        </div>
      </header>
      <section class="hero">
        <h1 class="logo">${esc(t('appName'))}</h1>
        <p class="tagline">${esc(t('tagline'))}</p>
        <button class="btn btn--primary btn--big" data-act="continue" data-testid="play">${t('play')} · ${t('stage', { n: next.id })} ${esc(t(`scene_${next.scene}`))}</button>
        <p class="muted small">★ ${totalStars} / ${LEVELS.length * 3}</p>
      </section>
      ${WORLDS.map(worldCard).join('')}
      <p class="muted small center">${t('adsFree')}</p>
    </div>`;
  app.querySelector('[data-act="continue"]')!.addEventListener('click', () => startLevel(nextLevelId()));
  app.querySelector('[data-act="shop"]')!.addEventListener('click', () => openShop());
  app.querySelector('[data-act="settings"]')!.addEventListener('click', openSettings);
  app.querySelectorAll<HTMLButtonElement>('.area').forEach((b) => b.addEventListener('click', () => renderArea(b.dataset.area!)));
}

const AREA_ICON: Record<string, string> = {
  living: '🛋️',
  room: '🛏️',
  kitchen: '🍳',
  bathroom: '🛁',
  garden: '🌿',
  exterior: '🚗',
  interior: '💺',
};

// ---------- 구역: 스테이지 목록 ----------
function renderArea(areaId: string) {
  stopGame();
  const st = getStore();
  const area = WORLDS.flatMap((w) => w.areas).find((a) => a.id === areaId);
  if (!area) return renderHome();
  app.innerHTML = `
    <div class="home">
      <header class="home__top">
        <button class="icon-btn" data-act="back" aria-label="${t('back')}" data-testid="back-home">‹</button>
        <div class="coins">● ${st.coins}</div>
      </header>
      <h2 class="section-title">${AREA_ICON[area.id]} ${esc(t(`world_${area.world}`))} · ${esc(t(`area_${area.id}`))}</h2>
      <div class="stages">
        ${area.levelIds
          .map((id) => {
            const l = getLevel(id)!;
            const locked = l.id > st.progress.unlocked;
            const stars = st.progress.stars[l.id] ?? 0;
            return `<button class="stage${locked ? ' is-locked' : ''}" data-level="${l.id}" ${locked ? 'disabled' : ''} data-testid="stage-${l.id}">
              <span class="stage__n">${l.id} <small class="stage__tier">T${l.tier}</small></span>
              <span class="stage__name">${esc(t(`scene_${l.scene}`))}</span>
              <span class="stage__stars">${locked ? '🔒' : '★'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
            </button>`;
          })
          .join('')}
      </div>
    </div>`;
  app.querySelector('[data-act="back"]')!.addEventListener('click', renderHome);
  app.querySelectorAll<HTMLButtonElement>('.stage').forEach((b) => b.addEventListener('click', () => startLevel(Number(b.dataset.level))));
}

// ---------- 게임 ----------
interface GameState {
  level: LevelDef;
  timing: Timing;
  session: CleanSession;
  renderer: Renderer;
  selected: string;
  pointer: { x: number; y: number } | null;
  queue: { x: number; y: number }[];
  started: boolean;
  finished: boolean;
  failed: boolean;
  raf: number;
  last: number;
  sprayCooldown: number;
  sparkleCooldown: number;
  trials: Set<string>;
  cleanedCells: number;
  revealToastShown: boolean;
  emptyAt: Map<string, number>;
}

let game: GameState | null = null;

function stopGame() {
  if (game) {
    cancelAnimationFrame(game.raf);
    stopScrub();
    ads.gameplayStop();
    window.removeEventListener('resize', onResize);
  }
  game = null;
}

function onResize() {
  game?.renderer.resize();
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

function startLevel(id: number) {
  const level = getLevel(id);
  if (!level) return;
  stopGame();
  const st = getStore();
  // 지급 아이템
  const newOnes = grantsUpTo(id).filter((g) => !st.owned.includes(g));
  if (newOnes.length) {
    st.owned.push(...newOnes);
    persist();
  }
  const timing = resolveTiming(level); // 봇 플레이 기준 목표·제한시간 (결정적, 캐시)
  app.innerHTML = `
    <div class="game">
      <header class="hud">
        <button class="icon-btn" data-act="back" aria-label="${t('back')}" data-testid="back">‹</button>
        <div class="hud__mid">
          <div class="hud__title">${t('stage', { n: id })} · ${esc(t(`scene_${level.scene}`))} <small class="hud__tier">T${level.tier}</small></div>
          <div class="bar"><div class="bar__fill" data-el="bar"></div><div class="bar__mark" style="left:${level.passClean * 100}%"></div></div>
        </div>
        <div class="hud__right">
          <div class="hud__pct" data-el="pct" data-testid="pct">0%</div>
          <div class="hud__time" data-el="time">0s / ${fmtTime(timing.parSec)}</div>
          ${timing.limitSec ? `<div class="hud__limit" data-el="limit" data-testid="limit">⏱ ${fmtTime(timing.limitSec)}</div>` : ''}
        </div>
      </header>
      <div class="hint" data-el="hint">${esc(level.hint ? t(level.hint) : t('passReq', { pct: Math.round(level.passClean * 100) }))}</div>
      <div class="stage-area"><canvas data-el="canvas" data-testid="canvas"></canvas></div>
      <nav class="toolbar" data-el="toolbar"></nav>
    </div>`;
  const canvas = app.querySelector<HTMLCanvasElement>('[data-el="canvas"]')!;
  const session = new CleanSession(level, timing);
  const renderer = new Renderer(canvas);
  // 기본 선택: 이 판의 표면에서 쓸 수 있고 해롭지 않은 첫 도구
  const surfaces = session.surfaces;
  const firstTool =
    items.find((e) => e.spec.kind === 'tool' && e.spec.base !== 'rinse' && owns(e.spec.id) && session.canUse(e.spec) && !e.spec.harms.some((h) => surfaces.includes(h))) ??
    items.find((e) => e.spec.kind === 'tool' && owns(e.spec.id))!;
  game = {
    level,
    timing,
    session,
    renderer,
    selected: firstTool.spec.id,
    pointer: null,
    queue: [],
    started: false,
    finished: false,
    failed: false,
    raf: 0,
    last: performance.now(),
    sprayCooldown: 0,
    sparkleCooldown: 0,
    trials: new Set(),
    cleanedCells: 0,
    revealToastShown: false,
    emptyAt: new Map(),
  };
  renderToolbar();
  renderer.setSession(session);
  window.addEventListener('resize', onResize);
  bindInput(canvas);
  app.querySelector('[data-act="back"]')!.addEventListener('click', () => {
    track('level_quit', { level: id, clean: Math.round(session.cleanliness * 100) });
    renderArea(level.area);
  });
  if (newOnes.length) toast(t('newItem', { item: newOnes.map((n) => itemName(findItem(n, items))).join(', ') }));
  track('level_start', { level: id, tier: level.tier, area: level.area });
  ads.gameplayStart();
  const loop = (now: number) => {
    if (!game) return;
    const dt = Math.min(0.05, (now - game.last) / 1000);
    game.last = now;
    step(dt);
    game.renderer.draw(dt);
    game.raf = requestAnimationFrame(loop);
  };
  game.raf = requestAnimationFrame(loop);
  exposeDebug();
  // 새 난이도 단계의 첫 스테이지: 규칙 안내
  const tier = tierFor(id);
  if (tier.fromId === id && tier.id > 1 && !st.progress.stars[id]) {
    modal(`<h2>${esc(t('tierLabel', { n: tier.id }))}</h2><p>${esc(t(`tierRule_${tier.id}`))}</p><button class="btn btn--primary btn--block" data-act="ok">${t('ok')}</button>`, (root, close) =>
      root.querySelector('[data-act="ok"]')!.addEventListener('click', close),
    );
  }
}

function renderToolbar() {
  if (!game) return;
  const bar = app.querySelector<HTMLElement>('[data-el="toolbar"]')!;
  const g = game;
  const surfaces = g.session.surfaces;
  // 이 판에서 못 쓰는 스폰서 도구는 툴바에서 숨김 (상점에는 노출)
  const usable = items.filter((e) => (owns(e.spec.id) || g.trials.has(e.spec.id)) && !(e.sponsor && !g.session.canUse(e.spec)));
  const tools = usable.filter((e) => e.spec.kind === 'tool');
  const dets = usable.filter((e) => e.spec.kind === 'detergent');
  const budgeted = g.level.sprayBudgetSec !== undefined;
  const btn = (e: ItemEntry) => {
    const blocked = !g.session.canUse(e.spec);
    const risky = e.spec.harms.some((h) => surfaces.includes(h));
    let budget = '';
    if (budgeted && e.spec.kind === 'detergent') {
      const left = g.session.budgetOf(e.spec);
      const frac = Math.max(0, Math.min(1, left / g.level.sprayBudgetSec!));
      budget = `<span class="tool__budget" data-budget="${esc(e.spec.id)}"><i style="width:${Math.round(frac * 100)}%"></i></span>`;
    }
    return `<button class="tool${g.selected === e.spec.id ? ' is-on' : ''}${blocked ? ' is-blocked' : ''}" data-item="${esc(e.spec.id)}" data-testid="item-${esc(e.spec.id)}" title="${esc(itemName(e))}">
      ${iconFor(e.spec.base)}
      <span class="tool__name">${esc(e.sponsor ? e.sponsor.brand : t(`item_${e.spec.base}`))}</span>
      ${budget}
      ${e.sponsor ? `<span class="tool__ad">${t('sponsored')}</span>` : ''}
      ${risky ? '<span class="tool__warn" aria-hidden="true">!</span>' : ''}
    </button>`;
  };
  bar.innerHTML = `
    <div class="toolbar__group"><span class="toolbar__label">${t('tools')}</span><div class="toolbar__row">${tools.map(btn).join('')}</div></div>
    <div class="toolbar__group"><span class="toolbar__label">${t('cleaners')}${budgeted ? ` · ${t('budget')}` : ''}</span><div class="toolbar__row">${dets.map(btn).join('')}<button class="tool tool--more" data-act="shop" data-testid="toolbar-shop">＋</button></div></div>`;
  bar.querySelectorAll<HTMLButtonElement>('[data-item]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!game) return;
      const id = b.dataset.item!;
      const entry = findItem(id, items)!;
      sfx.ui();
      if (game.selected === id && entry.sponsor) {
        openEvidence(entry);
        return;
      }
      if (game.selected === id && entry.spec.kind === 'detergent' && budgeted && game.session.budgetOf(entry.spec) <= 0) {
        offerRefill(entry);
        return;
      }
      game.selected = id;
      if (entry.sponsor) track('sponsor_item_select', { sponsor: entry.sponsor.id, level: game.level.id });
      const hint = app.querySelector<HTMLElement>('[data-el="hint"]')!;
      hint.textContent =
        entry.spec.kind === 'detergent'
          ? t('sprayHint')
          : entry.spec.base === 'rinse'
            ? t('hintRinse')
            : `${itemName(entry)} · ${t('goodFor', { list: strengths(entry.spec).map((d) => t(`dirt_${d}`)).join(', ') })}`;
      renderToolbar();
    }),
  );
  bar.querySelector('[data-act="shop"]')!.addEventListener('click', () => openShop(true));
  requestAnimationFrame(() => game?.renderer.resize());
}

function updateBudgets() {
  const g = game;
  if (!g || g.level.sprayBudgetSec === undefined) return;
  app.querySelectorAll<HTMLElement>('[data-budget]').forEach((el) => {
    const e = findItem(el.dataset.budget!, items);
    if (!e || e.spec.kind !== 'detergent') return;
    const frac = Math.max(0, Math.min(1, g.session.budgetOf(e.spec) / g.level.sprayBudgetSec!));
    (el.firstElementChild as HTMLElement).style.width = `${Math.round(frac * 100)}%`;
    el.classList.toggle('is-empty', frac <= 0);
  });
}

function bindInput(canvas: HTMLCanvasElement) {
  const down = (e: PointerEvent) => {
    if (!game || game.finished || game.failed) return;
    unlockAudio();
    canvas.setPointerCapture(e.pointerId);
    const p = game.renderer.toGrid(e.clientX, e.clientY);
    game.pointer = p;
    game.queue = [p];
    game.started = true;
  };
  const move = (e: PointerEvent) => {
    if (!game) return;
    const p = game.renderer.toGrid(e.clientX, e.clientY);
    const item = findItem(game.selected, items)!.spec;
    game.renderer.cursor = { x: p.x, y: p.y, item, active: Boolean(game.pointer) };
    if (!game.pointer) return;
    // 빠른 드래그 사이를 메워 빈틈 없이
    const last = game.queue[game.queue.length - 1] ?? game.pointer;
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    const n = Math.min(12, Math.ceil(dist / 0.8));
    for (let k = 1; k <= n; k++) game.queue.push({ x: last.x + ((p.x - last.x) * k) / n, y: last.y + ((p.y - last.y) * k) / n });
    game.pointer = p;
  };
  const up = () => {
    if (!game) return;
    game.pointer = null;
    game.queue = [];
    if (game.renderer.cursor) game.renderer.cursor.active = false;
    stopScrub();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => {
    if (game && !game.pointer) game.renderer.cursor = null;
  });
}

function handleEvents(events: SessionEvent[]) {
  if (!game) return;
  for (const ev of events) {
    if (ev.kind === 'cleared') {
      game.cleanedCells += ev.cells.length;
      game.renderer.burst(ev.cells);
      if (game.sparkleCooldown <= 0) {
        sfx.sparkle();
        game.sparkleCooldown = 0.12;
      }
    } else if (ev.kind === 'revealed') {
      if (!game.revealToastShown) {
        game.revealToastShown = true;
        toast(t('revealed'));
      }
    } else if (ev.kind === 'empty') {
      const last = game.emptyAt.get(ev.item) ?? -10;
      if (game.session.time - last > 3) {
        game.emptyAt.set(ev.item, game.session.time);
        sfx.warn();
        toast(t('empty', { item: itemName(findItem(ev.item, items)) }), 'warn');
        updateBudgets();
      }
    } else if (ev.kind === 'harm') {
      sfx.warn();
      toast(t('harm', { item: itemName(findItem(ev.item, items)), surface: t(`surf_${ev.surface}`) }), 'warn');
      track('surface_harm', { item: ev.item, surface: ev.surface });
    } else if (ev.kind === 'blocked') {
      sfx.warn();
      toast(t('blocked', { item: itemName(findItem(ev.item, items)) }), 'warn');
    } else if (ev.kind === 'hazard') {
      sfx.warn();
      stopScrub();
      game.pointer = null;
      track('hazard_mix', { level: game.level.id });
      modal(`<h2>⚠︎ ${t('hazardTitle')}</h2><p>${esc(t('hazardText'))}</p><button class="btn btn--primary btn--block" data-act="ok">${t('ok')}</button>`, (root, close) => {
        root.querySelector('[data-act="ok"]')!.addEventListener('click', close);
      });
    }
  }
}

function step(dt: number) {
  const g = game;
  if (!g || g.finished || g.failed) return;
  g.sparkleCooldown -= dt;
  g.sprayCooldown -= dt;
  if (g.started) g.session.tick(dt);
  const entry = findItem(g.selected, items)!;
  const spec = entry.spec;
  if (g.pointer) {
    const pts = g.queue.length ? g.queue.splice(0, g.queue.length) : [g.pointer];
    const each = dt / pts.length;
    const before = g.session.cleanliness;
    for (const p of pts) {
      const evs = spec.kind === 'tool' ? g.session.scrub(spec, p.x, p.y, each) : g.session.spray(spec, p.x, p.y, each);
      handleEvents(evs);
    }
    if (spec.kind === 'detergent') {
      if (g.sprayCooldown <= 0) {
        sfx.spray();
        g.sprayCooldown = 0.35;
        updateBudgets();
      }
    } else {
      const gain = g.session.cleanliness - before;
      scrubSound(0.35 + Math.min(1, gain * 400), spec.base === 'vacuum' ? 600 : spec.base === 'washer' ? 3000 : spec.base === 'brush' ? 2600 : spec.base === 'rinse' ? 900 : 1500);
    }
  }
  // HUD
  const pct = Math.floor(g.session.cleanliness * 100);
  (app.querySelector('[data-el="bar"]') as HTMLElement).style.width = `${Math.min(100, g.session.cleanliness * 100)}%`;
  (app.querySelector('[data-el="pct"]') as HTMLElement).textContent = `${pct}%`;
  const timeEl = app.querySelector('[data-el="time"]') as HTMLElement;
  timeEl.textContent = `${fmtTime(g.session.time)} / ${fmtTime(g.timing.parSec)}`;
  timeEl.classList.toggle('is-over', g.session.time > g.timing.parSec);
  const limitEl = app.querySelector<HTMLElement>('[data-el="limit"]');
  if (limitEl && g.session.limitSec !== undefined) {
    const left = g.session.limitSec - g.session.time;
    limitEl.textContent = `⏱ ${fmtTime(left)}`;
    limitEl.classList.toggle('is-urgent', left <= 10);
  }
  if (g.session.passed) finishLevel();
  else if (g.session.expired) failLevel();
}

function finishLevel() {
  const g = game;
  if (!g || g.finished) return;
  g.finished = true;
  g.pointer = null;
  stopScrub();
  ads.gameplayStop();
  // 남은 잔여 오염을 반짝이며 정리
  const rest: number[] = [];
  g.session.amount.forEach((a, i) => {
    if (a > 0) rest.push(i);
  });
  g.renderer.burst(rest);
  g.session.amount.fill(0);
  sfx.complete();
  haptic();
  const result = scoreSession(g.session, g.timing.parSec, g.level.tier);
  const st = getStore();
  const id = g.level.id;
  st.progress.stars[id] = Math.max(st.progress.stars[id] ?? 0, result.stars);
  st.progress.bestTime[id] = Math.min(st.progress.bestTime[id] ?? Infinity, result.timeSec);
  if (id >= st.progress.unlocked && id < LEVELS.length) st.progress.unlocked = id + 1;
  st.coins += result.coins;
  st.stats.gamesPlayed++;
  st.stats.totalCleanedCells += g.cleanedCells;
  persist();
  track('level_complete', { level: id, tier: g.level.tier, stars: result.stars, time: result.timeSec, damage: Math.round(result.damage * 100), hazard: result.hazard });
  setTimeout(() => showResult(g.level, g.timing, result), 700);
}

/** 제한시간 초과 — 광고로 연장하거나 다시 시작 */
function failLevel() {
  const g = game;
  if (!g || g.failed || g.finished) return;
  g.failed = true;
  g.pointer = null;
  stopScrub();
  sfx.warn();
  track('level_fail', { level: g.level.id, clean: Math.round(g.session.cleanliness * 100) });
  modal(
    `<div class="result" data-testid="fail">
      <h2>⏱ ${t('failTitle')}</h2>
      <p class="muted">${esc(t('failText'))} · ${Math.floor(g.session.cleanliness * 100)}% / ${Math.round(g.level.passClean * 100)}%</p>
      <button class="btn btn--ad btn--block" data-act="extend" data-testid="extend">${t('extendAd')}</button>
      <div class="btn-row"><button class="btn" data-act="retry" data-testid="fail-retry">${t('retry')}</button><button class="btn" data-act="menu">${t('menu')}</button></div>
    </div>`,
    (root, close) => {
      root.parentElement!.dataset.dismiss = 'no';
      root.querySelector('[data-act="extend"]')!.addEventListener('click', async (e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.disabled = true;
        if (await ads.showRewarded('extend_time')) {
          if (game) {
            game.session.extendLimit(EXTEND_SEC);
            game.failed = false;
            track('level_extend', { level: game.level.id });
          }
          close();
        } else b.disabled = false;
      });
      root.querySelector('[data-act="retry"]')!.addEventListener('click', async () => {
        close();
        const id = g.level.id;
        await ads.maybeShowInterstitial();
        startLevel(id);
      });
      root.querySelector('[data-act="menu"]')!.addEventListener('click', () => {
        close();
        renderArea(g.level.area);
      });
    },
  );
}

/** 세제 소진 — 광고로 리필 */
function offerRefill(entry: ItemEntry) {
  if (!game || entry.spec.kind !== 'detergent') return;
  const spec = entry.spec;
  modal(
    `<h2>${esc(t('empty', { item: itemName(entry) }))}</h2>
    <button class="btn btn--ad btn--block" data-act="refill" data-testid="refill">${esc(t('refillAd', { item: itemName(entry) }))}</button>
    <button class="btn btn--block" data-act="close">${t('close')}</button>`,
    (root, close) => {
      root.querySelector('[data-act="refill"]')!.addEventListener('click', async (e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.disabled = true;
        if (await ads.showRewarded('refill')) {
          game?.session.refill(spec, REFILL_SEC);
          track('refill', { item: spec.id, level: game?.level.id ?? 0 });
          toast(t('refilled'));
          renderToolbar();
          close();
        } else b.disabled = false;
      });
      root.querySelector('[data-act="close"]')!.addEventListener('click', close);
    },
  );
}

function showResult(level: LevelDef, timing: Timing, r: Result) {
  const penalties = [
    timing.parSec < r.timeSec ? t('slowPenalty') : '',
    r.damage >= 0.15 ? t('damagePenalty') : '',
    r.hazard ? t('hazardPenalty') : '',
  ].filter(Boolean);
  let coinsShown = r.coins;
  const hasNext = level.id < LEVELS.length;
  const mainDirt = level.patches[0]?.type;
  const recBase = mainDirt ? DIRT_TO_ITEM[mainDirt][0] : undefined;
  const market = defaultMarket(getLang());
  const mallCard =
    mallEnabled() && recBase
      ? `<a class="rec" data-testid="rec" href="${esc(searchUrl(recBase, market))}" data-mall="${recBase}" rel="noopener sponsored">
          <span class="rec__icon">${iconFor(recBase)}</span>
          <span class="rec__body"><b>${esc(t('mallRecommend'))}</b><span class="small">${esc(t(`item_${recBase}`))} · ${esc(MARKET_LABEL[market])} <span class="tag-ad">${t('sponsored')}</span></span></span>
        </a>`
      : '';
  modal(
    `<div class="result" data-testid="result">
      <h2>${t('done')}</h2>
      <div class="result__stars">${[0, 1, 2].map((i) => `<span class="${i < r.stars ? 'on' : ''}">★</span>`).join('')}</div>
      <p class="muted">${t('time')} ${r.timeSec}s · ${t('par', { s: timing.parSec })}</p>
      ${penalties.length ? `<ul class="penalties">${penalties.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <p class="result__coins" data-el="coins">${t('reward', { c: coinsShown })}</p>
      <button class="btn btn--ad btn--block" data-act="double" data-testid="double">${t('doubleAd')}</button>
      ${hasNext ? `<button class="btn btn--primary btn--block" data-act="next" data-testid="next">${t('next')}</button>` : ''}
      <div class="btn-row"><button class="btn" data-act="retry">${t('retry')}</button><button class="btn" data-act="menu" data-testid="to-menu">${t('menu')}</button></div>
      ${mallCard}
    </div>`,
    (root, closeFn) => {
      root.parentElement!.dataset.dismiss = 'no';
      [0, 1, 2].forEach((i) => i < r.stars && setTimeout(() => sfx.star(i), 250 + i * 200));
      root.querySelector('[data-act="double"]')!.addEventListener('click', async (e) => {
        const b = e.currentTarget as HTMLButtonElement;
        b.disabled = true;
        if (await ads.showRewarded('double_coins')) {
          getStore().coins += r.coins;
          persist();
          coinsShown *= 2;
          root.querySelector('[data-el="coins"]')!.textContent = t('reward', { c: coinsShown });
        }
      });
      const after = async (fn: () => void) => {
        closeFn();
        await ads.maybeShowInterstitial();
        fn();
      };
      root.querySelector('[data-act="next"]')?.addEventListener('click', () => after(() => startLevel(level.id + 1)));
      root.querySelector('[data-act="retry"]')!.addEventListener('click', () => after(() => startLevel(level.id)));
      root.querySelector('[data-act="menu"]')!.addEventListener('click', () => after(() => renderArea(level.area)));
      root.querySelector<HTMLAnchorElement>('[data-mall]')?.addEventListener('click', (e) => {
        e.preventDefault();
        track('mall_click', { from: 'result', base: recBase!, market });
        openExternal(searchUrl(recBase!, market));
      });
      if (mallCard) track('mall_impression', { from: 'result', base: recBase!, market });
    },
  );
}

// ---------- 상점: 게임 도구 / 실제 제품 ----------
function openShop(inGame = false, tab: 'game' | 'mall' = 'game') {
  const st = getStore();
  const showMall = mallEnabled();
  const row = (e: ItemEntry) => {
    const own = owns(e.spec.id);
    const trial = game?.trials.has(e.spec.id);
    const good = strengths(e.spec).map((d) => t(`dirt_${d}`)).join(', ');
    const harms = e.spec.harms.map((s) => t(`surf_${s}`)).join(', ');
    let action = '';
    if (e.sponsor) action = `<button class="btn btn--sm" data-evidence="${esc(e.spec.id)}">${t('evidence')}</button>`;
    else if (own) action = `<span class="pill">${t('owned')}</span>`;
    else
      action = `<button class="btn btn--sm btn--primary" data-buy="${esc(e.spec.id)}" ${st.coins < e.spec.cost ? 'data-poor="1"' : ''}>${t('buy', { c: e.spec.cost })}</button>${inGame && !trial ? `<button class="btn btn--sm btn--ad" data-try="${esc(e.spec.id)}">${t('tryAd')}</button>` : ''}`;
    return `<li class="shop__item${e.sponsor ? ' is-sponsor' : ''}" data-testid="shop-${esc(e.spec.id)}">
      <div class="shop__icon">${iconFor(e.spec.base)}</div>
      <div class="shop__body">
        <div class="shop__name">${esc(itemName(e))} ${e.sponsor ? `<span class="tag-ad">${t('sponsored')}</span>${e.sponsor.sample ? `<span class="tag-sample">${t('sample')}</span>` : ''}` : ''}</div>
        ${good ? `<div class="small">${esc(t('goodFor', { list: good }))}</div>` : ''}
        ${harms ? `<div class="small warn">${esc(t('cautionOn', { list: harms }))}</div>` : ''}
      </div>
      <div class="shop__act">${action}</div>
    </li>`;
  };
  const sponsors = items.filter((e) => e.sponsor);
  const base = items.filter((e) => !e.sponsor);
  const gameTab = `${sponsors.length ? `<ul class="shop__list">${sponsors.map(row).join('')}</ul>` : ''}<ul class="shop__list">${base.map(row).join('')}</ul>`;
  modal(
    `<div class="shop" data-testid="shop">
      <div class="row"><h2>${t('shop')}</h2><span class="coins">● ${st.coins}</span></div>
      ${showMall ? `<div class="tabs" role="tablist"><button class="tab${tab === 'game' ? ' is-on' : ''}" data-tab="game" data-testid="tab-game">${t('gameTab')}</button><button class="tab${tab === 'mall' ? ' is-on' : ''}" data-tab="mall" data-testid="tab-mall">${t('mallTab')}</button></div>` : ''}
      <div data-el="panel">${tab === 'mall' && showMall ? mallPanel(defaultMarket(getLang())) : gameTab}</div>
      <button class="btn btn--block" data-act="close">${t('close')}</button>
    </div>`,
    (root, close) => {
      root.querySelector('[data-act="close"]')!.addEventListener('click', () => {
        close();
        if (!game) renderHome();
      });
      root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
        b.addEventListener('click', () => {
          close();
          openShop(inGame, b.dataset.tab as 'game' | 'mall');
        }),
      );
      if (tab === 'mall' && showMall) {
        track('mall_open', { inGame });
        bindMall(root, inGame);
        return;
      }
      root.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
        b.addEventListener('click', () => {
          const e = findItem(b.dataset.buy!, items)!;
          if (getStore().coins < e.spec.cost) {
            toast(t('needCoins'), 'warn');
            return;
          }
          getStore().coins -= e.spec.cost;
          getStore().owned.push(e.spec.id);
          persist();
          track('shop_buy', { item: e.spec.id });
          close();
          if (game) renderToolbar();
          openShop(inGame);
        }),
      );
      root.querySelectorAll<HTMLButtonElement>('[data-try]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (await ads.showRewarded('try_item')) {
            game?.trials.add(b.dataset.try!);
            close();
            renderToolbar();
          }
        }),
      );
      root.querySelectorAll<HTMLButtonElement>('[data-evidence]').forEach((b) => b.addEventListener('click', () => openEvidence(findItem(b.dataset.evidence!, items)!)));
    },
  );
}

/** 실제 제품 몰 패널 — 마켓 선택 → 종류별 검색 링크 + 운영자 추천 제품 + 스폰서 제품 */
function mallPanel(market: Market): string {
  const lang = getLang();
  const markets = marketsFor(lang);
  const cats = Object.keys(CATEGORY_QUERY) as (ToolId | DetergentId)[];
  const picks = [
    ...MALL_PRODUCTS.filter((p) => isSafeUrl(p.links[market])).map((p) => ({ id: p.id, base: p.base, brand: p.brand, name: p.name, note: p.note, url: p.links[market]!, sample: p.sample, sponsor: false })),
    // 운영자 추천에 이미 있는 브랜드·계열의 스폰서 제품은 중복 표시하지 않음
    ...items
      .filter((e) => e.sponsor && isSafeUrl(sponsorBuyUrl(e.sponsor, market)) && !MALL_PRODUCTS.some((p) => p.brand === e.sponsor!.brand && p.base === e.spec.base && isSafeUrl(p.links[market])))
      .map((e) => ({ id: e.sponsor!.id, base: e.spec.base, brand: e.sponsor!.brand, name: e.sponsor!.name, note: e.sponsor!.tagline, url: sponsorBuyUrl(e.sponsor!, market)!, sample: e.sponsor!.sample, sponsor: true })),
  ];
  return `
    <div class="mall" data-testid="mall">
      <p class="small muted">${esc(t('mallIntro'))}</p>
      <div class="chips">${markets.map((m) => `<button class="chip${m === market ? ' is-on' : ''}" data-market="${m}" data-testid="market-${m}">${esc(MARKET_LABEL[m])}</button>`).join('')}</div>
      ${
        picks.length
          ? `<h3>${t('mallPicks')}</h3><ul class="shop__list">${picks
              .map(
                (p) => `<li class="shop__item${p.sponsor ? ' is-sponsor' : ''}" data-testid="mall-${esc(p.id)}">
          <div class="shop__icon">${iconFor(p.base)}</div>
          <div class="shop__body"><div class="shop__name">${esc(p.brand)} ${esc(p.name)} <span class="tag-ad">${t('sponsored')}</span>${p.sample ? `<span class="tag-sample">${t('sample')}</span>` : ''}</div>${p.note ? `<div class="small">${esc(p.note)}</div>` : ''}</div>
          <div class="shop__act"><button class="btn btn--sm btn--primary" data-mall-url="${esc(p.url)}" data-mall-id="${esc(p.id)}">${t('mallBuy')}</button></div>
        </li>`,
              )
              .join('')}</ul>`
          : ''
      }
      <h3>${t('mallCategories')}</h3>
      <ul class="shop__list">${cats
        .map(
          (c) => `<li class="shop__item" data-testid="mallcat-${c}">
        <div class="shop__icon">${iconFor(c)}</div>
        <div class="shop__body"><div class="shop__name">${esc(t(`item_${c}`))}</div><div class="small muted">${esc(CATEGORY_QUERY[c][lang])} · ${esc(MARKET_LABEL[market])}</div></div>
        <div class="shop__act"><button class="btn btn--sm" data-mall-url="${esc(searchUrl(c, market))}" data-mall-id="cat:${c}">${t('mallBrowse')}</button></div>
      </li>`,
        )
        .join('')}</ul>
      <p class="small muted">${esc(market === 'coupang' ? t('coupangDisclosure') : t('mallDisclosure'))}</p>
    </div>`;
}

function bindMall(root: HTMLElement, inGame: boolean) {
  root.querySelectorAll<HTMLButtonElement>('[data-market]').forEach((b) =>
    b.addEventListener('click', () => {
      const m = b.dataset.market as Market;
      const panel = root.querySelector<HTMLElement>('[data-el="panel"]')!;
      panel.innerHTML = mallPanel(m);
      track('mall_market', { market: m });
      bindMall(root, inGame);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-mall-url]').forEach((b) =>
    b.addEventListener('click', () => {
      const url = b.dataset.mallUrl!;
      track('mall_click', { from: inGame ? 'game' : 'home', id: b.dataset.mallId ?? '', url });
      openExternal(url);
    }),
  );
}

/** 스폰서 성능 근거 — 시험기관·성적서·방법 + 오염별 일반 제품 대비 % (+ 구매 링크) */
function openEvidence(e: ItemEntry) {
  const p = e.sponsor;
  if (!p) return;
  track('sponsor_evidence_view', { sponsor: p.id });
  const ratios = performanceRatios(p);
  const rows = p.lab
    .map((l) => {
      const ref = REFERENCE_REMOVAL[p.base]?.[l.dirt];
      const raw = ref ? l.removalPct / ref : null;
      const cell = raw === null ? t('notApplied') : `${t('vsStandard', { pct: Math.round(ratios[l.dirt] * 100) })}${Math.abs(raw - ratios[l.dirt]) > 0.005 ? ` (${t('capped')})` : ''}`;
      return `<tr><td>${t(`dirt_${l.dirt}`)}</td><td>${l.removalPct}%</td><td>${cell}</td></tr>`;
    })
    .join('');
  const ev = p.evidence!;
  const market = defaultMarket(getLang());
  const buy = mallEnabled() ? sponsorBuyUrl(p, market) : undefined;
  modal(
    `<div class="evidence" data-testid="evidence">
      <div class="row"><h2>${esc(p.brand)} ${esc(p.name)}</h2><span class="tag-ad">${t('sponsored')}</span></div>
      ${p.sample ? `<p class="tag-sample">${t('sample')}</p>` : ''}
      ${p.tagline ? `<p class="muted">${esc(p.tagline)}</p>` : ''}
      <h3>${t('evidence')}</h3>
      <table class="ev-table"><tbody>${rows}</tbody></table>
      <dl class="ev-meta">
        <dt>${t('lab')}</dt><dd>${esc(ev.lab)}</dd>
        <dt>${t('report')}</dt><dd>${esc(ev.reportId)} · ${esc(ev.date)}</dd>
        <dt>${t('protocol')}</dt><dd>${esc(ev.protocol)}</dd>
      </dl>
      ${p.cautions.length ? `<p class="small warn">${esc(t('cautionOn', { list: p.cautions.map((s) => t(`surf_${s}`)).join(', ') }))}</p>` : ''}
      <p class="small muted">${esc(t('evidenceNote'))}</p>
      ${isSafeUrl(buy) ? `<button class="btn btn--primary btn--block" data-act="buy" data-testid="evidence-buy">${t('mallBuy')} · ${esc(MARKET_LABEL[market])}</button>` : ''}
      <button class="btn btn--block" data-act="close">${t('close')}</button>
    </div>`,
    (root, close) => {
      root.querySelector('[data-act="close"]')!.addEventListener('click', close);
      root.querySelector('[data-act="buy"]')?.addEventListener('click', () => {
        track('mall_click', { from: 'evidence', id: p.id, market });
        openExternal(buy!);
      });
    },
  );
}

// ---------- 설정 ----------
function openSettings() {
  const s = getStore().settings;
  modal(
    `<h2>${t('settings')}</h2>
    <label class="setting"><span>${t('sound')}</span><input type="checkbox" data-k="sound" ${s.sound ? 'checked' : ''}></label>
    <label class="setting"><span>${t('haptics')}</span><input type="checkbox" data-k="haptics" ${s.haptics ? 'checked' : ''}></label>
    <label class="setting"><span>${t('language')}</span>
      <select data-k="lang">${(['auto', 'ko', 'en', 'ja'] as const).map((l) => `<option value="${l}" ${s.lang === l ? 'selected' : ''}>${l === 'auto' ? t('auto') : l === 'ko' ? '한국어' : l === 'en' ? 'English' : '日本語'}</option>`).join('')}</select>
    </label>
    <a class="small" href="./privacy.html" target="_blank" rel="noopener">${t('privacy')}</a>
    <button class="btn btn--sm" data-act="reset">${t('resetProgress')}</button>
    <button class="btn btn--block" data-act="close">${t('close')}</button>`,
    (root, close) => {
      root.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((inp) =>
        inp.addEventListener('change', () => {
          (s as unknown as Record<string, boolean>)[inp.dataset.k!] = inp.checked;
          setSoundEnabled(s.sound);
          persist();
        }),
      );
      root.querySelector<HTMLSelectElement>('select[data-k="lang"]')!.addEventListener('change', (e) => {
        s.lang = (e.target as HTMLSelectElement).value as Lang | 'auto';
        setLang(detectLang(s.lang));
        persist();
        close();
        renderHome();
      });
      root.querySelector('[data-act="reset"]')!.addEventListener('click', () => {
        resetStore();
        close();
        renderHome();
      });
      root.querySelector('[data-act="close"]')!.addEventListener('click', () => {
        close();
        renderHome();
      });
    },
  );
}

// ---------- 테스트용 훅 ----------
declare global {
  interface Window {
    __sparkle?: {
      session: () => CleanSession | null;
      select: (id: string) => void;
      items: () => string[];
      timing: () => Timing | null;
      forceExpire: () => void;
      level: () => number;
    };
  }
}
function exposeDebug() {
  window.__sparkle = {
    session: () => game?.session ?? null,
    select: (id: string) => {
      if (game) {
        game.selected = id;
        renderToolbar();
      }
    },
    items: () => items.map((e) => e.spec.id),
    timing: () => game?.timing ?? null,
    forceExpire: () => {
      if (game && game.session.limitSec !== undefined) {
        game.started = true;
        game.session.tick(game.session.limitSec - game.session.time + 0.01);
      }
    },
    level: () => game?.level.id ?? 0,
  };
}

async function boot() {
  await loadStore();
  const s = getStore().settings;
  setLang(detectLang(s.lang));
  setSoundEnabled(s.sound);
  items = allItems();
  renderHome();
  exposeDebug();
  void ads.init();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopScrub();
  });
}

void boot();
