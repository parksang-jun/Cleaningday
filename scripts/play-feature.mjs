// Google Play 그래픽 이미지(1024x500) — 스토어 스크린샷을 재료로 합성한다.
//   node scripts/play-feature.mjs          한국어
//   SHOT_LANG=en node scripts/play-feature.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LANG = process.env.SHOT_LANG || 'ko';
const b64 = (p) => `data:image/png;base64,${readFileSync(resolve(root, p)).toString('base64')}`;
const shot = (n) => b64(`store-assets/${LANG}-1080x1920/${n}.png`);
const T = LANG === 'ko' ? { title: '싹싹 클린', sub: '문지르면 반짝! 청소 게임', tag: '집 · 정원 · 자동차 96개 스테이지' } : { title: 'Sparkle Clean', sub: 'Scrub it till it shines', tag: '96 stages · home, garden & car' };
const html = `<!doctype html><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}body{width:1024px;height:500px;overflow:hidden;font-family:'Noto Sans CJK KR','Noto Sans KR','Apple SD Gothic Neo',system-ui,sans-serif;
background:radial-gradient(900px 500px at 15% 20%,#2fd3c4 0%,#1a9fb8 45%,#14607f 100%);color:#fff;position:relative}
.l{position:absolute;left:56px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;gap:14px}
.row{display:flex;align-items:center;gap:18px}.row img{width:104px;height:104px;border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,.3)}
h1{font-size:${LANG === 'ko' ? 76 : 58}px;font-weight:900;letter-spacing:-2px;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.15)}
.sub{font-size:${LANG === 'ko' ? 34 : 32}px;font-weight:800}.tag{font-size:21px;font-weight:700;opacity:.92;background:rgba(0,0,0,.18);padding:8px 16px;border-radius:999px;align-self:flex-start}
.p{position:absolute;width:210px;height:373px;border-radius:22px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.4);border:4px solid rgba(255,255,255,.9)}
.p img{width:100%;height:100%;object-fit:cover;object-position:top}
.p1{left:548px;top:96px;transform:rotate(-7deg)}.p2{left:690px;top:58px;transform:rotate(1deg);z-index:2;width:226px;height:402px}.p3{left:850px;top:104px;transform:rotate(8deg)}
.sp{position:absolute;font-size:40px}</style>
<div class="l"><div class="row"><img src="${b64('public/icon-512.png')}"><h1>${T.title}</h1></div><div class="sub">${T.sub}</div><div class="tag">${T.tag}</div></div>
<div class="p p1"><img src="${shot('2-rug')}"></div><div class="p p3"><img src="${shot('4-car')}"></div><div class="p p2"><img src="${shot('3-kitchen')}"></div>
<div class="sp" style="left:520px;top:30px">✨</div><div class="sp" style="left:36px;top:36px;font-size:30px">✨</div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
mkdirSync(resolve(root, 'store-assets/play'), { recursive: true });
const out = resolve(root, `store-assets/play/feature-${LANG}-1024x500.png`);
await page.screenshot({ path: out, omitBackground: false });
await browser.close();
console.log(out);
