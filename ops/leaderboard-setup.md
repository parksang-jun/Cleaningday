# 랭킹 설정 (Game Center · Play 게임)

점수 = 모은 별 총합. 클리어할 때마다, 앱을 켤 때마다 올린다. 홈 화면 오른쪽 위 🏆 로 연다(앱에서만 보임).
코드: `src/leaderboard.ts`, `ios/App/App/AppDelegate.swift`(LeaderboardPlugin), `android/.../LeaderboardPlugin.java`.

## iOS — App Store Connect

1. 앱 → 성장 및 마케팅 → **Game Center** → 순위표 `+`
   - 유형: 클래식 / 참조 이름: Total Stars / **순위표 ID: `total_stars`** (코드와 같아야 함)
   - 점수 형식: 정수 / 제출 유형: 최고 점수 / 정렬: 높은 순 / 범위: 0 ~ 288
   - 현지화(한국어·영어·일본어): 이름 "모은 별" / "Total Stars" / "集めた星", 단위 "★"
2. 버전(1.3) 페이지 → Game Center 켜기 → 방금 만든 순위표 선택 → 심사 제출에 포함
3. Xcode: 권한 파일(`App.entitlements`)은 저장소에 들어 있다. Signing & Capabilities 에 Game Center 가 보이면 끝.
   서명 오류가 나면 `+ Capability → Game Center` 를 한 번 눌러 준다.

## Android — Play Console

1. Play 게임즈 서비스 → 설정 및 관리 → 설정 → "아니요, 내 게임에서 Google API를 사용하지 않습니다" → 만들기
2. 사용자 인증 정보 추가 → Android → OAuth 클라이언트 생성(패키지 `io.github.parksangjun.cleaningday`,
   SHA-1 은 Play Console → 앱 무결성 → **앱 서명 키** 의 값). 테스트용으로 업로드 키 SHA-1 도 하나 더 추가.
3. 순위표 → 만들기: 이름 "모은 별", 정수, 클수록 좋음
4. "리소스 보기" 에 나오는 두 값을 `android/app/src/main/res/values/strings.xml` 에 채운다
   - `game_services_project_id` (숫자 12자리 안팎)
   - `leaderboard_total_stars` (`CgkI…` 로 시작)
   둘 다 공개돼도 되는 식별자다(비밀 값 아님). 비어 있으면 랭킹만 꺼지고 게임은 그대로 돈다.
5. 테스터 탭에 본인 계정 추가 → 게시(검토 후 공개)

## 확인 (실기기)

- 🏆 → 순위표가 뜨고 내 별 수가 올라가 있는지
- Game Center / Play 게임 로그아웃 상태에서 🏆 → 로그인 창 또는 안내 문구, 게임은 멈추지 않는지
- 한 판 클리어 후 점수가 늘었는지 (반영에 몇 분 걸릴 수 있음)
