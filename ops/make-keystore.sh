#!/bin/bash
# 싹싹 클린 — 구글 플레이 출시용 서명 키 만들기 (맥에서 한 번만 실행)
#   bash ops/make-keystore.sh
# 만들어진 키스토어와 비밀번호 파일은 저장소에 올라가지 않는다. 반드시 따로 백업할 것.
set -e
cd "$(dirname "$0")/.."
KS=android/sparkle-release.jks
PROP=android/keystore.properties
if [ -f "$KS" ]; then echo "이미 있습니다: $KS — 덮어쓰지 않습니다."; exit 0; fi
command -v keytool >/dev/null || { echo "keytool 이 없습니다. Android Studio 또는 JDK 를 먼저 설치하세요."; exit 1; }

read -r -s -p "키스토어 비밀번호를 정하세요 (6자 이상): " PW; echo
read -r -s -p "한 번 더 입력하세요: " PW2; echo
[ "$PW" = "$PW2" ] || { echo "비밀번호가 다릅니다."; exit 1; }
[ ${#PW} -ge 6 ] || { echo "6자 이상이어야 합니다."; exit 1; }

keytool -genkeypair -v -keystore "$KS" -alias sparkle -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PW" -keypass "$PW" \
  -dname "CN=Sangjun Park, OU=Sparkle Clean, O=Sparkle Clean, L=Daejeon, C=KR"

cat > "$PROP" <<PROPS
storeFile=sparkle-release.jks
storePassword=$PW
keyAlias=sparkle
keyPassword=$PW
PROPS
chmod 600 "$PROP"
echo
echo "=== 완료 ==="
echo "만들어진 파일 (저장소에 올라가지 않습니다):"
echo "  $KS"
echo "  $PROP"
echo
echo "!! 이 두 파일을 외장 디스크나 비밀번호 관리자에 꼭 백업하세요."
echo "   잃어버리면 같은 앱의 업데이트를 영영 올릴 수 없습니다."
