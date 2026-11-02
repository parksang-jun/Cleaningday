# 튜닝 파라미터 지도 (2026-11-02 코드 기준 — 변경 전 코드에서 재확인)

## 전역

| 파라미터 | 위치 | 기본값 | 영향 |
|---|---|---|---|
| 오염 저항 `DIRT_RESIST` | `src/game/catalog.ts` | dust 0.14, mud 0.32, grease 0.75, stain 0.5, scale 0.8, mold 0.85 | 효율 1.0 도구로 한 칸 지우는 대략 시간(초). ↑ = 전 스테이지 난이도↑ |
| 클리어 기준 `PASS_CLEAN` | `src/game/engine.ts` | 0.95 | 마지막 잔여 찾기 피로. HUD 바는 cleanliness/0.95 로 표시 |
| 칸 소거 임계 | `engine.ts` `scrub()` | 0.02 미만이면 0 처리 | 체감 "끝맺음" |
| 가장자리 감쇠 | `forEachInRadius` | 1 − (d/r)×0.55 | 도구 중심 집중도 |
| 손상 누적 속도 | `checkHarm()` | +0.12/초(최대 1) | 15% 도달 ≈ 1.25초 사용 → 별 −1 |
| 경고 쿨다운 | `checkHarm`/`scrub` blocked | 1.5초 | 토스트 빈도 |
| 격자 | `src/game/levels.ts` | 48×64 | 성능·해상도 |

## 도구 `BASE_TOOLS` (effect: dust/mud/grease/stain/scale/mold)

| 도구 | radius | power | effect | harms | onlyOn | cost |
|---|---|---|---|---|---|---|
| cloth | 3.4 | 1.0 | 1.0/0.45/0.2/0.3/0.05/0.1 | — | — | 0 |
| sponge | 2.8 | 1.1 | 0.6/0.95/0.5/0.75/0.2/0.3 | — | — | 0 |
| brush | 2.0 | 1.35 | 0.3/1.0/0.6/0.8/0.75/0.95 | glass, paint, wood | — | 120 |
| vacuum | 4.2 | 1.2 | 1.7/0.15/0/0/0/0 | — | — | 200 |
| washer | 3.6 | 1.5 | 0.9/1.7/0.7/0.6/0.5/0.7 | wood, fabric | stone, paint, tile | 320 |

## 세제 `BASE_DETERGENTS` (mult: 불린 칸 문지를 때 배율)

| 세제 | radius | soakSec | mult | chemistry | harms | cost |
|---|---|---|---|---|---|---|
| allpurpose | 4.5 | 9 | 1.0/1.3/1.6/1.6/1.1/1.2 | neutral | — | 0 |
| degreaser | 4.5 | 9 | 1.0/1.2/3.0/1.5/1.0/1.0 | alkaline | wood | 150 |
| descaler | 4.5 | 10 | 1.0/1.0/1.0/1.3/3.2/1.1 | acid | stone | 150 |
| moldremover | 4.0 | 12 | 1.0/1.0/1.0/1.8/1.0/3.4 | chlorine | wood, fabric, paint | 180 |

위험 혼합: `isHazardMix()` — 불림이 남아 있는 칸에 chlorine↔acid 가 겹치면 1회 경고 + 별 −1.

## 스테이지 `LEVELS` (봇 시간은 2026-11-02 `npm test` 실측)

| # | scene | surface | parSec | 봇 시간 | grants | 핵심 오염 |
|---|---|---|---|---|---|---|
| 1 | floor | wood | 25 | 19.3 | cloth, sponge, allpurpose | dust(coverage 0.35) |
| 2 | entrance | tile | 30 | 24.8 | — | mud, dust |
| 3 | kitchenTile | tile | 25 | 17.9 | — | stain, dust |
| 4 | stove | steel | 40 | 32.7 | degreaser | grease, stain |
| 5 | window | glass | 25 | 19.6 | — | dust, stain (brush 금지) |
| 6 | bathTile | tile | 55 | 48.9 | descaler | scale |
| 7 | bathtub | ceramic | 40 | 32.6 | moldremover, brush | mold, scale (위험 혼합 학습) |
| 8 | table | wood | 25 | 20.2 | — | stain, grease (degreaser 금지) |
| 9 | sofa | fabric | 25 | 19.3 | vacuum | dust, stain |
| 10 | patio | stone | 40 | 33.2 | washer | mud, mold (descaler 금지) |
| 11 | car | paint | 30 | 26.2 | — | mud, dust (brush 금지) |
| 12 | bigClean | tile | 40 | 33.7 | — | 6종 복합 |

합계 봇 시간 약 328초(5.5분) — 콘텐츠 깊이 부족의 근거.

## 별·코인·광고

| 파라미터 | 위치 | 기본값 | 영향 |
|---|---|---|---|
| 별 규칙 | `engine.ts` `scoreSession()` | 3 시작, parSec 초과 −1, 2×parSec 초과 −1, 손상 ≥ 0.15 −1, 위험 혼합 −1, 최소 1 | 재도전 동기 |
| 클리어 코인 | `scoreSession()` | 20 + 별×10 | 경제 유입 |
| 코인 2배 RV | `src/main.ts` `showResult()` placement `double_coins` | +기본 코인 1회 | RV 옵트인 |
| 아이템 체험 RV | `main.ts` `openShop(inGame)` placement `try_item` | 해당 스테이지 동안 미보유 아이템 사용 | RV 옵트인·구매 유도 |
| 전면 광고 | `src/ads/index.ts` | 2스테이지·150초 간격·첫 스테이지 제외, 결과 화면 이후 | 리텐션 vs 매출 |
| 스폰서 성능 한도 | `src/game/sponsor.ts` `RATIO_MIN/MAX` | 0.5 / 1.8 | 스폰서 아이템 체감 차 (밸런스 레버 아님) |

## 리밸런스 절차 (봇 타이밍 테스트)

1. `rm -f /tmp/balance.txt && npm test` → 현재 봇 시간 기록(기준선).
2. 파라미터 1개 변경 → 다시 실행 → 스테이지별 전후 표 작성(Δ초, Δ%).
3. 판정: 모든 스테이지 봇 시간 < parSec×1.3(테스트 통과), "맞는 도구가 틀린 도구보다 2배+ 빠름" 테스트 유지, 스폰서 "더 좋은 제품이 실제로 더 빨리 닦임" 테스트 유지.
4. parSec 재설정이 필요하면 봇 시간×1.2~1.3 으로 제안.
5. 출시 후에는 실제 스테이지별 중앙값 시간(`level_complete.time`)으로 봇 대비 배율을 보정해 parSec 를 재조정.

## 지표 → 조치 매핑(초기 가이드)

| 관찰 | 의심 원인 | 1순위 조치 |
|---|---|---|
| 1→3단계 이탈 > 20% | 첫 훅 약함·조작 불명확 | 1단계 coverage 축소로 더 빨리 클리어, 힌트 강화 |
| 6단계(bathTile) 이탈·quit 급증 | parSec 55초로 가장 긺, 물때 저항 0.8 | scale blobs 10→8 또는 descaler soakSec 10→12, 봇 확인 |
| 평균 별 > 2.8 | 너무 쉬움 | 후반 parSec −10% (테스트 한도 확인) |
| quit 시 clean% 85~94% 다수 | 마지막 5% 찾기 피로 | 잔여 오염 하이라이트/반짝임 힌트(UI) 우선, PASS_CLEAN 조정은 후순위 |
| surface_harm 후 quit | 처벌 체감 과함 | 첫 손상 시 1회 안내 모달, 손상 속도 0.12→0.08 검토 |
| shop_buy 거의 없음 | 무료 지급이 구매를 대체 | 선구매 가치·코인 싱크 추가 |
| 코인 2배 옵트인 < 30% | 코인 쓸 곳 없음 | 코인 싱크 먼저, 그다음 보상량 |
