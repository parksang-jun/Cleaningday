# 제휴 링크가 비어 있는 실제 제품 목록 (관리자 패널 입력용)

작성: 2026-11-13 제품개선팀 · 출처: `src/game/realProducts.ts`(제품 목록), `.env.production`(제휴 코드 미설정 확인)

지금 상태: 아래 제품 **25개 전부** 제휴 링크가 없습니다. 게임에서 "쿠팡에서 보기" 등을 누르면 마켓 **검색 화면**이 열리고(동작은 함) **수수료는 0원**입니다. 제휴 코드(`VITE_COUPANG_LPTAG`, `VITE_AMAZON_TAG_US`, `VITE_AMAZON_TAG_JP`)도 비어 있습니다.

채우는 법: 제휴 사이트에서 제품별 링크를 만들어 → 게임 운영자 모드 › 실제 판매 제품(제휴 추천) › 해당 제품 "수정" › "구매 링크" 칸에 붙여 넣기. 계정이 아직 없으면 결재함의 `affiliate-accounts` 요청서를 먼저 처리해야 합니다.

**주의(코드로 확인함, `src/ops.ts`·`src/storage.ts`)**: 운영자 모드에 붙여 넣은 링크는 **그 기기에만** 저장됩니다. 모든 플레이어의 게임에 반영하려면 링크(또는 추적 코드)를 결재함 메모로 주시면 에이전트가 코드에 넣는 변경안(PR)을 올립니다. 제휴 링크·추적 코드는 링크 주소에 그대로 드러나는 공개 값이라 적어도 안전합니다.

## 쿠팡 (쿠팡 파트너스) — 8개

| 제품 ID | 브랜드 · 제품명 | 종류 | 제휴 링크 |
|---|---|---|---|
| `kr-yuhanrox` | 유한락스 레귤러 | 세제 | 없음(검색 링크로 대체 중) |
| `kr-homestar-mold` | 홈스타 곰팡이싹 젤 | 세제 | 없음(검색 링크로 대체 중) |
| `kr-pigeon-bath` | 피죤 무균무때 욕실용 | 세제 | 없음(검색 링크로 대체 중) |
| `kr-scotchbrite` | 3M 스카치브라이트 다목적 수세미 | 도구 | 없음(검색 링크로 대체 중) |
| `kr-magic-block` | 매직블럭 멜라민 스펀지 | 도구 | 없음(검색 링크로 대체 중) |
| `kr-dyson-v16` | 다이슨 V16 피스톤 애니멀 | 도구 | 없음(검색 링크로 대체 중) |
| `kr-karcher-k4` | 카처 K4 컨트롤 플렉스 | 도구 | 없음(검색 링크로 대체 중) |
| `kr-haan-steam` | 한경희 스팀청소기 | 도구 | 없음(검색 링크로 대체 중) |

## Amazon.com (Amazon Associates 미국) — 9개

| 제품 ID | 브랜드 · 제품명 | 종류 | 제휴 링크 |
|---|---|---|---|
| `us-magic-eraser` | Mr. Clean Magic Eraser | 도구 | 없음(검색 링크로 대체 중) |
| `us-scotch-brite` | Scotch-Brite Heavy Duty Scour Pads | 도구 | 없음(검색 링크로 대체 중) |
| `us-clr` | CLR Calcium, Lime & Rust Remover | 세제 | 없음(검색 링크로 대체 중) |
| `us-windex` | Windex Original Glass Cleaner | 세제 | 없음(검색 링크로 대체 중) |
| `us-tilex` | Tilex Mold & Mildew Remover | 세제 | 없음(검색 링크로 대체 중) |
| `us-dyson-v16` | Dyson V16 Piston Animal | 도구 | 없음(검색 링크로 대체 중) |
| `us-karcher-k4` | Kärcher K4 Power Control | 도구 | 없음(검색 링크로 대체 중) |
| `us-meguiars` | Meguiar's Gold Class Car Wash | 세제 | 없음(검색 링크로 대체 중) |
| `us-bissell-steamshot` | Bissell SteamShot Handheld Steam Cleaner | 도구 | 없음(검색 링크로 대체 중) |

## Amazon.co.jp (Amazon 어소시에이트 일본) — 8개

| 제품 ID | 브랜드 · 제품명 | 종류 | 제휴 링크 |
|---|---|---|---|
| `jp-magiclean` | 花王 マジックリン キッチン用 | 세제 | 없음(검색 링크로 대체 중) |
| `jp-kabikiller` | ジョンソン カビキラー | 세제 | 없음(검색 링크로 대체 중) |
| `jp-gekiochi` | レック 激落ちくん メラミンスポンジ | 도구 | 없음(검색 링크로 대체 중) |
| `jp-mogi` | 茂木和哉 水アカ洗剤 | 세제 | 없음(검색 링크로 대체 중) |
| `jp-glass-magiclean` | 花王 ガラスマジックリン | 세제 | 없음(검색 링크로 대체 중) |
| `jp-karcher-k4` | ケルヒャー K4 サイレント | 도구 | 없음(검색 링크로 대체 중) |
| `jp-surluster` | シュアラスター カーシャンプー | 세제 | 없음(검색 링크로 대체 중) |
| `jp-scotch-brite` | 3M スコッチ・ブライト キッチンスポンジ | 도구 | 없음(검색 링크로 대체 중) |
