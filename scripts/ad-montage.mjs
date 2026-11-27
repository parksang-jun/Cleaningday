// 홍보 영상 묶음 — 여러 판의 실제 플레이를 이어 붙이고 나레이션·게임 소리·끝 화면을 넣는다 (1080x1920 mp4)
//   node scripts/ad-montage.mjs --spec ops/agent/ads/cr-20261126-01/spec.json --out ops/agent/ads/cr-20261126-01/final.mp4
// spec.json:
//   { "lang": "ko",
//     "scenes": [ { "area": "living", "stage": 1, "steps": "cloth", "caption": "먼지? 한 번에 쓱", "say": "먼지는 한 번에 쓱.", "take": 5, "from": "start" } ],
//     "end": { "title": "싹싹 클린", "sub": "App Store 에서 검색", "say": "싹싹 클린. 지금 앱스토어에서 만나 보세요." } }
//   take: 그 장면을 몇 초 쓸지(나레이션이 더 길면 그만큼 늘어난다) · from: "start"(더러운 화면부터) 또는 "end"(반짝 결과까지)
//   photo: 사진 장면 — 게임 화면 대신 사진 한 장(저장소 기준 경로)을 천천히 당겨 보여 준다. caption·say·take·zoom('in'|'out')·note(작은 안내 글)
//   speed: 빨리 감기 배율(1~4, 기본 1) — 화면 구석에 x3 처럼 표시된다
//   say: 나레이션(한국어·영어 — scripts/ad-voice.py). 비우면 그 장면은 게임 소리만.
//   맨 위에 "voice": 0~9(0~4 남성, 5~9 여성 계열, 기본 5), "voiceSpeed": 0.8~1.3(기본 1.05) 을 줄 수 있다.
// 먼저 `npm run build`. 장면 녹화는 scripts/ad-clip.mjs 가 한다(실제 플레이만).
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const spec = JSON.parse(readFileSync(resolve(root, arg('spec')), 'utf8'));
const OUT = resolve(root, arg('out', 'screenshots/ad-montage.mp4'));
const LANG = spec.lang || 'ko';
const tmp = mkdtempSync(resolve(tmpdir(), 'ad-montage-'));
const GAME_VOL = 0.32; // 나레이션이 깔릴 때 게임 소리 크기
const ENC = ['-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2'];

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} 실패: ${(r.stderr || r.stdout || '').slice(-600)}`);
  return r.stdout;
};
const ff = (args, out) => {
  // 중간에 멈추면 재생은 되지만 짧은 파일이 남는다 — 임시 이름으로 쓰고 성공하면 바꾼다
  const part = out.replace(/\.mp4$/, '.part.mp4');
  run('ffmpeg', ['-y', '-loglevel', 'error', ...args, part]);
  renameSync(part, out);
};
const seconds = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

/** 나레이션을 만든다. 못 만들면(한국어가 아니거나 음성 도구가 없으면) null — 그 장면은 게임 소리만 */
let voiceWarned = false;
const narrate = (text, name) => {
  if (!text || !['ko', 'en'].includes(LANG)) return null;
  const wav = resolve(tmp, `${name}.wav`);
  // 영어는 Kokoro(ad-voice-en.py) — 사람 목소리에 가깝다. 한국어는 Supertonic(ad-voice.py)
  const r =
    LANG === 'en'
      ? spawnSync('python3', ['scripts/ad-voice-en.py', text, wav, String(spec.voiceSpeed ?? 1.0), String(spec.voice ?? 3)], { cwd: root, encoding: 'utf8' })
      : spawnSync('python3', ['scripts/ad-voice.py', text, wav, String(spec.voiceSpeed ?? 1.05), String(spec.voice ?? 5), LANG], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    if (!voiceWarned) console.log('주의 - 나레이션을 만들지 못했습니다(자막과 게임 소리만 들어갑니다):', (r.stderr || '').trim().split('\n').pop());
    voiceWarned = true;
    return null;
  }
  return wav;
};

const { chromium } = createRequire(import.meta.url)('playwright');
const parts = [];
const report = [];
try {
  let n = 0;
  for (const sc of spec.scenes) {
    n++;
    // 사진 장면(photo): 게임 화면이 아닌 생활 장면 사진 한 장을 천천히 당겨 보여 준다. 자막은 화면 아래쪽에 얹는다
    if (sc.photo) {
      const len = sc.take ?? 3.2;
      const voice = narrate(sc.say, `say${n}`);
      const dur = Math.max(len, voice ? seconds(voice) + 0.7 : 0);
      const cap = resolve(tmp, `cap${n}.png`);
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
      const esc = (t) => String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
      await page.setContent(`<body style="margin:0;width:540px;height:960px;background:transparent;position:relative">
        <div style="position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(transparent,rgba(0,0,0,.62))"></div>
        <div style="position:absolute;left:0;right:0;bottom:${sc.note ? 150 : 120}px;text-align:center;font:800 34px/1.28 system-ui,sans-serif;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.8);padding:0 28px;white-space:pre-line">${esc(sc.caption)}</div>
        ${sc.note ? `<div style="position:absolute;left:0;right:0;bottom:44px;text-align:center;font:600 15px/1.3 system-ui,sans-serif;color:rgba(255,255,255,.78);padding:0 28px">${esc(sc.note)}</div>` : ''}</body>`);
      await page.screenshot({ path: cap, omitBackground: true });
      await browser.close();
      const out = resolve(tmp, `scene${n}.mp4`);
      const frames = Math.ceil(dur * 30);
      const z = sc.zoom === 'out' ? `1.12-0.12*on/${frames}` : `1+0.12*on/${frames}`;
      const v = `[0:v]scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih*0.42-(ih/zoom*0.42)':d=${frames}:s=1080x1920:fps=30[bg];[bg][1:v]overlay=0:0,format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st=${(dur - 0.25).toFixed(2)}:d=0.25[v]`;
      if (voice) ff(['-i', resolve(root, sc.photo), '-i', cap, '-i', voice, '-filter_complex', `${v};[2:a]aresample=48000,adelay=300|300,apad[a]`, '-map', '[v]', '-map', '[a]', '-t', dur.toFixed(2), ...ENC], out);
      else ff(['-i', resolve(root, sc.photo), '-i', cap, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-filter_complex', v, '-map', '[v]', '-map', '2:a', '-t', dur.toFixed(2), ...ENC], out);
      parts.push(out);
      report.push({ scene: `photo ${sc.photo}`, seconds: Number(dur.toFixed(1)), narration: !!voice });
      continue;
    }
    const raw = resolve(tmp, `raw${n}.mp4`);
    const a = ['scripts/ad-clip.mjs', '--area', sc.area, '--stage', String(sc.stage), '--lang', LANG, '--out', raw, '--max', String(sc.max ?? 30)];
    if (sc.steps) a.push('--steps', sc.steps);
    if (sc.caption) a.push('--hook', sc.caption);
    const info = JSON.parse(run('node', a).trim().split('\n').find((l) => l.startsWith('{')));
    const voice = narrate(sc.say, `say${n}`);
    const want = Math.max(sc.take ?? 5, voice ? seconds(voice) + 0.7 : 0);
    // speed: 빨리 감기 배율(1~4). 어려운 판은 녹화가 사람보다 느려서, 빨리 감아야 닦이는 모습이 보인다. 화면에 배율을 표시한다
    const sp = Math.min(4, Math.max(1, sc.speed ?? 1));
    const len = Math.min(want, info.seconds / sp);
    const src = len * sp;
    const ss = sc.from === 'end' ? Math.max(0, info.seconds - src) : 0;
    const out = resolve(tmp, `scene${n}.mp4`);
    const tag = sp > 1 ? `,drawtext=text='x${sp}':fontcolor=white:fontsize=34:x=w-tw-36:y=h-th-40:box=1:boxcolor=black@0.45:boxborderw=12` : '';
    const fade = `${sp > 1 ? `setpts=PTS/${sp},` : ''}fade=t=in:st=0:d=0.2,fade=t=out:st=${(len - 0.2).toFixed(2)}:d=0.2${tag}`;
    const tempo = sp > 1 ? (sp > 2 ? `atempo=2,atempo=${(sp / 2).toFixed(3)},` : `atempo=${sp},`) : '';
    if (voice) {
      ff(['-ss', ss.toFixed(2), '-t', src.toFixed(2), '-i', raw, '-i', voice, '-filter_complex', `[0:v]${fade}[v];[0:a]${tempo}volume=${GAME_VOL}[g];[1:a]aresample=48000,adelay=350|350,apad[s];[g][s]amix=inputs=2:duration=first:normalize=0[a]`, '-map', '[v]', '-map', '[a]', '-t', len.toFixed(2), ...ENC], out);
    } else {
      ff(['-ss', ss.toFixed(2), '-t', src.toFixed(2), '-i', raw, '-filter_complex', `[0:v]${fade}[v];[0:a]${tempo}anull[a]`, '-map', '[v]', '-map', '[a]', '-t', len.toFixed(2), ...ENC], out);
    }
    parts.push(out);
    report.push({ scene: n, area: sc.area, stage: sc.stage, seconds: Number(len.toFixed(1)), finished: info.finished, sound: info.sound, narration: !!voice });
  }

  if (spec.end) {
    const { chromium } = createRequire(import.meta.url)('playwright');
    const icon = readFileSync(resolve(root, 'store-assets/play/icon-512.png')).toString('base64');
    const html = `<body style="margin:0;width:540px;height:960px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;background:linear-gradient(180deg,#e9f8f6,#bfe9e4);font-family:system-ui,sans-serif">
      <img src="data:image/png;base64,${icon}" style="width:190px;height:190px;border-radius:44px;box-shadow:0 14px 40px rgba(0,80,80,.25)">
      <div style="font:800 54px/1.1 system-ui,sans-serif;color:#0f3d3a">${spec.end.title ?? ''}</div>
      <div style="font:700 26px/1.4 system-ui,sans-serif;color:#1c6f69;text-align:center;padding:0 40px;white-space:pre-line">${spec.end.sub ?? ''}</div></body>`;
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    await page.setContent(html);
    const png = resolve(tmp, 'end.png');
    await page.screenshot({ path: png });
    await browser.close();
    const voice = narrate(spec.end.say, 'sayend');
    const len = Math.max(spec.end.take ?? 2.6, voice ? seconds(voice) + 0.8 : 0);
    const out = resolve(tmp, 'end.mp4');
    const v = `format=yuv420p,loop=-1:1,trim=duration=${len.toFixed(2)},fade=t=in:st=0:d=0.25`;
    if (voice) ff(['-framerate', '30', '-i', png, '-i', voice, '-filter_complex', `[0:v]${v}[v];[1:a]aresample=48000,adelay=300|300,apad[a]`, '-map', '[v]', '-map', '[a]', '-t', len.toFixed(2), ...ENC], out);
    else ff(['-framerate', '30', '-i', png, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-filter_complex', `[0:v]${v}[v]`, '-map', '[v]', '-map', '1:a', '-t', len.toFixed(2), ...ENC], out);
    parts.push(out);
    report.push({ scene: 'end', seconds: Number(len.toFixed(1)), narration: !!voice });
  }

  const list = resolve(tmp, 'list.txt');
  writeFileSync(list, parts.map((f) => `file '${f}'`).join('\n'));
  mkdirSync(dirname(OUT), { recursive: true });
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart'], OUT);
  console.log(JSON.stringify({ out: OUT, seconds: Number(seconds(OUT).toFixed(1)), scenes: report }, null, 1));
  if (report.some((r) => r.finished === false)) console.log('주의 - 끝까지 닦지 못한 장면이 있습니다. 그 장면의 steps 를 고치세요(from: "end" 장면은 결과 화면이 안 나옵니다).');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
