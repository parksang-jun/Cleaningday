#!/bin/bash
# 싹싹 클린 운영센터 — 바탕화면 앱 만들기
#   터미널에서:  bash install-app.sh
# 결과: 바탕화면(과 응용 프로그램 폴더)에 "싹싹클린 운영센터" 앱. 더블클릭하면 관리 화면이 창으로 열린다.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$HOME/SparkleCleanOps"
DEST="$HOME_DIR/console"
APP_NAME="싹싹클린 운영센터"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js 가 없습니다. 'brew install node' 또는 https://nodejs.org 에서 설치 후 다시 실행하세요."; exit 1
fi

echo "1/3 운영센터 파일 복사 → $DEST"
mkdir -p "$DEST" "$HOME_DIR/logs"
cp "$SRC/server.mjs" "$SRC/diagnose.mjs" "$SRC/index.html" "$SRC/icon.png" "$DEST/"
# 실행 스크립트도 최신으로 (저장소 안에서 실행된 경우)
if [ -f "$SRC/../run-routine.sh" ]; then cp "$SRC/../run-routine.sh" "$HOME_DIR/run-routine.sh"; chmod +x "$HOME_DIR/run-routine.sh"; fi
mkdir -p "$HOME_DIR/feedback"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

echo "2/3 앱 만들기"
build_app() {
  local APP="$1"
  rm -rf "$APP"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cat > "$APP/Contents/MacOS/launcher" <<'SH'
#!/bin/bash
# 서버가 안 떠 있으면 띄우고, 관리 화면을 앱 창으로 연다
HOME_DIR="$HOME/SparkleCleanOps"
[ -f "$HOME_DIR/env.sh" ] && . "$HOME_DIR/env.sh"
export PATH="$PATH:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin"
URL="http://127.0.0.1:4777"
if ! curl -s -m 1 "$URL/api/ping" >/dev/null 2>&1; then
  mkdir -p "$HOME_DIR/logs"
  nohup node "$HOME_DIR/console/server.mjs" >> "$HOME_DIR/logs/console.log" 2>&1 &
  disown
  for _ in $(seq 1 40); do curl -s -m 1 "$URL/api/ping" >/dev/null 2>&1 && break; sleep 0.25; done
fi
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL" --window-size=1320,860
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$URL" --window-size=1320,860
else
  open "$URL"
fi
SH
  chmod +x "$APP/Contents/MacOS/launcher"
  cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundleIdentifier</key><string>com.sparkleclean.console</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
  if [ -f "$ICNS" ]; then cp "$ICNS" "$APP/Contents/Resources/AppIcon.icns"; fi
  touch "$APP"
}

# 아이콘 (.icns)
ICNS="$DEST/AppIcon.icns"
TMP="$(mktemp -d)"; SET="$TMP/AppIcon.iconset"; mkdir -p "$SET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$DEST/icon.png" --out "$SET/icon_${s}x${s}.png" >/dev/null 2>&1 || true
  d=$((s * 2)); sips -z $d $d "$DEST/icon.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null 2>&1 || true
done
iconutil -c icns "$SET" -o "$ICNS" >/dev/null 2>&1 || echo "  (아이콘 변환 생략)"
rm -rf "$TMP"

build_app "$HOME/Desktop/$APP_NAME.app"
mkdir -p "$HOME/Applications"
build_app "$HOME/Applications/$APP_NAME.app"
rm -f "$HOME/Desktop/싹싹클린운영.command" 2>/dev/null || true   # 예전 임시 실행 파일 정리

echo "3/3 실행"
# 이미 떠 있던 예전 서버가 있으면 내리고 새로 띄운다
curl -s -m 1 -X POST -H 'X-SC: 1' http://127.0.0.1:4777/api/quit >/dev/null 2>&1 || true
sleep 0.5
open "$HOME/Desktop/$APP_NAME.app"
echo
echo "✅ 완료 — 바탕화면의 '$APP_NAME' 을 더블클릭하면 열립니다. (Dock 에 끌어다 두면 더 편해요)"
