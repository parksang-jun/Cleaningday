# Google Play 등록 자료 (초안, 2026-11-16)

Play Console 에 붙여 넣을 자료와 제출 전 점검 결과. 실제 제출은 사장님 몫(권한표).

## 1. 붙여 넣을 글 — `listing.json`
| Play Console 칸 | listing.json 키 | 제한 |
|---|---|---|
| 앱 이름 | `locales.<언어>.title` | 30자 |
| 간단한 설명 | `shortDescription` | 80자 |
| 자세한 설명 | `fullDescription` | 4000자 |
| 출시 노트 | `releaseNotes` | 500자 |

언어: 한국어(ko-KR, 기본) · 영어(en-US) · 일본어(ja-JP). 중국어·힌디어는 결재 `app-names-zh-hi-pick` 결정 뒤 추가.
글자 수·앱 설정과의 일치·금지 내용(효능 수치·연락처·브랜드)은 `npx vitest run src/__tests__/playListing.test.ts` 로 검사한다.

## 2. 고정 값
| 항목 | 값 | 근거 |
|---|---|---|
| 개발자 이름 | Martin park | 결재 play-developer-name (2026-11-13 메모 그대로) |
| 패키지 이름 | io.github.parksangjun.cleaningday | capacitor.config.ts · android/app/build.gradle |
| 개인정보처리방침 | https://parksang-jun.github.io/Cleaningday/privacy.html | docs/privacy.html (GitHub Pages) |
| 카테고리 | 게임 › 캐주얼 | |
| 광고 포함 | 예 | AdMob |
| 버전 | 1.0 (versionCode 1) | android/app/build.gradle |

## 3. 제출 전 점검 결과
| 항목 | 상태 | 할 일 |
|---|---|---|
| 앱 아이콘 512×512 | 있음 (`public/icon-512.png`) | — |
| 그래픽 이미지 1024×500 | **없음** | 만들어야 제출 가능 → backlog [auto] |
| 휴대전화 스크린샷 2~8장 | **규격 초과** | `store-assets/` 는 1179×2556·1320×2868(긴 변/짧은 변 ≈ 2.17). Play Console 도움말(answer/9866151): 긴 변은 짧은 변의 2배 이하, 320~3840px, 세로 권장 9:16(1080×1920 이상) → 9:16 판을 `scripts/store-shots.mjs` 로 따로 뽑기 → backlog [auto] |
| 개인정보처리방침의 운영자 이름 | **개발자 이름과 다름** | 방침은 "Sangjun Park / 박상준", 스토어 개발자 이름은 "Martin park". 법적으로 문제라고 단정할 수는 없지만, 심사·이용자 혼동을 줄이려면 방침에 "Martin park(박상준)"처럼 함께 적는 것을 권장 → 사장님 확인 후 반영 |
| 개발자 이름 대소문자 | 확인 필요 | 메모가 "Martin park"(소문자 p). Play Console 에 실제로 그렇게 등록됐는지 한 번 확인 |
| 데이터 보안(Data safety) | 아래 4절 초안 | AdMob SDK 공개 문서 기준으로 사장님이 최종 확인 |
| 타겟층 | 만 13세 이상(어린이 대상 아님) | 방침 4절과 일치. 어린이 대상으로 두면 맞춤 광고가 막힘 |
| 앱 권한 | INTERNET (+ 플러그인이 자동으로 넣는 알림·광고 ID 권한) | 빌드된 AAB 의 최종 권한 목록을 콘솔에서 확인 |

## 4. 데이터 보안(Data safety) 설문 초안
- 데이터 수집: 예 / 전송 중 암호화: 예(AdMob 은 HTTPS) / 삭제 요청 방법: 계정 없음 → 앱 삭제로 기기 데이터 삭제
- 수집·공유 항목(AdMob 때문): 기기 또는 기타 ID(광고 ID) · 대략적 위치(IP 기반) · 앱 활동/앱 상호작용(광고 상호작용) · 앱 정보 및 성능(비정상 종료 로그·진단, SDK 가 보내는 경우)
- 목적: 광고 또는 마케팅, 분석, 사기 방지·보안
- 게임 자체 수집: 없음(진행 상황은 기기에만 저장, `src/analytics.ts` 는 아직 외부 전송 없음)
- ※ 위 항목은 Google 의 AdMob 데이터 공개 안내를 기준으로 사장님이 최종 확인해야 한다(에이전트는 이번 실행에서 웹 확인 못 함).

## 5. 비공개 테스트(테스터 12명 · 14일) 안내문

개인 계정은 프로덕션 출시 전에 비공개 테스트를 거쳐야 한다(테스터 12명 이상이 14일 연속 참여). 아래는 테스터에게 보낼 안내문 초안 — **발송은 사장님이 직접**.

### 한국어
> 안녕하세요! 제가 만든 청소 게임 **싹싹 클린**의 출시 전 테스트에 참여해 주실 수 있을까요?
> 구글 정책상 출시 전에 12명이 14일 동안 설치해 두어야 해서 부탁드립니다.
>
> 1. 안드로이드 폰에서, 알려 주신 Gmail 계정으로 아래 '테스트 참여' 링크를 엽니다.
> 2. '테스터 되기'를 누른 뒤 Play 스토어에서 설치합니다.
> 3. **14일 동안 지우지 말고** 가끔 한 판씩 해 주세요(하루 1분이면 충분합니다).
> 4. 불편한 점이나 막힌 판이 있으면 편하게 알려 주세요.
>
> 테스트 참여 링크: (Play Console '비공개 테스트 › 테스터' 화면의 링크를 붙여 넣기)
> 고맙습니다!

### English
> Hi! Could you help me test my cleaning game **Sparkle Clean** before launch?
> Google requires 12 testers to keep the app installed for 14 days before it can go live.
>
> 1. On an Android phone, open the opt-in link below while signed in with the Gmail address you gave me.
> 2. Tap "Become a tester", then install from Google Play.
> 3. **Keep it installed for 14 days** and play a stage now and then (a minute a day is plenty).
> 4. Tell me anything that felt off or any stage where you got stuck.
>
> Opt-in link: (paste from Play Console › Closed testing › Testers)
> Thank you!

### 사장님 순서(요약)
1. Play Console '테스트 › 비공개 테스트'에서 트랙을 만들고 AAB(`ops/android-release.md` 2절)를 올린다.
2. '테스터' 탭에서 이메일 목록을 만들어 테스터 Gmail 12개 이상을 넣는다.
3. 참여 링크를 복사해 위 안내문과 함께 보낸다.
4. 14일이 지나면 '프로덕션 액세스 신청'.
