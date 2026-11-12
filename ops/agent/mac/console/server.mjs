#!/usr/bin/env node
// 싹싹 클린 운영센터 — 로컬 관리 화면 서버 (의존성 없음, 이 맥에서만 열림: 127.0.0.1)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const HOME_DIR = process.env.SC_HOME_DIR || path.join(HOME, 'SparkleCleanOps');
const REPO = process.env.SC_REPO_DIR || path.join(HOME_DIR, 'Cleaningday');
const AGENT = path.join(REPO, 'ops', 'agent');
const LOGS = path.join(HOME_DIR, 'logs');
const LAUNCH = path.join(HOME, 'Library', 'LaunchAgents');
const PORT = Number(process.env.SC_PORT || 4777);
const REPO_URL = 'https://github.com/parksang-jun/Cleaningday';
const GAME_URL = 'https://claude.ai/artifact/BdmTkpBwacf1cv3dHKCbDE';
const IDLE_MS = 45 * 60 * 1000;

// launchd 로 열린 앱은 PATH 가 비어 있다 — 설치기가 적어 둔 env.sh 와 흔한 경로를 더한다
(() => {
  const extra = [path.join(HOME, '.local/bin'), path.join(HOME, '.claude/local'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  try {
    const env = fs.readFileSync(path.join(HOME_DIR, 'env.sh'), 'utf8');
    const m = env.match(/export PATH="([^"]+)"/);
    if (m) extra.unshift(...m[1].split(':'));
  } catch {}
  process.env.PATH = [...new Set([...extra, ...(process.env.PATH || '').split(':')])].filter(Boolean).join(':');
  process.env.GIT_TERMINAL_PROMPT = '0';
})();

const ROUTINES = {
  A: { name: '주간 운영 점검', desc: '앱 상태·리뷰·지표 확인, 백로그 1건 개선(PR)', label: 'weekly', when: '매주 월 09:43', cal: { weekday: 1, hour: 9, minute: 43 } },
  B: { name: '광고주 발굴', desc: '스폰서 후보 조사, 제안 메일 초안 작성(발송 안 함)', label: 'sponsors', when: '매주 수 10:17', cal: { weekday: 3, hour: 10, minute: 17 } },
  D: { name: '제품 개선', desc: '피드백 수집·분류 → 우선순위 → 수정(PR) → 효과 확인', label: 'improve', when: '매주 화·금 10:31', cal: { weekdays: [2, 5], hour: 10, minute: 31 } },
  C: { name: '월간 정산', desc: '광고·제휴 수익 대사, 미수금 정리(지급 안 함)', label: 'settlement', when: '매월 3일 10:12', cal: { day: 3, hour: 10, minute: 12 } },
};
const children = new Map(); // routine → child process started here

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: opts.timeout ?? 20000, cwd: opts.cwd, maxBuffer: 8 << 20, env: opts.env || process.env }, (err, stdout, stderr) => {
      resolve({ ok: !err, code: err ? (err.code ?? 1) : 0, out: String(stdout || ''), err: String(stderr || (err && err.message) || '') });
    });
  });
}
const git = (args, timeout) => run('git', ['-C', REPO, ...args], { timeout });
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
async function which(bin) { const r = await run('/bin/sh', ['-c', `command -v ${bin}`]); return r.ok ? r.out.trim() : null; }

function nextRun(cal, from = new Date()) {
  const d = new Date(from); d.setSeconds(0, 0);
  for (let i = 0; i < 60 * 24 * 40; i++) {
    d.setMinutes(d.getMinutes() + 1);
    if (d.getHours() !== cal.hour || d.getMinutes() !== cal.minute) continue;
    if (cal.weekday !== undefined && d.getDay() !== cal.weekday) continue;
    if (cal.weekdays && !cal.weekdays.includes(d.getDay())) continue;
    if (cal.day !== undefined && d.getDate() !== cal.day) continue;
    return d.toISOString();
  }
  return null;
}

function logsFor(r) {
  try {
    return fs.readdirSync(LOGS).filter((f) => f.startsWith(`routine-${r}-`) && f.endsWith('.log')).sort().reverse();
  } catch { return []; }
}
function outcome(file) {
  try {
    const txt = fs.readFileSync(path.join(LOGS, file), 'utf8');
    const m = txt.match(/=== 종료 코드 (\d+) ===\s*$/);
    if (m) return m[1] === '0' ? 'ok' : 'fail';
    return 'unknown';
  } catch { return 'unknown'; }
}

let launchCache = { at: 0, out: '' };
async function launchList() {
  if (Date.now() - launchCache.at < 4000) return launchCache.out;
  const r = await run('launchctl', ['list'], { timeout: 5000 });
  launchCache = { at: Date.now(), out: r.out };
  return r.out;
}

async function status() {
  const [gitBin, nodeBin, claudeBin, ghBin] = await Promise.all(['git', 'node', 'claude', 'gh'].map(which));
  const repoOk = exists(path.join(REPO, '.git'));
  let repo = { ok: repoOk, path: REPO };
  if (repoOk) {
    const [head, br, dirty] = await Promise.all([git(['log', '-1', '--format=%h|%s|%cI', 'main']), git(['rev-parse', '--abbrev-ref', 'HEAD']), git(['status', '--porcelain'])]);
    const [hash, subject, date] = head.out.trim().split('|');
    repo = { ...repo, hash, subject, date, branch: br.out.trim(), dirty: dirty.out.trim() ? dirty.out.trim().split('\n').length : 0 };
  }
  const ll = await launchList();
  const runner = exists(path.join(HOME_DIR, 'run-routine.sh')) ? path.join(HOME_DIR, 'run-routine.sh') : path.join(AGENT, 'mac', 'run-routine.sh');
  const routines = {};
  for (const [k, r] of Object.entries(ROUTINES)) {
    const label = `com.sparkleclean.ops.${r.label}`;
    const logs = logsFor(k);
    const last = logs[0] ? { file: logs[0], at: fs.statSync(path.join(LOGS, logs[0])).mtime.toISOString(), result: outcome(logs[0]) } : null;
    const running = exists(path.join(HOME_DIR, `.lock-${k}`)) || children.has(k);
    if (last && running && last.result === 'unknown') last.result = 'running';
    routines[k] = { ...r, scheduled: exists(path.join(LAUNCH, `${label}.plist`)) && ll.includes(label), plist: exists(path.join(LAUNCH, `${label}.plist`)), next: nextRun(r.cal), last, running, runs: logs.length };
  }
  return { now: new Date().toISOString(), host: os.hostname(), tools: { git: gitBin, node: nodeBin, claude: claudeBin, gh: ghBin }, repo, runner: exists(runner) ? runner : null, homeDir: HOME_DIR, routines, links: { repo: REPO_URL, game: GAME_URL } };
}

// ---- 상태 파일: main 과 에이전트 브랜치(agent/*) 중 가장 최근 것을 읽는다 (에이전트는 브랜치에 커밋하고 PR 을 연다)
async function refs() {
  if (!exists(path.join(REPO, '.git'))) return [];
  const r = await git(['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)|%(committerdate:iso-strict)|%(subject)', 'refs/heads/agent/', 'refs/remotes/origin/agent/', 'refs/heads/main']);
  const seen = new Set();
  return r.out.trim().split('\n').filter(Boolean).map((l) => { const [ref, date, subject] = l.split('|'); return { ref, date, subject, name: ref.replace(/^origin\//, '') }; })
    .filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true)));
}
async function readAt(ref, rel) {
  const r = await git(['show', `${ref}:ops/agent/${rel}`]);
  if (r.ok) return r.out;
  try { return fs.readFileSync(path.join(AGENT, rel), 'utf8'); } catch { return ''; }
}
function parseCsv(txt) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head = [], ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return { columns: head, rows: body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))) };
}
async function stateData() {
  const all = await refs();
  const main = all.find((x) => x.name === 'main');
  const latest = all[0] || null; // 가장 최근 커밋이 있는 브랜치
  const ref = latest ? latest.ref : 'main';
  const [pipeline, ledger, backlog, log, feedback, improvements] = await Promise.all(['state/pipeline.csv', 'state/ledger.csv', 'state/backlog.md', 'state/log.md', 'state/feedback.csv', 'state/improvements.md'].map((f) => readAt(ref, f)));
  // 보고서: 모든 에이전트 브랜치 + main
  const reports = []; const seen = new Set();
  for (const b of all.length ? all : [{ ref: 'main', name: 'main', date: '' }]) {
    const ls = await git(['ls-tree', '-r', '--name-only', b.ref, 'ops/agent/reports']);
    for (const p of ls.out.trim().split('\n').filter((x) => x.endsWith('.md'))) {
      const rel = p.replace(/^ops\/agent\//, '');
      if (seen.has(rel)) continue; seen.add(rel);
      const d = await git(['log', '-1', '--format=%cI', b.ref, '--', p]);
      reports.push({ path: rel, ref: b.ref, branch: b.name, date: d.out.trim() || b.date, draft: rel.includes('/drafts/') });
    }
  }
  reports.sort((a, b) => (a.date < b.date ? 1 : -1));
  const pending = all.filter((x) => x.name.startsWith('agent/'));
  return {
    source: { ref, name: latest ? latest.name : 'main', date: latest?.date, isMain: !latest || latest.name === 'main', mainDate: main?.date },
    pipeline: parseCsv(pipeline), ledger: parseCsv(ledger), feedback: parseCsv(feedback), improvements, inbox: readInbox(), backlog, log, reports, pending,
  };
}

// ---- 피드백 함: 사장님이 운영센터에 적은 피드백 (저장소 밖 ~/SparkleCleanOps/feedback/inbox.md). 제품 개선 루틴이 가져간다
const FB_DIR = path.join(HOME_DIR, 'feedback');
const FB_INBOX = path.join(FB_DIR, 'inbox.md');
function readInbox() {
  let txt = ''; try { txt = fs.readFileSync(FB_INBOX, 'utf8'); } catch {}
  const items = txt.split(/^## /m).slice(1).map((b) => { const [head, ...body] = b.split('\n'); const [at, source] = head.split(' · '); return { at: (at || '').trim(), source: (source || '').trim(), text: body.join('\n').trim() }; });
  let processing = 0; try { processing = fs.readdirSync(FB_DIR).filter((f) => f.startsWith('processing-')).length; } catch {}
  return { items, processing };
}
function addFeedback(source, text) {
  text = String(text || '').trim(); source = String(source || '기타').replace(/[\n#·]/g, ' ').trim().slice(0, 40) || '기타';
  if (!text) return { ok: false, msg: '내용을 적어 주세요' };
  if (text.length > 5000) return { ok: false, msg: '너무 깁니다 (5,000자 이내)' };
  fs.mkdirSync(FB_DIR, { recursive: true });
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  fs.appendFileSync(FB_INBOX, `## ${stamp} · ${source}\n${text.replace(/^## /gm, '# # ')}\n\n`);
  return { ok: true, msg: '피드백을 접수했습니다 — 다음 제품 개선 실행 때 반영됩니다' };
}
function removeFeedback(index) {
  const { items } = readInbox();
  if (!(index >= 0 && index < items.length)) return { ok: false, msg: '없는 항목' };
  items.splice(index, 1);
  fs.writeFileSync(FB_INBOX, items.map((i) => `## ${i.at} · ${i.source}\n${i.text}\n\n`).join(''));
  return { ok: true, msg: '지웠습니다' };
}

function safeRel(rel) { return typeof rel === 'string' && /^reports\/[\w\-./가-힣 ]+\.md$/.test(rel) && !rel.includes('..'); }

// ---- 동작
function startRoutine(k) {
  if (!ROUTINES[k]) return { ok: false, msg: '알 수 없는 루틴' };
  if (children.has(k) || exists(path.join(HOME_DIR, `.lock-${k}`))) return { ok: false, msg: '이미 실행 중입니다' };
  const runner = exists(path.join(HOME_DIR, 'run-routine.sh')) ? path.join(HOME_DIR, 'run-routine.sh') : path.join(AGENT, 'mac', 'run-routine.sh');
  if (!exists(runner)) return { ok: false, msg: '실행 스크립트가 없습니다 — 설정에서 "에이전트 설치"를 먼저 하세요' };
  fs.mkdirSync(LOGS, { recursive: true });
  const child = spawn('/bin/bash', [runner, k], { detached: true, stdio: 'ignore', env: process.env });
  children.set(k, child);
  child.on('exit', () => children.delete(k));
  child.unref();
  return { ok: true, msg: `${ROUTINES[k].name} 시작 — 보통 5~20분 걸립니다` };
}
function stopRoutine(k) {
  const c = children.get(k);
  if (!c) return { ok: false, msg: '이 화면에서 시작한 실행만 멈출 수 있습니다' };
  try { process.kill(-c.pid, 'SIGTERM'); } catch { try { c.kill('SIGTERM'); } catch {} }
  try { fs.rmdirSync(path.join(HOME_DIR, `.lock-${k}`)); } catch {}
  return { ok: true, msg: '멈췄습니다' };
}
async function setSchedule(on) {
  const uid = process.getuid?.() ?? 501;
  const msgs = [];
  for (const r of Object.values(ROUTINES)) {
    const label = `com.sparkleclean.ops.${r.label}`;
    const file = path.join(LAUNCH, `${label}.plist`);
    if (!exists(file)) { msgs.push(`${r.name}: 예약 파일 없음`); continue; }
    await run('launchctl', ['bootout', `gui/${uid}/${label}`], { timeout: 8000 });
    if (on) { const b = await run('launchctl', ['bootstrap', `gui/${uid}`, file], { timeout: 8000 }); if (!b.ok) msgs.push(`${r.name}: ${b.err.trim()}`); }
  }
  launchCache.at = 0;
  return { ok: msgs.length === 0, msg: msgs.length ? msgs.join(' / ') : on ? '자동 실행을 켰습니다' : '자동 실행을 껐습니다 (지금 실행은 계속 가능)' };
}
async function installAgent() {
  // 저장소가 없으면 받고(공개 저장소라 로그인 불필요), 설치 스크립트를 화면 없이 돌린다
  if (!exists(path.join(REPO, '.git'))) {
    fs.mkdirSync(HOME_DIR, { recursive: true });
    const c = await run('git', ['clone', '-q', `${REPO_URL}.git`, REPO], { timeout: 180000 });
    if (!c.ok) return { ok: false, msg: `저장소 받기 실패: ${c.err.trim().slice(0, 200)}` };
  }
  const inst = path.join(AGENT, 'mac', 'install.command');
  const r = await run('/bin/bash', [inst], { timeout: 240000, env: { ...process.env, SC_FROM_CONSOLE: '1' } });
  launchCache.at = 0;
  const tail = (r.out + r.err).trim().split('\n').slice(-6).join('\n');
  return { ok: r.ok, msg: r.ok ? '에이전트 설치·예약 등록 완료' : `설치 중 문제:\n${tail}` };
}
async function pull() {
  if (!exists(path.join(REPO, '.git'))) return { ok: false, msg: '저장소가 없습니다' };
  const f = await git(['fetch', '-q', '--prune', 'origin'], 60000);
  if (!f.ok) return { ok: false, msg: `받기 실패: ${f.err.trim().slice(0, 200)}` };
  const br = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).out.trim();
  if (br !== 'main') await git(['checkout', '-q', 'main']);
  const p = await git(['merge', '--ff-only', '-q', 'origin/main'], 60000);
  return { ok: p.ok, msg: p.ok ? '최신으로 갱신했습니다' : `갱신 실패(로컬 변경이 있을 수 있음): ${p.err.trim().slice(0, 200)}` };
}
function openTarget(t, arg) {
  const map = {
    repo: REPO_URL, game: GAME_URL, pulls: `${REPO_URL}/pulls`, actions: `${REPO_URL}/actions`,
    reports: path.join(AGENT, 'reports'), logs: LOGS, folder: HOME_DIR,
  };
  let target = map[t];
  if (t === 'branch' && typeof arg === 'string' && /^agent\/[\w\-./]+$/.test(arg)) target = `${REPO_URL}/compare/main...${encodeURIComponent(arg).replace(/%2F/g, '/')}?expand=1`;
  if (!target) return { ok: false, msg: '열 수 없는 대상' };
  if (!target.startsWith('http')) fs.mkdirSync(target, { recursive: true });
  spawn('open', [target], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  return { ok: true, msg: '열었습니다', target };
}

// ---- HTTP
let lastHit = Date.now();
setInterval(() => { if (Date.now() - lastHit > IDLE_MS && children.size === 0) process.exit(0); }, 60000).unref();

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

const server = http.createServer(async (req, res) => {
  lastHit = Date.now();
  const host = (req.headers.host || '').split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host)) return send(res, 403, { ok: false });
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET') {
      if (url.pathname === '/' || url.pathname === '/index.html') return send(res, 200, fs.readFileSync(path.join(HERE, 'index.html')), 'text/html; charset=utf-8');
      if (url.pathname === '/icon.png' && exists(path.join(HERE, 'icon.png'))) return send(res, 200, fs.readFileSync(path.join(HERE, 'icon.png')), 'image/png');
      if (url.pathname === '/api/ping') return send(res, 200, { ok: true });
      if (url.pathname === '/api/status') return send(res, 200, await status());
      if (url.pathname === '/api/state') return send(res, 200, await stateData());
      if (url.pathname === '/api/report') {
        const rel = url.searchParams.get('path'); const ref = url.searchParams.get('ref') || 'main';
        if (!safeRel(rel) || !/^[\w\-./]+$/.test(ref)) return send(res, 400, { ok: false });
        return send(res, 200, { ok: true, text: await readAt(ref, rel) });
      }
      if (url.pathname === '/api/logs') {
        let files = []; try { files = fs.readdirSync(LOGS).filter((f) => f.endsWith('.log')); } catch {}
        const list = files.map((f) => { const st = fs.statSync(path.join(LOGS, f)); return { file: f, at: st.mtime.toISOString(), size: st.size, result: f.startsWith('routine-') ? outcome(f) : 'info' }; }).sort((a, b) => (a.at < b.at ? 1 : -1));
        return send(res, 200, { ok: true, list });
      }
      if (url.pathname === '/api/log') {
        const f = url.searchParams.get('file');
        if (!f || !/^[\w\-.]+\.log$/.test(f)) return send(res, 400, { ok: false });
        const p = path.join(LOGS, f); const st = fs.statSync(p); const start = Math.max(0, st.size - 200000);
        const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(st.size - start); fs.readSync(fd, buf, 0, buf.length, start); fs.closeSync(fd);
        return send(res, 200, { ok: true, text: buf.toString('utf8'), truncated: start > 0 });
      }
      return send(res, 404, { ok: false });
    }
    if (req.method === 'POST') {
      if (req.headers['x-sc'] !== '1') return send(res, 403, { ok: false }); // 다른 사이트에서 오는 요청 차단
      const body = await readBody(req);
      if (url.pathname === '/api/run') return send(res, 200, startRoutine(body.routine));
      if (url.pathname === '/api/stop') return send(res, 200, stopRoutine(body.routine));
      if (url.pathname === '/api/feedback') return send(res, 200, addFeedback(body.source, body.text));
      if (url.pathname === '/api/feedback/remove') return send(res, 200, removeFeedback(Number(body.index)));
      if (url.pathname === '/api/schedule') return send(res, 200, await setSchedule(Boolean(body.on)));
      if (url.pathname === '/api/pull') return send(res, 200, await pull());
      if (url.pathname === '/api/install') return send(res, 200, await installAgent());
      if (url.pathname === '/api/open') return send(res, 200, openTarget(body.target, body.arg));
      if (url.pathname === '/api/quit') { send(res, 200, { ok: true }); setTimeout(() => process.exit(0), 200); return; }
      return send(res, 404, { ok: false });
    }
    send(res, 405, { ok: false });
  } catch (e) {
    send(res, 500, { ok: false, msg: String(e.message || e) });
  }
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `포트 ${PORT} 사용 중 — 이미 열려 있을 수 있습니다` : e); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => console.log(`싹싹 클린 운영센터: http://127.0.0.1:${PORT}`));
