// Playwright 스모크 테스트: preview 서버 → 실제 포인터 드래그로 청소 → 발견·수첩·힌트 → 결과·코인 → 틀린 도구 무효과 → 제한시간 → 손상·위험 혼합 → 프리미엄 상점·스폰서 근거·실제 제품 몰
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const shots = resolve(root, 'screenshots');
mkdirSync(shots, { recursive: true });
const PORT = 4174;

function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true });
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('preview start timeout')), 20000);
    proc.stdout.on('data', (d) => {
      if (String(d).includes(String(PORT))) {
        clearTimeout(timer);
        res(proc);
      }
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
  });
}

const softFails = [];
function assert(cond, msg) {
  if (!cond) {
    // E2E_KEEP_GOING=1: 첫 실패에서 멈추지 않고 끝까지 돌려 실패 목록을 한 번에 본다 (진단용)
    if (process.env.E2E_KEEP_GOING) { softFails.push(msg); console.log('not ok -', msg); return; }
    throw new Error('ASSERT: ' + msg);
  }
  console.log('ok -', msg);
}

/** 쇼호스트 카드가 떠 있으면 닫는다 */
async function closeHostIfOpen(page) {
  // 카드는 미디어를 불러온 뒤에 뜬다 — 불러오는 중이면 끝날 때까지 기다렸다가 확인한다 (느린 러너에서 카드가 뒤늦게 떠 문지르기를 가리는 일 방지)
  await page.waitForFunction(() => !window.__sparkle?.hostPending?.(), null, { timeout: 5000 }).catch(() => {});
  if (await page.locator('[data-testid="host"]').count()) {
    await page.click('[data-testid="host-close"]');
    await page.waitForTimeout(350);
  }
}

/** 캔버스 위를 지그재그로 문지름 (passes 회) */
// CI(1배 해상도, 60fps)에서는 한 점당 22ms 로 맞춘다 — 3배 해상도 로컬에서 자연스럽게 나오던 빠르기와 비슷해 같은 기준으로 검사된다
const PACE_MS = Number(process.env.E2E_PACE_MS ?? (process.env.CI ? 22 : 0));
async function sweep(page, passes = 1, rows = 14, stepMs = 8) {
  // 도구를 막 바꾼 직후에는 화면 배치(안내 문구·캔버스 크기)가 한두 프레임 뒤에 자리 잡는다 — 그 뒤에 좌표를 잰다
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const box = await page.locator('[data-testid="canvas"]').boundingBox();
  for (let p = 0; p < passes; p++) {
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    const t0 = Date.now();
    let n = 0;
    for (let r = 0; r <= rows; r++) {
      const y = box.y + (box.height * (r + 0.5)) / (rows + 1);
      const xs = r % 2 ? [box.x + box.width - 4, box.x + 4] : [box.x + 4, box.x + box.width - 4];
      for (let k = 0; k <= 12; k++) {
        await page.mouse.move(xs[0] + ((xs[1] - xs[0]) * k) / 12, y);
        await page.waitForTimeout(stepMs);
        n++;
        // 기계 속도와 무관하게 같은 빠르기로 문지른다 (한 점에 PACE_MS — 게임 시간은 실제 시간을 따라가므로 작업량이 일정해진다)
        const ahead = t0 + n * PACE_MS - Date.now();
        if (ahead > 0) await page.waitForTimeout(ahead);
      }
    }
    if (process.env.E2E_PACE_LOG) console.log(`info - sweep pace ${((Date.now() - t0) / n).toFixed(1)} ms/step (stepMs ${stepMs})`);
    await page.mouse.up();
    if (await page.locator('[data-testid="result"]').count()) return;
  }
}

async function cleanUntilDone(page, maxPasses = 20) {
  for (let i = 0; i < maxPasses; i++) {
    if (await page.locator('[data-testid="result"]').count()) return true;
    await sweep(page, 1);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(900);
  return (await page.locator('[data-testid="result"]').count()) > 0;
}

const preview = await startPreview();
const browser = await chromium.launch();
// GPU 없는 CI 러너는 3배 해상도 캔버스를 소프트웨어로 그리느라 프레임이 크게 떨어진다 → 타이밍 검사가 흔들림.
// CI 에서는 1배 해상도로 돌린다(검사 내용은 같음). 로컬 기본은 실제 기기 배율 그대로.
const DSF = process.env.E2E_DSF ? Number(process.env.E2E_DSF) : process.env.CI ? 1 : undefined;
const phone = { ...devices['iPhone 13'], ...(DSF ? { deviceScaleFactor: DSF } : {}) };
const fpsOf = (pg) => pg.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 1000 ? requestAnimationFrame(f) : res(n); }; requestAnimationFrame(f); }));
const ctx = await browser.newContext({ ...phone, locale: 'en-US', hasTouch: false });
// 출시판 기본값(실제 브랜드 제품 소개 없음)부터 확인한 뒤, 나머지 검사는 그 기능을 켜고 돌린다
{
  const ctx0 = await browser.newContext({ ...phone, locale: 'en-US', hasTouch: false });
  const p0 = await ctx0.newPage();
  await p0.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await p0.waitForSelector('[data-testid="play"]');
  const real = await p0.evaluate(() => window.__sparkle.sponsors().filter((x) => x.affiliate).length);
  assert(real === 0, 'launch default: no real brand products are listed (VITE_REAL_PRODUCTS off)');
  assert((await p0.evaluate(() => window.__sparkle.sponsors().length)) === 0, 'launch default: no sample advertisers either, so the show host has nothing to present');
  assert((await p0.evaluate(() => window.__sparkle.items().filter((id) => id.startsWith('sp:')).length)) === 0, 'launch default: no sponsored items in the game');
  // 잔존 장치: 출석 달력 + 오늘의 미션 + 보너스 상자 (보상은 홈에서 직접 받는다)
  await p0.waitForSelector('[data-testid="today"]');
  assert((await p0.locator('[data-testid="attend"] .attend__day').count()) === 7 && (await p0.locator('[data-testid="attend"] .attend__day.is-today').count()) === 1, 'home shows the 7-day check-in calendar with today marked');
  assert((await p0.locator('[data-testid="missions"] .mission').count()) === 3, "home lists today's 3 missions");
  assert(await p0.locator('[data-testid="chest-open"]').isDisabled(), 'bonus chest is locked until all missions are claimed');
  assert((await p0.locator('[data-testid="next-area-goal"]').count()) === 1, 'home shows how many stages are left to unlock the next area');
  const c0 = await p0.evaluate(() => window.__sparkle.coins());
  for (let i = 0; i < 3; i++) await p0.evaluate(() => window.__sparkle.missionClear(3, true, true));
  assert((await p0.locator('[data-mission]').count()) === 3, 'three clears complete all three missions (claim buttons appear)');
  assert((await p0.evaluate(() => window.__sparkle.coins())) === c0, 'mission rewards are not paid until claimed');
  for (let i = 0; i < 3; i++) await p0.locator('[data-mission]').first().click();
  assert((await p0.evaluate(() => window.__sparkle.coins())) === c0 + 120, 'claiming three missions pays 3 x 40 coins');
  await p0.click('[data-testid="chest-open"]');
  assert((await p0.evaluate(() => window.__sparkle.coins())) === c0 + 220 && (await p0.evaluate(() => window.__sparkle.missions().chest)), 'bonus chest pays 100 coins once all are claimed');
  assert((await p0.locator('[data-testid="chest-open"]').count()) === 0, 'opened chest cannot be opened again');
  await p0.screenshot({ path: resolve(shots, '00-today.png'), fullPage: true });
  await ctx0.close();
}
await ctx.addInitScript(() => { try { localStorage.setItem('sc_real_products', '1'); localStorage.setItem('sc_sample_sponsors', '1'); } catch {} });
const page = await ctx.newPage();
// 느린 CI 러너 재현용: E2E_CPU_THROTTLE=4 처럼 주면 CPU 를 그만큼 느리게 한다
if (process.env.E2E_CPU_THROTTLE) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.E2E_CPU_THROTTLE) });
}
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="play"]');
  // 실제 제품(제휴 추천) 소개는 아래 전용 구간에서 검사 — 그 전까지는 꺼서 기존 흐름(가상 광고주)을 그대로 본다
  await page.evaluate(() => window.__sparkle.hostConfig({ affiliate: false }));
  await page.evaluate(() => window.__sparkle.skipTour()); // 첫 판 조작 안내는 3D 브라우저 구간에서 검사
  await page.evaluate(() => window.__sparkle.force2d(true)); // 본 흐름은 2D 로 검사, 3D 는 아래 WebGL 브라우저에서
  assert((await page.locator('[data-testid="beta-tag"]').count()) === 1, 'home shows the BETA tag on production builds (VITE_BETA)');
  assert((await page.locator('.world').count()) === 3, '3 worlds listed (apartment, house, car)');
  await page.waitForTimeout(700);
  assert((await page.evaluate(() => window.__sparkle.coins())) === 30, 'first visit of the day pays the 30-coin daily bonus');
  assert((await page.locator('[data-testid="coins"]').innerText()).includes('30'), 'home coin button shows the balance and opens the shop');
  assert((await page.locator('.area').count()) === 7, '7 areas listed');
  assert((await page.locator('.area.is-locked').count()) === 6, 'only the living room is unlocked at start');
  // 하단 배너 자리: 메뉴 화면에서만, 화면이 배너 높이만큼 비켜난다
  await page.waitForSelector('body.has-banner [data-testid="ad-banner-placeholder"]');
  {
    const g = await page.evaluate(() => { const b = document.getElementById('ad-banner').getBoundingClientRect(); const a = document.getElementById('app'); const last = a.querySelector('.home').getBoundingClientRect(); return { top: b.top, h: b.height, vh: innerHeight, contentBottom: last.bottom }; });
    assert(g.h >= 50 && Math.abs(g.top + g.h - g.vh) < 1, `home shows the banner slot at the bottom (${g.h}px)`);
    assert(g.contentBottom <= g.top + 1, 'home content ends above the banner slot (nothing hidden behind it)');
  }
  await page.screenshot({ path: resolve(shots, '01-home.png'), fullPage: true });

  // 1단계(거실 바닥 먼지): 걸레로 드래그 → 발견 토스트 → 완료 → 전후 리빌 → 결과
  await page.click('[data-testid="play"]');
  await page.waitForSelector('[data-testid="intro"]');
  assert((await page.locator('[data-testid="intro"] .kit__item').count()) === 2, 'intro shows only the 2 tools this job needs (cloth, vacuum)');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.waitForTimeout(300);
  assert((await page.locator('.toolbar [data-item]').count()) === 2, 'toolbar lists only the needed items');
  assert((await page.locator('body.has-banner').count()) === 0 && !(await page.locator('#ad-banner').isVisible()), 'no banner while cleaning');
  assert((await page.locator('[data-testid="limit"]').count()) === 0, 'tier 1 has no time limit');
  console.log(`info - in-game frame rate: ${await fpsOf(page)} fps (deviceScaleFactor ${DSF ?? 3}${process.env.E2E_CPU_THROTTLE ? ', CPU x' + process.env.E2E_CPU_THROTTLE + ' slower' : ''})`);
  assert((await page.locator('[data-el="unknown"]').innerText()) === '1', 'notebook badge shows 1 unknown mess');
  await page.screenshot({ path: resolve(shots, '02-stage1-dirty.png') });
  // 드래그 중에 문지르는 소리가 나고, 손을 떼면 바로 멈춘다
  const box0 = await page.locator('[data-testid="canvas"]').boundingBox();
  await page.mouse.move(box0.x + 20, box0.y + 20);
  await page.mouse.down();
  for (let k = 0; k < 12; k++) {
    await page.mouse.move(box0.x + 20 + k * 12, box0.y + 24 + k * 6);
    await page.waitForTimeout(16);
  }
  const audio = await page.evaluate(() => window.__sparkle.audio());
  assert(audio.unlocked && audio.state === 'running', `audio unlocked on first touch (state ${audio.state})`);
  assert(audio.scrub === 'cloth', `scrub sound uses the cloth profile while dragging (${audio.scrub})`);
  assert(/^cloth:(wood|fabric|tile|vinyl|stone|paint|plastic|glass|ceramic|steel|metal|brick):(grit|rustle|squelch|scrape|fizz|-)$/.test(audio.scrubKey), `scrub sound carries the surface material and the dirt texture (${audio.scrubKey})`);
  await page.mouse.up();
  await page.waitForTimeout(450);
  assert((await page.evaluate(() => window.__sparkle.audio())).scrub === null, 'scrub sound stops right after the pointer lifts');
  await sweep(page, 1);
  await page.waitForTimeout(700);
  const audio2 = await page.evaluate(() => window.__sparkle.audio());
  assert(audio2.musicStep > 2, `background music is scheduling notes (${audio2.musicStep} steps)`);
  const mid = await page.evaluate(() => window.__sparkle.session().cleanliness);
  assert(mid > 0.2, `one sweep with the cloth cleans ${(mid * 100).toFixed(0)}%`);
  assert((await page.evaluate(() => window.__sparkle.journal())).includes('dust|cloth|-'), 'cloth-on-dust recipe recorded in the notebook');
  await page.screenshot({ path: resolve(shots, '03-stage1-cleaning.png') });
  assert(await cleanUntilDone(page), 'stage 1 completes by dragging');
  await page.waitForSelector('[data-testid="result"]', { timeout: 8000 });
  assert((await page.locator('[data-testid="result-missions"] .mission').count()) === 3 && (await page.evaluate(() => window.__sparkle.missions().prog.clear)) === 1, "result shows today's missions and the first clear counts 1/3");
  await page.waitForTimeout(500);
  assert((await page.evaluate(() => window.__sparkle.audio())).scrub === null, 'scrub sound stops when the stage ends');
  const stars = await page.locator('.result__stars .on').count();
  assert(stars >= 1, `result shows ${stars} stars`);
  assert((await page.locator('.result__found .recipe').count()) >= 1, 'result lists the discovered combo');
  assert((await page.locator('[data-testid="rec"]').count()) === 1, 'result recommends a real product for the main dirt');
  await page.screenshot({ path: resolve(shots, '04-result.png') });
  // 매 판 끝: 쇼호스트가 결과 화면 위로 나와 제품을 소개 (1단계는 쓴 제품·오염에 맞는 광고가 없으니 일반 추천)
  await page.waitForSelector('[data-testid="host"][data-placement="result"]', { timeout: 4000 });
  const ctx1 = await page.getAttribute('[data-testid="host"]', 'data-context');
  assert(ctx1 === 'generic', `host appears at every stage end (stage 1 context: ${ctx1})`);
  assert((await page.locator('[data-testid="host"] .hav--paint [data-eye]').count()) === 3 && (await page.locator('[data-testid="host"] .hav--paint [data-mouth]').count()) === 3, 'host face is the painted portrait with eye and mouth layers (blink / lip-sync)');
  await page.waitForTimeout(900);
  const mouthOn = await page.locator('[data-testid="host"] .hav__mouth.is-on').getAttribute('data-mouth');
  assert(['closed', 'mid', 'open'].includes(mouthOn), `portrait animates the mouth while talking (${mouthOn})`);
  await page.screenshot({ path: resolve(shots, '04a-result-host.png') });
  await page.click('[data-testid="host-close"]');
  await page.waitForTimeout(350);

  const before = Number((await page.locator('[data-el="coins"]').innerText()).match(/\d+/)[0]);
  await page.click('[data-testid="double"]');
  await page.waitForTimeout(1600);
  const after = Number((await page.locator('[data-el="coins"]').innerText()).match(/\d+/)[0]);
  assert(after === before * 2, `rewarded ad doubles coins (${before} → ${after})`);
  // 2단계 열림 → 구역 화면 (12판)
  await page.click('[data-testid="to-menu"]');
  await page.waitForSelector('[data-testid="stage-1"]');
  assert((await page.locator('.stage').count()) === 12, 'living room lists 12 stages');
  assert((await page.locator('.stage.is-locked').count()) === 10, 'stage 2 unlocked');
  await page.click('[data-testid="back-home"]');
  await page.waitForSelector('[data-testid="play"]');

  // 전부 열기 + 코인 지급(진행 저장 조작)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sparkle-clean-v1'));
    raw.progress.unlocked = 96;
    raw.coins = 2000;
    localStorage.setItem('sparkle-clean-v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  assert((await page.locator('.area.is-locked').count()) === 0, 'all areas unlocked');

  // 2단계(안내 단계, 얼룩+먼지): 두 번 실패 → 수첩에서 코인 힌트 → 세정제 공개 (힌트는 3단계까지만)
  await page.click('[data-testid="area-living"]');
  await page.click('[data-testid="stage-2"]');
  await page.waitForSelector('[data-testid="intro"]');
  assert((await page.locator('[data-testid="intro"] .kit').innerText()).includes('Tools for this job'), 'guided stage intro lists the tools for the job');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="item-allpurpose"]');
  await page.click('[data-testid="item-vacuum"]');
  await sweep(page, 1, 8, 4);
  await page.click('[data-testid="item-cloth"]');
  await sweep(page, 1, 8, 4);
  assert((await page.evaluate(() => window.__sparkle.tries('stain'))) >= 2, 'two failed tools tried on the stain');
  await page.click('[data-testid="journal"]');
  await page.waitForSelector('[data-testid="hint-coins-stain"]');
  await page.click('[data-testid="hint-coins-stain"]');
  await page.waitForTimeout(200);
  const hintText = await page.locator('[data-testid="journal-stain"]').innerText();
  assert(hintText.includes('Cleaner:'), 'coin hint reveals the needed cleaner on a guided stage');
  await page.screenshot({ path: resolve(shots, '09-hint.png') });
  await page.click('[data-testid="journal-modal"] [data-act="close"]');

  // 3단계(안내 단계): 인트로에 진짜 꿀팁 카드(출처 링크 포함)
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="stage-3"]');
  await page.waitForSelector('[data-testid="intro-tip"]');
  const introTip = await page.locator('[data-testid="intro-tip"]').innerText();
  assert(introTip.includes('rubber glove') && introTip.includes('GQ Korea'), 'guided intro shows a real, sourced cleaning tip (damp rubber glove for pet hair)');
  assert((await page.locator('[data-testid="intro-tip"] [data-url^="https://"]').count()) >= 2, 'tip card links to its sources');
  await page.click('[data-testid="start"]');
  await closeHostIfOpen(page);
  await page.waitForSelector('[data-testid="item-rubberglove"]');
  await page.click('[data-testid="item-rubberglove"]');
  await sweep(page, 1, 10, 5);
  assert((await page.evaluate(() => window.__sparkle.journal())).some((k) => k.startsWith('hair|lintroller')), 'rubber glove really lifts hair (recipe discovered)');
  await page.click('[data-testid="journal"]');
  await page.waitForSelector('[data-testid="tip-hair-glove"]');
  await page.click('[data-testid="journal-modal"] [data-act="close"]');

  // 4단계(안내 끝): 미끼 도구가 섞이고, 힌트 버튼이 없다
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="stage-4"]');
  await page.waitForSelector('[data-testid="intro"]');
  const intro4 = await page.locator('[data-testid="intro"]').innerText();
  assert(intro4.includes('Hints end after stage 3'), 'stage 4 intro explains that hints are over');
  assert(intro4.includes('only some of them work'), 'stage 4 intro says only some tools work');
  assert((await page.locator('[data-testid="intro-mix"]').count()) === 1, 'stage 4 intro mentions that two cleaners in the kit can be mixed (vinegar + dish soap)');
  assert((await page.locator('[data-testid="intro-mess"]').innerText()).includes('Dust keeps settling'), 'stage 4 intro warns that dust keeps settling while you clean (re-soiling starts at stage 4)');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="item-squeegee"]');
  assert((await page.locator('[data-testid="mess"]').innerText()).includes('⏸'), 'HUD shows the mess-maker paused until cleaning starts');
  const kit4 = await page.evaluate(() => window.__sparkle.kit());
  assert(kit4.includes('squeegee') && kit4.includes('glass') && kit4.length >= 5, `stage 4 kit mixes decoys in (${kit4.join(',')})`);
  assert(kit4.includes('vinegar') && kit4.includes('dishsoap'), `stage 4 kit holds both halves of the glass-cleaner mix (${kit4.join(',')})`);
  await page.click('[data-testid="item-vacuum"]');
  await sweep(page, 1, 8, 4);
  await page.click('[data-testid="item-cloth"]');
  await sweep(page, 1, 8, 4);
  assert((await page.evaluate(() => window.__sparkle.tries('film'))) >= 2, 'two failed tools tried on the window film');
  // 재오염: 먼지가 다시 내려앉음 — 예고 배너, 진행률 하락, 수첩 배지
  const mess0 = await page.evaluate(() => window.__sparkle.mess());
  assert(mess0.kind === 'drift' && mess0.next > 0 && mess0.count === 0, `HUD counts down to the next dust drift (${mess0.next.toFixed(1)}s)`);
  const clean0 = await page.evaluate(() => window.__sparkle.session().cleanliness);
  await page.evaluate(() => window.__sparkle.forceMess());
  await page.waitForTimeout(120);
  const mess1 = await page.evaluate(() => window.__sparkle.mess());
  assert(mess1.count === 1, 'dust drifted onto the window (1 wave)');
  assert((await page.locator('[data-testid="mess-warn"]:not([hidden])').count()) === 1 && (await page.locator('[data-testid="mess-warn"]').innerText()).includes('settled'), 'a banner announces the fresh mess');
  const clean1 = await page.evaluate(() => window.__sparkle.session().cleanliness);
  assert(clean1 < clean0, `progress drops when the mess lands (${(clean0 * 100).toFixed(0)}% → ${(clean1 * 100).toFixed(0)}%)`);
  await page.screenshot({ path: resolve(shots, '05b-mess.png') });
  // 뽀득이의 장비 추천 카드 — 느리게 가는 중(목표시간 절반 지나고 반도 못 닦음)이거나 두 번째 재오염 때 뜬다
  const slowTip = (await page.locator('[data-testid="gear-tip"]:not([hidden])').count()) === 1;
  if (!slowTip) {
    await page.evaluate(() => window.__sparkle.forceMess());
    await page.waitForSelector('[data-testid="gear-tip"]:not([hidden])', { timeout: 3000 });
  }
  const gear4 = await page.locator('[data-testid="gear-tip"]').innerText();
  assert(gear4.includes('gear tip') && gear4.includes('Steam cleaner') && gear4.includes('faster'), `host's gear tip recommends the steam cleaner for the window film (${slowTip ? 'slow pace' : 'second mess'}: "${gear4.split('\n')[1]}")`);
  assert(gear4.includes('taking a while') || gear4.includes('Getting messed up again'), 'gear tip explains itself in context (slow pace / re-soiling)');
  assert((await page.locator('[data-testid="gear-buy"]').innerText()).includes('1,200') || (await page.locator('[data-testid="gear-buy"]').innerText()).includes('1200'), 'with enough coins the tip offers "Buy now · 1200 coins"');
  await page.screenshot({ path: resolve(shots, '05c-gear-tip.png') });
  if (!(await page.locator('[data-testid="gear-tip"]:not([hidden])').count())) await page.evaluate(() => window.__sparkle.gearTip('slow')); // 14초 자동 닫힘 대비
  await page.click('[data-testid="gear-shop"]');
  await page.waitForSelector('[data-testid="shop"]');
  assert((await page.locator('[data-testid="gear-tip"]:not([hidden])').count()) === 0, 'gear tip closes when the shop opens from it');
  await page.click('[data-testid="shop"] [data-act="close"]');
  await page.waitForTimeout(150);
  await page.click('[data-testid="journal"]');
  await page.waitForSelector('[data-testid="journal-modal"]');
  assert((await page.locator('[data-testid^="hint-coins-"]').count()) === 0 && (await page.locator('[data-testid^="hint-ad-"]').count()) === 0, 'no hint buttons after stage 3');
  assert((await page.locator('[data-testid="journal-modal"]').innerText()).includes('Hints end after stage 3'), 'notebook says hints are over');
  await page.click('[data-testid="journal-modal"] [data-act="close"]');
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');

  // 25단계(가스레인지 기름때): 쇼호스트가 광고 제품(기름때 제거제) 소개 → 틀린 도구는 아무 효과 없음 → 세정제+수세미로만 지워짐 → 발견
  await page.click('[data-testid="area-kitchen"]');
  await page.click('[data-testid="stage-25"]');
  await page.waitForSelector('[data-testid="intro"]');
  await page.click('[data-testid="start"]');
  await page.evaluate(() => window.__sparkle.setShield(600)); // 이 구간은 세정제·도구 효과를 재는 곳 — 재오염(기름 튐)은 아래 차단 부스터 검사에서 다시 켠다
  await page.waitForSelector('[data-testid="host"][data-placement="intro"]', { timeout: 4000 });
  assert((await page.locator('[data-testid="host"]').innerText()).includes('BrightMax'), 'live host introduces the sponsored degreaser at stage start');
  await page.waitForTimeout(1500);
  const hostLine = await page.locator('[data-testid="host-line"]').innerText();
  assert(hostLine.length > 10, `host speaks with a typewriter bubble ("${hostLine.slice(0, 40)}…")`);
  assert((await page.locator('[data-testid="host-trial"]').count()) === 1 && (await page.locator('[data-testid="host-buy"]').count()) === 1, 'host offers a free trial (ad) and a buy button');
  await page.screenshot({ path: resolve(shots, '04b-host-intro.png') });
  await page.click('[data-testid="host-close"]');
  await page.waitForTimeout(350);
  await page.waitForSelector('[data-testid="item-degreaser"]');
  const kit25 = await page.evaluate(() => window.__sparkle.kit());
  assert(kit25.includes('degreaser') && kit25.includes('scrubpad') && !kit25.includes('sp:brightmax-degreaser'), `stove kit has what grease/dust need (${kit25.join(',')})`);
  assert((await page.locator('[data-testid="limit"]').count()) === 1, 'tier 3 stage shows a time limit');
  assert((await page.locator('[data-testid="limit"]').innerText()).includes('⏸'), 'clock is paused until cleaning actually starts');
  const grease0 = await page.evaluate(() => window.__sparkle.session().remainingOf('grease'));
  await page.click('[data-testid="item-sponge"]');
  await sweep(page, 1, 10, 4);
  const grease1 = await page.evaluate(() => window.__sparkle.session().remainingOf('grease'));
  assert(grease1 === grease0, `sponge alone leaves grease untouched (${grease0.toFixed(1)} → ${grease1.toFixed(1)})`);
  assert((await page.evaluate(() => window.__sparkle.noEffects())) >= 1, 'a "no effect" toast (no diagnosis after stage 3) fired for the wrong combo');
  assert((await page.evaluate(() => window.__sparkle.tries('grease'))) >= 1, 'failed attempt counted');
  await page.screenshot({ path: resolve(shots, '05-stove-wrong-tool.png') });
  // 수첩: 힌트 대신 쇼호스트 호출 → 막힘 등장(시계 멈춤) → 광고 보고 체험 → 툴바에 광고 제품
  await page.click('[data-testid="journal"]');
  await page.waitForSelector('[data-testid="host-hint-grease"]');
  await page.click('[data-testid="host-hint-grease"]');
  await page.waitForSelector('[data-testid="host"][data-placement="struggle"]');
  assert(await page.evaluate(() => window.__sparkle.paused()), 'game clock pauses while the host is on screen');
  assert((await page.locator('[data-testid="item-sp:brightmax-degreaser"]').count()) === 0, 'sponsored product is not in the toolbar before a trial');
  await page.click('[data-testid="host-trial"]');
  await page.waitForSelector('[data-testid="item-sp:brightmax-degreaser"]', { timeout: 5000 });
  await page.waitForSelector('[data-testid="host"]', { state: 'detached', timeout: 3000 });
  assert((await page.locator('[data-testid="host"]').count()) === 0, 'host closes after the rewarded trial');
  assert(!(await page.evaluate(() => window.__sparkle.paused())), 'clock resumes after the host closes');
  assert((await page.locator('[data-testid="item-sp:brightmax-degreaser"] .tool__ad').count()) === 1, 'sponsored degreaser joins the toolbar as a free trial');
  // 섞어 쓰기: 베이킹소다를 뿌린 자리에 주방세제를 겹쳐 뿌리면 "베이킹소다 + 주방세제" 페이스트가 된다 → 수세미로 기름때가 지워진다
  assert(kit25.includes('bakingsoda') && kit25.includes('dishsoap'), `stove kit holds both halves of the soda + dish-soap paste (${kit25.join(',')})`);
  assert((await page.locator('[data-testid="item-mix:soapsoda"]').count()) === 0, 'the mixture itself is not a toolbar item — it only exists where both are sprayed');
  await page.click('[data-testid="item-bakingsoda"]');
  await sweep(page, 1, 10, 3);
  assert((await page.evaluate(() => window.__sparkle.mixes())).length === 0, 'one cleaner alone does not mix');
  await page.click('[data-testid="item-dishsoap"]');
  await sweep(page, 1, 10, 3);
  const mixes = await page.evaluate(() => window.__sparkle.mixes());
  assert(mixes.includes('soapsoda'), `spraying dish soap over baking soda makes the paste (${mixes.join(',')})`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(shots, '05b-stove-mix.png') });
  const greaseMix0 = await page.evaluate(() => window.__sparkle.session().remainingOf('grease'));
  await page.click('[data-testid="item-scrubpad"]');
  await sweep(page, 1, 20, 4);
  const greaseMix1 = await page.evaluate(() => window.__sparkle.session().remainingOf('grease'));
  assert(greaseMix1 < greaseMix0, `scouring pad over the paste removes grease (${greaseMix0.toFixed(1)} → ${greaseMix1.toFixed(1)})`);
  assert((await page.evaluate(() => window.__sparkle.journal())).includes('grease|scrubpad|soapsoda'), 'the mixed recipe is recorded in the notebook as its own discovery');
  // 최소 3번, 기계가 빨라 한 번에 닦이는 양이 적으면 목표(30% 감소)에 닿을 때까지 최대 6번
  for (let round = 0; round < 6; round++) {
    await page.click('[data-testid="item-degreaser"]');
    await sweep(page, 1, 12, 3);
    await page.click('[data-testid="item-scrubpad"]');
    await sweep(page, 1, 20, 5);
    if (round >= 2 && (await page.evaluate(() => window.__sparkle.session().remainingOf('grease'))) < grease1 * 0.7) break;
  }
  const grease2 = await page.evaluate(() => window.__sparkle.session().remainingOf('grease'));
  assert(grease2 < grease1 * 0.7, `degreaser + scouring pad removes grease (${grease1.toFixed(1)} → ${grease2.toFixed(1)})`);
  assert((await page.evaluate(() => window.__sparkle.journal())).includes('grease|scrubpad|degreaser'), 'grease recipe discovered and saved');
  const pick25 = await page.evaluate(() => window.__sparkle.resultPick());
  assert(pick25 && pick25.id === 'brightmax-degreaser' && pick25.context === 'category', `stage-end host will pitch the sponsored degreaser because a plain degreaser was used this stage (${JSON.stringify(pick25)})`);
  assert((await page.evaluate(() => window.__sparkle.used())).includes('degreaser'), 'items actually used this stage are tracked');
  assert((await page.locator('[data-testid="limit"]').innerText()).includes('⏸') === false, 'clock runs once cleaning started');
  await page.screenshot({ path: resolve(shots, '06-stove-discovered.png') });

  // 수첩: 발견한 조합 표시
  await page.click('[data-testid="journal"]');
  await page.waitForSelector('[data-testid="journal-modal"]');
  assert((await page.locator('[data-testid="journal-grease"] .recipe').count()) >= 1, 'notebook shows the grease recipe');
  await page.screenshot({ path: resolve(shots, '07-journal.png') });
  await page.click('[data-testid="journal-modal"] [data-act="close"]');

  // 제한시간 초과 → 실패 모달 → 광고로 +30초
  const limit = await page.evaluate(() => window.__sparkle.timing().limitSec);
  assert(limit > 0, `stage 25 limit is ${limit}s`);
  await page.evaluate(() => window.__sparkle.forceExpire());
  await page.waitForSelector('[data-testid="fail"]');
  await page.screenshot({ path: resolve(shots, '08-timeout.png') });
  await page.click('[data-testid="extend"]');
  await page.waitForTimeout(1600);
  assert((await page.locator('[data-testid="fail"]').count()) === 0, 'rewarded ad extends the time limit');
  const extended = await page.evaluate(() => window.__sparkle.session().limitSec);
  assert(extended === limit + 30, `limit extended ${limit} → ${extended}`);

  // 코인 경제: HUD 부스터 바 → 상점(광고 코인·부스터 구매) → 판 안에서 사용 → 코인으로 이어하기
  assert((await page.locator('[data-testid="boosters"] [data-booster]').count()) === 4, 'HUD shows the 4 booster slots (extra time, foam bomb, grime scan, mess shield)');
  assert((await page.locator('[data-testid="booster-time"].is-empty').count()) === 1, 'booster slots start empty');
  await page.click('[data-testid="booster-time"]');
  await page.waitForSelector('[data-testid="shop"]');
  assert((await page.locator('[data-testid="booster-list"] .shop__item').count()) === 4, 'tapping an empty slot opens the shop with the boosters listed');
  assert((await page.locator('[data-testid="ad-coins"]').innerText()).includes('+80'), 'shop offers "watch ad → +80 coins"');
  assert((await page.locator('[data-testid="shop"] .coin-ad').innerText()).includes('5/5'), 'coin ads show the daily allowance (5/5)');
  const coinsA = await page.evaluate(() => window.__sparkle.coins());
  await page.click('[data-testid="ad-coins"]');
  await page.waitForTimeout(1600);
  await page.waitForSelector('[data-testid="shop"]');
  const coinsA2 = await page.evaluate(() => window.__sparkle.coins());
  assert(coinsA2 === coinsA + 80, `rewarded ad pays +80 coins (${coinsA} → ${coinsA2})`);
  assert((await page.locator('[data-testid="shop"] .coin-ad').innerText()).includes('4/5'), 'daily coin-ad counter drops to 4/5');
  await page.click('[data-testid="ad-coins"]');
  await page.waitForTimeout(1600);
  await page.waitForSelector('[data-testid="shop"]');
  const coinsB = await page.evaluate(() => window.__sparkle.coins());
  assert(coinsB === coinsA + 160 && (await page.locator('[data-testid="shop"] .coin-ad').innerText()).includes('3/5'), 'a second coin ad pays again and the counter reads 3/5');
  await page.click('[data-testid="shop-booster-time"] [data-buy-booster]');
  await page.waitForSelector('[data-testid="shop"]');
  assert((await page.evaluate(() => window.__sparkle.coins())) === coinsB - 60, 'extra-time booster costs 60 coins');
  assert((await page.evaluate(() => window.__sparkle.boosters())).time === 1, 'booster is stocked after buying');
  await page.click('[data-testid="shop-booster-bomb"] [data-ad-booster]');
  await page.waitForTimeout(1600);
  await page.waitForSelector('[data-testid="shop"]');
  assert((await page.evaluate(() => window.__sparkle.boosters())).bomb === 1, 'watching an ad grants a foam bomb for free');
  assert((await page.locator('[data-testid="booster-list"] .shop__item').count()) === 4, 'shop lists the mess shield as the 4th booster');
  await page.click('[data-testid="shop-booster-shield"] [data-buy-booster]');
  await page.waitForSelector('[data-testid="shop"]');
  assert((await page.evaluate(() => window.__sparkle.boosters())).shield === 1, 'mess shield bought (80 coins)');
  await page.screenshot({ path: resolve(shots, '08b-shop-boosters.png'), fullPage: true });
  await page.click('[data-testid="shop"] [data-act="close"]');
  await page.waitForTimeout(200);
  assert((await page.locator('[data-testid="booster-time"] .booster__n').innerText()) === '×1', 'HUD slot shows the stocked booster (×1)');
  const limitBefore = await page.evaluate(() => window.__sparkle.session().limitSec);
  await page.click('[data-testid="booster-time"]');
  await page.waitForTimeout(150);
  const limitAfter = await page.evaluate(() => window.__sparkle.session().limitSec);
  assert(limitAfter === limitBefore + 20, `using the extra-time booster adds 20s (${limitBefore} → ${limitAfter})`);
  assert((await page.locator('[data-testid="booster-time"].is-empty').count()) === 1, 'booster is consumed after use');
  const cleanBefore = await page.evaluate(() => window.__sparkle.session().cleanliness);
  await page.click('[data-testid="booster-bomb"]');
  await page.waitForTimeout(300);
  const cleanAfter = await page.evaluate(() => window.__sparkle.session().cleanliness);
  assert(cleanAfter >= cleanBefore + 0.2 * (1 - cleanBefore) - 0.02, `foam bomb wipes ~20% of the remaining grime at once (${(cleanBefore * 100).toFixed(0)}% → ${(cleanAfter * 100).toFixed(0)}%)`);
  await page.screenshot({ path: resolve(shots, '08c-foam-bomb.png') });
  // 장비 추천(느리게 가는 중) — 코인이 모자라면 "광고 보고 +80", 채워지면 바로 구매 → 툴바에 장착되고 선택됨
  const coinsG1 = await page.evaluate(() => window.__sparkle.coins());
  await page.evaluate(() => window.__sparkle.setCoins(750));
  assert(await page.evaluate(() => window.__sparkle.gearTip('slow', 'grease')), 'gear tip can be raised for the stove grease');
  const gear25 = await page.locator('[data-testid="gear-tip"]').innerText();
  assert(gear25.includes('Drill brush') && gear25.includes('taking a while'), `slow-going tip recommends the drill brush for stove grease ("${gear25.replace(/\n+/g, ' | ')}")`);
  assert((await page.locator('[data-testid="gear-ad"]').count()) === 1 && (await page.locator('[data-testid="gear-buy"]').count()) === 0, '750 coins < 800 → the tip offers "watch ad +80" instead of buy');
  await page.click('[data-testid="gear-ad"]');
  await page.waitForTimeout(1600);
  assert((await page.evaluate(() => window.__sparkle.coins())) === 830, 'gear tip ad pays +80 coins');
  assert((await page.locator('[data-testid="gear-buy"]').count()) === 1, 'card re-renders with a buy button once affordable');
  await page.click('[data-testid="gear-buy"]');
  await page.waitForTimeout(200);
  assert((await page.evaluate(() => window.__sparkle.coins())) === 30, 'drill brush bought from the tip for 800 coins');
  assert((await page.locator('[data-testid="item-drillbrush"].is-on').count()) === 1, 'bought gear lands in the toolbar already selected');
  assert((await page.locator('[data-testid="gear-tip"]:not([hidden])').count()) === 0, 'tip closes after buying');
  await page.evaluate((n) => window.__sparkle.setCoins(n), coinsG1 + 80 - 800); // 실제 흐름과 같은 잔액으로
  // 재오염 차단: 25초 동안 기름이 안 튄다
  await page.evaluate(() => window.__sparkle.setShield(0));
  await page.waitForTimeout(100);
  assert((await page.evaluate(() => window.__sparkle.mess())).shield === 0, 'stove splatter is live again');
  await page.click('[data-testid="booster-shield"]');
  await page.waitForTimeout(150);
  const shield = await page.evaluate(() => window.__sparkle.mess());
  assert(shield.kind === 'splatter' && shield.shield > 20, `mess shield blocks the stove splatter for ${shield.shield.toFixed(0)}s`);
  assert((await page.locator('[data-testid="mess"]').innerText()).includes('🛡'), 'HUD shows the shield instead of the countdown');
  assert((await page.locator('[data-testid="booster-shield"].is-empty').count()) === 1, 'shield consumed');
  // 코인으로 이어하기 (100코인, +20초)
  const coinsC = await page.evaluate(() => window.__sparkle.coins());
  await page.evaluate(() => window.__sparkle.forceExpire());
  await page.waitForSelector('[data-testid="fail"]');
  assert((await page.locator('[data-testid="extend-coins"]').count()) === 1, 'fail screen offers "continue for 100 coins" next to the ad');
  await page.click('[data-testid="extend-coins"]');
  await page.waitForTimeout(300);
  assert((await page.locator('[data-testid="fail"]').count()) === 0, 'coin continue resumes the stage');
  assert((await page.evaluate(() => window.__sparkle.coins())) === coinsC - 100, 'coin continue costs 100 coins');
  assert((await page.evaluate(() => window.__sparkle.session().limitSec)) === limitAfter + 20, 'coin continue adds 20s');

  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  // 27단계(원목 식탁, 정밀 모드): 기름때 제거제를 쓰면 손상 → 10% 에서 실패
  await page.click('[data-testid="area-kitchen"]');
  await page.click('[data-testid="stage-27"]');
  await page.waitForSelector('[data-testid="intro"]');
  assert((await page.locator('[data-testid="intro"] .intro__mode').innerText()).includes('Fragile'), 'stage 27 is a fragile-surface stage');
  await page.click('[data-testid="start"]');
  await closeHostIfOpen(page);
  await page.waitForSelector('[data-testid="item-degreaser"]');
  assert(await page.locator('[data-testid="item-degreaser"] .tool__warn').count(), 'toolbar flags degreaser as risky on wood');
  await page.click('[data-testid="item-degreaser"]');
  // 느린 CI 러너에서는 프레임이 적어 게임 시간이 천천히 흐른다 — 손상이 쌓일 때까지 몇 번 더 문지른다
  for (let i = 0; i < 6; i++) {
    await sweep(page, 2, 10, 6);
    await page.waitForTimeout(300);
    if ((await page.evaluate(() => window.__sparkle.session().damage)) > 0.05 || (await page.locator('[data-testid="fail"]').count())) break;
  }
  assert((await page.evaluate(() => window.__sparkle.session().damage)) > 0.05, 'degreaser on the wooden table causes damage');
  await page.waitForSelector('[data-testid="fail"]', { timeout: 8000 });
  assert((await page.locator('[data-testid="fail"]').innerText()).includes('Surface ruined'), 'fragile stage fails when damage reaches 10%');
  await page.screenshot({ path: resolve(shots, '09b-ruined.png') });
  await page.click('[data-testid="fail"] [data-act="menu"]');
  await page.waitForSelector('[data-testid="stage-25"]');

  // 3단계(소파, 러시 모드): 플레이 중 고양이 털이 계속 생김
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-living"]');
  await page.click('[data-testid="stage-3"]');
  await page.waitForSelector('[data-testid="intro"]');
  assert((await page.locator('[data-testid="intro"] .intro__mode').innerText()).includes('Keeps coming'), 'stage 3 is a rush stage');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="mode"]');
  const pending0 = await page.evaluate(() => window.__sparkle.session().pendingSpawns);
  await page.click('[data-testid="item-vacuum"]');
  await sweep(page, 3, 12, 6);
  const pending1 = await page.evaluate(() => window.__sparkle.session().pendingSpawns);
  assert(pending0 > 0 && pending1 < pending0, `hair keeps appearing while cleaning (${pending0} → ${pending1} left)`);
  await page.screenshot({ path: resolve(shots, '09c-rush.png') });

  // 6단계(책장, 스팟 모드): 표적 링
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="stage-6"]');
  await page.waitForSelector('[data-testid="intro"]');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="mode"]');
  const spots = await page.evaluate(() => window.__sparkle.session().spots.length);
  assert(spots >= 3, `spots stage marks ${spots} stubborn spots`);
  assert((await page.locator('[data-testid="mode"]').innerText()).includes(`0/${spots}`), 'HUD shows spot progress');
  await page.screenshot({ path: resolve(shots, '09d-spots.png') });

  // 33단계(주방 전체, T3): 복합 구역 + 세정제 용량 바
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-kitchen"]');
  await page.click('[data-testid="stage-33"]');
  await page.waitForSelector('[data-testid="intro"]');
  await page.click('[data-testid="start"]');
  await closeHostIfOpen(page);
  await page.waitForSelector('[data-testid="canvas"]');
  assert((await page.locator('.tool__budget').count()) >= 2, 'tier 3 shows cleaner budget bars');
  const zones = await page.evaluate(() => window.__sparkle.session().surfaces.length);
  assert(zones >= 3, `mixed kitchen has ${zones} surfaces`);
  await page.screenshot({ path: resolve(shots, '10-kitchen-mix.png') });

  // 40단계(욕조): 곰팡이 제거제 + 물때 제거제 → 위험 혼합 모달
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-bathroom"]');
  await page.click('[data-testid="stage-43"]');
  await page.waitForSelector('[data-testid="intro"]');
  await page.click('[data-testid="start"]');
  await closeHostIfOpen(page);
  await page.waitForSelector('[data-testid="item-moldremover"]');
  await page.waitForSelector('[data-testid="item-descaler"]');
  await page.click('[data-testid="item-moldremover"]');
  for (let i = 0; i < 3; i++) {
    await sweep(page, 1, 4, 4);
    if ((await page.evaluate(() => window.__sparkle.used())).includes('moldremover')) break;
    // 첫 분사가 반영되지 않았으면 이유를 남기고 다시 (CI 전용 실패 추적)
    console.log('info - mold remover sweep did not register:', JSON.stringify(await page.evaluate(() => {
      const c = document.querySelector('[data-testid="canvas"]').getBoundingClientRect();
      const el = document.elementFromPoint(c.x + 5, c.y + 5);
      return { paused: window.__sparkle.paused(), selected: window.__sparkle.selected(), at: el ? `${el.tagName}.${el.className}[${el.getAttribute('data-testid') ?? ''}]` : null, canvas: [c.x, c.y, c.width, c.height].map(Math.round) };
    })));
    await page.waitForTimeout(300);
  }
  await page.click('[data-testid="item-descaler"]');
  await sweep(page, 1, 4, 4);
  await page.waitForTimeout(200);
  assert(await page.locator('.modal h2', { hasText: 'Dangerous mix' }).count(), 'hazard modal warns about mixing chlorine and acid');
  await page.screenshot({ path: resolve(shots, '11-hazard.png') });
  await page.click('.modal [data-act="ok"]');

  // 상점: 프리미엄(빨리 닦는 장비) 구매 → 툴바에 등장; 스폰서 근거 + 구매 버튼
  await page.click('[data-testid="toolbar-shop"]');
  await page.waitForSelector('[data-testid="shop"]');
  assert((await page.locator('[data-testid="premium-list"] .shop__item').count()) === 7, 'shop lists 7 premium (faster) items');
  assert(await page.locator('[data-testid="shop-sp:brightmax-degreaser"] .tag-ad').count(), 'sponsored item carries an Ad label');
  assert((await page.locator('[data-testid="live"] .live__item').count()) === 2, 'shop has a LIVE section with the host for each sponsored product');
  await page.screenshot({ path: resolve(shots, '12-shop.png'), fullPage: true });
  await page.click('[data-testid="shop-cordlessvac"] [data-buy]');
  await page.waitForTimeout(200);
  assert((await page.locator('[data-testid="shop-cordlessvac"] .shop__act .pill').count()) === 1, 'cordless vacuum bought with coins');
  await page.click('[data-testid="shop-sp:brightmax-degreaser"] [data-evidence]');
  await page.waitForSelector('[data-testid="evidence"]');
  const ev = await page.locator('[data-testid="evidence"]').innerText();
  assert(ev.includes('92%') && ev.includes('115% vs standard'), 'evidence shows lab removal and % vs standard');
  assert((await page.locator('[data-testid="evidence-buy"]').count()) === 1, 'evidence offers a buy link');
  await page.click('[data-testid="evidence"] [data-act="close"]');

  // 실제 제품 몰 탭: 마켓 칩, 종류별 링크, 제휴 고지
  await page.click('[data-testid="tab-mall"]');
  await page.waitForSelector('[data-testid="mall"]');
  assert((await page.locator('[data-testid^="mallcat-"]').count()) === 44, 'mall lists all 44 product categories (incl. household tip items)');
  assert((await page.locator('[data-testid="market-amazon_us"].is-on').count()) === 1, 'English UI defaults to Amazon');
  await page.click('[data-testid="market-coupang"]');
  await page.waitForTimeout(100);
  { const mallText = await page.locator('[data-testid="mall"]').innerText(); assert(/Ad ·|광고/.test(mallText) && !/수수료|commission/i.test(mallText), 'Coupang market is labelled as ads, with no commission wording'); }
  await page.screenshot({ path: resolve(shots, '13-mall.png'), fullPage: true });
  await page.click('[data-testid="shop"] [data-act="close"]');
  assert((await page.locator('[data-testid="item-cordlessvac"]').count()) === 0, 'premium vacuum stays hidden where it is not needed (bathtub)');

  // 새 장면 렌더 확인 + 한국어 화면
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sparkle-clean-v1'));
    raw.settings.lang = 'ko';
    localStorage.setItem('sparkle-clean-v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(shots, '14-home-ko.png'), fullPage: true });
  const scenes = [
    ['living', 5, '15-rug-ko.png'],
    ['living', 9, '15b-dark-ko.png'],
    ['bathroom', 41, '16-toilet-ko.png'],
    ['bathroom', 40, '16b-spread-ko.png'],
    ['garden', 63, '17-garden-ko.png'],
    ['garden', 56, '18-grill-ko.png'],
    ['exterior', 82, '19-car-ko.png'],
    ['interior', 93, '20-car-interior-ko.png'],
  ];
  for (const [area, id, file] of scenes) {
    await page.click(`[data-testid="area-${area}"]`);
    await page.click(`[data-testid="stage-${id}"]`);
    await page.waitForSelector('[data-testid="intro"]');
    await page.click('[data-testid="start"]');
    await page.waitForSelector('[data-testid="canvas"]');
    await closeHostIfOpen(page);
    if (id === 5) {
      assert((await page.locator('[data-testid="item-cordlessvac"].is-premium').count()) === 1, 'bought premium vacuum shows up on the rug stage where it is needed');
      await page.click('[data-testid="item-cordlessvac"]');
      await sweep(page, 2, 12, 4);
      const polish = await page.evaluate(() => window.__sparkle.polish());
      assert(polish > 0.05, `premium vacuum leaves a polished finish (${(polish * 100).toFixed(0)}% of cells)`);
    }
    const cb = await page.locator('[data-testid="canvas"]').boundingBox();
    await page.mouse.move(cb.x + cb.width * 0.55, cb.y + cb.height * 0.45); // 정전 모드 손전등
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(shots, file) });
    await page.click('[data-testid="back"]');
    await page.click('[data-testid="back-home"]');
  }

  // 운영자 모드: PIN → 광고 제품 목록 → 새 제품 등록 → 일시정지 → 통계 → 배포 JSON → 게임으로
  await page.click('[data-testid="admin-entry"]');
  await page.waitForSelector('[data-testid="admin-pin"]');
  await page.fill('[data-testid="admin-pin"]', '0000');
  await page.click('[data-testid="admin-ok"]');
  await page.waitForTimeout(200);
  assert((await page.locator('[data-testid="admin"]').count()) === 0, 'wrong PIN is rejected');
  await page.fill('[data-testid="admin-pin"]', '1234');
  await page.click('[data-testid="admin-ok"]');
  await page.waitForSelector('[data-testid="admin"]');
  assert((await page.locator('[data-testid="admin-list"] .admin__item').count()) === 2, 'admin lists the 2 sponsored products');
  assert((await page.locator('[data-testid="admin-item-brightmax-degreaser"]').innerText()).includes('노출'), 'admin shows host impressions per product');
  await page.screenshot({ path: resolve(shots, '21-admin.png'), fullPage: true });
  await page.click('[data-testid="admin-new"]');
  await page.waitForSelector('[data-testid="admin-form"]');
  await page.fill('[data-testid="admin-form"] [name="brand"]', 'WaxCo');
  await page.fill('[data-testid="admin-form"] [name="name"]', 'Mold Wax');
  await page.selectOption('[data-testid="admin-form"] [name="base"]', 'moldremover');
  await page.waitForTimeout(150);
  await page.fill('[data-testid="admin-form"] [name="lab_mold"]', '95');
  await page.fill('[data-testid="admin-form"] [name="ev_lab"]', 'KTR');
  await page.fill('[data-testid="admin-form"] [name="ev_report"]', 'KTR-2027-01');
  await page.fill('[data-testid="admin-claims"]', '곰팡이 95% 제거 (시험성적서)\n리뷰 평점 4.8');
  await page.fill('[data-testid="admin-form"] [name="rv_count"]', '8800');
  await page.fill('[data-testid="admin-form"] [name="rv_rating"]', '4.8');
  await page.screenshot({ path: resolve(shots, '22-admin-form.png'), fullPage: true });
  await page.click('[data-testid="admin-save"]');
  await page.waitForSelector('[data-testid="admin-flash"]');
  assert((await page.locator('[data-testid="admin-list"] .admin__item').count()) === 3, 'new sponsored product saved from the admin form');
  const waxRow = await page.locator('.admin__item', { hasText: 'WaxCo' }).innerText();
  assert(waxRow.includes('노출 중') && waxRow.includes('PRO'), `new product is live and PRO grade (${waxRow.split('\n')[0]})`);
  await page.click('[data-testid="admin-toggle-brightmax-degreaser"]');
  await page.waitForTimeout(150);
  assert((await page.locator('[data-testid="admin-item-brightmax-degreaser"]').innerText()).includes('일시정지'), 'built-in product can be paused');
  // 실사 쇼호스트: 사진 파일 올리기 → 미리보기가 사진으로, 라이브 카드도 사진으로
  await page.click('[data-testid="admin-tab-host"]');
  await page.waitForSelector('[data-testid="admin-host"]');
  assert((await page.locator('[data-testid="admin-host-preview"] .hav--paint').count()) === 1, 'host settings preview shows the built-in portrait by default');
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 120, height: 120 } });
  await page.setInputFiles('[data-testid="admin-photo-file"]', { name: 'host.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('[data-testid="admin-photo-clear"]');
  const photoSrc = await page.getAttribute('[data-testid="admin-host-preview"] .hav--photo img', 'src');
  assert(photoSrc && photoSrc.startsWith('data:image/jpeg') && photoSrc.length < 200_000, `uploaded photo is cropped, compressed and saved (${Math.round(photoSrc.length / 1024)} KB)`);
  await page.click('[data-testid="admin-tab-campaigns"]');
  await page.click('[data-testid="admin-preview-brightmax-degreaser"]');
  await page.waitForSelector('[data-testid="host"]');
  assert((await page.locator('[data-testid="host"] .hav--photo img').count()) === 1, 'live card shows the real-person photo instead of the portrait');
  await page.waitForTimeout(600);
  assert((await page.locator('[data-testid="host"] .hav.is-talking').count()) === 1, 'photo host pulses a talking ring while speaking');
  await page.screenshot({ path: resolve(shots, '22b-host-photo.png') });
  await page.click('[data-testid="host-close"]');
  await page.waitForTimeout(350);
  await page.click('[data-testid="admin-tab-host"]');
  await page.click('[data-testid="admin-photo-clear"]');
  await page.waitForTimeout(150);
  assert((await page.locator('[data-testid="admin-host-preview"] .hav--paint').count()) === 1, 'removing the photo falls back to the portrait');
  // 편집 화면: 제품 소개 영상 URL + 대본 복사
  await page.click('[data-testid="admin-tab-campaigns"]');
  await page.click('[data-testid="admin-edit-brightmax-degreaser"]');
  await page.waitForSelector('[data-testid="admin-form"]');
  assert((await page.locator('[data-testid="admin-video-url"]').count()) === 1 && (await page.locator('[data-testid="admin-video-file"]').count()) === 1, 'product form takes a real-person video (URL or file)');
  await page.click('[data-testid="admin-copy-script"]');
  await page.waitForSelector('[data-testid="admin-flash"]');
  const scriptFlash = await page.locator('[data-testid="admin-flash"]').innerText();
  const scriptBox = await page.locator('[data-testid="admin-script"]').count();
  assert(scriptFlash.includes('대본을 복사') || (scriptBox === 1 && (await page.locator('[data-testid="admin-script"]').inputValue()).includes('[en] BrightMax')), `copy-script gives the three-language pitch for AI avatar services (${scriptFlash})`);
  await page.click('[data-testid="admin-form"] [data-act="cancel"]');
  await page.click('[data-testid="admin-tab-stats"]');
  await page.waitForSelector('[data-testid="admin-stats"]');
  const counters = await page.evaluate(() => JSON.parse(localStorage.getItem('sparkle-clean-v1')).ops.counters);
  const shows = Object.entries(counters).filter(([k]) => k.startsWith('host_show|brightmax-degreaser|')).reduce((a, [, n]) => a + n, 0);
  const trials = counters['host_cta_trial|brightmax-degreaser|struggle'] ?? 0;
  assert(shows >= 2 && trials >= 1, `stats count host impressions (${shows}) and trial clicks (${trials}) for BrightMax`);
  assert((await page.locator('[data-testid="admin-stats"]').innerText()).includes('BrightMax'), 'stats table lists the product');
  await page.click('[data-testid="admin-tab-export"]');
  await page.waitForSelector('[data-testid="admin-export"]');
  const json = await page.locator('[data-testid="admin-export"]').inputValue();
  assert(json.includes('"WaxCo"') && json.includes('"host"'), 'export JSON carries products and host config');
  // 테스트 플레이: 진행과 상관없이 모든 판을 바로 시작
  await page.click('[data-testid="admin-tab-play"]');
  await page.waitForSelector('[data-testid="admin-stage-96"]');
  assert((await page.locator('[data-testid^="admin-play-"]').count()) === 96, 'test-play tab lists all 96 stages with a play button');
  const realUnlocked = await page.evaluate(() => JSON.parse(localStorage.getItem('sparkle-clean-v1')).progress.unlocked);
  await page.evaluate(() => window.__sparkle.setUnlocked(5));
  await page.waitForTimeout(250);
  const unlocked0 = 5;
  await page.click('[data-testid="admin-grant-coins"]');
  await page.waitForSelector('[data-testid="admin-wallet"]');
  assert((await page.evaluate(() => window.__sparkle.coins())) >= 1000, 'test grant adds 1,000 coins');
  await page.click('[data-testid="admin-play-90"]');
  await page.waitForSelector('[data-testid="canvas"]');
  assert((await page.evaluate(() => window.__sparkle.session().level.id)) === 90, 'locked stage 90 starts straight from the test-play tab');
  await page.evaluate(() => window.__sparkle.clearAll());
  await page.waitForSelector('[data-testid="result"]', { timeout: 8000 });
  await page.waitForTimeout(300);
  const unlocked1 = await page.evaluate(() => JSON.parse(localStorage.getItem('sparkle-clean-v1')).progress.unlocked);
  assert(unlocked1 === unlocked0, `clearing a test-played stage leaves saved progress alone (${unlocked0} → ${unlocked1})`);
  await page.click('[data-testid="result"] [data-act="menu"]').catch(() => {});
  await page.waitForTimeout(200);
  if (!(await page.locator('[data-testid="admin-entry"]').count())) {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  }
  await page.waitForSelector('[data-testid="admin-entry"]');
  await page.click('[data-testid="admin-entry"]');
  if (await page.locator('[data-testid="admin-pin"]').count()) {
    await page.fill('[data-testid="admin-pin"]', '1234');
    await page.click('[data-testid="admin-ok"]');
  }
  await page.waitForSelector('[data-testid="admin"]');
  await page.click('[data-testid="admin-tab-play"]');
  await page.check('[data-testid="admin-test-unlock"]');
  await page.click('[data-testid="admin-exit"]');
  await page.waitForSelector('[data-testid="play"]');
  await page.click('[data-testid="area-interior"]');
  assert((await page.locator('[data-testid="stage-90"]:not([disabled]).is-test').count()) === 1, 'with "unlock every stage" on, game screens open locked stages marked as test play');
  await page.click('[data-testid="back-home"]');
  await page.waitForSelector('[data-testid="play"]');
  await page.click('[data-testid="result"] [data-act="menu"]').catch(() => {});
  await page.waitForTimeout(200);
  if (!(await page.locator('[data-testid="admin-entry"]').count())) {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  }
  await page.waitForSelector('[data-testid="admin-entry"]');
  await page.click('[data-testid="admin-entry"]');
  if (await page.locator('[data-testid="admin-pin"]').count()) {
    await page.fill('[data-testid="admin-pin"]', '1234');
    await page.click('[data-testid="admin-ok"]');
  }
  await page.waitForSelector('[data-testid="admin"]');
  await page.click('[data-testid="admin-tab-play"]');
  await page.uncheck('[data-testid="admin-test-unlock"]');
  await page.evaluate((n) => window.__sparkle.setUnlocked(n), realUnlocked);
  await page.click('[data-testid="admin-exit"]');
  await page.waitForSelector('[data-testid="play"]');
  // 일시정지한 제품은 상점에서 빠지고, 새 제품이 들어온다
  await page.click('[data-act="shop"]');
  await page.waitForSelector('[data-testid="shop"]');
  assert((await page.locator('[data-testid="shop-sp:brightmax-degreaser"]').count()) === 0, 'paused product disappears from the game');
  assert((await page.locator('.shop__item', { hasText: 'WaxCo' }).count()) === 1, 'new product appears in the game');
  await page.locator('.live__item', { hasText: 'WaxCo' }).click();
  await page.waitForSelector('[data-testid="host"]');
  await page.waitForTimeout(2500);
  const liveText = await page.locator('[data-testid="host"]').innerText();
  assert(liveText.includes('WaxCo'), 'LIVE host presents the newly registered product');
  await page.screenshot({ path: resolve(shots, '23-host-live.png') });
  await page.click('[data-testid="host-close"]');

  // 실제 판매 제품(제휴 추천): 유료 광고주가 없는 판에서 쇼호스트가 실제 제품을 소개하고, 체험 대신 구매 링크·제휴 고지를 보여 준다
  await page.evaluate(() => window.__sparkle.hostConfig({ affiliate: true, introCooldownMin: 0 }));
  await page.click('[data-testid="area-living"]');
  await page.click('[data-testid="stage-4"]');
  await page.waitForSelector('[data-testid="intro"]');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="host"][data-placement="intro"]', { timeout: 4000 });
  await page.waitForTimeout(1200);
  const affText = await page.locator('[data-testid="host"]').innerText();
  assert((await page.locator('[data-testid="host-affiliate"]').count()) === 1, 'host card carries the "Affiliate pick" badge for a real retail product');
  const realKr = /유한락스|홈스타|피죤|스카치브라이트|매직블럭|다이슨|카처|한경희/;
  assert(realKr.test(affText), `host presents a real Korean retail product (${affText.split('\n').find((l) => realKr.test(l))})`);
  assert(affText.includes('실제로 파는 제품'), 'pitch says it is a real product you can buy');
  assert(!/\d+%|\d+배/.test(affText), 'affiliate pitch makes no efficacy claims (no % or ×)');
  assert((await page.locator('[data-testid="host-spec"]').innerText()).includes('315AW'), 'card shows the published spec the in-game performance is tuned to (Dyson V16 315AW)');
  assert((await page.locator('[data-testid="host-trial"]').count()) === 1, 'real product offers "watch ad, try it this stage"');
  assert((await page.locator('[data-testid="host-buy"]').innerText()).includes('쿠팡'), 'buy button says "쿠팡에서 보기"');
  assert((await page.locator('[data-testid="host-foot"]').innerText()).startsWith('광고') && !affText.includes('수수료'), 'card is labelled as an ad, with no commission wording');
  await page.screenshot({ path: resolve(shots, '24-host-affiliate.png') });
  const realName = affText.match(/— (.+?)\./)?.[1];
  await page.click('[data-testid="host-trial"]');
  await page.waitForTimeout(1600);
  const sel = await page.evaluate(() => window.__sparkle.selected?.() ?? null);
  assert(typeof sel === 'string' && sel.startsWith('sp:kr-'), `trying the real product puts it in the toolbar, selected (${sel}, ${realName})`);
  // 쇼호스트 광고는 판마다 한 번: 판 시작에 나왔으면 결과 화면에서는 저절로 안 나온다
  await page.evaluate(() => window.__sparkle.clearAll());
  await page.waitForSelector('[data-testid="result"]', { timeout: 8000 });
  await page.waitForTimeout(2200);
  assert((await page.locator('[data-testid="host"]').count()) === 0, 'host ad appears only once per stage (intro shown → no automatic result spot)');
  await page.waitForTimeout(300);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="play"]');
  // 코인으로 광고 제거 이용권 → 저절로 뜨는 쇼호스트 광고가 나오지 않는다
  await page.evaluate(() => window.__sparkle.setCoins(400));
  await page.click('[data-act="shop"]');
  await page.waitForSelector('[data-testid="adfree-list"]');
  assert((await page.locator('[data-testid="adfree-list"] .shop__item').count()) === 3, 'shop sells ad-free passes (1 / 7 / 30 days) for coins');
  await page.click('[data-testid="adfree-day"] [data-adfree]');
  await page.waitForSelector('[data-testid="adfree-active"]');
  assert((await page.evaluate(() => window.__sparkle.coins())) === 100, 'one-day ad-free pass costs 300 coins');
  await page.click('[data-testid="shop"] [data-act="close"]');
  await page.click('[data-testid="area-living"]');
  await page.click('[data-testid="stage-4"]');
  await page.waitForSelector('[data-testid="intro"]');
  await page.click('[data-testid="start"]');
  await page.waitForTimeout(2500);
  assert((await page.locator('[data-testid="host"]').count()) === 0, 'with ad-free on, no automatic host ad at stage start');
  await page.click('[data-testid="back"]');
  await page.waitForSelector('[data-testid="stage-1"]');
  await page.click('[data-testid="back-home"]');
  await page.waitForSelector('[data-testid="play"]');
  await page.click('[data-act="shop"]');
  await page.waitForSelector('[data-testid="shop"]');
  await page.click('[data-testid="tab-mall"]');
  await page.waitForSelector('[data-testid="mall"]');
  assert((await page.locator('[data-testid="mall-kr-yuhanrox"]').count()) === 1 && (await page.locator('[data-testid="mall-kr-yuhanrox"] .tag-affiliate').count()) === 1, 'mall lists real Korean products with the affiliate tag (Coupang market)');
  assert((await page.locator('[data-testid="mall-us-windex"]').count()) === 0, 'US products stay out of the Coupang list');
  await page.click('[data-testid="market-amazon_us"]');
  await page.waitForTimeout(100);
  assert((await page.locator('[data-testid="mall-us-windex"]').count()) === 1, 'switching to Amazon lists the US products');
  await page.click('[data-testid="shop"] [data-act="close"]');

  // 3D 보기 — WebGL(SwiftShader) 켠 별도 브라우저에서: 같은 판을 3D 방 안의 면으로, 광선 투사로 닦인다
  {
    const b3d = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const ctx3 = await b3d.newContext({ ...phone, locale: 'en-US', hasTouch: false });
    const p3 = await ctx3.newPage();
    await p3.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await p3.waitForSelector('[data-testid="play"]');
    await p3.evaluate(() => window.__sparkle.force2d(false)); // 3D 는 실험 기능 — 기본은 2D
    await p3.click('[data-testid="play"]');
    await p3.waitForSelector('[data-testid="intro"]');
    await p3.click('[data-testid="start"]');
    await p3.waitForSelector('[data-testid="canvas"]');
    // 첫 판 조작 안내: 버튼을 하나씩 비추며 설명, 그동안 게임은 멈춤
    await p3.waitForSelector('[data-testid="tour"]');
    const tourTexts = [];
    for (let n = 0; n < 12 && (await p3.locator('[data-testid="tour"]').count()); n++) {
      tourTexts.push(await p3.locator('[data-testid="tour-text"]').innerText());
      await p3.click('[data-testid="tour-next"]');
    }
    assert(tourTexts.length === 9 && new Set(tourTexts).size === 9 && tourTexts[1].startsWith('Tools') && tourTexts[4].startsWith('Boosters'), 'first stage walks through what each control does (9 steps)');
    assert(/needs none/.test(tourTexts[2]) && !/tap one/.test(tourTexts[2]), 'stage 1 has no cleaners, so the walkthrough says none are needed instead of telling you to tap one');
    assert(await p3.waitForFunction(() => JSON.parse(localStorage.getItem('sparkle-clean-v1') || '{}').settings?.tourDone === true, null, { timeout: 5000 }).then(() => true, () => false), 'finishing the walkthrough is remembered');
    // 1판은 다시 해도 안내가 나온다
    await p3.click('[data-testid="back"]');
    await p3.waitForSelector('[data-testid="stage-1"]');
    await p3.click('[data-testid="stage-1"]');
    await p3.waitForSelector('[data-testid="intro"]');
    await p3.click('[data-testid="start"]');
    assert(await p3.waitForSelector('[data-testid="tour"]', { timeout: 5000 }).then(() => true, () => false), 'stage 1 shows the walkthrough every time');
    await p3.click('[data-testid="tour-skip"]');
    await p3.waitForFunction(() => { const c = document.querySelector('[data-testid="canvas3d"]'); return c && !c.hidden && c.dataset.engine; }, null, { timeout: 15000 });
    await p3.waitForTimeout(500);
    assert((await p3.locator('[data-testid="view3d"]').count()) === 0, '3D (experimental) renders the stage, with no switch in the HUD');
    const before3d = await p3.evaluate(() => window.__sparkle.session().cleanliness);
    const b3 = await p3.locator('[data-testid="canvas3d"]').boundingBox();
    await p3.mouse.move(b3.x + b3.width * 0.2, b3.y + b3.height * 0.35);
    await p3.mouse.down();
    for (let k = 0; k < 40; k++) {
      await p3.mouse.move(b3.x + b3.width * (0.2 + (k % 10) * 0.06), b3.y + b3.height * (0.3 + Math.floor(k / 10) * 0.1));
      await p3.waitForTimeout(25);
    }
    await p3.mouse.up();
    const after3d = await p3.evaluate(() => window.__sparkle.session().cleanliness);
    assert(after3d > before3d + 0.05, `scrubbing the 3D surface cleans it (${(before3d * 100).toFixed(0)}% → ${(after3d * 100).toFixed(0)}%)`);
    await p3.screenshot({ path: resolve(shots, '03b-view3d.png') });
    await b3d.close();
  }

  assert(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  if (softFails.length) throw new Error(`${softFails.length} soft failure(s): ${softFails.join(' | ')}`);
  console.log('\nE2E PASSED');
} catch (e) {
  console.error('\nE2E FAILED:', e.message);
  await page.screenshot({ path: resolve(shots, 'zz-fail.png') }).catch(() => {});
  // 실패 순간의 게임 상태 — CI 에서만 나는 실패를 원인까지 볼 수 있게
  const snap = await page.evaluate(() => {
    const k = window.__sparkle; const s = k?.session?.();
    return {
      level: k?.level?.(), selected: k?.selected?.(), items: k?.items?.(), used: k?.used?.(), mixes: k?.mixes?.(),
      session: s ? { time: s.time, engaged: s.engaged, hazard: s.hazard, damage: s.damage, cleanliness: s.cleanliness, limitSec: s.limitSec, passed: s.passed } : null,
      modal: document.querySelector('.modal')?.innerText?.slice(0, 200) ?? null,
      overlays: [...document.querySelectorAll('[data-testid="host"], [data-testid="intro"], [data-testid="fail"], [data-testid="result"], .tour, [data-testid="shop"]')].map((e) => e.getAttribute('data-testid') || e.className),
      canvas: (() => { const c = document.querySelector('[data-testid="canvas"]')?.getBoundingClientRect(); return c ? [Math.round(c.x), Math.round(c.y), Math.round(c.width), Math.round(c.height)] : null; })(),
      viewport: [innerWidth, innerHeight],
    };
  }).catch((err) => ({ error: String(err) }));
  console.error('state at failure:', JSON.stringify(snap));
  process.exitCode = 1;
} finally {
  await browser.close();
  try {
    process.kill(-preview.pid, 'SIGTERM');
  } catch {}
  process.exit(process.exitCode ?? 0);
}
