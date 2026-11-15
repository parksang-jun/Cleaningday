# 안드로이드(구글 플레이) 출시 절차

## 0. 준비물
- 구글 플레이 개발자 계정 ($25, 한 번만 결제)
- 키스토어(서명 키) — **잃어버리면 앱 업데이트를 영영 못 낸다.** 반드시 따로 백업할 것

## 1. 키스토어 만들기 (맥에서 한 번만)
```bash
bash ops/make-keystore.sh
```
`android/sparkle-release.jks` 와 `android/keystore.properties` 가 만들어진다.
둘 다 저장소에 올라가지 않는다(.gitignore). 외장 디스크나 비밀번호 관리자에 따로 보관할 것.

## 2. AAB 만들기
```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
```
결과물: `android/app/build/outputs/bundle/release/app-release.aab`

## 3. 플레이 콘솔에 올리기
https://play.google.com/console → 앱 만들기 → 프로덕션(또는 비공개 테스트) → 새 버전 → AAB 업로드

## 4. 스토어 등록정보에 필요한 것
| 항목 | 값 / 규격 |
|---|---|
| 앱 이름 | 싹싹 클린 - 청소 게임 (30자) |
| 간단한 설명 | 80자 |
| 자세한 설명 | 4000자 |
| 앱 아이콘 | 512x512 PNG |
| 그래픽 이미지 | 1024x500 PNG (플레이 전용, 따로 만들어야 함) |
| 스크린샷 | 2~8장, 폰용 (store-assets 의 것을 그대로 쓸 수 있다) |
| 개인정보처리방침 | https://parksang-jun.github.io/Cleaningday/privacy.html |

## 5. 콘텐츠 관련 설문 (전부 채워야 제출 가능)
- 콘텐츠 등급 설문
- 데이터 보안(Data safety) — AdMob 때문에 기기 ID·대략적 위치·광고 데이터 수집으로 신고
- 타겟층 및 콘텐츠 — **어린이 대상으로 하지 말 것** (맞춤 광고가 막힌다)
- 광고 포함 여부: 예

## 6. 개인 계정의 비공개 테스트 요건
2023년 11월 이후에 만든 **개인(individual)** 개발자 계정은 프로덕션 출시 전에
비공개 테스트를 거쳐야 한다. 테스터 12명 이상이 14일 연속 참여해야 신청할 수 있다.
사업자(organization) 계정은 해당 없다.
→ 계정 종류를 먼저 확인하고, 개인 계정이면 테스터 12명을 먼저 모을 것.
