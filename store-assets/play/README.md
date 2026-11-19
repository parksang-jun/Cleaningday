# Google Play 등록 자료

| 항목 | 파일 |
|---|---|
| 앱 아이콘 512×512 | `icon-512.png` |
| 그래픽 이미지 1024×500 (한국어) | `feature-ko-1024x500.png` |
| 그래픽 이미지 1024×500 (영어) | `feature-en-1024x500.png` |
| 휴대전화 스크린샷 1080×1920 (한국어) | `../ko-1080x1920/1-home.png` … `5-result.png` |
| 휴대전화 스크린샷 1080×1920 (영어) | `../en-1080x1920/` |

Play 스크린샷은 긴 변이 짧은 변의 2배를 넘으면 거절된다. App Store용(1320×2868)은 쓸 수 없어 1080×1920을 따로 만든다:
`SHOT_SIZES=1080x1920 node scripts/store-shots.mjs` · 그래픽 이미지는 `node scripts/play-feature.mjs`.

## 기본 스토어 등록정보 — 한국어
- 앱 이름: `싹싹 클린 - 청소 게임`
- 간단한 설명(80자): `문지르면 반짝! 얼룩에 맞는 도구와 세제를 골라 집·정원·자동차를 닦는 힐링 청소 게임`
- 자세한 설명: App Store 한국어 설명과 같은 글을 쓴다.

## English (United States)
- App name: `Sparkle Clean - Cleaning Game`
- Short description: `Scrub it till it shines! Pick the right tool and cleaner for every stain.`

## 앱 콘텐츠 답안
- 개인정보처리방침: `https://parksang-jun.github.io/Cleaningday/privacy.html`
- 앱 액세스 권한: 모든 기능을 제한 없이 이용 가능
- 광고: 예, 광고 포함
- 콘텐츠 등급: 게임 · 폭력/성적/언어/약물/도박 모두 아니요
- 타겟층: 13세 이상 (어린이 대상 아님)
- 데이터 보안: 수집함 — 대략적인 위치(광고), 기기 또는 기타 ID(광고), 앱 상호작용·진단(광고·분석). 전송 중 암호화 예. 계정 없음 → 삭제 요청 방법은 개인정보처리방침 주소.
- 광고 ID: 사용함 (광고)
- 정부 앱·금융 기능·건강: 아니요
