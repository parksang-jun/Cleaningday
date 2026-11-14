// 스토어 등록용 스크린샷 — 애플 6.9형(1320x2868) 규격으로 주요 장면을 찍는다.
//   node scripts/store-shots.mjs            한국어
//   SHOT_LANG=en node scripts/store-shots.mjs   영어
// 광고 자리와 베타 표시는 숨긴다(심사에서 빈 광고 상자가 보이면 지적받는다).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const HIDE = '#ad-banner,.beta-tag,.toast,[data-testid="rec"],[data-testid="feedback"]{display:none!important}body.has-banner{--banner-h:0px!important}';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const LANG = process.env.SHOT_LANG || 'ko';
const out = resolve(root, 'screenshots', 'store', LANG);
mkdirSync(out, { recursive: true });
const PORT = 4176;

function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true });
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('preview start timeout')), 20000);
    proc.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(timer); res(proc); } });
    proc.stderr.on('data', (d) => process.stderr.write(d));
  });
}

const preview = await startPreview();
const browser = await chromium.launch();
// iPhone 16 Pro Max: 논리 440x956 에 3배 → 1320x2868 (애플 6.9형 규격)
const ctx = await browser.newContext({
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: false,
  locale: LANG === 'ko' ? 'ko-KR' : LANG === 'ja' ? 'ja-JP' : 'en-US',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const p = await ctx.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
// 광고 자리·베타 배지는 스토어 사진에 넣지 않는다
await p.addStyleTag({ content: HIDE });
await p.evaluate(() => { window.__sparkle.skipTour(); window.__sparkle.setUnlocked(12); });
await p.waitForTimeout(400);

const shot = async (name) => { await p.waitForTimeout(250); await p.screenshot({ path: resolve(out, name) }); console.log('찍음 -', name); };

// 1. 홈 — 오늘의 보상·미션
await shot('1-home.png');

// 2. 지역의 단계 지도 — 고비 판과 보스 판 표시
await p.click('[data-testid="area-living"]');
await p.waitForSelector('[data-testid="stage-12"]');
await shot('2-stages.png');

// 3~5. 실제로 한 판을 닦으며 찍는다 (STAGE 로 판을 바꿀 수 있다)
const STAGE = Number(process.env.SHOT_STAGE || 1);
await p.click(`[data-testid="stage-${STAGE}"]`);
await p.waitForSelector('[data-testid="intro"]');
await p.click('[data-testid="start"]');
await p.waitForSelector('[data-testid="canvas"]');
await p.waitForTimeout(500);
const box = await p.locator('[data-testid="canvas"]').boundingBox();
/** 왼쪽에서 frac 만큼만 지그재그로 문지른다 */
const sweep = async (rows, frac, hold = false) => {
  await p.mouse.move(box.x + 6, box.y + 6);
  await p.mouse.down();
  for (let r = 0; r <= rows; r++) {
    const y = box.y + (box.height * (r + 0.5)) / (rows + 1);
    const x0 = r % 2 ? box.x + box.width * frac : box.x + 6;
    const x1 = r % 2 ? box.x + 6 : box.x + box.width * frac;
    await p.mouse.move(x0, y);
    for (let k = 1; k <= 10; k++) { await p.mouse.move(x0 + ((x1 - x0) * k) / 10, y); await p.waitForTimeout(8); }
  }
  if (!hold) await p.mouse.up();
};
const progress = () => p.evaluate(() => Number((document.body.innerText.match(/(\d+)%/) || [0, 0])[1]));
// 이 판에 맞는 도구를 고른다 — 아무 도구나 쓰면 0% 에서 멈춰 '닦이는 맛'이 사진에 담기지 않는다
const ids = await p.$$eval('.toolbar [data-item]', (els) => els.map((e) => e.getAttribute('data-item')));
let picked = null;
for (const id of ids) {
  await p.click(`[data-item="${id}"]`);
  const before = await progress();
  await sweep(2, 0.25);
  if ((await progress()) > before) { picked = id; break; }
}
if (!picked) throw new Error('이 판을 닦을 수 있는 도구를 찾지 못했습니다: ' + ids.join(', '));
console.log('도구 -', picked);

// 3. 청소 중 — 왼쪽 절반은 깨끗, 오른쪽은 아직 더러운 화면
await sweep(12, 0.5);
console.log('진행률 -', await progress(), '%');
await shot('3-cleaning.png');

// 4. 반짝 타임 — 문지르는 손을 떼지 않은 채로 찍는다
await p.evaluate(() => window.__sparkle.setFever(6.9));
await sweep(4, 0.62, true);
await shot('4-fever.png');
await p.mouse.up();

// 5. 결과 — 끝까지 닦아서 나온 진짜 결과 화면
for (let i = 0; i < 12 && !(await p.locator('[data-testid="result"]').count()); i++) await sweep(14, 0.98);
await p.waitForSelector('[data-testid="result"]', { timeout: 20000 });
await p.waitForTimeout(900);
await shot('5-result.png');

// 6. 상점 — 도구와 부스터
await p.click('[data-testid="to-menu"]');
await p.waitForSelector('[data-testid="stage-1"]', { timeout: 20000 });
if (await p.locator('[data-testid="shop"]').count()) {
  await p.click('[data-testid="shop"]');
  await p.waitForTimeout(600);
  await shot('6-shop.png');
}

await browser.close();
try { process.kill(-preview.pid); } catch { /* 이미 종료 */ }
console.log(`\n완료 → screenshots/store/${LANG}/`);
