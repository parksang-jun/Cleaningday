# 싹싹 클린 (Sparkle Clean) — 청소 캐주얼 게임

Jelly Blocks(블록 퍼즐)를 대체하는 2027 출시용 광고 수익형 게임. 손가락으로 문질러 오염을 지우는 "보는 맛" 캐주얼 게임이며, **나중에 실제 청소 도구·세제 광고주가 들어오면 그 제품의 실제 성능과 기능대로 게임 속에서 청소되도록** 설계했다.

| 항목 | 내용 |
|---|---|
| 스택 | TypeScript · Vite 8 · Canvas 2D · Capacitor 8 (Android/iOS, appId `com.sparkleclean.app`) |
| 광고 | AdMob(네이티브: 보상형·전면, UMP/ATT 동의) · Poki/CrazyGames SDK(웹 포털) · 개발용 Noop — `src/ads/` |
| 언어 | 한국어 · English · 日本語 (`src/i18n.ts`) |
| 저장 | 기기 로컬(Preferences/localStorage) — 계정 없음 |
| 테스트 | `npm test` (vitest 9개: 엔진·밸런스 봇·스폰서 환산) · `npm run e2e` (Playwright, 실제 드래그로 청소) |

## 1. 게임 규칙

- 12단계: 거실 마루 → 현관 진흙 → 주방 타일 얼룩 → 가스레인지 기름때 → 창문 → 샤워부스 물때 → 욕조 곰팡이 → 원목 식탁 → 패브릭 소파 → 돌 테라스 → 자동차 보닛 → 봄맞이 대청소.
- **오염 6종 × 도구 5종 × 세제 4종** 상성표(`src/game/catalog.ts`): 먼지는 걸레·청소기, 진흙은 스펀지·고압세척기, 기름때는 기름때 제거제, 물때는 산성 물때 제거제, 곰팡이는 곰팡이 제거제가 잘 듣는다. 세제는 **뿌린 뒤 문질러야** 효과(불림 시간 9~12초).
- **표면 손상**: 유리·자동차 도장에 솔(흠집), 원목에 알칼리·염소계 세제, 실내에 고압세척기(사용 불가) → 경고 + 손상 누적 → 별 감점.
- **위험 혼합**: 곰팡이 제거제(염소계)와 물때 제거제(산성)가 같은 곳에서 겹치면 "유독가스" 경고 + 별 감점 — 실제 청소 안전 수칙을 게임으로 학습.
- 청결도 95% 달성 시 완료. 별 3개 기준: 목표 시간 이내 · 손상 15% 미만 · 위험 혼합 없음. 코인 = 20 + 별×10 → 상점에서 솔·청소기·고압세척기·세제 해금.
- 광고 위치: 결과 화면 "광고 보고 코인 2배"(보상형), 상점 "광고 보고 이번 판 무료 체험"(보상형), 결과 후 전면 광고(첫 판 제외, 2판·150초 간격 — `src/ads/index.ts`).

## 2. 스폰서(광고주) 제품 = 실제 성능대로 청소

`src/game/sponsor.ts` 가 광고주 제품의 **시험 성적**을 게임 성능으로 바꾼다.

| 원칙 | 구현 |
|---|---|
| 근거만으로 성능 결정 | 오염별 `제거율(%) ÷ 같은 시험의 일반 기준 제품 제거율` = 배율. 근거 없는 오염은 1.0(일반 제품과 동일) |
| 과장 방지 | 배율 0.5~1.8로 제한, 성적서·시험기관·날짜 없으면 노출 안 함(`validateSponsor`) |
| 기능 반영 | 도구는 1분당 닦는 면적 → 브러시 반경, 세제는 화학 계열(염소·산·알칼리·중성) → 위험 혼합 규칙 |
| 라벨 주의사항 반영 | 제품 라벨의 사용 금지 재질 → 게임에서도 그 표면에 쓰면 손상 |
| 광고 표시 | 툴바·상점에 "광고" 배지, 성능 근거 화면(시험기관·성적서·방법·오염별 일반 제품 대비 %) |
| 캠페인 | 시작/종료일 밖이면 자동 숨김 |

현재는 **가상 브랜드 샘플 2종**(BrightMax 기름때 제거제, AquaJet 무선 고압세척기)이 "샘플·가상 브랜드" 표시와 함께 들어 있다. 실제 광고주가 오면 `SAMPLE_SPONSORS` 를 원격 설정(예: Supabase 테이블·Remote Config)에서 받아오도록 바꾸고 샘플은 삭제한다.

### 광고주 제출 자료 (온보딩 스펙)

```ts
{
  id, brand, name,
  kind: 'tool' | 'detergent',
  base: 'cloth' | 'sponge' | 'brush' | 'vacuum' | 'washer' | 'allpurpose' | 'degreaser' | 'descaler' | 'moldremover',
  lab: [{ dirt: 'grease', removalPct: 92 }, ...],   // 오염별 제거율 — 시험 방법을 명시한 성적서 필수
  coverageM2PerMin?: 7.5,                           // 도구: 1분당 처리 면적
  chemistry?: 'neutral' | 'alkaline' | 'acid' | 'chlorine',
  cautions: ['wood', 'paint'],                      // 라벨의 사용 금지 재질
  evidence: { lab, reportId, date, protocol, url? },
  campaign: { start, end },
}
```

- `REFERENCE_REMOVAL`(일반 기준 제품 제거율)은 현재 가정값이다. **출시 전 운영사가 같은 시험 방법으로 무브랜드 제품을 직접 시험해 갱신**해야 광고주 간 비교가 공정해진다.
- 게임 속 성능 표현도 광고에 해당하므로 표시광고법상 **실증 책임**이 생긴다. 성적서 원본 보관, "업계 최고" 같은 비교 우위 문구 금지(근거 없는 경우), 출시 전 법률 검토 권장.

## 3. 실행·빌드

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 단위 테스트 + 밸런스 봇 (단계별 예상 완료 시간 출력: /tmp/balance.txt)
npm run build      # dist/
npm run e2e        # Playwright 스모크 + screenshots/
npm run cap:android / cap:ios   # 네이티브 빌드 (Android Studio / Xcode 필요)
```

웹 포털 빌드: `VITE_AD_PROVIDER=poki npm run build` 또는 `crazygames`.

## 4. 출시 전 할 일

- AdMob 앱 ID 교체: `android/app/src/main/AndroidManifest.xml`, `ios/App/App/Info.plist` (현재 Google 샘플 ID), 광고 단위 ID `.env` (`VITE_ADMOB_*`).
- 개인정보 처리방침 `public/privacy.html` 운영자 정보 기입 후 공개 URL 호스팅.
- appId·앱 이름 최종 확정(변경 시 `npx cap add` 로 네이티브 프로젝트 재생성).
- 기준 제품 시험값(`REFERENCE_REMOVAL`, `REFERENCE_COVERAGE`) 갱신, 샘플 스폰서 삭제.
- 어린이 이용 가능성: 세제 관련 표현은 안전 수칙 중심 유지(삼키기·혼합 금지), 스토어 연령 등급과 광고 설정(가족용 정책) 검토.

## 5. 구조

```
src/
  game/catalog.ts   오염·표면·도구·세제 데이터와 상성표, 위험 혼합 규칙
  game/sponsor.ts   광고주 시험 성적 → 게임 성능 환산, 검증, 샘플 스폰서
  game/levels.ts    12단계 정의 (표면·오염 분포·목표 시간·지급 아이템)
  game/engine.ts    청소 세션 (격자 오염, 문지르기·분사, 손상·위험, 별점)
  game/items.ts     기본 + 스폰서 아이템 목록, 지급 누적
  render/scene.ts   표면 절차적 그리기 (이미지 자산 없음)
  render/renderer.ts 오염층·거품·반짝임·커서 렌더링
  ui/icons.ts       아이템 아이콘(SVG)
  ads/              AdMob · Poki · CrazyGames · Noop + 노출 정책
  main.ts           화면: 홈 · 게임 · 결과 · 상점 · 성능 근거 · 설정
  i18n.ts, audio.ts(합성 효과음), storage.ts, analytics.ts
```
