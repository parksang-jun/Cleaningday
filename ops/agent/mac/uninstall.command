#!/bin/bash
# 싹싹 클린 운영 에이전트 — 맥에서 제거 (예약만 지운다. 저장소·리포트·로그는 남긴다)
for n in weekly sponsors settlement improve; do
  label="com.sparkleclean.ops.$n"
  launchctl bootout "gui/$(id -u)/$label" >/dev/null 2>&1 || true
  rm -f "$HOME/Library/LaunchAgents/$label.plist"
  echo "✓ 제거: $label"
done
echo "저장소와 로그는 ~/SparkleCleanOps 에 남아 있습니다. 필요 없으면 직접 지우세요."
