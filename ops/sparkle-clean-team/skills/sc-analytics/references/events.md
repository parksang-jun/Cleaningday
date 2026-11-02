# 이벤트 사전 (2026-11-02 코드 grep 기준 — 작업 전 `grep -rn "track(" src` 로 재확인)

## 코드에 이미 있는 이벤트 (`src/analytics.ts` `track()`)

| 이벤트 | 파라미터 | 발생 위치·시점 |
|---|---|---|
| level_start | level | `main.ts` `startLevel()` — 스테이지 진입 |
| level_quit | level, clean(0~100 정수 %) | `main.ts` 뒤로 버튼 — 미완료 이탈 |
| level_complete | level, stars, time(초), damage(0~100 %), hazard(bool) | `main.ts` `finishLevel()` — 95% 달성 |
| surface_harm | item, surface | `main.ts` `handleEvents()` — 표면 손상(1.5초 쿨다운마다 1회) |
| hazard_mix | level | `main.ts` — 염소계↔산성 혼합(세션당 최대 1회) |
| shop_buy | item | `main.ts` `openShop()` — 코인으로 아이템 해금 |
| sponsor_item_select | sponsor, level | `main.ts` `renderToolbar()` — 툴바에서 스폰서 아이템 선택 |
| sponsor_evidence_view | sponsor | `main.ts` `openEvidence()` — 근거 화면 열림(상점 버튼 또는 선택된 스폰서 재탭) |
| ad_rewarded_request | placement(`double_coins`, `try_item`) | `ads/index.ts` `showRewarded()` |
| ad_rewarded_earned / ad_rewarded_failed | placement, provider | `ads/index.ts` |
| ad_interstitial_shown | provider | `ads/index.ts` `maybeShowInterstitial()` |
| ads_init / ads_init_error | provider(, message) | `ads/index.ts` `init()` |
| ads_consent_error, ads_interstitial_load_error, ads_rewarded_load_error, ads_interstitial_show_error, ads_rewarded_show_error, ads_banner_error | message | `ads/admob.ts` |

주의: `blocked`(고압세척기 실내 사용 등) 이벤트는 토스트만 있고 track 없음. 앱 시작 이벤트 없음.

## 추가 권장 이벤트(`sc-dev` 구현)

| 이벤트 | 파라미터 | 목적 | 우선순위 |
|---|---|---|---|
| app_open | platform, lang | DAU·리텐션 분모 | P0 |
| ad_offer_shown | placement | RV 옵트인 분모(결과 화면·상점 체험 버튼 노출) | P0 |
| sponsor_impression | sponsor, placement(`toolbar`/`shop`), level | 광고주 노출 수(세션·화면당 1회로 중복 제거 규칙 명시) | P0(스폰서 라이브 전) |
| sponsor_level_clear | sponsor, level, used_sec | 스폰서 아이템을 사용한 스테이지 클리어 | P0(스폰서 라이브 전) |
| sponsor_link_click | sponsor | 제품 페이지 이동(CPC 모델 도입 시, 링크 UI 신규 필요) | P1 |
| item_select | item, level | 도구 전환 빈도·학습 | P1 |
| item_blocked | item, surface | 사용 제한 학습 | P2 |
| first_scrub | seconds_since_open | 온보딩 퍼널 | P1 |
| session_end | duration_s, levels | 세션 정의 보조 | P2 |

## 연결 방법

- 네이티브: `@capacitor-firebase/analytics` 설치(Capacitor 8 호환 버전 확인) → `onTrack((name, params) => FirebaseAnalytics.logEvent({ name, params }))`.
- 웹: GA4 gtag 또는 포털 대시보드. GA4 이벤트명·파라미터 수 제한은 현행 문서 확인.
- 개인정보: 사용자 ID·광고 ID를 분석 이벤트에 넣지 않는다. 동의(UMP) 전 분석 전송 보류 여부·아동 타깃 시 분석 범위는 `sc-cs` 와 확인.

## 파생 지표 정의

- DAU: 해당 일 `app_open` 고유 기기 수(이벤트 추가 전에는 `level_start` 고유 기기로 근사 — "근사" 표기)
- 리텐션 Dn: 설치일 코호트 중 n일 후 `app_open` 비율(캘린더 일 기준)
- 스테이지 퍼널: level_complete(level=n) 고유 사용자 / 설치 코호트
- 스테이지 이탈률: level_quit / level_start (level별)
- 시간 배율: 스테이지별 level_complete.time 중앙값 / parSec (봇 시간과 비교)
- 손상률: surface_harm 발생 세션 / level_start, 위험 혼합률: hazard_mix / level_start(level 7·12)
- Ad ARPDAU: AdMob 일 매출 / DAU (포털은 포털 매출)
- RV 옵트인율: ad_rewarded_request / ad_offer_shown (placement별)
- 스폰서 선택률: sponsor_item_select / sponsor_impression(toolbar), 근거 조회율: sponsor_evidence_view / sponsor_item_select
