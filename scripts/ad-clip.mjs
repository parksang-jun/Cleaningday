// 홍보용 세로 영상 — 실제 게임 플레이를 그대로 녹화한다 (1080x1920 mp4, 게임 소리 포함. 540x960 녹화를 2배로 키운 것)
//   node scripts/ad-clip.mjs --area living --stage 1 --steps vacuum --hook "먼지, 한 번에 쓱" --out ops/agent/ads/cr-20261126-01/clip.mp4
//   --area   지역 id (living, room, kitchen, bathroom, garden, exterior, interior)
//   --stage  판 번호
//   --steps  쓸 도구·세제를 제한(쉼표). 생략하면 게임이 힌트로 알려 주는 조합 그대로 전부 닦는다(권장)
//   --hook   영상 위쪽에 얹을 한 줄(생략 가능)   --lang ko|en|ja   --max 최대 길이(초, 기본 22)
// 먼저 `npm run build` 가 돼 있어야 한다. 광고에는 실제 플레이만 쓴다 — 화면을 꾸며 내지 않는다.
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
// 게임 소리 녹음: 게임 코드는 건드리지 않고, 스피커로 나가는 소리를 페이지 안에서 함께 받아 적는다
const AUDIO_TAP = () => {
  const taps = new WeakMap();
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) {
      const ac = dest.context;
      let tap = taps.get(ac);
      if (!tap) {
        tap = ac.createMediaStreamDestination();
        taps.set(ac, tap);
        const rec = new MediaRecorder(tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
        const chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.start(250);
        window.__adAudio = {
          startedAt: Date.now(),
          stop: () => new Promise((resolve) => {
            rec.onstop = async () => {
              const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
              let bin = '';
              for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
              resolve(btoa(bin));
            };
            rec.stop();
          }),
        };
      }
      orig.call(this, tap);
    }
    return orig.call(this, dest, ...rest);
  };
};
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
  await ctx.addInitScript(AUDIO_TAP);
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
      el.style.cssText = 'position:fixed;left:0;right:0;top:152px;z-index:9999;text-align:center;font:800 30px/1.25 system-ui,sans-serif;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.75),0 0 2px rgba(0,0,0,.9);padding:0 24px;pointer-events:none';
      document.body.appendChild(el);
    }, HOOK);
  }
  await p.waitForTimeout(900); // 더러운 화면을 잠깐 보여 준다
  const playFrom = Date.now() - t0;

  const done = async () => (await p.locator('[data-testid="result"]').count()) > 0;
  const left = () => p.evaluate(() => { const s = window.__sparkle.session(); return s ? s.remaining : 0; });
  const deadline = Date.now() + MAX_MS;
  const startLeft = await left();
  const toolbar = await p.$$eval('.toolbar [data-item]', (els) => els.map((e) => e.getAttribute('data-item')));
  for (const id of STEPS) if (!toolbar.includes(id)) throw new Error(`이 판의 도구 막대에 없는 항목: ${id} (있는 것: ${toolbar.join(', ')})`);
  const pick = async (id) => {
    await p.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
    if (await p.locator(`[data-item="${id}"]`).count()) await p.click(`[data-item="${id}"]`);
    else await p.evaluate((x) => window.__sparkle.select(x), id); // 도구 막대에 없으면(가진 것 중 힌트가 고른 것) 바로 고른다
  };
  /** 점들을 차례로 찾아가며 작은 원을 그린다. dwell: 한 점에서 도는 횟수, slow: 눌러 흡수하는 오염은 천천히 */
  const work = async (points, { dwell = 10, slow = false } = {}) => {
    const box = await p.locator('[data-testid="canvas"]').boundingBox();
    const cell = box.width / 9;
    const pts = points.map(([x, y]) => [box.x + x * box.width, box.y + y * box.height]);
    if (!pts.length) return;
    let [px, py] = pts[0];
    await p.mouse.move(px, py);
    await p.mouse.down();
    for (const [x, y] of pts) {
      for (let k = 1; k <= 2; k++) { await p.mouse.move(px + ((x - px) * k) / 2, py + ((y - py) * k) / 2); await p.waitForTimeout(14); }
      const r = cell * (slow ? 0.12 : 0.3);
      for (let k = 0; k < dwell; k++) { const a = (k / 10) * Math.PI * 2; await p.mouse.move(x + Math.cos(a) * r, y + Math.sin(a) * r); await p.waitForTimeout(slow ? 45 : 18); }
      [px, py] = [x, y];
      if (Date.now() > deadline || (await done())) break;
    }
    await p.mouse.up();
  };
  // 게임이 힌트로 알려 주는 조합 그대로 닦는다(세제를 뿌리고 → 도구로 문지른다). --steps 를 주면 그 도구·세제만 그 순서로 쓴다
  let stuck = 0;
  const used = [];
  while (!(await done()) && Date.now() < deadline && stuck < 3) {
    const before = await left();
    let plan = await p.evaluate(() => window.__sparkle.plan());
    if (STEPS.length) plan = plan.filter((g) => STEPS.includes(g.toolId) && (!g.cleanerId || STEPS.includes(g.cleanerId))).sort((a, b) => STEPS.indexOf(a.toolId) - STEPS.indexOf(b.toolId));
    if (!plan.length) break;
    for (const g of plan) {
      if ((await done()) || Date.now() > deadline) break;
      // 세제는 조금 뿌리고 바로 문지른다 — 한꺼번에 다 뿌려 두면 문지르기 전에 말라 버린다(게임 규칙)
      const CHUNK = g.cleanerId ? 4 : 12;
      for (let c = 0; c < g.points.length && !(await done()) && Date.now() < deadline; c += CHUNK) {
        const part = g.points.slice(c, c + CHUNK);
        if (g.cleanerId) { await pick(g.cleanerId); await work(part, { dwell: 4 }); }
        await pick(g.toolId);
        await work(part, { dwell: g.slow ? 14 : g.cleanerId ? 9 : 5, slow: g.slow });
      }
      if (g.cleanerId) used.push(g.cleanerId);
      used.push(g.toolId);
      if (process.env.AD_DEBUG) console.error('dbg', g.dirt, g.surface, g.cleanerId, g.toolId, 'pts', g.points.length, JSON.stringify(await p.evaluate((d) => { const s = window.__sparkle.session(); return { left: +s.remainingOf(d).toFixed(1), total: +s.remaining.toFixed(1), t: +s.time.toFixed(0), noeff: window.__sparkle.noEffects(), sel: window.__sparkle.selected() }; }, g.dirt)));
    }
    stuck = (await left()) < before - 0.5 ? 0 : stuck + 1;
  }
  const order = [...new Set(used)];
  const finished = await done();
  await p.waitForTimeout(finished ? 2200 : 600); // 결과 화면(반짝임)을 잠깐 보여 준다
  const total = Date.now() - t0;
  const remain = finished ? 0 : await left();
  // 소리: 녹음을 멈추고 꺼내 온다. 녹음이 시작된 시각으로 화면과 맞춘다
  const audio = await p.evaluate(async () => (window.__adAudio ? { at: window.__adAudio.startedAt, b64: await window.__adAudio.stop() } : null));
  await ctx.close();

  const webm = readdirSync(tmp).find((f) => f.endsWith('.webm'));
  mkdirSync(dirname(OUT), { recursive: true });
  // 판에 들어가기까지(메뉴)는 잘라 내고, 더러운 화면 → 닦는 장면 → 결과만 남긴다
  const cut = Math.max(0, playFrom - 900);
  const ss = (cut / 1000).toFixed(2);
  const dur = ((total - cut) / 1000).toFixed(2);
  const vf = 'scale=1080:1920:flags=lanczos,fps=30,format=yuv420p';
  const enc = ['-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-movflags', '+faststart'];
  let args;
  if (audio && audio.b64.length > 1000) {
    writeFileSync(resolve(tmp, 'game.webm'), Buffer.from(audio.b64, 'base64'));
    // 화면의 자르는 지점이 소리 녹음의 몇 초째인가 (녹음이 더 늦게 시작했으면 그만큼 뒤로 민다)
    const off = (t0 + cut - audio.at) / 1000;
    const a = off >= 0 ? ['-ss', off.toFixed(2), '-i', resolve(tmp, 'game.webm')] : ['-itsoffset', (-off).toFixed(2), '-i', resolve(tmp, 'game.webm')];
    args = ['-y', '-loglevel', 'error', '-ss', ss, '-i', resolve(tmp, webm), ...a, '-t', dur, '-map', '0:v', '-map', '1:a', '-vf', vf, ...enc, '-af', 'aresample=48000,apad', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', OUT];
  } else {
    args = ['-y', '-loglevel', 'error', '-ss', ss, '-i', resolve(tmp, webm), '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', dur, '-map', '0:v', '-map', '1:a', '-vf', vf, ...enc, '-c:a', 'aac', '-b:a', '160k', OUT];
  }
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg 변환 실패');
  console.log(JSON.stringify({ out: OUT, seconds: Number(dur), sound: !!(audio && audio.b64.length > 1000), finished, remaining: Number(remain.toFixed(2)), cleaned: Number((startLeft > 0 ? 1 - remain / startLeft : 1).toFixed(2)), steps: order }));
  if (!finished) console.log('주의 - 판을 끝까지 닦지 못했습니다. --steps 순서를 바꾸거나 --max 를 늘리세요.');
  ok = true;
} finally {
  await browser.close();
  stop();
  rmSync(tmp, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
