// Playwright 스모크 테스트: preview 서버 → 실제 포인터 드래그로 청소 → 결과·코인 → 세제 분사 → 손상·위험 혼합 → 상점·스폰서 근거
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

  // 1단계: 실제 드래그로 먼지 닦기 (T1: 제한시간 없음)
  await page.click('[data-testid="play"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.waitForTimeout(300);
  assert((await page.locator('[data-testid="limit"]').count()) === 0, 'tier 1 has no time limit');
  await page.screenshot({ path: resolve(shots, '02-stage1-dirty.png') });
  await sweep(page, 1);
  const mid = await page.evaluate(() => window.__sparkle.session().cleanliness);
  assert(mid > 0.2, `one sweep cleans ${(mid * 100).toFixed(0)}%`);
  await page.screenshot({ path: resolve(shots, '03-stage1-cleaning.png') });
  assert(await cleanUntilDone(page), 'stage 1 completes by dragging');
  await page.waitForTimeout(900);
  const stars = await page.locator('.result__stars .on').count();
  assert(stars >= 1, `result shows ${stars} stars`);
  assert((await page.locator('[data-testid="rec"]').count()) === 1, 'result recommends a real product for the main dirt');
  await page.screenshot({ path: resolve(shots, '04-result.png') });
  const before = Number((await page.locator('[data-el="coins"]').innerText()).match(/\d+/)[0]);
  await page.click('[data-testid="double"]');
  await page.waitForTimeout(1600);
  const after = Number((await page.locator('[data-el="coins"]').innerText()).match(/\d+/)[0]);
  assert(after === before * 2, `rewarded ad doubles coins (${before} → ${after})`);

  // 2단계 열림 → 구역 화면
  await page.click('[data-testid="to-menu"]');
  await page.waitForSelector('[data-testid="stage-1"]');
  assert((await page.locator('.stage').count()) === 6, 'living room lists 6 stages');
  assert((await page.locator('.stage.is-locked').count()) === 4, 'stage 2 unlocked');
  await page.click('[data-testid="back-home"]');
  await page.waitForSelector('[data-testid="play"]');

  // 전부 열기(진행 저장 조작) → 주방 13단계(가스레인지): 세제 분사 효과
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sparkle-clean-v1'));
    raw.progress.unlocked = 48;
    localStorage.setItem('sparkle-clean-v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  assert((await page.locator('.area.is-locked').count()) === 0, 'all areas unlocked');
  await page.click('[data-testid="area-kitchen"]');
  await page.click('[data-testid="stage-13"]');
  await page.waitForSelector('[data-testid="item-degreaser"]');
  await page.click('.modal [data-act="ok"]').catch(() => {});
  assert((await page.locator('[data-testid="limit"]').count()) === 1, 'tier 2 stage shows a time limit');
  await page.click('[data-testid="item-sponge"]');
  await sweep(page, 1, 10, 4);
  const noDet = await page.evaluate(() => window.__sparkle.session().cleanliness);
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="stage-13"]');
  await page.waitForSelector('[data-testid="item-degreaser"]');
  await page.click('[data-testid="item-degreaser"]');
  await sweep(page, 1, 10, 4);
  await page.click('[data-testid="item-sponge"]');
  await sweep(page, 1, 10, 4);
  await page.screenshot({ path: resolve(shots, '05-stove-spray.png') });
  const withDet = await page.evaluate(() => window.__sparkle.session().cleanliness);
  assert(withDet > noDet * 1.3, `degreaser helps on grease (${(noDet * 100).toFixed(0)}% → ${(withDet * 100).toFixed(0)}%)`);

  // 제한시간 초과 → 실패 모달 → 광고로 +30초
  const limit = await page.evaluate(() => window.__sparkle.timing().limitSec);
  assert(limit > 0, `stage 13 limit is ${limit}s`);
  await page.evaluate(() => window.__sparkle.forceExpire());
  await page.waitForSelector('[data-testid="fail"]');
  await page.screenshot({ path: resolve(shots, '06-timeout.png') });
  await page.click('[data-testid="extend"]');
  await page.waitForTimeout(1600);
  assert((await page.locator('[data-testid="fail"]').count()) === 0, 'rewarded ad extends the time limit');
  const extended = await page.evaluate(() => window.__sparkle.session().limitSec);
  assert(extended === limit + 30, `limit extended ${limit} → ${extended}`);

  // 7단계(책상·원목): 기름때 제거제(알칼리) → 원목 손상 경고
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-room"]');
  await page.click('[data-testid="stage-7"]');
  await page.waitForSelector('[data-testid="item-degreaser"]');
  assert(await page.locator('[data-testid="item-degreaser"] .tool__warn').count(), 'toolbar flags degreaser as risky on wood');
  await page.click('[data-testid="item-degreaser"]');
  await sweep(page, 1, 6, 6);
  assert((await page.locator('.toast--warn').count()) >= 1, 'degreaser on wood shows a damage warning');
  await page.screenshot({ path: resolve(shots, '07-wood-warning.png') });

  // 17단계(주방 전체, T3): 복합 구역 + 세제 용량 바
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-kitchen"]');
  await page.click('[data-testid="stage-17"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.click('.modal [data-act="ok"]').catch(() => {});
  assert((await page.locator('.tool__budget').count()) >= 2, 'tier 3 shows cleaner budget bars');
  const zones = await page.evaluate(() => window.__sparkle.session().surfaces.length);
  assert(zones >= 3, `mixed kitchen has ${zones} surfaces`);
  await page.screenshot({ path: resolve(shots, '08-kitchen-mix.png') });

  // 22단계(욕조): 곰팡이 제거제 + 물때 제거제 → 위험 혼합 모달
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-bathroom"]');
  await page.click('[data-testid="stage-22"]');
  await page.waitForSelector('[data-testid="item-moldremover"]');
  await page.click('[data-testid="item-moldremover"]');
  await sweep(page, 1, 4, 4);
  await page.click('[data-testid="item-descaler"]');
  await sweep(page, 1, 4, 4);
  await page.waitForTimeout(200);
  assert(await page.locator('.modal h2', { hasText: 'Dangerous mix' }).count(), 'hazard modal warns about mixing chlorine and acid');
  await page.screenshot({ path: resolve(shots, '09-hazard.png') });
  await page.click('.modal [data-act="ok"]');

  // 상점: 스폰서(샘플) 아이템 + 근거 + 구매 버튼
  await page.click('[data-testid="toolbar-shop"]');
  await page.waitForSelector('[data-testid="shop"]');
  assert(await page.locator('[data-testid="shop-sp:brightmax-degreaser"] .tag-ad').count(), 'sponsored item carries an Ad label');
  await page.screenshot({ path: resolve(shots, '10-shop.png'), fullPage: true });
  await page.click('[data-testid="shop-sp:brightmax-degreaser"] [data-evidence]');
  await page.waitForSelector('[data-testid="evidence"]');
  const ev = await page.locator('[data-testid="evidence"]').innerText();
  assert(ev.includes('92%') && ev.includes('115% vs standard'), 'evidence shows lab removal and % vs standard');
  assert((await page.locator('[data-testid="evidence-buy"]').count()) === 1, 'evidence offers a buy link');
  await page.screenshot({ path: resolve(shots, '11-evidence.png') });
  await page.click('[data-testid="evidence"] [data-act="close"]');

  // 실제 제품 몰 탭: 마켓 칩, 종류별 링크, 제휴 고지
  await page.click('[data-testid="tab-mall"]');
  await page.waitForSelector('[data-testid="mall"]');
  assert((await page.locator('[data-testid^="mallcat-"]').count()) === 10, 'mall lists all 10 product categories');
  assert((await page.locator('[data-testid="mall-sample-degreaser"]').count()) === 1, 'mall lists operator picks');
  assert((await page.locator('[data-testid="market-amazon_us"].is-on').count()) === 1, 'English UI defaults to Amazon');
  await page.click('[data-testid="market-coupang"]');
  await page.waitForTimeout(100);
  assert((await page.locator('[data-testid="mall"]').innerText()).includes('쿠팡 파트너스'), 'Coupang market shows the Partners disclosure');
  const href = await page.evaluate(() => document.querySelector('[data-testid="mallcat-degreaser"] [data-mall-url]').dataset.mallUrl);
  assert(href.startsWith('https://www.coupang.com/np/search?q='), `category link targets Coupang search (${href})`);
  await page.screenshot({ path: resolve(shots, '12-mall.png'), fullPage: true });
  await page.click('[data-testid="shop"] [data-act="close"]');

  // 자동차·정원 장면 렌더 확인 + 한국어 화면
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sparkle-clean-v1'));
    raw.settings.lang = 'ko';
    localStorage.setItem('sparkle-clean-v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(shots, '13-home-ko.png'), fullPage: true });
  await page.click('[data-testid="area-garden"]');
  await page.click('[data-testid="stage-33"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.click('.modal [data-act="ok"]').catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(shots, '14-garden-ko.png') });
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-exterior"]');
  await page.click('[data-testid="stage-42"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.click('.modal [data-act="ok"]').catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(shots, '15-car-ko.png') });
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="back-home"]');
  await page.click('[data-testid="area-interior"]');
  await page.click('[data-testid="stage-47"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(shots, '16-car-interior-ko.png') });

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
