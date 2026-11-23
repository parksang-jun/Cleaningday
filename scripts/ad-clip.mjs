// 홍보용 세로 영상 — 실제 게임 플레이를 그대로 녹화한다 (1080x1920 mp4, 소리 없음. 540x960 녹화를 2배로 키운 것)
//   node scripts/ad-clip.mjs --area living --stage 1 --steps vacuum --hook "먼지, 한 번에 쓱" --out ops/agent/ads/cr-20261126-01/clip.mp4
//   --area   지역 id (living, room, kitchen, bathroom, garden, exterior, interior)
//   --stage  판 번호
//   --steps  누를 도구·세제를 순서대로(쉼표). 세제는 뿌리고, 도구는 문지른다. 생략하면 도구 막대의 것을 차례로 써 본다
//   --hook   영상 위쪽에 얹을 한 줄(생략 가능)   --lang ko|en|ja   --max 최대 길이(초, 기본 22)
// 먼저 `npm run build` 가 돼 있어야 한다. 광고에는 실제 플레이만 쓴다 — 화면을 꾸며 내지 않는다.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const AREA = arg('area', 'living');
const STAGE = Number(arg('stage', '1'));
const STEPS = (arg('steps', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const HOOK = arg('hook', '');
const LANG = arg('lang', 'ko');
const MAX_MS = Number(arg('max', '22')) * 1000;
const OUT = resolve(root, arg('out', `screenshots/ad-clip-${AREA}-${STAGE}.mp4`));
const PORT = 4177;
const VIEW = { width: 540, height: 960 };
const HIDE = '#ad-banner,.beta-tag,.toast,[data-testid="rec"],[data-testid="feedback"]{display:none!important}body.has-banner{--banner-h:0px!important}';

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('미리보기 서버가 뜨지 않았습니다 — npm run build 를 먼저 하세요')), 20000);
  preview.stdout.on('data', (d) => String(d).includes(String(PORT)) && (clearTimeout(t), res()));
});
const stop = () => { try { process.kill(-preview.pid); } catch { /* 이미 끝남 */ } };

const tmp = mkdtempSync(resolve(tmpdir(), 'ad-clip-'));
const browser = await chromium.launch();
let ok = false;
try {
  // 준비(판 열기)는 녹화하지 않는 창에서 하고, 저장된 진행 상태만 넘겨 받는다
  const prep = await browser.newContext({ viewport: VIEW });
  const p0 = await prep.newPage();
  await p0.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await p0.evaluate(() => { window.__sparkle.skipTour(); window.__sparkle.setUnlocked(96, 3); window.__sparkle.setGamesPlayed(0); });
  await p0.waitForTimeout(300);
  const state = await prep.storageState();
  await prep.close();

  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2,
    isMobile: true,
    locale: LANG === 'ko' ? 'ko-KR' : LANG === 'ja' ? 'ja-JP' : 'en-US',
    storageState: state,
    recordVideo: { dir: tmp, size: VIEW }, // 녹화는 화면 크기 그대로(540x960), 변환할 때 2배로 키운다
  });
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.click(`[data-testid="area-${AREA}"]`);
  await p.click(`[data-testid="stage-${STAGE}"]`);
  await p.waitForSelector('[data-testid="start"]');
  await p.click('[data-testid="start"]');
  await p.waitForSelector('[data-testid="canvas"]');
  await p.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  if (HOOK) {
    await p.evaluate((text) => {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.cssText = 'position:fixed;left:0;right:0;top:118px;z-index:9999;text-align:center;font:800 30px/1.25 system-ui,sans-serif;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.75),0 0 2px rgba(0,0,0,.9);padding:0 24px;pointer-events:none';
      document.body.appendChild(el);
    }, HOOK);
  }
  await p.waitForTimeout(900); // 더러운 화면을 잠깐 보여 준다
  const playFrom = Date.now() - t0;

  const done = async () => (await p.locator('[data-testid="result"]').count()) > 0;
  const left = () => p.evaluate(() => { const s = window.__sparkle.session(); return s ? s.remaining : 0; });
  const sweep = async () => {
    const box = await p.locator('[data-testid="canvas"]').boundingBox();
    const rows = 9;
    await p.mouse.move(box.x + 8, box.y + 8);
    await p.mouse.down();
    for (let r = 0; r <= rows; r++) {
      const y = box.y + (box.height * (r + 0.5)) / (rows + 1);
      const xs = r % 2 ? [box.x + box.width - 6, box.x + 6] : [box.x + 6, box.x + box.width - 6];
      for (let k = 0; k <= 14; k++) { await p.mouse.move(xs[0] + ((xs[1] - xs[0]) * k) / 14, y); await p.waitForTimeout(22); }
      if (await done()) break;
    }
    await p.mouse.up();
  };
  const deadline = Date.now() + MAX_MS;
  const toolbar = await p.$$eval('.toolbar [data-item]', (els) => els.map((e) => e.getAttribute('data-item')));
  const order = STEPS.length ? STEPS : toolbar;
  for (const id of order) if (!toolbar.includes(id)) throw new Error(`이 판의 도구 막대에 없는 항목: ${id} (있는 것: ${toolbar.join(', ')})`);
  let stuck = 0;
  while (!(await done()) && Date.now() < deadline && stuck < 2) {
    const before = await left();
    for (const id of order) {
      if ((await done()) || Date.now() > deadline) break;
      await p.click(`[data-item="${id}"]`);
      await sweep();
    }
    stuck = (await left()) < before - 1e-6 ? 0 : stuck + 1;
  }
  const finished = await done();
  await p.waitForTimeout(finished ? 2200 : 600); // 결과 화면(반짝임)을 잠깐 보여 준다
  const total = Date.now() - t0;
  const remain = finished ? 0 : await left();
  await ctx.close();

  const webm = readdirSync(tmp).find((f) => f.endsWith('.webm'));
  mkdirSync(dirname(OUT), { recursive: true });
  // 판에 들어가기까지(메뉴)는 잘라 내고, 더러운 화면 → 닦는 장면 → 결과만 남긴다
  const ss = Math.max(0, (playFrom - 900) / 1000).toFixed(2);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss, '-i', resolve(tmp, webm), '-t', ((total - playFrom + 900) / 1000).toFixed(2), '-vf', 'scale=1080:1920:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-movflags', '+faststart', '-an', OUT], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg 변환 실패');
  console.log(JSON.stringify({ out: OUT, seconds: Number(((total - playFrom + 900) / 1000).toFixed(1)), finished, remaining: Number(remain.toFixed(2)), steps: order }));
  if (!finished) console.log('주의 - 판을 끝까지 닦지 못했습니다. --steps 순서를 바꾸거나 --max 를 늘리세요.');
  ok = true;
} finally {
  await browser.close();
  stop();
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
