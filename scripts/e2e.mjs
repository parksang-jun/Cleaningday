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
  assert((await page.locator('.world').count()) === 3, '3 worlds listed (apartment, house, car)');
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
  await sweep(page, 1);
  const mid = await page.evaluate(() => window.__sparkle.session().cleanliness);
  assert(mid > 0.2, `one sweep with the cloth cleans ${(mid * 100).toFixed(0)}%`);
  assert((await page.evaluate(() => window.__sparkle.journal())).includes('dust|cloth|-'), 'cloth-on-dust recipe recorded in the notebook');
  await page.screenshot({ path: resolve(shots, '03-stage1-cleaning.png') });
  assert(await cleanUntilDone(page), 'stage 1 completes by dragging');
  await page.waitForSelector('[data-testid="result"]', { timeout: 8000 });
  const stars = await page.locator('.result__stars .on').count();
  assert(stars >= 1, `result shows ${stars} stars`);
  assert((await page.locator('.result__found .recipe').count()) >= 1, 'result lists the discovered combo');
  assert((await page.locator('[data-testid="rec"]').count()) === 1, 'result recommends a real product for the main dirt');
  await page.screenshot({ path: resolve(shots, '04-result.png') });
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

  // 25단계(가스레인지 기름때): 틀린 도구는 아무 효과 없음 → 세정제+수세미로만 지워짐 → 발견
  await page.click('[data-testid="area-kitchen"]');
  await page.click('[data-testid="stage-25"]');
  await page.waitForSelector('[data-testid="intro"]');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="item-degreaser"]');
  const kit25 = await page.evaluate(() => window.__sparkle.kit());
  assert(kit25.includes('degreaser') && kit25.includes('scrubpad') && !kit25.includes('descaler') && !kit25.includes('moldremover'), `stove kit has what grease/dust need and nothing else (${kit25.join(',')})`);
  assert((await page.locator('[data-testid="limit"]').count()) === 1, 'tier 3 stage shows a time limit');
  assert((await page.locator('[data-testid="limit"]').innerText()).includes('⏸'), 'clock is paused until cleaning actually starts');
  const grease0 = await page.evaluate(() => window.__sparkle.session().remainingOf('grease'));
  await page.click('[data-testid="item-sponge"]');
  await sweep(page, 1, 10, 4);
  const grease1 = await page.evaluate(() => window.__sparkle.session().remainingOf('grease'));
  assert(grease1 === grease0, `sponge alone leaves grease untouched (${grease0.toFixed(1)} → ${grease1.toFixed(1)})`);
  assert((await page.evaluate(() => window.__sparkle.noEffects())) >= 1, 'a "no effect" toast explained the wrong combo');
  assert((await page.evaluate(() => window.__sparkle.tries('grease'))) >= 1, 'failed attempt counted toward a hint');
  await page.screenshot({ path: resolve(shots, '05-stove-wrong-tool.png') });
  for (let round = 0; round < 3; round++) {
    await page.click('[data-testid="item-degreaser"]');
    await sweep(page, 1, 12, 3);
    await page.click('[data-testid="item-scrubpad"]');
    await sweep(page, 1, 20, 5);
  }
  const grease2 = await page.evaluate(() => window.__sparkle.session().remainingOf('grease'));
  assert(grease2 < grease1 * 0.7, `degreaser + scouring pad removes grease (${grease1.toFixed(1)} → ${grease2.toFixed(1)})`);
  assert((await page.evaluate(() => window.__sparkle.journal())).includes('grease|scrubpad|degreaser'), 'grease recipe discovered and saved');
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

  // 37단계(욕실 타일 비누때): 두 번 실패 → 수첩에서 코인 힌트 → 세정제 공개
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-bathroom"]');
  await page.click('[data-testid="stage-37"]');
  await page.waitForSelector('[data-testid="intro"]');
  await page.click('[data-testid="start"]');
  await page.waitForSelector('[data-testid="item-bathroom"]');
  await page.click('[data-testid="item-tilebrush"]');
  await sweep(page, 1, 8, 4);
  await page.click('[data-testid="item-sponge"]');
  await sweep(page, 1, 8, 4);
  assert((await page.evaluate(() => window.__sparkle.tries('soap'))) >= 2, 'two failed tools tried on soap scum');
  await page.click('[data-testid="journal"]');
  await page.waitForSelector('[data-testid="hint-coins-soap"]');
  await page.click('[data-testid="hint-coins-soap"]');
  await page.waitForTimeout(200);
  const hintText = await page.locator('[data-testid="journal-soap"]').innerText();
  assert(hintText.includes('Bathroom cleaner'), 'coin hint reveals the needed cleaner');
  await page.screenshot({ path: resolve(shots, '09-hint.png') });
  await page.click('[data-testid="journal-modal"] [data-act="close"]');

  // 15단계(책상·원목): 수세미 → 원목 손상 경고
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  // 27단계(원목 식탁, 정밀 모드): 기름때 제거제를 쓰면 손상 → 10% 에서 실패
  await page.click('[data-testid="area-kitchen"]');
  await page.click('[data-testid="stage-27"]');
  await page.waitForSelector('[data-testid="intro"]');
  assert((await page.locator('[data-testid="intro"] .intro__mode').innerText()).includes('Fragile'), 'stage 27 is a fragile-surface stage');
  await page.click('[data-testid="start"]');
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
  assert((await page.locator('[data-testid^="mallcat-"]').count()) === 33, 'mall lists all 33 product categories');
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
    if (id === 5) assert((await page.locator('[data-testid="item-cordlessvac"].is-premium').count()) === 1, 'bought premium vacuum shows up on the rug stage where it is needed');
    const cb = await page.locator('[data-testid="canvas"]').boundingBox();
    await page.mouse.move(cb.x + cb.width * 0.55, cb.y + cb.height * 0.45); // 정전 모드 손전등
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(shots, file) });
    await page.click('[data-testid="back"]');
    await page.click('[data-testid="back-home"]');
  }

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
