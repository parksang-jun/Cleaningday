# 코드 지도 — 어디를 고치나 (2026-11-02 기준)

| 하고 싶은 일 | 파일 | 메모 |
|---|---|---|
| 오염·표면·도구·세제 정의와 상성표 | `src/game/catalog.ts` | `DIRT_TYPES`(dust·mud·grease·stain·scale·mold), `SurfaceType` 8종, `DIRT_RESIST`, `DIRT_COLOR`, `BASE_TOOLS`(cloth·sponge·brush·vacuum·washer: radius·power·effect·harms·onlyOn·cost), `BASE_DETERGENTS`(allpurpose·degreaser·descaler·moldremover: radius·soakSec·mult·chemistry·harms·cost) |
| 위험 혼합 규칙 | `catalog.ts` `isHazardMix()` | 현재 염소계(chlorine)↔산성(acid)만. `Chemistry` = neutral·alkaline·acid·chlorine |
| 스폰서 제품 → 게임 성능 환산·검증 | `src/game/sponsor.ts` | `SponsorProduct`·`LabResult`·`Evidence` 타입, `REFERENCE_REMOVAL`·`REFERENCE_COVERAGE`(임시값, 운영사 실측으로 갱신), `RATIO_MIN/MAX` 0.5/1.8, `performanceRatios()`, `validateSponsor()`, `toItemSpec()`, `SAMPLE_SPONSORS`(가상 2종) |
| 아이템 목록 조립 | `src/game/items.ts` | `activeSponsors()`(검증 통과분만, 기본 인자 = 샘플), `allItems()`, `findItem()`, `grantsUpTo()`(스테이지별 지급 누적), `strengths()`(도구 effect ≥ 0.9, 세제 mult ≥ 1.5 를 "잘 듣는 오염"으로 표시) |
| 스테이지 정의 | `src/game/levels.ts` | `LEVELS` 12개, `LevelDef`(scene·surface·patches·parSec·grants·hint), `GRID_W=48`·`GRID_H=64`, `SceneId` |
| 청소 세션 엔진 | `src/game/engine.ts` | `CleanSession`: 시드 기반 얼룩 생성, `scrub()`(제거율 = power×effect×세제배율×가장자리감쇠 ÷ DIRT_RESIST), `spray()`(soakSec 동안 불림, 위험 혼합 감지), `checkHarm()`(손상 +0.12/초), `canUse()`(onlyOn), `PASS_CLEAN=0.95` |
| 별·코인 | `engine.ts` `scoreSession()` | 별 3 시작: parSec 초과 −1, 2배 초과 추가 −1, 손상 ≥ 15% −1, 위험 혼합 −1, 최소 1. 코인 = 20 + 별×10 |
| 시드 난수·날짜 | `src/game/rng.ts` | `mulberry32`, `hashString`, `dateKey()`, `dailySeed()`(현재 미사용 — 데일리 청소 모드에 활용), `randomSeed()`. `CleanSession` 기본 시드는 `level.id × 7919` |
| 단위 테스트 + 밸런스 봇 | `src/game/game.test.ts` | 9개. `simulate()` 봇이 스테이지별 시간을 `/tmp/balance.txt` 에 기록, `parSec×1.3` 미만 단언 |
| 장면 배경 그리기 | `src/render/scene.ts` | `paintScene()` 장면별 절차적 그리기(원목·타일·유리 등) |
| 오염층·거품·반짝임·커서 | `src/render/renderer.ts` | `Renderer`: 저해상도 격자 확대, 화학 계열별 거품색 `FOAM`, `burst()`, `toGrid()` |
| 앱 흐름·UI | `src/main.ts` | 홈(스테이지 목록) → `startLevel()` → `step()` → `finishLevel()` → `showResult()`(코인 2배 RV, 이후 전면 광고) / `openShop()`(구매·RV 체험·스폰서 근거) / `openEvidence()` / `openSettings()`. 스폰서 아이템은 무료 사용(`owns()`), 사용 불가 표면에선 툴바 숨김. 디버그 훅 `window.__sparkle`(e2e 전용) |
| 광고 공급자·노출 정책 | `src/ads/index.ts` | `AdsController`, `INTERSTITIAL_MIN_GAMES=2`, `INTERSTITIAL_MIN_INTERVAL_MS=150_000`, 첫 스테이지 제외(`stats.gamesPlayed <= 1`) |
| AdMob 세부(동의·프리로드) | `src/ads/admob.ts` | 테스트 ID 기본값, `.env` 로 교체, `VITE_ADMOB_TESTING`, 배너는 `VITE_ADMOB_BANNER=true` 일 때만 |
| 웹 포털 SDK | `src/ads/poki.ts`, `src/ads/crazygames.ts`, `src/ads/noop.ts`, `src/ads/types.ts` | 빌드 시 `VITE_AD_PROVIDER` |
| 문자열 | `src/i18n.ts` | ko/en/ja, 키는 en 기준 타입. ko 앱명 "싹싹 클린", ja "ピカピカクリーン" |
| 효과음 | `src/audio.ts` | WebAudio 합성: 문지르기(필터 노이즈, 도구별 주파수), 분사, 반짝임, 별, 완료, 경고 |
| 아이콘 | `src/ui/icons.ts` | 아이템 인라인 SVG(`iconFor(base)`) — 스폰서도 base 아이콘 사용 |
| 저장 | `src/storage.ts` | 키 `sparkle-clean-v1`: settings, stats(gamesPlayed·totalCleanedCells), ads, progress(unlocked·stars·bestTime), coins, owned |
| 분석 | `src/analytics.ts` | `track()`/`onTrack()` — SDK 미연결 |
| 네이티브 설정 | `capacitor.config.ts`, `android/app/src/main/AndroidManifest.xml`, `ios/App/App/Info.plist` | appId, AdMob 앱 ID(현재 테스트), ATT 문구 |
| 개인정보 처리방침 | `public/privacy.html` | TODO: 운영자 상호·주소·이메일·책임자 |
| 웹 매니페스트·아이콘 | `public/manifest.webmanifest`, `public/favicon.svg`, `public/icon-*.png` | |
| 아이콘·스플래시 원본 | `resources/`, `scripts/make-icons.mjs` | Playwright로 SVG→PNG, `npx @capacitor/assets generate` |
| E2E | `scripts/e2e.mjs` | preview :4174, 드래그 청소→결과→코인 2배→세제 효과→원목 손상 경고→위험 혼합 모달→상점 "Ad" 라벨→근거 화면(92%, 115% vs standard)→ko 화면. 스크린샷 `screenshots/01~11` |
| 빌드 설정 | `vite.config.ts` | `base: './'`, es2020, vitest node 환경 |

## 분석 이벤트(현재 코드에서 발생)

`level_start{level}`, `level_quit{level,clean}`, `level_complete{level,stars,time,damage,hazard}`, `surface_harm{item,surface}`, `hazard_mix{level}`, `shop_buy{item}`, `sponsor_item_select{sponsor,level}`, `sponsor_evidence_view{sponsor}`, `ads_init{provider}`, `ads_init_error`, `ad_interstitial_shown{provider}`, `ad_rewarded_request{placement}`, `ad_rewarded_earned/failed{placement,provider}`(placement: `double_coins`, `try_item`), `ads_consent_error`, `ads_{interstitial,rewarded}_{load,show}_error`, `ads_banner_error`. `app_open` 은 없음.
