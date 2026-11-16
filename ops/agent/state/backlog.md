# 개선 백로그 (위에서부터 처리)

표시: `[auto]` 에이전트가 PR 로 처리 가능 · `[승인]` Peter 결정 필요

> 결재가 필요한 일은 여기 한 줄로만 적지 말고 **`state/approvals.json` 에 결재 요청서**(무엇을·왜·정확한 절차·비용·선택지)로 올린다. 아래 `[승인]` 줄은 요청서가 아직 없는 임시 메모다.

정렬 기준: (영향 받는 사람 수 × 심각도) ÷ 작업량. 결재 후속 작업은 맨 위(헌장 1-1). 최근 정렬 2026-11-16(루틴 A: 결재 2건 반영).

## 진행 중 (PR 올림, 병합은 승인)
- [auto] Play 스토어 등록 자료 초안(ko/en/ja)·데이터 보안 설문 초안·비공개 테스트 안내문 → `store/play/`, 브랜치 agent/2026-11-16-play-listing (결재 play-developer-name=done)
- [auto] 판매몰 맨 아래 제휴(수수료) 고지 복원 → PR #7 (결재 affiliate-disclosure=restore)
- [auto] '새 아이템' 알림: 그 판에 쓰는 것만, 조작 안내가 끝난 뒤에 → PR #9
- [auto] AdMob 인증 파일 app-ads.txt → PR #12 (올릴 주소는 결재 app-ads-host)

## 다음에 처리 (위에서부터)
- [auto] e2e 시간 민감 검사 안정화: 느린 기기(≈24fps)에서 4판 '먼지 재발 카운트다운'(재발이 검사 전에 일어남)·25판 기름때 루프(제한시간 78초 초과)가 실패. 테스트용 훅으로 재오염·제한시간 시계를 검사 구간 동안 멈추거나, 검사 직전에 재발 타이머를 초기화. CI(61fps)는 통과 (근거: 2026-11-16 루틴 A 로컬 3회 실패)
- [auto] 사진 재질(CC0) 적용: Poly Haven·ambientCG 무료 상업용 사진을 마루 → 타일 → 스테인리스 순으로, 전후 스크린샷을 PR 에 첨부. 앱 용량 증가 폭 기록 (결재 graphics-assets=photo-cc0) — **2026-11-16 막힘: 예약 실행 세션에서 두 사이트 다운로드(네트워크)가 승인 필요로 차단됨.** 실행기 허용 목록에 api.polyhaven.com·dl.polyhaven.org·ambientcg.com 을 넣어야 진행 가능
- [auto] Play 휴대전화 스크린샷 9:16 판(예: 1080×1920) 만들기 — store-assets 의 1179×2556·1320×2868 은 긴 변이 짧은 변의 2배를 넘어 Play 규격 초과 가능성 (`scripts/store-shots.mjs` 에 크기 추가) (근거: store/play/README.md 점검)
- [auto] Play 그래픽 이미지 1024×500 만들기(실제 게임 화면 기반) — 없으면 등록정보 제출 불가 (근거: 같은 점검)
- [auto] iOS 빌드 점검(번들 ID·서명 설정·Info.plist 권한 문구)과 App Store 등록 자료 초안 (결재 apple-developer=done)
- [auto] 광고팀: 유료 캠페인 설계는 하지 않고 무료 게시(숏폼 오가닉)·ASO 만 계획. 리텐션 게이트 통과 시 유료 결재 재상신 (결재 ad-paid-budget=organic-first)
- [auto] 그래픽 2차: 타일(유약 반사·줄눈 깊이)·스테인리스·버너 받침 질감, 도구 아이콘 입체화 — 위 사진 재질 작업과 겹치는 부분은 사진 재질로 대체 (근거: 2026-11-14 사장님 명령 "그래픽이 조잡하다")
- [auto] 그래픽 1차(나뭇결·조명) 화면 확인: 스크린샷 스크립트로 전후 비교해 PR 에 붙이기 (근거: 2026-11-14 명령 처리)
- [auto] 제휴 링크를 코드에 담을 자리 만들기(제품별 링크 칸) — 결재 affiliate-accounts 가 끝나면 바로 넣도록 (근거: 운영자 모드 링크는 기기에만 저장됨)
- [auto] Amazon.co.jp 고지의 운영자 이름 칸 확인(현재 "当アプリ"), 쇼호스트 제휴 카드에도 수수료 고지가 필요한지 약관 재확인
- [auto] e2e 실행 준비 자동화: playwright 가 의존성에 없어 로컬에서 `npm install --no-save playwright@1.63.0` + `npx playwright install chromium` 이 매번 필요(2026-11-14 에도 발생)
- [auto] e2e 소요 시간 줄이기(10분 → 5분 목표)
- [auto] 3D 보기(실험, 꺼져 있음) 코드 유지 여부 검토 — 번들에서 분리돼 있어 비용은 없음

## 결재 대기 (요청서는 approvals.json)
- [승인] 개인정보처리방침 운영자 이름을 스토어 개발자 이름과 맞추기 → `privacy-operator-name`
- [승인] 중국어·힌디어 앱 이름 선택 → `app-names-zh-hi-pick`
- [승인] app-ads.txt 올릴 주소 → `app-ads-host`
- [승인] 광고주 제안 메일 발송 시점 → `sponsor-outreach-send`
- [승인] 쿠팡 파트너스·Amazon Associates 가입과 추적 코드 → `affiliate-accounts` (목록: `state/affiliate-links.md`, 25개 전부 비어 있음)
- [승인] 홍보용 SNS 계정 → `ad-channels`

## 보류
- 난이도 요철(판 사이 2배 급등락) — 11-14 재판정: 난이도 개편(8ba3cf1)으로 구역별 '가볍게 시작 → 어려운 판(4·8번째) → 대청소(12번째)'가 의도된 설계. 사람 피드백이 오면 다시 본다.
- 쇼호스트 음성 — 결재 host-voice=none(이번 출시는 음성 없음). 출시 후 재검토.
- 유료 광고 — 결재 ad-paid-budget=organic-first. 리텐션 게이트(D1 30%·D7 10%) 통과 후 재결재.

## 끝난 것
- 2026-11-16 결재 2건 반영: play-developer-name=done(Martin park → Play 등록 자료), admob-app-id=done(이미 AndroidManifest 에 같은 값, 작업 없음)
- 2026-11-14 결재 8건 반영(approvals.json, 명령 처리): 고지 복원·음성 없음·Play 완료·AdMob 완료·이름 후보 제안·Apple 완료·유료 광고 보류·사진 재질 A안
- 2026-11-14 [auto] 목표 시간 하한 보정(16판) → PR #6 (병합)
- 2026-11-14 AdMob 아이폰·안드로이드 실제 앱 ID·광고 ID 반영(main 9a5ed8e·040c340)
- 2026-11-13 [auto] 첫 판 조작 안내: 세제가 없는 판에서는 세제 단계 문구 교체 → PR #1 (병합)
- 2026-11-13 [auto] 제휴 링크가 비어 있는 실제 제품 목록 정리 → `state/affiliate-links.md`
- ~~15판 너무 쉬움~~ 기각(2026-11-14): 방 구역 '가볍게 시작' 구간이라 의도된 쉬움
