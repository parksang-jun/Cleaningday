# 스폰서 온보딩 사양 — 제출 패키지, 성능 환산, 한계 (`src/game/sponsor.ts` 2026-11-02 기준)

## 1. 광고주 제출 패키지

| # | 항목 | 코드 필드 | 필수 | 비고 |
|---|---|---|---|---|
| 1 | 브랜드명·제품명 | `brand`, `name` | 필수 | 게임 표시명. 상표 사용 허락 |
| 2 | 제품 종류 | `kind`(`tool`/`detergent`) | 필수 | |
| 3 | 게임 계열(기준 제품) | `base` | 필수 | 도구: cloth·sponge·brush·vacuum·washer / 세제: allpurpose·degreaser·descaler·moldremover. 맞는 계열이 없으면 신규 계열 개발 필요(§4) |
| 4 | 시험 성적서 원본(PDF) | `evidence` | 필수 | 시험기관 `lab`, 성적서 번호 `reportId`, 시험일 `date`, 시험 방법 요약 `protocol`, 공개 URL `url`(선택) |
| 5 | 오염별 제거율(%) | `lab[]` = `{ dirt, removalPct }` | 1개 이상 | dirt: dust·mud·grease·stain·scale·mold. 0~100. **명시된 프로토콜**(시편·오염 조성·압력·왕복 횟수/시간·거리)로 측정 |
| 6 | 도구 작업 면적(m²/분) | `coverageM2PerMin` | 도구 선택 | 같은 프로토콜로 측정한 경우에만 반영 |
| 7 | 화학 계열 | `chemistry` | 세제 필수 | neutral·alkaline·acid·chlorine — 라벨·MSDS(SDS)로 확인 |
| 8 | 라벨 주의사항(사용 금지 재질) | `cautions[]` | 필수(없으면 빈 목록 확인서) | wood·tile·steel·glass·ceramic·fabric·stone·paint 로 매핑. 매핑 불가 문구는 검수 메모에 기록 |
| 9 | 캠페인 기간 | `campaign: { start, end }` | 필수 | YYYY-MM-DD, 기간 밖이면 자동 비노출 |
| 10 | 태그라인 | `tagline` | 선택 | 근거 범위 내 표현만(검수 대상) |
| 11 | 로고·제품 이미지 | (현재 UI 미사용 — 계열 아이콘 사용) | 선택 | 사용 시 라이선스 확인 |
| 12 | 제품 페이지 URL | (UI 미구현) | CPC 시 필수 | 앱 빌드 전용, 포털 정책 확인 |
| 13 | 표시·광고 적법성 확인 | — | 권장 | 광고주 측 법무/품질 담당 확인서(생활화학제품 표시 규정 등 — 확인 필요) |

예시(가상, 실제 회사 아님):

```json
{
  "id": "exampleclean-moldgel",
  "brand": "Example Clean Co.",
  "name": "Mold Gel (가상)",
  "kind": "detergent",
  "base": "moldremover",
  "lab": [{ "dirt": "mold", "removalPct": 88 }, { "dirt": "stain", "removalPct": 60 }],
  "chemistry": "chlorine",
  "cautions": ["wood", "fabric", "paint", "steel"],
  "evidence": { "lab": "(가상) 시험기관", "reportId": "EX-0000-000", "date": "2027-01-10", "protocol": "표준 곰팡이 시편, 도포 10분 후 동일 압력 왕복 10회, 제거율" },
  "campaign": { "start": "2027-05-01", "end": "2027-06-30" }
}
```

## 2. 운영사 기준값 (광고주 비교 대상)

`REFERENCE_REMOVAL` — 일반(무브랜드) 기준 제품의 같은 시험 기준 제거율(%). **현재 값은 임시이며 운영사 자체 시험으로 갱신해야 한다(TODO).** 값이 없는(—) 오염은 그 계열에서 반영되지 않는다.

| base | dust | mud | grease | stain | scale | mold |
|---|---|---|---|---|---|---|
| cloth | 85 | 40 | — | 25 | — | — |
| sponge | 60 | 80 | 35 | 55 | — | — |
| brush | — | 85 | — | 60 | 45 | 55 |
| vacuum | 95 | — | — | — | — | — |
| washer | 80 | 92 | — | — | — | 45 |
| allpurpose | — | 70 | 55 | 60 | — | — |
| degreaser | — | — | 80 | 55 | — | — |
| descaler | — | — | — | 40 | 75 | — |
| moldremover | — | — | — | 65 | — | 80 |

`REFERENCE_COVERAGE`(m²/분): cloth 1.2, sponge 0.9, brush 0.5, vacuum 3.0, washer 6.0 — 임시값.

TODO: 기준 제품 선정 기준(시중 일반 제품 다수 평균 / 특정 무브랜드 제품), 시험 프로토콜 문서화(오염별), 시험기관, 갱신 주기를 확정하고 광고주에게 같은 프로토콜 문서를 제공한다. 광고주 시험이 다른 프로토콜이면 비교가 성립하지 않는다.

## 3. 환산 방식 (코드 그대로)

1. 오염별 비율 `ratio[d] = clamp(removalPct / REFERENCE_REMOVAL[base][d], 0.5, 1.8)`. 성적서에 없거나 기준값이 없는 오염은 1.0.
2. 도구: `effect[d] = 기준 effect[d] × ratio[d]`, 면적 비율 `cov = clamp(coverageM2PerMin / REFERENCE_COVERAGE[base], 0.5, 1.8)`, `radius = 기준 radius × √cov`. power·onlyOn 은 기준 그대로.
3. 세제: 세제 효과 부분에만 적용 `mult[d] = 1 + (기준 mult[d] − 1) × ratio[d]`. chemistry 는 제출값(없으면 기준), radius·soakSec 은 기준 그대로.
4. 손상: `harms = 기준 harms ∪ 라벨 cautions`. 위험 혼합: chemistry 가 chlorine/acid 면 반대 계열과 겹칠 때 경고.
5. 비용 0(무료 사용), id `sp:{id}`, 모든 UI에 "광고" 라벨.

계산 예(코드 샘플, 가상 브랜드):
- BrightMax 기름때 제거제(degreaser): grease 92/80 = 1.15 → mult 1 + 2.0×1.15 = 3.30(기준 3.0), stain 63/55 = 1.145 → 1 + 0.5×1.145 ≈ 1.57(기준 1.5). 근거 화면 "115% vs standard".
- AquaJet 고압세척기(washer): mud 96/92 ≈ 1.04 → effect 1.7×1.04 ≈ 1.77, mold 50/45 ≈ 1.11 → 0.7×1.11 ≈ 0.78, 면적 7.5/6 = 1.25 → radius 3.6×√1.25 ≈ 4.02, cautions 에 glass 추가.
- 성적서가 기준보다 낮으면(예: grease 60/80 = 0.75) 게임에서도 기준 제품보다 **느리다**.

## 4. 한계 (광고주에게 사전 고지)

1. **반영 범위**: 오염별 제거율·도구 면적·화학 계열·라벨 주의 표면만. 향·내구성·안전 인증·친환경성·가격·사용 편의는 게임 성능에 반영되지 않는다.
2. **기준값이 있는 오염만**: 표 §2의 "—" 칸은 성적서가 있어도 1.0. 예: 진공청소기의 진흙 제거율은 반영 안 됨.
3. **곱셈 구조**: 기준 effect 가 0(진공청소기의 기름때 등)이거나 기준 mult 가 1.0(기름때 제거제의 먼지 등)인 오염은 비율이 높아도 효과 0 → 제품 계열의 본래 용도 밖 성능은 표현 불가.
4. **상·하한 0.5~1.8배**: 실제 차이가 더 커도 게임 체감은 1.8배까지. 현재 근거 화면의 "% vs standard"도 클램프된 값을 보여준다(원 제거율 %는 별도 표시).
5. **선형 근사**: 제거율 비율을 제거 속도 배율로 단순 환산한 게임적 근사이며 실제 사용 시간 단축을 의미하지 않는다(근거 화면 문구 `evidenceNote` 유지).
6. **프로토콜 일치는 수작업 검수**: 코드에 프로토콜 ID 필드·검증이 없다.
7. **계열 고정**: 9개 기준 계열 밖 제품(스팀 청소기, 유리 스퀴지 등)은 신규 계열·아이콘·기준 실측·밸런스 작업이 선행돼야 한다(`sc-dev`·`sc-liveops`, 일정·비용 별도).
8. **노출 위치**: 스폰서 아이템은 툴바·상점에 노출되며, 해당 표면에서 사용 불가(`onlyOn`)면 툴바에서 숨는다. 스테이지 구성상 특정 계열은 등장 스테이지가 적을 수 있다(예: washer 는 stone·paint·tile 스테이지만).

## 5. 코드 개선 요청 목록(라이브 전 `sc-dev`)

- [ ] 근거 화면: 기준값이 없어 반영되지 않은 오염 행은 "100% vs standard" 대신 "게임 성능 미반영(기준 없음)"으로 표시 — 현재는 1.0 → "100%"로 보여 오해 소지
- [ ] 근거 화면: 클램프된 경우 "게임 상한 적용" 표시
- [ ] `validateSponsor`: `sample` 플래그(출시 빌드 차단), 시험일 유효기간, 도구 `coverageM2PerMin` 근거, 세제 `chemistry` 필수 검사 추가
- [ ] `SAMPLE_SPONSORS` 를 출시 빌드에서 제외, 원격 목록 로딩(서명·캐시·실패 시 비노출)
- [ ] 이벤트: `sponsor_impression`, `sponsor_level_clear`, (CPC 시) `sponsor_link_click` + 제품 페이지 링크 UI
- [ ] 포털 빌드 스폰서 비활성 플래그
