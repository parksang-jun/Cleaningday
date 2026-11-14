// 스토어 등록용 스크린샷 — 큰 문구 + 실제 게임 화면(실사 사진)
//   node scripts/store-shots.mjs             기본 크기 전부 (6.9형 1320x2868, 중형 1179x2556)
//   SHOT_LANG=en node scripts/store-shots.mjs   영어
// 순서: 1 시작 페이지 · 2~4 게임 화면 · 5 리워드(결과) 화면
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const LANG = process.env.SHOT_LANG || 'ko';
const PORT = 4176;
// 애플 규격: 6.9형 1320x2868, 중형(Dynamic Island) 1179x2556
const SIZES = (process.env.SHOT_SIZES || '1320x2868,1179x2556').split(',').map((s) => s.split('x').map(Number));
// 게임 화면은 논리 440x956 에 3배로 찍어 어느 규격에든 선명하게 들어간다
const VIEW = { width: 440, height: 956 };
const DSF = 3;
const HIDE = '#ad-banner,.beta-tag,.toast,[data-testid="rec"],[data-testid="feedback"]{display:none!important}body.has-banner{--banner-h:0px!important}';
const raw = resolve(root, 'screenshots', 'store-raw', LANG);
mkdirSync(raw, { recursive: true });

function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true });
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('preview start timeout')), 20000);
    proc.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(proc); } });
    proc.stderr.on('data', (d) => process.stderr.write(d));
  });
}
const preview = await startPreview();
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEW,
  deviceScaleFactor: DSF,
  isMobile: true,
  hasTouch: false,
  locale: LANG === 'ko' ? 'ko-KR' : LANG === 'ja' ? 'ja-JP' : 'en-US',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const p = await ctx.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await p.evaluate(() => { window.__sparkle.skipTour(); window.__sparkle.setUnlocked(96); window.__sparkle.setCoins(1280); });
await p.waitForTimeout(400);

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
  await p.waitForTimeout(500);
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
  await p.waitForTimeout(800);
  await noModal();
  return p.locator('[data-testid="canvas"]').boundingBox();
};
/** 왼쪽 frac 만큼을 깨끗하게 — 게임이 판을 다 닦을 때 쓰는 것과 같은 처리를 왼쪽 칸에만 */
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
/** 깨끗한 쪽 경계를 문지르는 손 — 떼지 않은 채로 찍는다 */
const rub = async (box, frac) => {
  const x = box.x + box.width * frac;
  const y0 = box.y + box.height * 0.28;
  await p.mouse.move(x - 40, y0);
  await p.mouse.down();
  for (let k = 0; k <= 26; k++) { await p.mouse.move(x - 40 + (k % 2) * 52, y0 + (box.height * 0.32 * k) / 26); await p.waitForTimeout(10); }
};
/** 이 판에 듣는 도구로 반짝 타임을 켠다 */
const fever = async (box) => {
  const ids = await p.$$eval('.toolbar [data-item]', (els) => els.map((e) => e.getAttribute('data-item')));
  for (const id of ids) {
    await noModal();
    await p.click(`[data-item="${id}"]`);
    await p.evaluate(() => window.__sparkle.setFever(6.9));
    await p.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.2);
    await p.mouse.down();
    for (let k = 0; k <= 40; k++) { await p.mouse.move(box.x + box.width * (0.64 + 0.28 * (k % 2)), box.y + box.height * (0.2 + (0.6 * k) / 40)); await p.waitForTimeout(12); }
    if (((await p.evaluate(() => window.__sparkle.fever()))?.left ?? 0) > 0) return id;
    await p.mouse.up();
  }
  return null;
};

// ---------- 1~5 장면: 시작 · 카페트 · 주방 · 자동차 · 리워드 ----------
let box;
await home(); await shot('1-home.png');
box = await enter('living', 5); await cleanLeft(0.5); await rub(box, 0.5); await p.waitForTimeout(400); await shot('2-rug.png'); await p.mouse.up();
box = await enter('kitchen', 25); await cleanLeft(0.5); await rub(box, 0.5); await p.waitForTimeout(400); await shot('3-kitchen.png'); await p.mouse.up();
box = await enter('exterior', 73); await cleanLeft(0.5); await rub(box, 0.5); await p.waitForTimeout(400); await shot('4-car.png'); await p.mouse.up();
box = await enter('garden', 60);
await p.evaluate(() => window.__sparkle.clearAll());
await p.waitForSelector('[data-testid="result"]', { timeout: 30000 });
await p.waitForTimeout(1800); await shot('5-result.png', true);

// ---------- 스토어용 합성: 큰 문구 + 기기 틀 안의 게임 화면 ----------
const COPY = {
  ko: [
    ['1-home', '96개 스테이지', '집 · 정원 · 자동차까지', ['#1b2a4a', '#0d1628'], '#7cc4ff'],
    ['2-rug', '카페트도\n새것처럼', '진흙도 머리카락도 싹', ['#14342a', '#071913'], '#5fe0a0'],
    ['3-kitchen', '찌든 기름때도\n싹싹', '얼룩마다 딱 맞는 세제', ['#5a2708', '#2a1104'], '#ffa743'],
    ['4-car', '문지르면\n반짝!', '더러운 차가 새 차로', ['#0b2f52', '#04121f'], '#56b8ff'],
    ['5-result', '별 3개\n클리어!', '보상으로 장비를 모아요', ['#3a1060', '#17062b'], '#c08bff'],
  ],
  en: [
    ['1-home', '96 Stages', 'Home · Garden · Car', ['#1b2a4a', '#0d1628'], '#7cc4ff'],
    ['2-rug', 'Rugs Like\nNew Again', 'Mud and pet hair, gone', ['#14342a', '#071913'], '#5fe0a0'],
    ['3-kitchen', 'Grease?\nGone.', 'The right cleaner for every mess', ['#5a2708', '#2a1104'], '#ffa743'],
    ['4-car', 'Swipe.\nSparkle!', 'From filthy to brand new', ['#0b2f52', '#04121f'], '#56b8ff'],
    ['5-result', '3 Stars\nCleared!', 'Earn gear with your rewards', ['#3a1060', '#17062b'], '#c08bff'],
  ],
}[LANG === 'ko' ? 'ko' : 'en'];

for (const [W, H] of SIZES) {
  const out = resolve(root, 'store-assets', `${LANG}-${W}x${H}`);
  mkdirSync(out, { recursive: true });
  const c = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const cp = await c.newPage();
  const u = W / 1320; // 1320 기준으로 잡은 치수를 규격에 맞게 줄인다
  let n = 0;
  for (const [key, head, sub, [c1, c2], accent] of COPY) {
    n++;
    const img = readFileSync(resolve(raw, `${key}.png`)).toString('base64');
    const two = head.includes('\n');
    await cp.setContent(`<style>
      *{margin:0;box-sizing:border-box}
      body{width:${W}px;height:${H}px;overflow:hidden;background:${c2};font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif;color:#fff;text-align:center;position:relative}
      .bg{position:absolute;inset:0;background:
        radial-gradient(120% 70% at 50% -10%, ${c1} 0%, ${c2} 62%),
        radial-gradient(60% 30% at 84% 6%, ${accent}55, transparent 70%),
        radial-gradient(50% 26% at 10% 26%, ${accent}2e, transparent 70%)}
      .grain{position:absolute;inset:0;opacity:.5;background-image:radial-gradient(rgba(255,255,255,.14) 1px, transparent 1px);background-size:${Math.round(5 * u)}px ${Math.round(5 * u)}px}
      h1{position:relative;padding-top:${Math.round((two ? 112 : 150) * u)}px;font-size:${Math.round((two ? 184 : 196) * u)}px;line-height:1.04;font-weight:900;letter-spacing:${Math.round(-6 * u)}px;white-space:pre-line;text-shadow:0 ${Math.round(10 * u)}px ${Math.round(40 * u)}px rgba(0,0,0,.55)}
      p{position:relative;margin-top:${Math.round(30 * u)}px;font-size:${Math.round(66 * u)}px;font-weight:700;color:${accent};letter-spacing:${Math.round(-2 * u)}px}
      .ph{position:absolute;left:50%;transform:translateX(-50%);top:${Math.round((two ? 700 : 560) * u)}px;width:${Math.round(1040 * u)}px;
        border-radius:${Math.round(96 * u)}px;padding:${Math.round(16 * u)}px;background:linear-gradient(160deg,#5c6672,#1a1f26 40%,#0b0e12);
        box-shadow:0 ${Math.round(50 * u)}px ${Math.round(110 * u)}px rgba(0,0,0,.6), 0 0 ${Math.round(90 * u)}px ${accent}33}
      .scr{border-radius:${Math.round(82 * u)}px;overflow:hidden;background:#000;display:block}
      .scr img{display:block;width:100%}
      .sp{position:absolute;filter:drop-shadow(0 ${Math.round(6 * u)}px ${Math.round(10 * u)}px rgba(0,0,0,.35))}
    </style>
    <div class="bg"></div><div class="grain"></div>
    <h1>${head}</h1><p>${sub}</p>
    <div class="ph"><div class="scr"><img src="data:image/png;base64,${img}"></div></div>
    <span class="sp" style="left:${Math.round(46 * u)}px;top:${Math.round(40 * u)}px;font-size:${Math.round(92 * u)}px">✨</span>
    <span class="sp" style="right:${Math.round(56 * u)}px;top:${Math.round((two ? 560 : 420) * u)}px;font-size:${Math.round(70 * u)}px">✨</span>`);
    await cp.waitForTimeout(350);
    await cp.screenshot({ path: resolve(out, `${n}-${key.slice(2)}.png`) });
    console.log('합성 -', `${LANG}-${W}x${H}/${n}-${key.slice(2)}.png`);
  }
  await c.close();
}

await browser.close();
try { process.kill(-preview.pid); } catch { /* 이미 종료 */ }
console.log(`\n완료 → store-assets/${LANG}-*/`);
