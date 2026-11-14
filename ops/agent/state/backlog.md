# 개선 백로그 (위에서부터 처리)

표시: `[auto]` 에이전트가 PR 로 처리 가능 · `[승인]` Peter 결정 필요

> 결재가 필요한 일은 여기 한 줄로만 적지 말고 **`state/approvals.json` 에 결재 요청서**(무엇을·왜·정확한 절차·비용·선택지)로 올린다. 아래 `[승인]` 줄은 요청서가 아직 없는 임시 메모다.

정렬 기준: (영향 받는 사람 수 × 심각도) ÷ 작업량. 결재 후속 작업은 맨 위(헌장 1-1). 최근 정렬 2026-11-14(제품개선팀).

## 진행 중 (PR 올림, 병합은 승인)
- [auto] 판매몰 맨 아래 제휴(수수료) 고지 복원 → PR `agent/2026-11-14-affiliate-disclosure` (결재 affiliate-disclosure=restore)
- [auto] 목표 시간 하한 보정(16판, 기본 장비로 별 3개 가능하게) → PR `agent/2026-11-14-improve-par-floor` (근거: 봇 플레이테스트 11-13·11-14)

## 다음에 처리 (위에서부터)
- [auto] Play 스토어 등록 자료 초안(설명문 ko/en/ja·스크린샷 목록·개인정보처리방침 점검)과 비공개 테스트(12명·14일) 안내문 — 개발자 이름은 결재 play-developer-name 대기, 이름 칸만 비워 두고 먼저 작성 가능 (결재 play-console=done)
- [auto] iOS 빌드 점검(번들 ID·서명 설정·Info.plist 권한 문구)과 App Store 등록 자료 초안 (결재 apple-developer=done)
- [auto] 1판 '새 아이템' 알림: 그 판에 실제로 쓰는 것만, 조작 안내가 끝난 뒤에 (근거: 2026-11-13 조작 안내 화면 점검)
- [auto] 제휴 링크를 코드에 담을 자리 만들기(제품별 링크 칸) — 결재 affiliate-accounts 가 끝나면 바로 넣도록 (근거: 운영자 모드 링크는 기기에만 저장됨)
- [auto] Amazon.co.jp 고지의 운영자 이름 칸 확인(현재 "当アプリ"), 쇼호스트 제휴 카드에도 수수료 고지가 필요한지 약관 재확인
- [auto] e2e 실행 준비 자동화: playwright 가 의존성에 없어 로컬에서 `npm install --no-save playwright@1.63.0` + `npx playwright install chromium` 이 매번 필요(2026-11-14 에도 발생)
- [auto] e2e 소요 시간 줄이기(10분 → 5분 목표)
- [auto] 3D 보기(실험, 꺼져 있음) 코드 유지 여부 검토 — 번들에서 분리돼 있어 비용은 없음

## 결재 대기 (요청서는 approvals.json)
- [승인] AdMob 광고 ID 3개를 어느 앱에 넣을지 → `admob-apply-ids` (받으면 ID 반영 + `public/app-ads.txt` PR)
- [승인] Play 개발자 이름 → `play-developer-name`
- [승인] 중국어·힌디어 앱 이름 선택 → `app-names-zh-hi-pick`
- [승인] 쿠팡 파트너스·Amazon Associates 가입과 추적 코드 → `affiliate-accounts` (목록: `state/affiliate-links.md`, 25개 전부 비어 있음)

## 보류
- 난이도 요철(판 사이 2배 급등락) — 11-14 재판정: 난이도 개편(8ba3cf1)으로 구역별 '가볍게 시작 → 어려운 판(4·8번째) → 대청소(12번째)'가 의도된 설계. 사람 피드백이 오면 다시 본다.
- 쇼호스트 음성 — 결재 host-voice=none(이번 출시는 음성 없음). 출시 후 재검토.

## 끝난 것
- 2026-11-14 결재 6건 반영(approvals.json): 고지 복원·음성 없음·Play 완료·AdMob 완료·이름 후보 제안·Apple 완료
- 2026-11-13 [auto] 첫 판 조작 안내: 세제가 없는 판에서는 세제 단계 문구 교체 → PR #1 (병합)
- 2026-11-13 [auto] 제휴 링크가 비어 있는 실제 제품 목록 정리 → `state/affiliate-links.md`
- ~~15판 너무 쉬움~~ 기각(2026-11-14): 방 구역 '가볍게 시작' 구간이라 의도된 쉬움
