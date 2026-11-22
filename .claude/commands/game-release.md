---
description: 출시 전 점검 — 버전·검사·금지 설정·출시 노트·Mac 에서 할 일을 정리한다
argument-hint: [버전, 예: 1.3]
---
출시 버전: $ARGUMENTS (비어 있으면 현재 버전 그대로 빌드 번호만 올린다)

아무것도 제출하지 않는다. 점검하고 준비물만 만든다.

1. **버전 일치** — `package.json`, iOS `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`, Android `versionName`/`versionCode` 가 서로 맞는지 확인하고, 다르면 맞춘다.
2. **금지 설정** — `.env.production` 과 빌드 결과에 `VITE_ADMIN=on`, `VITE_ADMOB_TESTING=true` 가 없는지, `src/ads/admob.ts` 가 실제 광고 단위 ID 를 쓰는지 확인한다.
3. **비밀 값** — security-reviewer 에이전트(또는 `/security-scan`)로 키스토어·`.env`·개인 메일 주소가 커밋에 섞이지 않았는지 본다.
4. **검사** — `npx tsc --noEmit` → `npm test` → `npm run build` → `npm run e2e` → `npx cap sync`. 하나라도 실패하면 출시 준비 중단.
5. **지난 출시 이후 변경** — 마지막 출시 커밋부터의 `git log` 를 읽고 플레이어에게 보이는 변화만 추린다.
6. **출시 노트** — `store-assets/release-notes-<버전>.md` 에 한국어·영어 "새로운 기능" 문구를 쓴다(각 4줄 이내, 과장 없이).
7. **실기기 확인 목록** — 이번 변경 중 자동 검사로 확인 못 하는 것(실제 광고, ATT 창, 소리, 터치 감)을 체크리스트로 만든다.
8. **보고** — 통과/실패 표, 출시 노트, 실기기 확인 목록, 그리고 Mac 에서 할 일을 순서대로:
   `git pull` → `npm install && npm run build && npx cap sync` → Xcode Archive → App Store Connect 에서 버전·빌드 선택 → 제출 / Android `./gradlew bundleRelease`(JDK 21) → Play Console 업로드.
