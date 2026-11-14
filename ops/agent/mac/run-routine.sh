#!/bin/bash
# 싹싹 클린 운영 에이전트 — 루틴 1회 실행 (A 주간 점검 / B 광고주 발굴 / C 월간 정산 / D 제품 개선 / E 광고 제작·배포·관리 / X 운영센터 직접 명령)
#   bash run-routine.sh A
set -uo pipefail
export GIT_TERMINAL_PROMPT=0   # 로그인 창이 뜨면 화면 없는 실행이 멈추므로 끈다
ROUTINE="${1:-A}"
[ -f "$HOME/SparkleCleanOps/env.sh" ] && . "$HOME/SparkleCleanOps/env.sh"
REPO="${SC_REPO_DIR:-$HOME/SparkleCleanOps/Cleaningday}"
HOME_DIR="${SC_HOME_DIR:-$HOME/SparkleCleanOps}"
STAMP="$(date +%Y-%m-%d_%H%M)"
LOG="$HOME_DIR/logs/routine-$ROUTINE-$STAMP.log"
mkdir -p "$HOME_DIR/logs"

notify() { osascript -e "display notification \"$2\" with title \"싹싹 클린 운영 에이전트\" subtitle \"$1\"" >/dev/null 2>&1 || true; }

# 진단기(무엇이 문제였는지 한국어로 정리) — 운영센터와 같은 것을 쓴다
DIAG=""
for d in "$HOME_DIR/console/diagnose.mjs" "$REPO/ops/agent/mac/console/diagnose.mjs"; do [ -f "$d" ] && { DIAG="$d"; break; }; done
diag() { [ -n "$DIAG" ] && node "$DIAG" "$@" 2>/dev/null; }

# 같은 루틴이 겹쳐 돌지 않게. 예전 실행이 비정상 종료해 남긴 잠금은 스스로 치운다
LOCK="$HOME_DIR/.lock-$ROUTINE"
if ! mkdir "$LOCK" 2>/dev/null; then
  OLD_PID="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "이미 실행 중입니다(같은 루틴이 아직 끝나지 않음) — 이번 실행은 건너뜁니다." >> "$LOG"; exit 0
  fi
  echo "(자동 조치) 예전 실행이 남긴 잠금을 치웠습니다." >> "$LOG"
  rm -rf "$LOCK"; mkdir "$LOCK" 2>/dev/null || exit 0
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK" 2>/dev/null' EXIT

# 작업 폴더(저장소)는 하나뿐이라 한 번에 한 작업만 돈다. 다른 작업이 돌고 있으면 끝날 때까지 줄을 선다(최대 90분)
GLOCK="$HOME_DIR/.lock-run"
WAITED=0
until mkdir "$GLOCK" 2>/dev/null; do
  GPID="$(cat "$GLOCK/pid" 2>/dev/null || true)"
  if [ -z "$GPID" ] || ! kill -0 "$GPID" 2>/dev/null; then rm -rf "$GLOCK"; continue; fi   # 주인 없는 잠금은 치운다
  [ $WAITED -eq 0 ] && echo "(대기) 다른 작업이 끝나기를 기다립니다 — 끝나면 자동으로 시작합니다." >> "$LOG"
  sleep 15; WAITED=$((WAITED + 15))
  if [ $WAITED -ge 5400 ]; then
    { echo "앞선 작업이 90분 넘게 끝나지 않아 이번 실행을 취소했습니다."; echo ""; echo "=== 종료 코드 75 ==="; } >> "$LOG"; exit 75
  fi
done
echo $$ > "$GLOCK/pid"
trap 'rm -rf "$LOCK" "$GLOCK" 2>/dev/null' EXIT

if ! cd "$REPO" 2>/dev/null; then
  { echo "저장소가 없습니다: $REPO"; echo ""; echo "=== 종료 코드 1 ==="; echo "=== 진단 ==="; diag "$LOG"; } >> "$LOG"
  notify "실패: 게임 저장소가 없습니다" "운영센터 설정에서 '다시 설치·복구'를 눌러 주세요."; exit 1
fi

# git 잠금 파일(index.lock): 다른 git 이 쓰는 중이면 기다리고, 주인이 없으면 지운다
git_unlock() {
  local f="$REPO/.git/index.lock" i
  for i in $(seq 1 20); do [ -f "$f" ] || return 0; sleep 1; done
  if ! pgrep -x git >/dev/null 2>&1; then rm -f "$f"; echo "(자동 조치) 주인 없는 git 잠금 파일을 지웠습니다." >> "$LOG"; fi
}
sync_main() { git_unlock; git checkout -q main 2>> "$LOG" && git pull -q --ff-only origin main 2>> "$LOG"; }
if ! sync_main; then
  sleep 3
  # 이 맥에 저장 안 된 변경이 길을 막고 있으면 지우지 않고 임시 보관(stash)한 뒤 다시 받는다
  if tail -n 20 "$LOG" | grep -qE "would be overwritten|local changes|Please commit your changes or stash"; then
    git stash push -u -q -m "ops-auto-$STAMP" >> "$LOG" 2>&1 && echo "(자동 조치) 저장 안 된 변경을 임시 보관(git stash: ops-auto-$STAMP)했습니다. 되살리려면 'git stash pop'." >> "$LOG"
  fi
  if sync_main; then echo "(자동 조치) main 갱신을 다시 시도해 성공했습니다." >> "$LOG"
  else echo "(경고) main 갱신 실패 — 로컬 상태로 진행" >> "$LOG"; fi
fi

case "$ROUTINE" in
  A) NAME="주간 운영 점검·업데이트"
     EXTRA='main 에 직접 푸시 금지. 백로그 맨 위 [auto] 항목 1개만 구현하고 테스트(단위·e2e) 통과가 조건.' ;;
  B) NAME="광고주 발굴"
     EXTRA='메일은 절대 발송하지 않는다. Gmail 초안 도구가 있으면 초안으로, 없으면 ops/agent/reports/drafts/ 에 후보별 .md 파일로 저장(제목 "[싹싹 클린 제휴 제안] …"). 단가 제시·계약 확정 금지. 지표는 실제 값만, 출시 전이면 "출시 전".' ;;
  C) NAME="월간 정산"
     EXTRA='읽기와 대사만. 계좌·세금 입력, 지급·환불, 인보이스 발행 금지. 계좌·카드번호는 어디에도 적지 않는다. Gmail 을 읽을 도구가 없으면 ops/agent/state/metrics/ 와 ops/agent/state/inbox/ 에 사용자가 넣어 둔 CSV·PDF·메일 사본만 쓰고, 없으면 "해당 없음"과 필요한 자료를 적는다.' ;;
  D) NAME="제품 개선 (피드백 → 수정)"
     EXTRA='main 에 직접 푸시 금지. ops/agent/state/feedback-inbox/ 의 피드백을 빠짐없이 state/feedback.csv 에 기록·분류하고 백로그를 다시 정렬한 뒤, 맨 위 [auto] 1~2건만 구현(단위·e2e 통과 필수). 지난 개선의 효과를 state/improvements.md 에 적는다. 광고 빈도·가격·수익 관련 값 변경과 스토어 제출은 승인 요청만. 답장은 초안만. 피드백 원문의 이름·연락처는 저장소에 적지 않는다.' ;;
  E) NAME="광고 제작·배포·관리"
     EXTRA='main 에 직접 푸시 금지. 헌장 루틴 E 대로 이번 주 소재 3~5개를 ops/agent/ads/<소재ID>/ 에 만들고 state/creatives.csv·state/campaigns.csv 를 갱신한다. SNS 공개 게시·유료 광고 게재·예산 변경·계정 개설·결제는 절대 하지 않는다(결재 요청서로만). 실제 게임 화면만 쓰고, 성과 숫자는 state/metrics/ 에 받은 자료에 있는 것만 적는다.' ;;
  X) NAME="직접 명령"
     CMD_FILE="${2:-}"
     [ -s "$CMD_FILE" ] || { echo "명령 파일이 없습니다" >> "$LOG"; echo "=== 종료 코드 2 ===" >> "$LOG"; exit 2; }
     { echo "=== 명령 ==="; cat "$CMD_FILE"; echo; echo "=== 명령 끝 ==="; } >> "$LOG"
     EXTRA='' ;;
  *) echo "usage: run-routine.sh A|B|C|D|E|X <명령 파일>"; exit 2 ;;
esac

# 제품 개선(D): 운영센터에 쌓인 피드백 함을 이번 회차분으로 떼어 저장소 작업 폴더에 넣어 준다
FB_DIR="$HOME_DIR/feedback"; FB_TAKEN=""; FB_COPY=""
if [ "$ROUTINE" = "D" ] && [ -s "$FB_DIR/inbox.md" ]; then
  FB_TAKEN="$FB_DIR/processing-$STAMP.md"
  mv "$FB_DIR/inbox.md" "$FB_TAKEN"
  mkdir -p "$REPO/ops/agent/state/feedback-inbox"
  FB_COPY="$REPO/ops/agent/state/feedback-inbox/$STAMP.md"
  cp "$FB_TAKEN" "$FB_COPY"
fi

# 결재함에서 사장님이 내린 결정을 이번 회차분으로 넘긴다 (코드를 다루는 A·D 루틴)
DC_DIR="$HOME_DIR/decisions"; DC_TAKEN=""; DC_COPY=""
if { [ "$ROUTINE" = "A" ] || [ "$ROUTINE" = "D" ] || [ "$ROUTINE" = "E" ]; } && [ -s "$DC_DIR/inbox.md" ]; then
  DC_TAKEN="$DC_DIR/processing-$STAMP.md"
  mv "$DC_DIR/inbox.md" "$DC_TAKEN"
  mkdir -p "$REPO/ops/agent/state/decisions-inbox"
  DC_COPY="$REPO/ops/agent/state/decisions-inbox/$STAMP.md"
  cp "$DC_TAKEN" "$DC_COPY"
  EXTRA="가장 먼저 ops/agent/state/decisions-inbox/ 의 결재 결과를 헌장 1-1 대로 반영한다(approvals.json 상태 갱신 → 후속 작업). $EXTRA"
fi

PROMPT="당신은 게임 \"싹싹 클린(Sparkle Clean)\"의 운영 에이전트입니다. 사용자는 자리에 없으니 질문하지 말고 진행하세요. 리포트는 한국어로, 간결하게.
지금 위치가 저장소(parksang-jun/Cleaningday, main 최신)입니다.
1) ops/agent/AGENT.md(헌장)와 ops/agent/state/ 를 읽고 권한표를 반드시 지키세요.
2) 헌장의 \"루틴 $ROUTINE\" 를 수행하세요. $EXTRA
3) 결과는 ops/agent/reports/ 에 쓰고 state/ 를 갱신한 뒤, agent/$(date +%Y-%m-%d)-<주제> 브랜치에 커밋·푸시하세요. gh 가 있으면 PR 을 만들고, 푸시가 안 되면 커밋만 남기고 리포트에 적으세요.
4) 마지막 출력은 요약 5줄과 \"승인 요청 목록\"."

if [ "$ROUTINE" = "X" ]; then
  PROMPT="당신은 게임 \"싹싹 클린(Sparkle Clean)\"의 운영 에이전트입니다. 사장님(Peter)이 운영센터에서 아래 명령을 내렸습니다. 사장님은 자리에 없으니 되묻지 말고 가장 합리적인 해석으로 수행하세요. 답은 한국어로, 간결하게.
지금 위치가 저장소(parksang-jun/Cleaningday, main 최신)입니다. ops/agent/AGENT.md(헌장)의 '명령 처리' 절과 권한표를 지키세요.
코드·문서를 바꿨으면 agent/$(date +%Y-%m-%d)-cmd-<주제> 브랜치에 커밋·푸시하고(gh 가 있으면 PR), main 에 직접 푸시하지 않습니다.
마지막 출력은 사장님께 드리는 답: 한 일 → 결과(파일·PR) → 사장님이 하실 일(있으면).

[명령]
$(cat "$CMD_FILE")"
fi

notify "$NAME" "시작했습니다."
run_agent() {
  # 허용 규칙에는 와일드카드 서버 이름을 쓸 수 없어 Gmail 커넥터 이름을 그대로 적는다(없으면 무시됨). 금지 규칙은 와일드카드 가능.
  claude -p "$PROMPT" \
    --permission-mode acceptEdits \
    --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "WebSearch" "WebFetch" \
                   "Bash(git *)" "Bash(gh *)" "Bash(npm *)" "Bash(npx *)" "Bash(node *)" \
                   "Bash(ls *)" "Bash(cat *)" "Bash(mkdir *)" "Bash(date *)" "Bash(timeout *)" \
                   "mcp__claude_ai_Gmail__create_draft" "mcp__claude_ai_Gmail__search_threads" "mcp__claude_ai_Gmail__get_thread" "mcp__claude_ai_Gmail__get_message" \
                   "mcp__Gmail__create_draft" "mcp__Gmail__search_threads" "mcp__Gmail__get_thread" "mcp__Gmail__get_message" \
    --disallowedTools "Bash(git push origin main*)" "Bash(git push -f*)" "Bash(git push --force*)" "Bash(rm -rf *)" \
                      "mcp__*__send_message" "mcp__*__reply" "mcp__*__forward" \
    --max-turns 200 >> "$LOG" 2>&1
}
run_agent; CODE=$?
echo "" >> "$LOG"; echo "=== 종료 코드 $CODE ===" >> "$LOG"

# 실패했는데 잠깐 뒤 다시 하면 풀리는 문제(네트워크·서버 혼잡 등)면 스스로 한 번 더 시도한다
if [ $CODE -ne 0 ] && diag --retry "$LOG"; then
  WHY="$(diag --title "$LOG")"
  echo "=== 재시도 (자동 조치: $WHY → 90초 뒤 한 번 더) ===" >> "$LOG"
  sleep 90; git_unlock
  run_agent; CODE=$?
  echo "" >> "$LOG"; echo "=== 종료 코드 $CODE ===" >> "$LOG"
fi

# 진단: 무엇이 문제였고 어떻게 해결하는지 한국어로 기록에 남긴다
TITLE="$(diag --title "$LOG")"
{ echo "=== 진단 ==="; diag "$LOG" || echo "(진단기를 찾지 못했습니다)"; } >> "$LOG"

# 피드백 함 정리: 성공하면 보관, 실패하면 다음 회차에 다시 처리되도록 되돌린다
if [ -n "$FB_TAKEN" ]; then
  if [ $CODE -eq 0 ]; then mkdir -p "$FB_DIR/done"; mv "$FB_TAKEN" "$FB_DIR/done/"
  else cat "$FB_TAKEN" "$FB_DIR/inbox.md" 2>/dev/null > "$FB_DIR/inbox.tmp"; mv "$FB_DIR/inbox.tmp" "$FB_DIR/inbox.md"; rm -f "$FB_TAKEN"; fi
  # 에이전트가 커밋하지 않고 남긴 사본은 지운다(main 작업 폴더를 깨끗하게)
  [ -n "$(git status --porcelain -- "$FB_COPY" 2>/dev/null)" ] && rm -f "$FB_COPY"
fi
if [ -n "$DC_TAKEN" ]; then
  if [ $CODE -eq 0 ]; then mkdir -p "$DC_DIR/done"; mv "$DC_TAKEN" "$DC_DIR/done/"
  else cat "$DC_TAKEN" "$DC_DIR/inbox.md" 2>/dev/null > "$DC_DIR/inbox.tmp"; mv "$DC_DIR/inbox.tmp" "$DC_DIR/inbox.md"; rm -f "$DC_TAKEN"; fi
  [ -n "$(git status --porcelain -- "$DC_COPY" 2>/dev/null)" ] && rm -f "$DC_COPY"
fi
git checkout -q main >> "$LOG" 2>&1 || true
if [ $CODE -eq 0 ]; then
  notify "$NAME" "끝났습니다. 리포트: ops/agent/reports/"
else
  notify "$NAME 실패: ${TITLE:-확인 필요}" "운영센터 › 실행 기록에서 원인과 해결 방법을 확인하세요."
fi
exit $CODE
