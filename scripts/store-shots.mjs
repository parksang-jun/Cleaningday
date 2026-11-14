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
const out = resolve(root, 'store-assets', LANG);
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
await p.evaluate(() => { window.__sparkle.skipTour(); window.__sparkle.setUnlocked(96); });
await p.waitForTimeout(400);

const raw = resolve(root, 'screenshots', 'store-raw', LANG);
mkdirSync(raw, { recursive: true });
const noModal = () => p.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
const shot = async (name, keepModal = false) => {
  await p.waitForTimeout(250);
  if (!keepModal) await noModal();
  await p.screenshot({ path: resolve(raw, name) });
  console.log('찍음 -', name);
};
const home = async () => {
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.waitForTimeout(400);
};
/** 홈에서 시작해 해당 지역의 판에 들어간다 */
const enter = async (area, stage) => {
  await home();
  await p.click(`[data-testid="area-${area}"]`);
  await p.waitForSelector(`[data-testid="stage-${stage}"]`);
  await p.click(`[data-testid="stage-${stage}"]`);
  await p.waitForSelector('[data-testid="intro"]');
  await p.click('[data-testid="start"]');
  await p.waitForSelector('[data-testid="canvas"]');
  await p.waitForTimeout(700);
  await noModal();
  return p.locator('[data-testid="canvas"]').boundingBox();
};
/** 왼쪽 frac 만큼을 깨끗하게 — 게임이 판을 다 닦을 때 쓰는 것과 같은 처리를 왼쪽 칸에만 한다 */
const cleanLeft = (frac) => p.evaluate((f) => {
  const s = window.__sparkle.session();
  for (let i = 0; i < s.amount.length; i++) {
    if (i % s.w >= s.w * f) continue;
    if (s.amount[i] > 0) s.take(i, s.amount[i]);
    s.amount[i] = 0;
    if (s.under[i] > 0) { s.remaining -= s.under[i]; s.perType[s.underType[i]] -= s.under[i]; s.under[i] = 0; }
    s.shine[i] = 1;
  }
  s.version++;
}, frac);
/** 깨끗한 쪽 경계에서 문지르는 손 — hold 면 떼지 않는다 */
const rub = async (box, frac, hold = false) => {
  const x = box.x + box.width * frac, y0 = box.y + box.height * 0.3;
  await p.mouse.move(x - 40, y0);
  await p.mouse.down();
  for (let k = 0; k <= 24; k++) { await p.mouse.move(x - 40 + (k % 2) * 50, y0 + (box.height * 0.3 * k) / 24); await p.waitForTimeout(10); }
  if (!hold) await p.mouse.up();
};

const PLAN = Object.fromEntries((process.env.SHOT_PLAN || 'car:exterior:84,kitchen:kitchen:36,fever:interior:85,result:garden:60').split(',').map((x) => { const [k, a, n] = x.split(':'); return [k, [a, Number(n)]]; }));
let box;

// 시작 화면
await home(); await p.evaluate(() => window.__sparkle.setCoins(1280)); await home(); await shot('home.png');
// 자동차 — 절반 전/후
box = await enter(...PLAN.car); await cleanLeft(0.5); await rub(box, 0.5); await p.waitForTimeout(400); await shot('car.png');
// 주방 — 기름때 절반
box = await enter(...PLAN.kitchen); await cleanLeft(0.5); await rub(box, 0.5); await p.waitForTimeout(400); await shot('kitchen.png');
// 자동차 실내 — 반짝 타임(손을 떼지 않은 채)
box = await enter(...PLAN.fever); await cleanLeft(0.62);
// 더러운 쪽을 실제로 문질러 반짝 타임을 켠다 — 이 판에 듣는 도구를 찾을 때까지
const ids = await p.$$eval('.toolbar [data-item]', (els) => els.map((e) => e.getAttribute('data-item')));
let lit = false;
for (const id of ids) {
  await noModal(); await p.click(`[data-item="${id}"]`);
  await p.evaluate(() => window.__sparkle.setFever(6.9));
  await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.2);
  await p.mouse.down();
  for (let k = 0; k <= 40; k++) { await p.mouse.move(box.x + box.width * (0.62 + 0.3 * (k % 2)), box.y + box.height * (0.2 + (0.6 * k) / 40)); await p.waitForTimeout(12); }
  if (((await p.evaluate(() => window.__sparkle.fever()))?.left ?? 0) > 0) { lit = true; console.log('반짝 타임 -', id); break; }
  await p.mouse.up();
}
if (!lit) console.log('!! 반짝 타임이 켜지지 않음');
await shot('fever.png'); await p.mouse.up();
// 결과 — 별 3개
box = await enter(...PLAN.result);
await p.evaluate(() => window.__sparkle.clearAll());
await p.waitForSelector('[data-testid="result"]', { timeout: 30000 });
await p.waitForTimeout(1800); await shot('result.png', true);

// ---------- 스토어용 합성: 큰 문구 + 실제 게임 화면 ----------
const { readFileSync } = await import('node:fs');
const COPY = {
  ko: [
    ['car', '문지르면\n반짝!', '더러운 차가 새 차로', ['#16c2b1', '#0b8f9c']],
    ['kitchen', '찌든 기름때도\n싹싹', '얼룩마다 딱 맞는 도구', ['#ff9f43', '#f0613a']],
    ['fever', '반짝 타임!\n콤보 폭발', '멈출 수 없는 청소 쾌감', ['#ffd24a', '#ff8a3d']],
    ['home', '96개 스테이지', '집 · 정원 · 자동차까지', ['#5b8def', '#3b5bdb']],
    ['result', '별 3개\n클리어!', '오늘의 스트레스도 싹', ['#b06ef3', '#6f42e0']],
  ],
  en: [
    ['car', 'Swipe.\nSparkle!', 'From filthy to brand new', ['#16c2b1', '#0b8f9c']],
    ['kitchen', 'Grease?\nGone.', 'The right tool for every mess', ['#ff9f43', '#f0613a']],
    ['fever', 'Sparkle Time!\nCombo rush', 'Cleaning you can’t stop', ['#ffd24a', '#ff8a3d']],
    ['home', '96 Stages', 'Home · Garden · Car', ['#5b8def', '#3b5bdb']],
    ['result', '3 Stars\nCleared!', 'Wipe the stress away', ['#b06ef3', '#6f42e0']],
  ],
}[LANG === 'ko' ? 'ko' : 'en'];
const c = await browser.newContext({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
const cp = await c.newPage();
let n = 0;
for (const [key, head, sub, [c1, c2]] of COPY) {
  n++;
  const img = readFileSync(resolve(raw, `${key}.png`)).toString('base64');
  const big = head.includes('\n') ? 190 : 200;
  await cp.setContent(`<style>
    *{margin:0;box-sizing:border-box}
    body{width:1320px;height:2868px;overflow:hidden;background:linear-gradient(165deg,${c1},${c2});font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif;color:#fff;text-align:center;position:relative}
    body:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 85% 8%,rgba(255,255,255,.35),transparent 38%),radial-gradient(circle at 5% 30%,rgba(255,255,255,.18),transparent 30%)}
    h1{position:relative;padding-top:130px;font-size:${big}px;line-height:1.08;font-weight:900;letter-spacing:-6px;white-space:pre-line;text-shadow:0 8px 0 rgba(0,0,0,.14),0 18px 40px rgba(0,0,0,.2)}
    p{position:relative;margin-top:34px;font-size:74px;font-weight:700;opacity:.96;letter-spacing:-2px}
    .ph{position:absolute;left:50%;transform:translateX(-50%);top:${head.includes('\n') ? 760 : 560}px;width:1080px;border-radius:110px;border:22px solid #14202b;background:#14202b;overflow:hidden;box-shadow:0 50px 120px rgba(0,0,0,.4)}
    .ph img{display:block;width:100%}
    .sp{position:absolute;font-size:120px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.2))}
  </style><h1>${head}</h1><p>${sub}</p><div class="ph"><img src="data:image/png;base64,${img}"></div>
  <span class="sp" style="left:36px;top:24px;font-size:84px">✨</span><span class="sp" style="right:40px;top:${head.includes("\n") ? 620 : 420}px;font-size:84px">✨</span>`);
  await cp.waitForTimeout(300);
  await cp.screenshot({ path: resolve(out, `${n}-${key}.png`) });
  console.log('합성 -', `${n}-${key}.png`);
}

await browser.close();
try { process.kill(-preview.pid); } catch { /* 이미 종료 */ }
console.log(`\n완료 → store-assets/${LANG}/`);
