// 장면 미리보기 — 지정한 판에 들어가 왼쪽 절반만 닦은 화면을 찍는다 (실사 사진 확인용)
//   node scripts/scene-preview.mjs exterior:73 kitchen:25
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'screenshots', 'scene-preview');
mkdirSync(out, { recursive: true });
const PORT = 4177;
const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('preview timeout')), 20000); proc.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, isMobile: true });
const p = await ctx.newPage();
const HIDE = '#ad-banner,.beta-tag,.toast{display:none!important}';
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await p.evaluate(() => { window.__sparkle.skipTour(); window.__sparkle.setUnlocked(96); });
await p.waitForTimeout(500);
for (const spec of process.argv.slice(2)) {
  const [area, n] = spec.split(':');
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: HIDE });
  await p.click(`[data-testid="area-${area}"]`);
  await p.click(`[data-testid="stage-${n}"]`);
  await p.click('[data-testid="start"]');
  await p.waitForSelector('[data-testid="canvas"]');
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    document.querySelectorAll('.modal').forEach((m) => m.remove());
    const s = window.__sparkle.session();
    for (let i = 0; i < s.amount.length; i++) {
      if (i % s.w >= s.w * 0.5) continue;
      if (s.amount[i] > 0) s.take(i, s.amount[i]);
      s.amount[i] = 0;
      if (s.under[i] > 0) { s.remaining -= s.under[i]; s.perType[s.underType[i]] -= s.under[i]; s.under[i] = 0; }
    }
    s.version++;
  });
  await p.waitForTimeout(500);
  await p.locator('[data-testid="canvas"]').screenshot({ path: resolve(out, `${area}-${n}.png`) });
  console.log('찍음 -', `${area}-${n}.png`);
}
await browser.close();
try { process.kill(-proc.pid); } catch { /* 이미 종료 */ }
