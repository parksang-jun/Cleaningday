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
  assert((await page.locator('.stage').count()) === 12, '12 stages listed');
  assert((await page.locator('.stage.is-locked').count()) === 11, 'only stage 1 unlocked');
  await page.screenshot({ path: resolve(shots, '01-home.png') });

  // 1단계: 실제 드래그로 먼지 닦기
  await page.click('[data-testid="play"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(shots, '02-stage1-dirty.png') });
  await sweep(page, 1);
  const mid = await page.evaluate(() => window.__sparkle.session().cleanliness);
  assert(mid > 0.2, `one sweep cleans ${(mid * 100).toFixed(0)}%`);
  await page.screenshot({ path: resolve(shots, '03-stage1-cleaning.png') });
  assert(await cleanUntilDone(page), 'stage 1 completes by dragging');
  await page.waitForTimeout(900);
  const stars = await page.locator('.result__stars .on').count();
  assert(stars >= 1, `result shows ${stars} stars`);
  await page.screenshot({ path: resolve(shots, '04-result.png') });
  const before = Number((await page.locator('[data-el="coins"]').innerText()).match(/\d+/)[0]);
  await page.click('[data-testid="double"]');
  await page.waitForTimeout(1600);
  const after = Number((await page.locator('[data-el="coins"]').innerText()).match(/\d+/)[0]);
  assert(after === before * 2, `rewarded ad doubles coins (${before} → ${after})`);

  // 2단계 열림 → 메뉴
  await page.click('[data-testid="to-menu"]');
  await page.waitForSelector('[data-testid="play"]');
  assert((await page.locator('.stage.is-locked').count()) === 10, 'stage 2 unlocked');

  // 4단계(기름때): 진행 저장 조작으로 열고, 세제 분사 효과 검증
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sparkle-clean-v1'));
    raw.progress.unlocked = 12;
    localStorage.setItem('sparkle-clean-v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-testid="stage-4"]');
  await page.waitForSelector('[data-testid="item-degreaser"]');
  await page.click('[data-testid="item-sponge"]');
  await sweep(page, 1, 10, 4);
  const noDet = await page.evaluate(() => window.__sparkle.session().cleanliness);
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="stage-4"]');
  await page.waitForSelector('[data-testid="item-degreaser"]');
  await page.click('[data-testid="item-degreaser"]');
  await sweep(page, 1, 10, 4);
  await page.click('[data-testid="item-sponge"]');
  await sweep(page, 1, 10, 4);
  await page.screenshot({ path: resolve(shots, '05-stove-spray.png') });
  const withDet = await page.evaluate(() => window.__sparkle.session().cleanliness);
  assert(withDet > noDet * 1.3, `degreaser helps on grease (${(noDet * 100).toFixed(0)}% → ${(withDet * 100).toFixed(0)}%)`);

  // 8단계(원목): 기름때 제거제(알칼리) → 원목 손상 경고
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="stage-8"]');
  await page.waitForSelector('[data-testid="item-degreaser"]');
  assert(await page.locator('[data-testid="item-degreaser"] .tool__warn').count(), 'toolbar flags degreaser as risky on wood');
  await page.click('[data-testid="item-degreaser"]');
  await sweep(page, 1, 6, 6);
  assert((await page.locator('.toast--warn').count()) >= 1, 'degreaser on wood shows a damage warning');
  await page.screenshot({ path: resolve(shots, '06-wood-warning.png') });

  // 7단계(욕조): 곰팡이 제거제 + 물때 제거제 → 위험 혼합 모달
  await page.click('[data-testid="back"]');
  await page.click('[data-testid="stage-7"]');
  await page.waitForSelector('[data-testid="item-moldremover"]');
  await page.click('[data-testid="item-moldremover"]');
  await sweep(page, 1, 4, 4);
  await page.click('[data-testid="item-descaler"]');
  await sweep(page, 1, 4, 4);
  await page.waitForTimeout(200);
  assert(await page.locator('.modal h2', { hasText: 'Dangerous mix' }).count(), 'hazard modal warns about mixing chlorine and acid');
  await page.screenshot({ path: resolve(shots, '07-hazard.png') });
  await page.click('.modal [data-act="ok"]');

  // 상점: 스폰서(샘플) 아이템 + 근거
  await page.click('[data-testid="toolbar-shop"]');
  await page.waitForSelector('[data-testid="shop"]');
  assert(await page.locator('[data-testid="shop-sp:brightmax-degreaser"] .tag-ad').count(), 'sponsored item carries an Ad label');
  await page.screenshot({ path: resolve(shots, '08-shop.png'), fullPage: true });
  await page.click('[data-testid="shop-sp:brightmax-degreaser"] [data-evidence]');
  await page.waitForSelector('[data-testid="evidence"]');
  const ev = await page.locator('[data-testid="evidence"]').innerText();
  assert(ev.includes('92%') && ev.includes('115% vs standard'), 'evidence shows lab removal and % vs standard');
  await page.screenshot({ path: resolve(shots, '09-evidence.png') });

  // 한국어 화면
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sparkle-clean-v1'));
    raw.settings.lang = 'ko';
    localStorage.setItem('sparkle-clean-v1', JSON.stringify(raw));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(shots, '10-home-ko.png'), fullPage: true });
  await page.click('[data-testid="stage-10"]');
  await page.waitForSelector('[data-testid="canvas"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(shots, '11-patio-ko.png') });

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
