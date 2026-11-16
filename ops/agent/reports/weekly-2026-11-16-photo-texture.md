# 주간 운영 점검 2026-11-16 (루틴 A · 두 번째 실행)

> 같은 날 앞선 실행이 PR #19(주간 점검·e2e 준비)·#18(Play 등록 자료)을 이미 올렸다. 이 실행은 겹치지 않게 **백로그 맨 위 `[auto]` 1건(사진 재질)** 만 맡았다. 주간 점검 본문은 `weekly-2026-11-16.md`(PR #19) 참고.

## 요약 5줄
1. 테스트: tsc 통과 · 단위 73/73(새 8개 포함) · build 통과 · e2e 는 아래 '검사 결과' 참고.
2. 구현: 사진 재질 1단계 — 재질 사진 자리(`src/assets/materials/wood·tile·steel`) + 마루 나뭇결 연결. 사진이 없으면 지금 화면 그대로.
3. 막힌 것: 무인 실행이라 외부 다운로드(Poly Haven)가 승인 필요로 막혀 실제 CC0 사진 파일은 아직 없음 → 2단계로 backlog.
4. 지표: 없음(출시 전, `state/metrics/` 없음). 게이트(D1 30%·D7 10%) 판정 불가.
5. 정책: Apple 연령 등급 '콘텐츠 설명' 항목 신설(11-16~), AdMob 안드로이드 구 SDK 지원 종료 예고(2027-06, 제3자 보도) → backlog 2건.

## 한 일
- `src/render/photos.ts`: 재질 사진 자리(`mat:wood|tile|steel`) 와 불러오기 목록 `materialPhotoKeys()`.
- `src/render/materials.ts`: `grayCentered()`(사진을 회색 + 평균 128 로 바꿔 '결'만 쓰고 장면 색은 유지), `woodGrainTile()` 이 마루 사진이 있으면 사진 결을 쓰고 없으면 기존 캔버스 무늬.
- `src/render/renderer.ts`: 장면 사진과 함께 재질 사진도 불러오고, 늦게 도착하면 바탕을 다시 그림(기존 방식 그대로).
- `src/assets/materials/README.md`: CC0 출처 규칙·출처표.
- `src/render/materials.test.ts`: 8개 테스트.

## 검사 결과
- `npx tsc --noEmit` 통과, `npx vitest run` 11 파일 73/73 통과, `npm run build` 통과.
- e2e: 결과는 아래 'e2e' 줄(실행 후 기입).
- 참고(환경): 로컬에서 `node scripts/e2e.mjs` 를 **기본 모드**로 돌리면 1판이 한 번 문지르기로 끝나 '배경음악 스텝' 검사에서 실패한다(변경 전 main 도 동일하게 2회 재현). CI 는 `CI=true`(문지르기 속도 조절·배율 1)로 돌려 통과한다. 로컬도 `CI=true` 로 돌려야 같은 조건.
- 실패한 실행이 남긴 미리보기 서버가 4174 포트를 잡고 있어(종료는 승인 필요) 임시 사본(포트 4175, 커밋 안 함)으로 돌렸다.

## 지표
없음.

## 정책·SDK 확인 (웹)
- Apple: App Store Connect 에 2026-11-16 부터 연령 등급용 새 콘텐츠 설명 항목. 심사 지침 최신 개정은 2026-10-16(2.3.14 광고 소재 규칙 등). iOS 제출 전 설문 재확인 필요. [Apple Developer News](https://developer.apple.com/news/)
- AdMob: 안드로이드는 Next-Gen SDK 가 권장, 구 SDK 지원 종료 2027-06-30 이라는 보도(공식 확인 필요). [PPC Land](https://ppc.land/google-forces-android-developers-off-legacy-mobile-ads-sdk-by-2028/)
- Google Play·쿠팡 파트너스·Amazon Associates: 이번 실행에서 검색 결과 못 받음(시간 초과) — 다음 주 재확인.

## 승인 요청 목록
새 요청 없음. 기존 열린 결재(approvals.json):
- `play-developer-name` — Play 개발자 이름 적기
- `app-names-zh-hi-pick` — 중국어·힌디어 앱 이름 고르기
- `app-ads-host` — app-ads.txt 올릴 주소(A안 권장)
- `affiliate-accounts` — 쿠팡 파트너스 가입·추적 코드
- `ad-channels` — 홍보용 SNS 계정
- `sponsor-outreach-send` — 광고주 제안 메일 발송 시점
- PR 병합 대기: #7 #9 #10 #11 #12 #18 #19 + 이번 PR

## 다음 주
- 사진 재질 2단계(CC0 마루 사진 넣기 → 타일 → 스테인리스), 전후 스크린샷·용량 기록.
- Apple 콘텐츠 설명·AdMob SDK 전환 조사.
