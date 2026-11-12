#!/bin/bash
# 싹싹 클린 운영 에이전트 — 루틴 1회 실행 (A 주간 점검 / B 광고주 발굴 / C 월간 정산 / D 제품 개선)
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

# 같은 루틴이 겹쳐 돌지 않게
LOCK="$HOME_DIR/.lock-$ROUTINE"
if ! mkdir "$LOCK" 2>/dev/null; then echo "이미 실행 중: $ROUTINE" >> "$LOG"; exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

cd "$REPO" || { notify "실패" "저장소가 없습니다: $REPO"; exit 1; }
git checkout -q main >> "$LOG" 2>&1 && git pull -q --ff-only origin main >> "$LOG" 2>&1 || echo "(경고) main 갱신 실패 — 로컬 상태로 진행" >> "$LOG"

case "$ROUTINE" in
  A) NAME="주간 운영 점검·업데이트"
     EXTRA='main 에 직접 푸시 금지. 백로그 맨 위 [auto] 항목 1개만 구현하고 테스트(단위·e2e) 통과가 조건.' ;;
  B) NAME="광고주 발굴"
     EXTRA='메일은 절대 발송하지 않는다. Gmail 초안 도구가 있으면 초안으로, 없으면 ops/agent/reports/drafts/ 에 후보별 .md 파일로 저장(제목 "[싹싹 클린 제휴 제안] …"). 단가 제시·계약 확정 금지. 지표는 실제 값만, 출시 전이면 "출시 전".' ;;
  C) NAME="월간 정산"
     EXTRA='읽기와 대사만. 계좌·세금 입력, 지급·환불, 인보이스 발행 금지. 계좌·카드번호는 어디에도 적지 않는다. Gmail 을 읽을 도구가 없으면 ops/agent/state/metrics/ 와 ops/agent/state/inbox/ 에 사용자가 넣어 둔 CSV·PDF·메일 사본만 쓰고, 없으면 "해당 없음"과 필요한 자료를 적는다.' ;;
  D) NAME="제품 개선 (피드백 → 수정)"
     EXTRA='main 에 직접 푸시 금지. ops/agent/state/feedback-inbox/ 의 피드백을 빠짐없이 state/feedback.csv 에 기록·분류하고 백로그를 다시 정렬한 뒤, 맨 위 [auto] 1~2건만 구현(단위·e2e 통과 필수). 지난 개선의 효과를 state/improvements.md 에 적는다. 광고 빈도·가격·수익 관련 값 변경과 스토어 제출은 승인 요청만. 답장은 초안만. 피드백 원문의 이름·연락처는 저장소에 적지 않는다.' ;;
  *) echo "usage: run-routine.sh A|B|C|D"; exit 2 ;;
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

PROMPT="당신은 게임 \"싹싹 클린(Sparkle Clean)\"의 운영 에이전트입니다. 사용자는 자리에 없으니 질문하지 말고 진행하세요. 리포트는 한국어로, 간결하게.
지금 위치가 저장소(parksang-jun/Cleaningday, main 최신)입니다.
1) ops/agent/AGENT.md(헌장)와 ops/agent/state/ 를 읽고 권한표를 반드시 지키세요.
2) 헌장의 \"루틴 $ROUTINE\" 를 수행하세요. $EXTRA
3) 결과는 ops/agent/reports/ 에 쓰고 state/ 를 갱신한 뒤, agent/$(date +%Y-%m-%d)-<주제> 브랜치에 커밋·푸시하세요. gh 가 있으면 PR 을 만들고, 푸시가 안 되면 커밋만 남기고 리포트에 적으세요.
4) 마지막 출력은 요약 5줄과 \"승인 요청 목록\"."

notify "$NAME" "시작했습니다."
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "WebSearch" "WebFetch" \
                 "Bash(git *)" "Bash(gh *)" "Bash(npm *)" "Bash(npx *)" "Bash(node *)" \
                 "Bash(ls *)" "Bash(cat *)" "Bash(mkdir *)" "Bash(date *)" "Bash(timeout *)" \
                 "mcp__*__create_draft" "mcp__*__search_threads" "mcp__*__get_thread" "mcp__*__get_message" \
  --disallowedTools "Bash(git push origin main*)" "Bash(git push -f*)" "Bash(git push --force*)" "Bash(rm -rf *)" \
                    "mcp__*__send_message" "mcp__*__reply" "mcp__*__forward" \
  --max-turns 200 >> "$LOG" 2>&1
CODE=$?
echo "" >> "$LOG"; echo "=== 종료 코드 $CODE ===" >> "$LOG"

# 피드백 함 정리: 성공하면 보관, 실패하면 다음 회차에 다시 처리되도록 되돌린다
if [ -n "$FB_TAKEN" ]; then
  if [ $CODE -eq 0 ]; then mkdir -p "$FB_DIR/done"; mv "$FB_TAKEN" "$FB_DIR/done/"
  else cat "$FB_TAKEN" "$FB_DIR/inbox.md" 2>/dev/null > "$FB_DIR/inbox.tmp"; mv "$FB_DIR/inbox.tmp" "$FB_DIR/inbox.md"; rm -f "$FB_TAKEN"; fi
  # 에이전트가 커밋하지 않고 남긴 사본은 지운다(main 작업 폴더를 깨끗하게)
  [ -n "$(git status --porcelain -- "$FB_COPY" 2>/dev/null)" ] && rm -f "$FB_COPY"
fi
git checkout -q main >> "$LOG" 2>&1 || true
if [ $CODE -eq 0 ]; then
  notify "$NAME" "끝났습니다. 리포트: ops/agent/reports/"
else
  notify "$NAME 실패 (코드 $CODE)" "로그: $LOG"
fi
exit $CODE
