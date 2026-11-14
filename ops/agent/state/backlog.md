# 개선 백로그 (위에서부터 처리)

표시: `[auto]` 에이전트가 PR 로 처리 가능 · `[승인]` Peter 결정 필요

> 결재가 필요한 일은 여기 한 줄로만 적지 말고 **`state/approvals.json` 에 결재 요청서**(무엇을·왜·정확한 절차·비용·선택지)로 올린다. 아래 `[승인]` 줄은 요청서가 아직 없는 임시 메모다.

정렬 기준: (영향 받는 사람 수 × 심각도) ÷ 작업량. 최근 정렬 2026-11-13(제품개선팀).

> 2026-11-14 운영팀(루틴 A) 메모: 이 파일의 최신판은 열린 PR #8·#9 브랜치에 있다(main 은 병합 전이라 낡음). 아래 '진행 중'은 그 내용을 반영했다. 병합 시 충돌하면 PR #9 쪽을 기준으로 하고 app-ads.txt 줄만 옮긴다.

## 진행 중 (PR 올림, 병합은 승인)
- [auto] 목표 시간 하한 보정 → PR #6 `agent/2026-11-14-improve-par-floor`
- [auto] '새 아이템' 알림 정리 → PR #9 `agent/2026-11-14-improve-newitem-toast`
- [auto] 판매몰 제휴 고지 복원 → PR #7 `agent/2026-11-14-affiliate-disclosure`
- [auto] app-ads.txt 파일(`store/app-ads.txt`) + 앱 ID 와 게시자 ID 일치 검사 → `agent/2026-11-14-app-ads-txt`. 올릴 주소는 결재 `app-ads-host` (근거: AdMob 도움말 9363762 — 개발자 웹사이트 최상위에서만 찾음, `parksang-jun.github.io` 저장소 없음 11-14 확인)

## 다음에 처리 (위에서부터)
- [auto] e2e 실행 준비 자동화: playwright 가 의존성에 없어 로컬에서 매번 `npm install --no-save playwright@1.63.0` + `npx playwright install chromium` 필요(11-14 루틴 A 에서도 재발)
- [auto] 난이도 요철 다듬기: 2배 넘게 급등하는 판(66·75·77·96 등)과 너무 쉬운 15판의 오염량을 앞뒤와 고르게. 구역 첫 판의 쉬운 시작은 유지 (근거: 2026-11-13 봇 플레이테스트, 17군데)
- [auto] 제휴 링크를 코드에 담을 자리 만들기(제품별 링크 칸) — 결재 `affiliate-accounts` 가 끝나 링크를 받으면 바로 넣을 수 있게 (근거: 운영자 모드 링크는 기기에만 저장됨)
- [auto] e2e 소요 시간 줄이기(10분 → 5분 목표: 대기 시간 정리, 구간 병렬화)
- [auto] 3D 보기(실험, 꺼져 있음) 코드 유지 여부 검토 — 번들에서 분리돼 있어 비용은 없음

## 결재 대기 (요청서는 approvals.json)
- [승인] 쿠팡 파트너스·Amazon Associates 가입과 제휴 링크 발급 → `affiliate-accounts` (목록: `state/affiliate-links.md`, 25개 전부 비어 있음)

## 끝난 것
- 2026-11-13 [auto] 첫 판 조작 안내: 세제가 없는 판에서는 세제 단계 문구를 '이번 판은 세제 없이 도구만으로'로 교체 → PR #1
- 2026-11-13 [auto] 제휴 링크가 비어 있는 실제 제품 목록 정리 → `state/affiliate-links.md`
