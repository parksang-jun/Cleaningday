#!/bin/bash
# 싹싹 클린 운영센터 실행기 — 바탕화면 앱을 누르면 이 스크립트가 돈다 (터미널 창 없이).
#   1) 서버가 안 떠 있으면 띄우고 관리 화면을 연다
#   2) 그 뒤 조용히 GitHub 최신 버전을 확인해, 바뀐 게 있으면 스스로 교체한다 (업데이트에 터미널이 필요 없다)
HOME_DIR="$HOME/SparkleCleanOps"
REPO="$HOME_DIR/Cleaningday"
DEST="$HOME_DIR/console"
[ -f "$HOME_DIR/env.sh" ] && . "$HOME_DIR/env.sh"
export PATH="$PATH:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export GIT_TERMINAL_PROMPT=0 GIT_OPTIONAL_LOCKS=0
URL="http://127.0.0.1:4777"
LOG="$HOME_DIR/logs/console.log"
mkdir -p "$HOME_DIR/logs"

up() { curl -s -m 1 "$URL/api/ping" >/dev/null 2>&1; }
start_server() {
  nohup node "$DEST/server.mjs" >> "$LOG" 2>&1 &
  disown 2>/dev/null || true
  for _ in $(seq 1 40); do up && return 0; sleep 0.25; done
  return 1
}
open_window() {
  if [ -d "/Applications/Google Chrome.app" ]; then open -na "Google Chrome" --args --app="$URL" --window-size=1320,860
  elif [ -d "/Applications/Microsoft Edge.app" ]; then open -na "Microsoft Edge" --args --app="$URL" --window-size=1320,860
  else open "$URL"; fi
}
say_error() { osascript -e "display alert \"싹싹 클린 운영센터\" message \"$1\"" >/dev/null 2>&1 || true; }

if ! command -v node >/dev/null 2>&1; then
  say_error "Node.js 를 찾지 못했습니다. https://nodejs.org 에서 LTS 를 설치한 뒤 다시 눌러 주세요."; exit 1
fi
if ! up; then
  if ! start_server; then
    say_error "운영센터를 시작하지 못했습니다. 자세한 내용: $LOG"; exit 1
  fi
fi
[ "${1:-}" = "--no-window" ] || open_window

# ---- 조용한 자동 업데이트 (창은 이미 열렸다)
update() {
  [ -d "$REPO/.git" ] || return 0
  ls -d "$HOME_DIR"/.lock-* >/dev/null 2>&1 && return 0          # 에이전트가 일하는 중이면 건드리지 않는다
  cd "$REPO" || return 0
  [ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" = "main" ] || return 0
  git fetch -q origin main 2>/dev/null &
  local p=$!; ( sleep 15; kill "$p" 2>/dev/null ) & local w=$!
  wait "$p" 2>/dev/null; kill "$w" 2>/dev/null
  [ -z "$(git status --porcelain --untracked-files=no 2>/dev/null)" ] && git merge -q --ff-only origin/main 2>/dev/null
  local SRC="$REPO/ops/agent/mac" restart=0 rebuild=0 f
  for f in server.mjs diagnose.mjs index.html icon.png launch.sh install-app.sh; do
    [ -f "$SRC/console/$f" ] || continue
    cmp -s "$SRC/console/$f" "$DEST/$f" && continue
    cp "$SRC/console/$f" "$DEST/.$f.new" && mv -f "$DEST/.$f.new" "$DEST/$f"   # 교체는 한 번에(실행 중인 스크립트가 깨지지 않게)
    case "$f" in server.mjs|diagnose.mjs) restart=1 ;; install-app.sh) rebuild=1 ;; esac
  done
  if [ -f "$SRC/run-routine.sh" ] && ! cmp -s "$SRC/run-routine.sh" "$HOME_DIR/run-routine.sh"; then
    cp "$SRC/run-routine.sh" "$HOME_DIR/.run-routine.new" && chmod +x "$HOME_DIR/.run-routine.new" && mv -f "$HOME_DIR/.run-routine.new" "$HOME_DIR/run-routine.sh"
  fi
  if [ $restart = 1 ]; then
    echo "$(date '+%F %T') 업데이트: 새 버전으로 서버 교체" >> "$LOG"
    curl -s -m 2 -X POST -H 'X-SC: 1' "$URL/api/quit" >/dev/null 2>&1; sleep 1
    up || start_server
  fi
  if [ $rebuild = 1 ]; then
    echo "$(date '+%F %T') 업데이트: 바탕화면 앱 다시 만들기" >> "$LOG"
    SC_FROM_CONSOLE=1 bash "$DEST/install-app.sh" >> "$LOG" 2>&1
  fi
}
( update ) >/dev/null 2>&1 &
disown 2>/dev/null || true
exit 0
