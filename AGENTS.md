# 싹싹 클린 (Sparkle Clean) — 에이전트 작업 규칙

Claude Code · ECC(planner, tdd-guide, code-reviewer 등) · 운영 에이전트가 이 저장소에서 일할 때 가장 먼저 읽는 문서.
답변·보고·커밋 메시지는 한국어로, 짧게.

## 프로젝트

- 광고 수익형 청소 게임. TypeScript + Vite + Canvas 2D, Capacitor 8 (iOS · Android).
- 번들/패키지 ID `io.github.parksangjun.cleaningday`, 저장소 `parksang-jun/Cleaningday`, 기본 브랜치 `main`.
- 광고: AdMob (`@capacitor-community/admob`) — 배너·전면·보상형, UMP 동의, iOS ATT.
- 버전은 세 곳을 함께 올린다: `package.json`, `ios/App/App.xcodeproj/project.pbxproj`(MARKETING_VERSION · CURRENT_PROJECT_VERSION), `android/app/build.gradle`(versionName · versionCode).

## 어디에 무엇이 있나

| 경로 | 내용 |
|---|---|
| `src/game/` | 규칙 엔진(engine) · 오염/도구/레시피(catalog) · 판 정의(levels) · 봇(bot) — 화면과 무관, 단위 테스트 대상 |
| `src/render/` | 캔버스 그리기(장면 scene · 오염 grime · 판별 배경 looks) |
| `src/ads/` | 광고 공급자(admob · 웹 포털 · noop)와 빈도 정책(index) |
| `src/main.ts` | 화면·입력·상점·결과 — UI 전부 |
| `src/i18n.ts` | 문구 (ko · en · ja 세 언어를 항상 같이 고친다) |
| `scripts/e2e.mjs` | Playwright 종단 검사 (234개, 약 6분) |
| `store-assets/` | 스토어 스크린샷 · 출시 노트 |
| `ops/` | 운영 에이전트 규칙(`ops/agent/AGENT.md`) · 출시 절차 |

## 명령

```
npx tsc --noEmit        # 타입 검사
npm test                # 단위 테스트 (vitest)
npm run build           # dist 생성
npm run e2e             # 종단 검사 — 도는 동안 dist 를 다시 빌드하지 말 것(멈춘다)
npx cap sync            # 네이티브 프로젝트에 반영
```

커밋 전 순서: `tsc` → `npm test` → `npm run build` → `npm run e2e` → `npx cap sync`.
게임 규칙·광고·화면을 건드렸으면 e2e 까지 반드시 돌린다. 문서만 고쳤으면 생략 가능.

## 하면 안 되는 것 (예외 없음)

1. 비밀 값 커밋 금지 — 키스토어(`*.jks`, `*.keystore`, `keystore.properties`), `.env`, 비밀번호, 계정·카드·신분증 번호.
2. 운영자의 개인 메일 주소를 저장소·공개 페이지·외부 요청에 넣지 않는다. 공개 연락처는 `sparklecleangame@gmail.com` 하나.
3. `VITE_ADMIN=on`, `VITE_ADMOB_TESTING=true` 로 만든 빌드를 스토어에 올리지 않는다.
4. 승인 없이 하지 않는다: 메일 발송, 결제, 스토어 제출, 광고 빈도·가격·보상 수치 변경. → 변경안과 근거를 적어 승인 요청으로 남긴다.
5. 예약 실행되는 운영 에이전트는 `main` 에 직접 push 하지 않는다(`agent/날짜-주제` 브랜치 + PR). 운영자와 대화 중인 세션이 지시를 받아 하는 작업은 `main` 에 올려도 된다.
6. 테스트를 지우거나 느슨하게 고쳐서 통과시키지 않는다. 테스트가 틀렸다면 왜 틀렸는지 커밋 메시지에 적는다.

## 일하는 방식

- 버그 제보는 **먼저 재현**한다(단위 테스트나 시뮬레이션으로). 재현 없이 추측으로 고치지 않는다.
  사용자가 쓰는 버전은 `main` 보다 옛 코드일 수 있다 — `git log` 로 출시 빌드 커밋을 찾아 그 코드에서 확인한다.
- 고친 버그마다 그 버그를 잡는 테스트를 하나 남긴다.
- 네이티브 플러그인 동작(광고·ATT·리뷰 창)은 추측하지 말고 `node_modules/@capacitor-community/*/ios|android` 소스를 읽는다.
- 화면에 보이는 것을 바꿨으면 Playwright 로 캡처해 눈으로 확인한다.
- 실기기에서만 확인되는 것(실제 광고, ATT 창, 소리)은 "자동 검사 통과, 실기기 미확인"이라고 그대로 보고한다.
- 난이도·보상·광고 수치를 바꿀 때는 봇 기준 시간(`src/game/bot.ts`)과 `balance.test.ts` 가 같이 맞는지 본다.

## ECC 로 일할 때

| 일 | 쓰는 것 |
|---|---|
| 사용자 제보·버그 | `/game-fix` |
| 새 기능·콘텐츠 | `/game-feature` |
| 출시 준비 | `/game-release` |
| 현재 상태 한눈에 | `/game-status` |

각 명령은 ECC 에이전트(planner → tdd-guide → code-reviewer, 필요하면 build-error-resolver · e2e-runner · security-reviewer)를 순서대로 부른다.
ECC 를 플러그인으로 설치했으면 에이전트 이름 앞에 `ecc:` 가 붙을 수 있다(`ecc:planner`). 없는 에이전트는 건너뛰고 직접 한다.
