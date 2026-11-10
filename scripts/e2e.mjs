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

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('ok -', msg);
}

/** 쇼호스트 카드가 떠 있으면 닫는다 */
async function closeHostIfOpen(page) {
  if (await page.locator('[data-testid="host"]').count()) {
    await page.click('[data-testid="host-close"]');
    await page.waitForTimeout(350);
  }
}

/** 캔버스 위를 지그재그로 문지름 (passes 회) */
async function sweep(page, passes = 1, rows = 14, stepMs = 8) {
  const box = await page.locator('[data-testid="canvas"]').boundingBox();
  for (let p = 0; p < passes; p++) {
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    for (let r = 0; r <= rows; r++) {
      const y = box.y + (box.height * (r + 0.5)) / (rows + 1);
      const xs = r % 2 ? [box.x + box.width - 4, box.x + 4] : [box.x + 4, box.x + box.width - 4];
      for (let k = 0; k <= 12; k++) {
        await page.mouse.move(xs[0] + ((xs[1] - xs[0]) * k) / 12, y);
        await page.waitForTimeout(stepMs);
      }
    }
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
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'en-US', hasTouch: false });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="play"]');
  assert((await page.locator('[data-testid="beta-tag"]').count()) === 1, 'home shows the BETA tag on production builds (VITE_BETA)');
  assert((await page.locator('.world').count()) === 3, '3 worlds listed (apartment, house, car)');
  await page.waitForTimeout(700);
  assert((await page.evaluate(() => window.__sparkle.coins())) === 30, 'first visit of the day pays the 30-coin daily bonus');
  assert((await page.locator('[data-testid="coins"]').innerText()).includes('30'), 'home coin button shows the balance and opens the shop');
  assert((await page.locator('.area').count()) === 7, '7 areas listed');
  assert((await page.locator('.area.is-locked').count()) === 6, 'only the living room is unlocked at start');
  await page.screenshot({ path: resolve(shots, '01-home.png'), fullPage: true });

  // 1단계(거실 바닥 먼지): 걸레로 드래그 → 발견 토스트 → 완료 → 전후 리빌 → 결과
  await page.click('[data-testid="play"]');
  await page.waitForSelector('[data-testid="intro"]');
  assert((await page.locator('[data-testid="intro"] .kit__item').count()) === 2, 'intro shows only the 2 tools this job needs (cloth, vacuum)');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.waitForTimeout(300);
  assert((await page.locator('.toolbar [data-item]').count()) === 2, 'toolbar lists only the needed items');
  assert((await page.locator('[data-testid="limit"]').count()) === 0, 'tier 1 has no time limit');
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
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="item-squeegee"]');
  const kit4 = await page.evaluate(() => window.__sparkle.kit());
  assert(kit4.includes('squeegee') && kit4.includes('glass') && kit4.length >= 5, `stage 4 kit mixes decoys in (${kit4.join(',')})`);
  assert(kit4.includes('vinegar') && kit4.includes('dishsoap'), `stage 4 kit holds both halves of the glass-cleaner mix (${kit4.join(',')})`);
  await page.click('[data-testid="item-vacuum"]');
  await sweep(page, 1, 8, 4);
  await page.click('[data-testid="item-cloth"]');
  await sweep(page, 1, 8, 4);
  assert((await page.evaluate(() => window.__sparkle.tries('film'))) >= 2, 'two failed tools tried on the window film');
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
  for (let round = 0; round < 3; round++) {
    await page.click('[data-testid="item-degreaser"]');
    await sweep(page, 1, 12, 3);
    await page.click('[data-testid="item-scrubpad"]');
    await sweep(page, 1, 20, 5);
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
  assert((await page.locator('[data-testid="boosters"] [data-booster]').count()) === 3, 'HUD shows the 3 booster slots (extra time, foam bomb, grime scan)');
  assert((await page.locator('[data-testid="booster-time"].is-empty').count()) === 1, 'booster slots start empty');
  await page.click('[data-testid="booster-time"]');
  await page.waitForSelector('[data-testid="shop"]');
  assert((await page.locator('[data-testid="booster-list"] .shop__item').count()) === 3, 'tapping an empty slot opens the shop with the 3 boosters listed');
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
  assert(cleanAfter >= cleanBefore + 0.15, `foam bomb wipes ~20% of the remaining grime at once (${(cleanBefore * 100).toFixed(0)}% → ${(cleanAfter * 100).toFixed(0)}%)`);
  await page.screenshot({ path: resolve(shots, '08c-foam-bomb.png') });
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
  await sweep(page, 2, 10, 6);
  await page.waitForTimeout(300);
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
  await sweep(page, 1, 4, 4);
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
  assert((await page.locator('[data-testid="mall"]').innerText()).includes('쿠팡 파트너스'), 'Coupang market shows the Partners disclosure');
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

  assert(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  console.log('\nE2E PASSED');
} catch (e) {
  console.error('\nE2E FAILED:', e.message);
  await page.screenshot({ path: resolve(shots, 'zz-fail.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  try {
    process.kill(-preview.pid, 'SIGTERM');
  } catch {}
  process.exit(process.exitCode ?? 0);
}
