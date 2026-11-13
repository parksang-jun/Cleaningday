# 개선 백로그 (위에서부터 처리)

표시: `[auto]` 에이전트가 PR 로 처리 가능 · `[승인]` Peter 결정 필요

> 결재가 필요한 일은 여기 한 줄로만 적지 말고 **`state/approvals.json` 에 결재 요청서**(무엇을·왜·정확한 절차·비용·선택지)로 올린다. 아래 `[승인]` 줄은 요청서가 아직 없는 임시 메모다.

## 출시 전 필수
- ~~[auto] 판매몰 맨 아래 제휴(수수료) 고지 문구 복원~~ → 2026-11-13 PR `agent/2026-11-13-affiliate-disclosure` (결재 affiliate-disclosure=restore)
- [auto] AdMob 실제 광고 단위 ID 반영 + `public/app-ads.txt`(pub-5724346706486152) — 앱 ID 받은 뒤(결재 admob-app-id). PR 까지만, 병합은 승인
- [auto] Play 스토어 등록 자료(설명문 ko/en/ja·스크린샷 목록·개인정보처리방침 점검)와 비공개 테스트(12명·14일) 안내문 초안 (결재 play-console=done, 개발자 이름은 play-developer-name 대기)
- [auto] 중국어·힌디어 앱 이름 후보 3개씩 조사(뜻·발음·동명 앱) → `choose` 요청서로 올림 (결재 app-names-zh-hi=propose)
- [auto] 쿠팡 파트너스·Amazon Associates 링크가 비어 있는 실제 제품 목록 정리(관리자 패널 입력용)
- [auto] Amazon.co.jp 고지 문구의 운영자 이름 칸 확인(현재 "当アプリ"), 쇼호스트 제휴 카드에도 수수료 고지가 필요한지 약관 재확인

- [auto] 정책 점검(2026-11-13): Android `targetSdkVersion` 36 여부 확인(Play 신규 앱 요건, 2026-08-31 기준), Capacitor AdMob 플러그인이 쓰는 Google Mobile Ads SDK 버전 확인 — 구 SDK 가 legacy 로 지정됨(2026-07), 최신 25.5.0 은 minSdk 24

## 품질
- [auto] 첫 판 조작 안내: 세제가 없는 1판에서는 세제 단계 문구를 "＋ 로 세제를 살 수 있어요"로 바꾸기
- [auto] e2e 소요 시간 줄이기(10분 → 5분 목표: 대기 시간 정리, 구간 병렬화)
- [auto] e2e 실행 준비 자동화: playwright 가 의존성에 없어 로컬에서 `npm install --no-save playwright@1.63.0` 이 매번 필요(CI 와 동일하게 스크립트화)
- [auto] e2e "3D 문지르기" 검사가 맥 로컬에서 항상 실패(0%→0%, main 도 동일, 2026-11-13) — 원인 조사 또는 로컬에서는 건너뛰기
- [auto] 3D 보기(실험, 꺼져 있음) 코드 유지 여부 검토 — 번들에서 분리돼 있어 비용은 없음

## 보류
- iOS 빌드·App Store 자료 — Apple Developer 가입 보류(2026-11-13). 가입 완료 후 시작
- 쇼호스트 음성 — 이번 출시는 음성 없음(2026-11-13). 출시 후 재검토
