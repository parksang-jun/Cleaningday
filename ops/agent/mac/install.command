#!/bin/bash
# 싹싹 클린 운영 에이전트 — 맥 설치
# 더블클릭(또는 터미널에서 `bash install.command`)하면:
#   1) 저장소를 ~/SparkleCleanOps/Cleaningday 에 받고
#   2) 주간 점검(월 09:43) · 광고주 발굴(수 10:17) · 월간 정산(매월 3일 10:12) 을 launchd 에 등록한다.
# 실행은 이 맥의 Claude Code(`claude`)가 한다. 맥이 잠들어 있었으면 깨어난 뒤에 돈다.
set -euo pipefail

HOME_DIR="$HOME/SparkleCleanOps"
REPO_DIR="$HOME_DIR/Cleaningday"
REPO_URL="https://github.com/parksang-jun/Cleaningday.git"
AGENTS="$HOME/Library/LaunchAgents"
export PATH="$HOME/.local/bin:$HOME/.claude/local:/opt/homebrew/bin:/usr/local/bin:$PATH"

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "✗ '$1' 이(가) 없습니다. $2"
    MISSING=1
  else
    echo "✓ $1  ($(command -v "$1"))"
  fi
}

say "1/4 필요한 프로그램 확인"
MISSING=0
need git "터미널에서 'xcode-select --install' 을 실행하세요."
need node "https://nodejs.org 에서 LTS 를 설치하세요 (또는 'brew install node')."
need claude "Claude Code 를 설치하세요: 'curl -fsSL https://claude.ai/install.sh | bash' 후 'claude' 를 한 번 실행해 로그인."
if ! command -v gh >/dev/null 2>&1; then
  echo "· gh(GitHub CLI) 없음 — PR 자동 생성 없이 브랜치 푸시까지만 합니다. ('brew install gh' 후 'gh auth login' 권장)"
fi
if [ "$MISSING" = 1 ]; then
  echo; echo "위 항목을 설치한 뒤 다시 실행해 주세요."; exit 1
fi

say "2/4 저장소 받기 → $REPO_DIR"
mkdir -p "$HOME_DIR/logs"
if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" fetch -q origin && git -C "$REPO_DIR" checkout -q main && git -C "$REPO_DIR" pull -q --ff-only origin main
  echo "✓ 최신으로 갱신"
else
  git clone -q "$REPO_URL" "$REPO_DIR"
  echo "✓ 받음"
fi
if ! git -C "$REPO_DIR" push --dry-run -q origin main >/dev/null 2>&1; then
  echo "· 이 맥에서 GitHub 푸시 권한이 확인되지 않았습니다. 'gh auth login' 으로 로그인해 두면 에이전트가 브랜치를 올릴 수 있습니다."
fi

say "3/4 실행 스크립트 설치"
SRC="$REPO_DIR/ops/agent/mac"
cp "$SRC/run-routine.sh" "$HOME_DIR/run-routine.sh"
chmod +x "$HOME_DIR/run-routine.sh"
# launchd 는 PATH 가 거의 비어 있어서 지금 찾은 경로를 적어 둔다
cat > "$HOME_DIR/env.sh" <<ENV
export PATH="$(dirname "$(command -v claude)"):$(dirname "$(command -v node)"):$(dirname "$(command -v git)"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export SC_REPO_DIR="$REPO_DIR"
export SC_HOME_DIR="$HOME_DIR"
ENV
echo "✓ $HOME_DIR/run-routine.sh"

say "4/4 예약 등록 (launchd)"
mkdir -p "$AGENTS"
plist() { # 이름 루틴 "<달력 키들>"
  local label="com.sparkleclean.ops.$1" file="$AGENTS/com.sparkleclean.ops.$1.plist"
  cat > "$file" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$HOME_DIR/run-routine.sh</string><string>$2</string></array>
  <key>StartCalendarInterval</key>
  <dict>$3</dict>
  <key>StandardOutPath</key><string>$HOME_DIR/logs/launchd-$1.log</string>
  <key>StandardErrorPath</key><string>$HOME_DIR/logs/launchd-$1.log</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PLIST
  launchctl bootout "gui/$(id -u)/$label" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "$file"
  echo "✓ $label"
}
plist weekly     A "<key>Weekday</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>43</integer>"
plist sponsors   B "<key>Weekday</key><integer>3</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>17</integer>"
plist settlement C "<key>Day</key><integer>3</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>12</integer>"

say "설치 완료"
cat <<DONE
· 일정: 주간 점검 월 09:43 / 광고주 발굴 수 10:17 / 월간 정산 매월 3일 10:12 (이 맥의 시간대)
· 지금 한 번 돌려 보기:  bash "$HOME_DIR/run-routine.sh" A
· 리포트:  $REPO_DIR/ops/agent/reports/
· 로그:    $HOME_DIR/logs/
· 제거:    bash "$SRC/uninstall.command"
DONE
