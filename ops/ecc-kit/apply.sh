#!/usr/bin/env bash
# ECC 운영 키트를 다른 게임 저장소에 적용한다: bash ops/ecc-kit/apply.sh <대상 저장소 경로>
set -euo pipefail
src="$(cd "$(dirname "$0")/../.." && pwd)"
dst="${1:?대상 저장소 경로를 적어 주세요}"
[ -d "$dst/.git" ] || { echo "git 저장소가 아닙니다: $dst" >&2; exit 1; }
mkdir -p "$dst/.claude/commands"
cp "$src"/.claude/commands/game-*.md "$dst/.claude/commands/"
[ -f "$dst/CLAUDE.md" ] || printf '@AGENTS.md\n' > "$dst/CLAUDE.md"
if [ -f "$dst/AGENTS.md" ]; then
  echo "AGENTS.md 가 이미 있어 그대로 둡니다."
else
  cp "$src/ops/ecc-kit/AGENTS.template.md" "$dst/AGENTS.md"
  echo "AGENTS.md 틀을 만들었습니다 — <…> 부분을 채워 주세요."
fi
echo "적용 완료: $dst"
