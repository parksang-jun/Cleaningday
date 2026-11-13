#!/usr/bin/env node
// 실행 기록(로그)을 읽고 "무엇이 문제였는지 / 어떻게 해결하는지"를 한국어로 진단한다.
// 운영센터 서버와 실행기(run-routine.sh)가 같이 쓴다.
//   node diagnose.mjs <log>            → 사람이 읽는 진단문
//   node diagnose.mjs --title <log>    → 알림용 한 줄
//   node diagnose.mjs --retry <log>    → 잠깐 뒤 다시 하면 풀릴 문제면 종료 코드 0
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// level: fatal(이것 때문에 실패) · warn(일부 기능 제한) · info(참고)
// action: 운영센터가 버튼으로 바로 해 줄 수 있는 조치
const RULES = [
  {
    id: 'login', level: 'fatal', action: 'login',
    test: /Not logged in|Please run \/login|Invalid API key|OAuth token (has )?expired|authentication_error|401 Unauthorized/i,
    title: 'Claude 로그인이 필요합니다',
    cause: '이 맥의 Claude Code 가 로그인되어 있지 않아(또는 로그인이 만료되어) 에이전트가 일을 시작하지 못했습니다.',
    fix: '운영센터에서 "Claude 로그인" 버튼을 누르면 터미널이 열립니다 → 안내대로 브라우저에서 로그인 → 로그인이 끝나면 "다시 실행". 한 번만 하면 이후 예약 실행에도 적용됩니다.',
  },
  {
    id: 'credit', level: 'fatal', action: 'login',
    test: /Credit balance is too low|insufficient credits?|billing.*(issue|problem)|purchase credits/i,
    title: 'Claude 가 "API 결제 계정"으로 로그인되어 있고 잔액이 없습니다',
    cause: '이 맥의 Claude Code 가 구독(Pro·Max) 계정이 아니라, 쓴 만큼 돈을 내는 API 계정(Anthropic Console)으로 로그인되어 있습니다. 그 계정에 충전된 금액이 없어 에이전트가 시작하자마자 멈췄습니다.',
    fix: '"Claude 로그인" 버튼 → 터미널에서 /login 입력 → 첫 번째 "Claude account with subscription"(구독 계정)을 고르고 평소 쓰는 Claude 계정으로 로그인 → /exit → "다시 실행". (API 계정에 돈을 충전하는 방법도 있지만 권하지 않습니다 — 구독으로 충분합니다.)',
  },
  {
    id: 'no-claude', level: 'fatal', action: 'none',
    test: /claude: command not found|claude: No such file|command not found: claude/i,
    title: 'Claude Code 가 설치되어 있지 않습니다',
    cause: '에이전트를 실제로 움직이는 프로그램(Claude Code)을 이 맥에서 찾지 못했습니다.',
    fix: '터미널에 붙여넣기:  curl -fsSL https://claude.ai/install.sh | bash  → 설치 후 운영센터 설정에서 "다시 설치·복구".',
  },
  {
    id: 'usage', level: 'fatal', retry: false, action: 'none',
    test: /usage limit|limit reached|rate_limit_error|out of (extra )?usage|429 Too Many/i,
    title: 'Claude 사용량 한도에 걸렸습니다',
    cause: '이 계정의 Claude 사용량이 한도에 도달해 에이전트가 중간에 멈췄습니다.',
    fix: '한도가 풀린 뒤(보통 몇 시간 안) "다시 실행"을 누르거나, 다음 예약 실행을 기다리면 됩니다. 자주 걸리면 예약 횟수를 줄이는 것을 권합니다.',
  },
  {
    id: 'network', level: 'fatal', retry: true, action: 'retry',
    test: /Could not resolve host|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|Network is unreachable|Connection (timed out|refused)|fetch failed|overloaded_error|503 Service|529/i,
    title: '인터넷 연결(또는 서버)이 잠깐 불안정했습니다',
    cause: '실행 중 네트워크 연결이 끊겼거나 Claude·GitHub 서버가 일시적으로 응답하지 않았습니다.',
    fix: '자동으로 한 번 더 시도합니다. 계속되면 맥의 인터넷 연결을 확인한 뒤 "다시 실행".',
  },
  {
    id: 'no-repo', level: 'fatal', action: 'install',
    test: /저장소가 없습니다|not a git repository|No such file or directory.*Cleaningday/i,
    title: '게임 저장소가 이 맥에 없습니다',
    cause: '에이전트가 작업할 게임 소스 폴더(~/SparkleCleanOps/Cleaningday)를 찾지 못했습니다.',
    fix: '운영센터 설정에서 "다시 설치·복구"를 누르면 GitHub 에서 다시 받습니다.',
  },
  {
    id: 'max-turns', level: 'fatal', retry: false, action: 'retry',
    test: /Reached max turns|max.?turns/i,
    title: '작업이 너무 길어 중간에 멈췄습니다',
    cause: '한 번에 할 수 있는 작업량을 넘었습니다. 중간 결과는 브랜치에 남아 있을 수 있습니다.',
    fix: '"다시 실행"하면 남은 부분부터 이어서 합니다.',
  },
  {
    id: 'queue-timeout', level: 'fatal', action: 'retry',
    test: /앞선 작업이 90분 넘게 끝나지 않아/,
    title: '앞선 작업이 너무 오래 걸려 이번 실행을 건너뛰었습니다',
    cause: '에이전트는 한 번에 한 작업만 합니다. 먼저 시작한 작업이 90분 넘게 끝나지 않아 이 작업은 시작하지 못했습니다.',
    fix: '실행 기록에서 먼저 돌던 작업이 끝났는지 확인한 뒤 "다시 실행"을 누르세요.',
  },
  {
    id: 'git-lock', level: 'warn', retry: true, action: 'none',
    test: /index\.lock|Another git process seems to be running/i,
    title: '다른 git 작업과 잠깐 겹쳤습니다',
    cause: '저장소를 최신으로 받는 순간 다른 작업(운영센터의 상태 확인 등)이 같은 저장소를 쓰고 있었습니다.',
    fix: '자동으로 해결합니다: 잠금이 풀릴 때까지 기다리고, 주인이 없는 잠금 파일은 지운 뒤 다시 시도합니다.',
    auto: true,
  },
  {
    id: 'push', level: 'warn', action: 'gh-login',
    test: /could not read Username|Authentication failed for 'https:\/\/github|Permission to .* denied|remote: Permission|fatal: unable to access 'https:\/\/github|gh auth login/i,
    title: 'GitHub 에 올릴 권한이 없습니다',
    cause: '이 맥이 GitHub 에 로그인되어 있지 않아 에이전트가 만든 변경을 GitHub 에 올리지 못했습니다(작업 결과는 이 맥에만 남아 있음).',
    fix: '운영센터 설정에서 "GitHub 로그인" 버튼 → 터미널 안내대로 로그인. 이후 실행부터 자동으로 올라갑니다.',
  },
  {
    id: 'stash', level: 'info', action: 'none',
    test: /저장 안 된 변경을 임시 보관/,
    title: '이 맥의 저장 안 된 변경을 임시 보관했습니다',
    cause: '저장소 폴더에 저장(커밋)되지 않은 변경이 있어 GitHub 최신 내용을 받을 수 없었습니다.',
    fix: '자동으로 해결했습니다: 변경을 지우지 않고 임시 보관함(git stash)에 넣은 뒤 최신으로 맞췄습니다. 필요한 내용이었다면 Claude 에게 "stash 되살려줘"라고 하세요.',
    auto: true,
  },
  {
    id: 'pull', level: 'info', action: 'none',
    test: /main 갱신 실패/,
    title: '최신 소스 받기를 건너뛰었습니다',
    cause: '실행 직전에 GitHub 최신 내용을 받지 못해, 이 맥에 있던 내용으로 진행했습니다.',
    fix: '대부분 다음 실행에서 저절로 해결됩니다. 반복되면 설정에서 "최신으로"를 눌러 보세요.',
    auto: true,
  },
  {
    id: 'tests', level: 'warn', action: 'none',
    test: /E2E FAILED|Tests? +\d+ failed|npm ERR!|error TS\d+/,
    title: '게임 자동 검사 중 실패가 있었습니다',
    cause: '에이전트가 고친 뒤 돌린 검사에서 통과하지 못한 항목이 있습니다. 통과하지 못한 변경은 올리지 않습니다.',
    fix: '보고서의 "승인 요청·남은 문제"를 확인하세요. 다음 실행에서 에이전트가 이어서 고칩니다.',
  },
];

// 참고용으로만 남기고 진단에서는 무시하는 줄
const NOISE = /^Ignoring --allowedTools rule|is not supported in allow rules|must name the scope it widens|position after a literal mcp__|wildcards anywhere\.$/;

export function diagnose(text) {
  const all = String(text || '');
  // 재시도했으면 마지막 시도만 본다
  const parts = all.split(/^=== 재시도.*===$/m);
  const last = parts[parts.length - 1];
  const exit = (all.match(/=== 종료 코드 (\d+) ===\s*(?:\n=== 진단[\s\S]*)?$/) || [])[1];
  const body = last.replace(/\n=== 진단 ===[\s\S]*$/, '').replace(/^=== 명령 ===\n[\s\S]*?\n=== 명령 끝 ===\n?/m, ''); // 사장님이 적은 명령 문장은 진단 대상이 아니다
  const lines = body.split('\n').filter((l) => !NOISE.test(l.trim()));
  const clean = lines.join('\n');
  const findings = [];
  for (const r of RULES) {
    const hit = lines.find((l) => r.test.test(l));
    if (!hit) continue;
    if (exit === '0' && r.level === 'fatal') continue; // 끝까지 마쳤으면 치명 원인은 아니었다 (보고서 본문의 단어에 걸린 것)
    const level = r.level;
    findings.push({ id: r.id, level, title: r.title, cause: r.cause, fix: r.fix, action: r.action || 'none', retry: Boolean(r.retry), auto: Boolean(r.auto), evidence: hit.trim().slice(0, 200) });
  }
  const order = { fatal: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level]);
  const failed = exit !== undefined && exit !== '0';
  let primary = findings.find((f) => f.level === 'fatal') || null;
  if (failed && !primary) {
    const tail = lines.filter((l) => l.trim() && !/^=== /.test(l)).slice(-3).join(' / ').slice(0, 300);
    primary = { id: 'unknown', level: 'fatal', title: '처음 보는 오류입니다', cause: tail ? `에이전트가 남긴 마지막 기록: ${tail}` : '기록이 비어 있습니다 — 에이전트가 시작 직후 멈춘 것으로 보입니다.', fix: '"기록 복사"를 눌러 Claude 대화창에 붙여 넣어 주세요. 원인을 찾아 고치고, 다음부터는 자동으로 진단되게 합니다. (급하면 "다시 실행")', action: 'retry', retry: false, auto: false, evidence: tail };
    findings.unshift(primary);
  }
  // 종료 코드가 아직 없는데(실행 중이거나 예전 기록) 치명 원인이 보이면 실패로 본다
  const state = exit === '0' ? 'ok' : failed || primary ? 'fail' : 'unknown';
  // 잠깐 뒤 다시 하면 풀리는가: 치명 원인이 재시도형이거나, 치명 원인 없이 재시도형 경고만 있는 실패
  const retry = failed && (primary ? primary.retry : false);
  return { state, exit: exit === undefined ? null : Number(exit), primary, findings, retry, clean };
}

export function toText(d) {
  if (!d.findings.length) return d.state === 'ok' ? '문제 없이 끝났습니다.' : '특이 사항을 찾지 못했습니다.';
  const tag = { fatal: '원인', warn: '주의', info: '참고' };
  return d.findings.map((f) => `[${tag[f.level]}] ${f.title}\n  무엇이 문제였나: ${f.cause}\n  해결 방법: ${f.fix}${f.auto ? '\n  (자동 처리 대상)' : ''}`).join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch {}
  const d = diagnose(text);
  if (args.includes('--retry')) process.exit(d.retry ? 0 : 1);
  if (args.includes('--title')) { console.log(d.primary ? d.primary.title : d.state === 'ok' ? '정상 완료' : '확인 필요'); process.exit(0); }
  if (args.includes('--json')) { console.log(JSON.stringify(d)); process.exit(0); }
  console.log(toText(d));
}
