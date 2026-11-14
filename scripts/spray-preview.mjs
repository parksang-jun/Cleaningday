// 세제별 분사 모양 미리보기 — 한 판에 세제를 하나씩 뿌려 화면을 찍는다
//   node scripts/spray-preview.mjs exterior:73 carshampoo,moldremover,dishsoap,bakingsoda,allpurpose,cookingoil
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'screenshots', 'spray-preview');
mkdirSync(out, { recursive: true });
const PORT = 4178;
const [spec = 'exterior:73', list = 'carshampoo,moldremover,dishsoap,bakingsoda,allpurpose,cookingoil'] = process.argv.slice(2);
const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe', detached: true });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('preview timeout')), 20000); proc.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } }); });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, isMobile: true });
const p = await ctx.newPage();
await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await p.evaluate(() => { window.__sparkle.skipTour(); window.__sparkle.setUnlocked(96); });
await p.waitForTimeout(500);
const [area, n] = spec.split(':');
for (const id of list.split(',')) {
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '#ad-banner,.beta-tag,.toast{display:none!important}' });
  await p.click(`[data-testid="area-${area}"]`);
  await p.click(`[data-testid="stage-${n}"]`);
  await p.click('[data-testid="start"]');
  await p.waitForSelector('[data-testid="canvas"]');
  await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  await p.evaluate((i) => window.__sparkle.select(i), id);
  const box = await p.locator('[data-testid="canvas"]').boundingBox();
  await p.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await p.mouse.down();
  for (let k = 0; k <= 30; k++) { await p.mouse.move(box.x + box.width * (0.25 + 0.5 * (k / 30)), box.y + box.height * (0.3 + 0.35 * (k / 30))); await p.waitForTimeout(25); }
  await p.locator('[data-testid="canvas"]').screenshot({ path: resolve(out, `${id}.png`) }); // 뿌리는 중
  await p.mouse.up();
  console.log('찍음 -', id);
}
await browser.close();
try { process.kill(-proc.pid); } catch { /* 이미 종료 */ }
