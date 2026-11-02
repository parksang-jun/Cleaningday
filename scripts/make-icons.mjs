// SVG 아이콘을 PNG로 렌더링(Playwright). Capacitor 아이콘/스플래시 생성용 원본도 만든다.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
mkdirSync(resolve(root, 'resources'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });

async function render(size, out, bg = null, pad = 0) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  await page.setContent(`<html><body style="margin:0;background:${bg ?? 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: out, omitBackground: bg === null });
  console.log('wrote', out);
}

await render(1024, resolve(root, 'resources/icon.png'));
await render(1024, resolve(root, 'resources/icon-foreground.png'), null, 160);
await render(1024, resolve(root, 'resources/icon-background.png'), '#12b5a6', 2000);
await render(512, resolve(root, 'public/icon-512.png'));
await render(192, resolve(root, 'public/icon-192.png'));
// 스플래시(2732x2732 정사각, 중앙 아이콘)
await page.setViewportSize({ width: 2732, height: 2732 });
await page.setContent(`<html><body style="margin:0;background:#12b5a6;display:grid;place-items:center;width:2732px;height:2732px">
  <div style="width:600px;height:600px">${svg.replace('<svg ', '<svg width="600" height="600" ')}</div></body></html>`);
await page.screenshot({ path: resolve(root, 'resources/splash.png') });
await page.screenshot({ path: resolve(root, 'resources/splash-dark.png') });
await browser.close();
