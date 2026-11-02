// 싹싹 클린 — 앱 셸: 홈(단계 선택) · 게임 · 결과 · 상점(도구·세제, 스폰서 근거) · 설정
import './style.css';
import { Capacitor } from '@capacitor/core';
import { AdsController } from './ads';
import { track } from './analytics';
import { scrubSound, setSoundEnabled, sfx, stopScrub, unlockAudio } from './audio';
import { CleanSession, scoreSession, type Result, type SessionEvent } from './game/engine';
import { allItems, findItem, grantsUpTo, strengths, type ItemEntry } from './game/items';
import { getLevel, LEVELS, type LevelDef } from './game/levels';
import { performanceRatios, REFERENCE_REMOVAL } from './game/sponsor';
import { detectLang, setLang, t, type Lang } from './i18n';
import { Renderer } from './render/renderer';
import { getStore, loadStore, persist, resetStore } from './storage';
import { iconFor } from './ui/icons';

const app = document.getElementById('app')!;
const ads = new AdsController();
let items: ItemEntry[] = allItems();

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

// ---------- 홈 ----------
function renderHome() {
  stopGame();
  const st = getStore();
  const totalStars = Object.values(st.progress.stars).reduce((a, b) => a + b, 0);
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
        <button class="btn btn--primary btn--big" data-act="continue" data-testid="play">${t('play')} · ${t('stage', { n: Math.min(st.progress.unlocked, LEVELS.length) })}</button>
        <p class="muted small">★ ${totalStars} / ${LEVELS.length * 3}</p>
      </section>
      <h2 class="section-title">${t('menu')}</h2>
      <div class="stages">
        ${LEVELS.map((l) => {
          const locked = l.id > st.progress.unlocked;
          const stars = st.progress.stars[l.id] ?? 0;
          return `<button class="stage${locked ? ' is-locked' : ''}" data-level="${l.id}" ${locked ? 'disabled' : ''} data-testid="stage-${l.id}">
            <span class="stage__n">${l.id}</span>
            <span class="stage__name">${esc(t(`scene_${l.scene}`))}</span>
            <span class="stage__stars">${locked ? '🔒' : '★'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
          </button>`;
        }).join('')}
      </div>
      <p class="muted small center">${t('adsFree')}</p>
    </div>`;
  app.querySelector('[data-act="continue"]')!.addEventListener('click', () => startLevel(Math.min(st.progress.unlocked, LEVELS.length)));
  app.querySelector('[data-act="shop"]')!.addEventListener('click', () => openShop());
  app.querySelector('[data-act="settings"]')!.addEventListener('click', openSettings);
  app.querySelectorAll<HTMLButtonElement>('.stage').forEach((b) => b.addEventListener('click', () => startLevel(Number(b.dataset.level))));
}

// ---------- 게임 ----------
interface GameState {
  level: LevelDef;
  session: CleanSession;
  renderer: Renderer;
  selected: string;
  pointer: { x: number; y: number } | null;
  queue: { x: number; y: number }[];
  started: boolean;
  finished: boolean;
  raf: number;
  last: number;
  sprayCooldown: number;
  sparkleCooldown: number;
  trials: Set<string>;
  cleanedCells: number;
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
  app.innerHTML = `
    <div class="game">
      <header class="hud">
        <button class="icon-btn" data-act="back" aria-label="${t('back')}" data-testid="back">‹</button>
        <div class="hud__mid">
          <div class="hud__title">${t('stage', { n: id })} · ${esc(t(`scene_${level.scene}`))}</div>
          <div class="bar"><div class="bar__fill" data-el="bar"></div></div>
        </div>
        <div class="hud__right"><div class="hud__pct" data-el="pct" data-testid="pct">0%</div><div class="hud__time" data-el="time">0s / ${level.parSec}s</div></div>
      </header>
      <div class="hint" data-el="hint">${esc(level.hint ? t(level.hint) : t('scrubHint'))}</div>
      <div class="stage-area"><canvas data-el="canvas" data-testid="canvas"></canvas></div>
      <nav class="toolbar" data-el="toolbar"></nav>
    </div>`;
  const canvas = app.querySelector<HTMLCanvasElement>('[data-el="canvas"]')!;
  const session = new CleanSession(level);
  const renderer = new Renderer(canvas);
  // 기본 선택: 이 표면에서 쓸 수 있는 첫 도구
  const firstTool = items.find((e) => e.spec.kind === 'tool' && owns(e.spec.id) && session.canUse(e.spec) && !e.spec.harms.includes(level.surface))!;
  game = {
    level,
    session,
    renderer,
    selected: firstTool.spec.id,
    pointer: null,
    queue: [],
    started: false,
    finished: false,
    raf: 0,
    last: performance.now(),
    sprayCooldown: 0,
    sparkleCooldown: 0,
    trials: new Set(),
    cleanedCells: 0,
  };
  renderToolbar();
  renderer.setSession(session);
  window.addEventListener('resize', onResize);
  bindInput(canvas);
  app.querySelector('[data-act="back"]')!.addEventListener('click', () => {
    track('level_quit', { level: id, clean: Math.round(session.cleanliness * 100) });
    renderHome();
  });
  if (newOnes.length) toast(t('newItem', { item: newOnes.map((n) => itemName(findItem(n, items))).join(', ') }));
  track('level_start', { level: id });
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
}

function renderToolbar() {
  if (!game) return;
  const bar = app.querySelector<HTMLElement>('[data-el="toolbar"]')!;
  const g = game;
  // 이 표면에서 못 쓰는 스폰서 도구는 툴바에서 숨김 (상점에는 노출)
  const usable = items.filter((e) => (owns(e.spec.id) || g.trials.has(e.spec.id)) && !(e.sponsor && !g.session.canUse(e.spec)));
  const tools = usable.filter((e) => e.spec.kind === 'tool');
  const dets = usable.filter((e) => e.spec.kind === 'detergent');
  const btn = (e: ItemEntry) => {
    const blocked = !g.session.canUse(e.spec);
    const risky = e.spec.harms.includes(g.level.surface);
    return `<button class="tool${g.selected === e.spec.id ? ' is-on' : ''}${blocked ? ' is-blocked' : ''}" data-item="${esc(e.spec.id)}" data-testid="item-${esc(e.spec.id)}" title="${esc(itemName(e))}">
      ${iconFor(e.spec.base)}
      <span class="tool__name">${esc(e.sponsor ? e.sponsor.brand : t(`item_${e.spec.base}`))}</span>
      ${e.sponsor ? `<span class="tool__ad">${t('sponsored')}</span>` : ''}
      ${risky ? '<span class="tool__warn" aria-hidden="true">!</span>' : ''}
    </button>`;
  };
  bar.innerHTML = `
    <div class="toolbar__group"><span class="toolbar__label">${t('tools')}</span><div class="toolbar__row">${tools.map(btn).join('')}</div></div>
    <div class="toolbar__group"><span class="toolbar__label">${t('cleaners')}</span><div class="toolbar__row">${dets.map(btn).join('')}<button class="tool tool--more" data-act="shop" data-testid="toolbar-shop">＋</button></div></div>`;
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
      game.selected = id;
      if (entry.sponsor) track('sponsor_item_select', { sponsor: entry.sponsor.id, level: game.level.id });
      const hint = app.querySelector<HTMLElement>('[data-el="hint"]')!;
      hint.textContent = entry.spec.kind === 'detergent' ? t('sprayHint') : `${itemName(entry)} · ${t('goodFor', { list: strengths(entry.spec).map((d) => t(`dirt_${d}`)).join(', ') })}`;
      renderToolbar();
    }),
  );
  bar.querySelector('[data-act="shop"]')!.addEventListener('click', () => openShop(true));
  requestAnimationFrame(() => game?.renderer.resize());
}

function bindInput(canvas: HTMLCanvasElement) {
  const down = (e: PointerEvent) => {
    if (!game || game.finished) return;
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
  if (!g || g.finished) return;
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
      }
    } else {
      const gain = g.session.cleanliness - before;
      scrubSound(0.35 + Math.min(1, gain * 400), spec.base === 'vacuum' ? 600 : spec.base === 'washer' ? 3000 : spec.base === 'brush' ? 2600 : 1500);
    }
  }
  // HUD
  const pct = Math.floor(g.session.cleanliness * 100);
  (app.querySelector('[data-el="bar"]') as HTMLElement).style.width = `${Math.min(100, (g.session.cleanliness / 0.95) * 100)}%`;
  (app.querySelector('[data-el="pct"]') as HTMLElement).textContent = `${pct}%`;
  const timeEl = app.querySelector('[data-el="time"]') as HTMLElement;
  timeEl.textContent = `${Math.floor(g.session.time)}s / ${g.level.parSec}s`;
  timeEl.classList.toggle('is-over', g.session.time > g.level.parSec);
  if (g.session.passed) finishLevel();
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
  const result = scoreSession(g.session, g.level.parSec);
  const st = getStore();
  const id = g.level.id;
  st.progress.stars[id] = Math.max(st.progress.stars[id] ?? 0, result.stars);
  st.progress.bestTime[id] = Math.min(st.progress.bestTime[id] ?? Infinity, result.timeSec);
  if (id >= st.progress.unlocked && id < LEVELS.length) st.progress.unlocked = id + 1;
  st.coins += result.coins;
  st.stats.gamesPlayed++;
  st.stats.totalCleanedCells += g.cleanedCells;
  persist();
  track('level_complete', { level: id, stars: result.stars, time: result.timeSec, damage: Math.round(result.damage * 100), hazard: result.hazard });
  setTimeout(() => showResult(g.level, result), 700);
}

function showResult(level: LevelDef, r: Result) {
  const penalties = [
    level.parSec < r.timeSec ? t('slowPenalty') : '',
    r.damage >= 0.15 ? t('damagePenalty') : '',
    r.hazard ? t('hazardPenalty') : '',
  ].filter(Boolean);
  let coinsShown = r.coins;
  const hasNext = level.id < LEVELS.length;
  const close = modal(
    `<div class="result" data-testid="result">
      <h2>${t('done')}</h2>
      <div class="result__stars">${[0, 1, 2].map((i) => `<span class="${i < r.stars ? 'on' : ''}">★</span>`).join('')}</div>
      <p class="muted">${t('time')} ${r.timeSec}s · ${t('par', { s: level.parSec })}</p>
      ${penalties.length ? `<ul class="penalties">${penalties.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      <p class="result__coins" data-el="coins">${t('reward', { c: coinsShown })}</p>
      <button class="btn btn--ad btn--block" data-act="double" data-testid="double">${t('doubleAd')}</button>
      ${hasNext ? `<button class="btn btn--primary btn--block" data-act="next" data-testid="next">${t('next')}</button>` : ''}
      <div class="btn-row"><button class="btn" data-act="retry">${t('retry')}</button><button class="btn" data-act="menu" data-testid="to-menu">${t('menu')}</button></div>
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
      root.querySelector('[data-act="menu"]')!.addEventListener('click', () => after(renderHome));
    },
  );
  void close;
}

// ---------- 상점 ----------
function openShop(inGame = false) {
  const st = getStore();
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
  modal(
    `<div class="shop" data-testid="shop">
      <div class="row"><h2>${t('shop')}</h2><span class="coins">● ${st.coins}</span></div>
      ${sponsors.length ? `<ul class="shop__list">${sponsors.map(row).join('')}</ul>` : ''}
      <ul class="shop__list">${base.map(row).join('')}</ul>
      <button class="btn btn--block" data-act="close">${t('close')}</button>
    </div>`,
    (root, close) => {
      root.querySelector('[data-act="close"]')!.addEventListener('click', () => {
        close();
        if (!game) renderHome();
      });
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

/** 스폰서 성능 근거 — 시험기관·성적서·방법 + 오염별 일반 제품 대비 % */
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
      <button class="btn btn--block" data-act="close">${t('close')}</button>
    </div>`,
    (root, close) => root.querySelector('[data-act="close"]')!.addEventListener('click', close),
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
    __sparkle?: { session: () => CleanSession | null; select: (id: string) => void; items: () => string[] };
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
