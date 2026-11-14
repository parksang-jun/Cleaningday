#!/usr/bin/env node
// 싹싹 클린 운영센터 — 로컬 관리 화면 서버 (의존성 없음, 이 맥에서만 열림: 127.0.0.1)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { diagnose, toText } from './diagnose.mjs';

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
const STARTED = Date.now();
const uiVersion = () => { try { return `${STARTED}:${fs.statSync(path.join(HERE, 'index.html')).mtimeMs}`; } catch { return String(STARTED); } };

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
  process.env.GIT_OPTIONAL_LOCKS = '0'; // 상태 확인용 git 이 잠금 파일을 만들지 않게 (에이전트의 git 과 충돌 방지)
})();

const ROUTINES = {
  A: { name: '주간 운영 점검', desc: '앱 상태·리뷰·지표 확인, 백로그 1건 개선(PR)', label: 'weekly', when: '매주 월 09:43', cal: { weekday: 1, hour: 9, minute: 43 } },
  B: { name: '광고주 발굴', desc: '스폰서 후보 조사, 제안 메일 초안 작성(발송 안 함)', label: 'sponsors', when: '매주 수 10:17', cal: { weekday: 3, hour: 10, minute: 17 } },
  D: { name: '제품 개선', desc: '피드백 수집·분류 → 우선순위 → 수정(PR) → 효과 확인', label: 'improve', when: '매주 화·금 10:31', cal: { weekdays: [2, 5], hour: 10, minute: 31 } },
  E: { name: '광고 제작·배포', desc: '우리 게임 광고 소재 제작, 게시·캠페인 준비, 성과 관리(게시·집행은 사장님)', label: 'ads', when: '매주 목 10:23', cal: { weekday: 4, hour: 10, minute: 23 } },
  C: { name: '월간 정산', desc: '광고·제휴 수익 대사, 미수금 정리(지급 안 함)', label: 'settlement', when: '매월 3일 10:12', cal: { day: 3, hour: 10, minute: 12 } },
};
const extAllowed = new Set(); // 결재 요청서에 실린 외부 링크
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
const diagCache = new Map(); // file → { mtime, d }
function diagOf(file) {
  try {
    const p = path.join(LOGS, file); const st = fs.statSync(p); const c = diagCache.get(file);
    if (c && c.mtime === st.mtimeMs) return c.d;
    const d = diagnose(fs.readFileSync(p, 'utf8')); delete d.clean;
    diagCache.set(file, { mtime: st.mtimeMs, d }); return d;
  } catch { return { state: 'unknown', primary: null, findings: [] }; }
}
const outcome = (file) => diagOf(file).state;

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
    const running = exists(path.join(HOME_DIR, `.lock-${k}`)) || children.has(k);
    let last = null;
    if (logs[0]) {
      const d = diagOf(logs[0]);
      last = { file: logs[0], at: fs.statSync(path.join(LOGS, logs[0])).mtime.toISOString(), result: running ? 'running' : d.state, problem: !running && d.state === 'fail' ? d.primary : null, notes: d.findings.filter((f) => f.level !== 'fatal').map((f) => ({ id: f.id, title: f.title, action: f.action })) };
    }
    routines[k] = { ...r, scheduled: exists(path.join(LAUNCH, `${label}.plist`)) && ll.includes(label), plist: exists(path.join(LAUNCH, `${label}.plist`)), next: nextRun(r.cal), last, running, runs: logs.length };
  }
  return { now: new Date().toISOString(), host: os.hostname(), tools: { git: gitBin, node: nodeBin, claude: claudeBin, gh: ghBin }, repo, runner: exists(runner) ? runner : null, homeDir: HOME_DIR, routines, links: { repo: REPO_URL, game: GAME_URL }, sync: syncState, github: gh, update: { restartNeeded }, ui: uiVersion() };
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
  const [pipeline, ledger, backlog, log, feedback, improvements, approvalsRaw, creatives, campaigns] = await Promise.all(['state/pipeline.csv', 'state/ledger.csv', 'state/backlog.md', 'state/log.md', 'state/feedback.csv', 'state/improvements.md', 'state/approvals.json', 'state/creatives.csv', 'state/campaigns.csv'].map((f) => readAt(ref, f)));
  let approvals = []; try { approvals = JSON.parse(approvalsRaw).items || []; } catch {}
  const decided = readDecided();
  approvals = approvals.map((a) => ({ ...a, my: decided[a.id] || null }));
  extAllowed.clear(); for (const a of approvals) for (const l of a.links || []) if (typeof l.url === 'string') extAllowed.add(l.url);
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
  // 이미 main 에 합쳐진 브랜치는 '올리기 대기'에서 뺀다 — 남겨 두면 GitHub 에서 비교할 것이 없어 버튼이 눌리지 않는다
  const merged = new Set();
  for (const base of ['origin/main', 'main']) {
    const m = await git(['branch', '-a', '--merged', base, '--format=%(refname:short)']);
    if (m.code === 0) m.out.split('\n').forEach((l) => l.trim() && merged.add(l.trim().replace(/^origin\//, '')));
  }
  const pending = all.filter((x) => x.name.startsWith('agent/') && !merged.has(x.name));
  return {
    source: { ref, name: latest ? latest.name : 'main', date: latest?.date, isMain: !latest || latest.name === 'main', mainDate: main?.date },
    pipeline: parseCsv(pipeline), ledger: parseCsv(ledger), feedback: parseCsv(feedback), improvements, inbox: readInbox(), approvals, backlog, log, reports, pending, ads: adsConfig(),
    creatives: parseCsv(creatives), campaigns: parseCsv(campaigns),
  };
}

// ---- 광고 설정: 실제 AdMob ID 가 들어갔는지. 테스트 ID 인 채로 출시하면 수익이 0원이라 눈에 보이게 둔다
const TEST_PUB = '3940256099942544';
function adsConfig() {
  const read = (rel) => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { return ''; } };
  const src = read('src/ads/admob.ts');
  // REAL_IDS 선언 안쪽만 잘라낸다 (TEST_IDS 에도 같은 키가 있다)
  const real = (src.split('const REAL_IDS')[1] || '').split('\n};')[0];
  const units = (platform) => {
    const at = real.indexOf(`${platform}:`);
    if (at < 0) return [];
    const chunk = real.slice(at, at + 400);
    if (/^\s*\w+:\s*null/.test(chunk)) return [];
    return [...chunk.split(/\n\s*\},/)[0].matchAll(/(interstitial|rewarded|banner):\s*'([^']+)'/g)].map((m) => ({ kind: m[1], id: m[2] }));
  };
  const plist = read('ios/App/App/Info.plist');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const appId = (txt, re) => { const m = txt.match(re); return m ? m[1] : ''; };
  const one = (name, app, list) => {
    const real = Boolean(app) && !app.includes(TEST_PUB) && list.length > 0 && !list.some((u) => u.id.includes(TEST_PUB));
    return { name, app, units: list, real, missing: !app ? '앱 ID 없음' : app.includes(TEST_PUB) ? '앱 ID 가 구글 테스트용' : list.length === 0 ? '광고 단위 ID 미등록' : '' };
  };
  return [
    one('iOS', appId(plist, /<key>GADApplicationIdentifier<\/key>\s*<string>([^<]+)<\/string>/), units('ios')),
    one('Android', appId(manifest, /android:value="(ca-app-pub-[^"]+)"/), units('android')),
  ];
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

// ---- 결재: 사장님의 결정을 기록해 두었다가 다음 에이전트 실행 때 넘긴다 (~/SparkleCleanOps/decisions/)
const DC_DIR = path.join(HOME_DIR, 'decisions');
const DC_INBOX = path.join(DC_DIR, 'inbox.md');
const DC_FILE = path.join(DC_DIR, 'decided.json');
function readDecided() { try { return JSON.parse(fs.readFileSync(DC_FILE, 'utf8')); } catch { return {}; } }
function decide({ id, decision, label, memo, title }) {
  if (typeof id !== 'string' || !/^[\w\-]{1,80}$/.test(id)) return { ok: false, msg: '알 수 없는 항목' };
  if (typeof decision !== 'string' || !/^[\w\-]{1,40}$/.test(decision)) return { ok: false, msg: '결정 값이 올바르지 않습니다' };
  const clean = (v, n) => String(v || '').replace(/\r/g, '').trim().slice(0, n);
  memo = clean(memo, 2000); label = clean(label, 120).replace(/\n/g, ' '); title = clean(title, 160).replace(/\n/g, ' ');
  if (/\b\d{6}-?[1-4]\d{6}\b/.test(memo)) return { ok: false, msg: '주민등록번호처럼 보이는 숫자가 있습니다. 개인 식별 번호·비밀번호·계좌·카드 번호는 적지 마세요.' };
  fs.mkdirSync(DC_DIR, { recursive: true });
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  const at = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const all = readDecided(); all[id] = { decision, label, memo, at, iso: d.toISOString() };
  fs.writeFileSync(DC_FILE, JSON.stringify(all, null, 2));
  fs.appendFileSync(DC_INBOX, `## ${id}\n- 항목: ${title}\n- 결정: ${decision} (${label})\n- 시각: ${at}\n- 메모: ${memo ? memo.replace(/\n/g, '\n  ') : '(없음)'}\n\n`);
  return { ok: true, msg: '결재를 기록했습니다 — 다음 에이전트 실행 때 반영됩니다' };
}
function undecide(id) {
  const all = readDecided(); if (!all[id]) return { ok: false, msg: '기록이 없습니다' };
  let txt = ''; try { txt = fs.readFileSync(DC_INBOX, 'utf8'); } catch {}
  const blocks = txt.split(/^(?=## )/m); const kept = blocks.filter((b) => !b.startsWith(`## ${id}\n`));
  if (kept.length === blocks.length) return { ok: false, msg: '이미 에이전트가 가져가 처리 중입니다. 바꾸려면 다시 결재해 주세요.' };
  fs.writeFileSync(DC_INBOX, kept.join('')); delete all[id]; fs.writeFileSync(DC_FILE, JSON.stringify(all, null, 2));
  return { ok: true, msg: '결재를 취소했습니다' };
}
async function prAction(number, action, memo) {
  number = Number(number); if (!Number.isInteger(number) || number <= 0) return { ok: false, msg: '알 수 없는 변경안' };
  if (!(await which('gh'))) return { ok: false, msg: '이 맥에 GitHub 도구가 없어 여기서 바로 처리할 수 없습니다. "GitHub에서 내용 보기"를 눌러 열린 페이지 아래쪽의 초록색 "Merge pull request" → "Confirm merge" 를 누르면 승인됩니다. (설정에서 "GitHub 로그인"을 해 두면 다음부터 이 버튼으로 됩니다.)' };
  const base = ['-R', 'parksang-jun/Cleaningday'];
  const r = action === 'merge'
    ? await run('gh', ['pr', 'merge', String(number), ...base, '--merge', '--delete-branch'], { timeout: 60000, cwd: REPO })
    : await run('gh', ['pr', 'close', String(number), ...base, '--comment', `반려: ${String(memo || '사유 미기재').slice(0, 1000)}`], { timeout: 60000, cwd: REPO });
  if (!r.ok) {
    const e = r.err.trim();
    const why = /auth|logged|401|403/i.test(e) ? 'GitHub 로그인이 필요합니다 — 설정에서 "GitHub 로그인"을 누른 뒤 다시 시도하세요.' : /not mergeable|conflict/i.test(e) ? '다른 변경과 충돌해 바로 병합할 수 없습니다. "제품 개선"을 한 번 실행하면 에이전트가 충돌을 정리해 다시 올립니다.' : /checks|required/i.test(e) ? '자동 검사가 아직 끝나지 않았거나 실패했습니다. 검사 통과 후 다시 시도하세요.' : e.slice(0, 200);
    return { ok: false, msg: `처리하지 못했습니다: ${why}` };
  }
  await Promise.all([syncRepo(), syncGithub()]);
  return { ok: true, msg: action === 'merge' ? `변경안 #${number} 을 승인(병합)했습니다. 이 맥에도 반영했습니다.` : `변경안 #${number} 을 반려했습니다.` };
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
  try { fs.rmSync(path.join(HOME_DIR, `.lock-${k}`), { recursive: true, force: true }); } catch {}
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
// ---- GitHub 연동: 5분마다 받아 오고(fetch) main 을 최신으로 맞춘다. PR·자동 검사 상태는 GitHub API 에서 읽는다
const SYNC_MS = 5 * 60 * 1000;
let syncState = { at: null, ok: null, msg: '아직 동기화 전', pushOk: null, pushAt: 0, busy: false };
let gh = { at: null, ok: null, prs: [], ci: null, issues: 0, msg: '', commands: [], authed: false, private: false };
const replyCache = new Map();
let ghAuthCache = { at: 0, ok: false };
async function ghAuthed() {
  if (Date.now() - ghAuthCache.at < 60000) return ghAuthCache.ok;
  const ok = Boolean(await which('gh')) && (await run('gh', ['auth', 'status', '-h', 'github.com'], { timeout: 10000 })).ok;
  ghAuthCache = { at: Date.now(), ok }; return ok;
}
let restartNeeded = false;
const anyRunning = () => children.size > 0 || Object.keys(ROUTINES).some((k) => exists(path.join(HOME_DIR, `.lock-${k}`)));

async function syncRepo(manual = false) {
  if (!exists(path.join(REPO, '.git'))) { syncState = { ...syncState, at: new Date().toISOString(), ok: false, msg: '저장소가 없습니다 — 설정에서 "다시 설치·복구"' }; return syncState; }
  if (syncState.busy) return syncState;
  syncState.busy = true;
  try {
    const f = await git(['fetch', '-q', '--prune', 'origin'], 60000);
    if (!f.ok) {
      const offline = /Could not resolve host|unable to access|timed out|Network/i.test(f.err);
      syncState = { ...syncState, at: new Date().toISOString(), ok: false, msg: offline ? 'GitHub 에 연결하지 못했습니다(인터넷 확인) — 5분 뒤 자동으로 다시 시도합니다' : `받기 실패: ${f.err.trim().slice(0, 160)}` };
      return syncState;
    }
    let msg = 'GitHub 와 같은 상태입니다';
    if (!anyRunning()) { // 에이전트가 일하는 중에는 작업 폴더를 건드리지 않는다
      const br = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).out.trim();
      const dirty = (await git(['status', '--porcelain', '--untracked-files=no'])).out.trim();
      const behind = Number((await git(['rev-list', '--count', 'main..origin/main'])).out.trim() || 0);
      if (behind > 0) {
        if (dirty) msg = `GitHub 에 새 내용 ${behind}건이 있지만, 이 맥에 저장 안 된 변경이 있어 덮어쓰지 않았습니다`;
        else {
          if (br !== 'main') await git(['checkout', '-q', 'main']);
          const m = await git(['merge', '--ff-only', '-q', 'origin/main'], 60000);
          msg = m.ok ? `GitHub 의 새 내용 ${behind}건을 받았습니다` : `최신으로 맞추지 못했습니다: ${m.err.trim().slice(0, 120)}`;
          if (m.ok) selfUpdate();
        }
      }
      if (behind === 0) selfUpdate();
    } else msg = '에이전트 작업 중 — 받아 오기만 했습니다';
    // 올리기 권한은 30분에 한 번만 확인
    let { pushOk, pushAt } = syncState;
    if (manual || Date.now() - pushAt > 30 * 60 * 1000) {
      const p = await run('git', ['-C', REPO, 'push', '--dry-run', '-q', 'origin', 'HEAD:refs/heads/agent/_permission-check'], { timeout: 30000 });
      pushOk = p.ok; pushAt = Date.now();
    }
    syncState = { at: new Date().toISOString(), ok: true, msg, pushOk, pushAt, busy: false };
    return syncState;
  } finally { syncState.busy = false; }
}
async function syncGithub() {
  const api = 'https://api.github.com/repos/parksang-jun/Cleaningday';
  const authed = await ghAuthed();
  const get = async (u) => {
    if (authed) { const r = await run('gh', ['api', `repos/parksang-jun/Cleaningday${u}`], { timeout: 20000 }); if (!r.ok) throw new Error(`gh api: ${r.err.slice(0, 80)}`); return JSON.parse(r.out); }
    const r = await fetch(api + u, { headers: { 'User-Agent': 'sparkle-clean-console', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(`GitHub API ${r.status}`); return r.json();
  };
  try {
    const [prs, runs, repo, cmds] = await Promise.all([get('/pulls?state=open&per_page=30'), get('/actions/runs?branch=main&per_page=1'), get(''), get('/issues?labels=command&state=all&per_page=15&sort=created&direction=desc')]);
    // 명령(이슈)마다 에이전트의 마지막 답글 — 바뀐 것만 다시 읽는다
    const commands = [];
    for (const c of cmds.filter((x) => !x.pull_request)) {
      const key = `${c.number}:${c.updated_at}`; let reply = replyCache.get(key);
      if (reply === undefined) {
        reply = null;
        if (c.comments > 0) { try { const cs = await get(`/issues/${c.number}/comments?per_page=100`); const last = cs[cs.length - 1]; reply = last ? { body: String(last.body || '').slice(0, 4000), at: last.created_at } : null; } catch {} }
        replyCache.set(key, reply);
      }
      commands.push({ number: c.number, text: String(c.body || c.title || '').slice(0, 2000), state: c.state, at: c.created_at, updated: c.updated_at, url: c.html_url, by: c.user?.login, reply });
    }
    const r0 = runs.workflow_runs?.[0];
    gh = {
      at: new Date().toISOString(), ok: true, msg: '',
      prs: prs.map((p) => ({ number: p.number, title: p.title, url: p.html_url, branch: p.head?.ref, at: p.created_at, draft: p.draft, body: String(p.body || '').slice(0, 1500), files: p.changed_files })),
      ci: r0 ? { status: r0.status, conclusion: r0.conclusion, url: r0.html_url, sha: (r0.head_sha || '').slice(0, 7), title: r0.display_title, at: r0.updated_at } : null,
      issues: Math.max(0, (repo.open_issues_count || 0) - prs.length - commands.filter((c) => c.state === 'open').length),
      commands, authed, private: Boolean(repo.private),
    };
  } catch (e) { gh = { ...gh, at: new Date().toISOString(), ok: false, msg: /403|429/.test(String(e.message)) ? 'GitHub 조회 한도 — 잠시 뒤 자동으로 다시 읽습니다' : 'GitHub 상태를 읽지 못했습니다(인터넷 확인)' }; }
  return gh;
}
// 저장소에 운영센터·실행기의 새 버전이 들어왔으면 설치본을 스스로 갱신한다
function selfUpdate() {
  const src = path.join(AGENT, 'mac'); const installed = path.join(HOME_DIR, 'console');
  if (path.resolve(HERE) !== path.resolve(installed)) return; // 저장소에서 직접 실행 중(개발)
  try { if (!/refs\/heads\/main\s*$/.test(fs.readFileSync(path.join(REPO, '.git', 'HEAD'), 'utf8'))) return; } catch { return; } // main 일 때만
  const same = (a, b) => { try { return fs.readFileSync(a).equals(fs.readFileSync(b)); } catch { return false; } };
  try {
    let rebuild = false;
    for (const f of ['index.html', 'diagnose.mjs', 'icon.png', 'launch.sh', 'install-app.sh', 'server.mjs']) {
      const from = path.join(src, 'console', f); if (!exists(from) || same(from, path.join(installed, f))) continue;
      const tmp = path.join(installed, `.${f}.new`); fs.copyFileSync(from, tmp); fs.renameSync(tmp, path.join(installed, f)); // 한 번에 교체
      if (f === 'server.mjs' || f === 'diagnose.mjs') restartNeeded = true;
      if (f === 'install-app.sh') rebuild = true;
      if (f === 'launch.sh') fs.chmodSync(path.join(installed, f), 0o755);
    }
    // 바탕화면 앱 자체가 바뀌었으면 다시 만든다 (터미널 없이)
    if (rebuild) run('/bin/bash', [path.join(installed, 'install-app.sh')], { timeout: 120000, env: { ...process.env, SC_FROM_CONSOLE: '1' } }).then((r) => { try { fs.appendFileSync(path.join(LOGS, 'console.log'), `${new Date().toISOString()} 앱 다시 만들기: ${r.ok ? '완료' : r.err.slice(0, 200)}\n`); } catch {} });
    const runner = path.join(src, 'run-routine.sh');
    if (exists(runner) && !same(runner, path.join(HOME_DIR, 'run-routine.sh'))) { fs.copyFileSync(runner, path.join(HOME_DIR, 'run-routine.sh')); fs.chmodSync(path.join(HOME_DIR, 'run-routine.sh'), 0o755); }
  } catch {}
  if (restartNeeded && !anyRunning()) setTimeout(restartSelf, 1500); // 새 서버로 교체 (화면은 자동으로 다시 연결됨)
}
function restartSelf() {
  try { spawn('/bin/sh', ['-c', `sleep 1; exec node "${path.join(HERE, 'server.mjs')}" >> "${path.join(LOGS, 'console.log')}" 2>&1`], { detached: true, stdio: 'ignore', env: process.env }).unref(); } catch {}
  setTimeout(() => process.exit(0), 100);
}
async function pull() {
  const [s] = await Promise.all([syncRepo(true), syncGithub()]);
  return { ok: Boolean(s.ok), msg: s.msg };
}
setTimeout(() => { syncRepo(); syncGithub(); }, 500);
setInterval(() => { syncRepo(); syncGithub(); }, SYNC_MS).unref();

// ---- 명령: 사장님이 적은 지시를 (1) 클라우드 에이전트에게 보내거나(GitHub 이슈 → 어느 기기에서나 확인) (2) 이 맥에서 바로 실행한다
const CMD_DIR = path.join(HOME_DIR, 'commands');
async function sendCommand(text, where) {
  text = String(text || '').replace(/\r/g, '').trim();
  if (!text) return { ok: false, msg: '명령을 적어 주세요' };
  if (text.length > 3000) return { ok: false, msg: '너무 깁니다 (3,000자 이내)' };
  if (where === 'local') {
    if (children.has('X') || exists(path.join(HOME_DIR, '.lock-X'))) return { ok: false, msg: '앞선 명령을 아직 처리 중입니다 — 끝난 뒤 다시 보내 주세요' };
    const runner = exists(path.join(HOME_DIR, 'run-routine.sh')) ? path.join(HOME_DIR, 'run-routine.sh') : path.join(AGENT, 'mac', 'run-routine.sh');
    if (!exists(runner)) return { ok: false, msg: '실행 스크립트가 없습니다 — 설정에서 "다시 설치·복구"를 먼저 하세요' };
    fs.mkdirSync(CMD_DIR, { recursive: true }); fs.mkdirSync(LOGS, { recursive: true });
    const f = path.join(CMD_DIR, `cmd-${Date.now()}.txt`); fs.writeFileSync(f, text);
    const child = spawn('/bin/bash', [runner, 'X', f], { detached: true, stdio: 'ignore', env: process.env });
    children.set('X', child); child.on('exit', () => children.delete('X')); child.unref();
    return { ok: true, msg: '이 맥에서 바로 실행을 시작했습니다 — 아래 목록에서 진행과 결과를 볼 수 있습니다' };
  }
  const title = `[명령] ${text.split('\n')[0].slice(0, 60)}`;
  if (await ghAuthed()) {
    const r = await run('gh', ['issue', 'create', '-R', 'parksang-jun/Cleaningday', '--title', title, '--body', text, '--label', 'command'], { timeout: 30000 });
    if (r.ok) { setTimeout(syncGithub, 1500); return { ok: true, msg: '클라우드 에이전트에게 보냈습니다 — 매시 정각 무렵 확인해 처리하고 여기에 답을 답니다' }; }
    return { ok: false, msg: `보내지 못했습니다: ${r.err.trim().slice(0, 160)}` };
  }
  // GitHub 로그인이 없으면 브라우저에 내용이 채워진 등록 화면을 연다 (초록 버튼만 누르면 됨)
  const u = `${REPO_URL}/issues/new?labels=command&title=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
  spawn('open', [u], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  return { ok: true, msg: '브라우저에 등록 화면을 열었습니다 — 맨 아래 초록색 버튼(Create / Submit new issue)을 누르면 전송됩니다.\n(설정에서 "GitHub 로그인"을 해 두면 다음부터 이 단계 없이 바로 보내집니다)' };
}
function localCommands() {
  let files = []; try { files = fs.readdirSync(LOGS).filter((f) => /^routine-X-.*\.log$/.test(f)).sort().reverse().slice(0, 10); } catch {}
  return files.map((f) => {
    let txt = ''; try { txt = fs.readFileSync(path.join(LOGS, f), 'utf8'); } catch {}
    const d = diagOf(f); const m = txt.match(/^=== 명령 ===\n([\s\S]*?)\n=== 명령 끝 ===\n?/);
    const body = txt.replace(/^=== 명령 ===\n[\s\S]*?\n=== 명령 끝 ===\n?/, '').replace(/\n=== 종료 코드[\s\S]*$/, '').split('\n').filter((l) => !/^\((자동 조치|경고)\)|^Ignoring --allowedTools|index\.lock|Another git process/.test(l)).join('\n').trim();
    const ended = /=== 종료 코드 \d+ ===/.test(txt);
    const running = !ended && (children.has('X') || exists(path.join(HOME_DIR, '.lock-X'))) && f === files[0];
    return { file: f, text: m ? m[1] : '', at: fs.statSync(path.join(LOGS, f)).birthtime.toISOString(), state: running ? 'running' : ended ? d.state : 'fail', reply: running ? '' : body.slice(-4000), problem: d.state === 'fail' ? d.primary : null };
  });
}

// 터미널에서 해야 하는 로그인(브라우저 인증)을 버튼 하나로 열어 준다
function openTerminalScript(name, body) {
  const f = path.join(HOME_DIR, name);
  fs.writeFileSync(f, `#!/bin/bash\n[ -f "$HOME/SparkleCleanOps/env.sh" ] && . "$HOME/SparkleCleanOps/env.sh"\nexport PATH="$PATH:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin"\nclear\n${body}\n`);
  fs.chmodSync(f, 0o755);
  spawn('open', ['-a', 'Terminal', f], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}
function loginClaude() {
  openTerminalScript('login-claude.command', `cd "$HOME/SparkleCleanOps/Cleaningday" 2>/dev/null || cd "$HOME/SparkleCleanOps" 2>/dev/null\necho "── 싹싹 클린 운영센터: Claude 로그인 ──"\necho "0) 폴더를 믿느냐고 물으면(Yes, I trust this folder) 아래 화살표로 Yes 를 고르고 Enter — 사장님의 게임 폴더입니다."\necho "1) Claude 가 열리면  /login  을 입력하고 Enter."\necho "2) 로그인 방법을 물으면 첫 번째  Claude account with subscription (구독 계정)  을 고르세요."\necho "   ※ 두 번째 Anthropic Console account (API 결제) 는 고르지 마세요 — 잔액이 없으면 에이전트가 멈춥니다."\necho "3) 브라우저에서 평소 쓰는 Claude 계정으로 로그인합니다."\necho "4) 끝나면  /exit  로 나가고 이 창을 닫은 뒤, 운영센터에서 '다시 실행'."\necho\nclaude`);
  return { ok: true, msg: '터미널을 열었습니다 — 안내대로 구독 계정으로 로그인한 뒤 "다시 실행"을 눌러 주세요' };
}
async function loginGithub() {
  const hasGh = await which('gh');
  const hasBrew = await which('brew');
  if (hasGh) openTerminalScript('login-github.command', `echo "── 싹싹 클린 운영센터: GitHub 로그인 ──"\necho "질문이 나오면: GitHub.com → HTTPS → Yes → Login with a web browser 순서로 고르세요."\necho\ngh auth login -h github.com -p https -w && gh auth setup-git && echo && echo "✅ 완료 — 이 창을 닫아도 됩니다."`);
  else if (hasBrew) openTerminalScript('login-github.command', `echo "── GitHub 도구(gh) 설치 후 로그인 ──"\nbrew install gh && gh auth login -h github.com -p https -w && gh auth setup-git && echo && echo "✅ 완료 — 이 창을 닫아도 됩니다."`);
  else return { ok: false, msg: 'GitHub 도구(gh)가 없습니다. https://cli.github.com 에서 설치(macOS .pkg)한 뒤 이 버튼을 다시 눌러 주세요.' };
  syncState.pushAt = 0;
  return { ok: true, msg: '터미널을 열었습니다 — 브라우저에서 GitHub 로그인을 마치면 자동으로 반영됩니다' };
}
function openTarget(t, arg) {
  const map = {
    repo: REPO_URL, game: GAME_URL, pulls: `${REPO_URL}/pulls`, actions: `${REPO_URL}/actions`,
    reports: path.join(AGENT, 'reports'), logs: LOGS, folder: HOME_DIR,
  };
  let target = map[t];
  if (t === 'url' && typeof arg === 'string' && arg.startsWith(`${REPO_URL}/`) && !/[\s"'<>]/.test(arg)) target = arg;
  if (t === 'branch' && typeof arg === 'string' && /^agent\/[\w\-./]+$/.test(arg)) target = `${REPO_URL}/compare/main...${encodeURIComponent(arg).replace(/%2F/g, '/')}?expand=1`;
  // 결재 요청서에 적힌 공식 페이지 (요청서에 실제로 있는 주소만 연다)
  if (t === 'ext' && typeof arg === 'string' && /^https:\/\/[\w.\-]+(\/[^\s"'<>]*)?$/.test(arg) && extAllowed.has(arg)) target = arg;
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
      if (url.pathname === '/api/commands') return send(res, 200, { ok: true, cloud: gh.commands || [], local: localCommands(), authed: gh.authed, private: gh.private, synced: gh.at });
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
        const d = f.startsWith('routine-') ? diagOf(f) : null;
        return send(res, 200, { ok: true, text: buf.toString('utf8').replace(/\n=== 진단 ===[\s\S]*$/, ''), truncated: start > 0, diag: d });
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
      if (url.pathname === '/api/command') return send(res, 200, await sendCommand(body.text, body.where === 'local' ? 'local' : 'cloud'));
      if (url.pathname === '/api/decide') return send(res, 200, decide(body));
      if (url.pathname === '/api/undecide') return send(res, 200, undecide(String(body.id || '')));
      if (url.pathname === '/api/pr') return send(res, 200, await prAction(body.number, body.action === 'merge' ? 'merge' : 'close', body.memo));
      if (url.pathname === '/api/login') return send(res, 200, loginClaude());
      if (url.pathname === '/api/gh-login') return send(res, 200, await loginGithub());
      if (url.pathname === '/api/restart') { send(res, 200, { ok: true, msg: '새 버전으로 다시 시작합니다' }); restartSelf(); return; }
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
