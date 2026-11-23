# 장면 실사 사진 — 만들 목록과 프롬프트

손그림 배경을 쓰는 장면 25개를 실사 느낌 사진으로 바꾸기 위한 목록. 사진은 **깨끗한 상태**만 담는다(오염은 게임이 덧그린다).
파일은 `src/assets/scenes/<장면>.jpg` (896x1200, 3:4) 로 넣으면 그 장면을 쓰는 모든 판과 구역에 적용된다(`src/render/photos.ts`).

- 모델: nano-banana-2.1, 3:4, 1K (장당 4크레딧 → 25장 약 100크레딧)
- 상태(2026-11-24): 시험 3장(floor·sofa·sink)을 만들었으나, 그때의 작업 환경에서는 Runway 이미지 서버(`dnznrvs05pmza.cloudfront.net`)가
  막혀 내려받지 못했다. 사용자가 허용 도메인에 추가했다 — **새로 시작한 작업(세션)** 에서만 적용된다. 아래 "작업 순서"대로 이어서 한다.

## 작업 순서 (새 세션에서)

0. **먼저 내려받기가 되는지 확인한다(크레딧을 쓰기 전에).** Runway `get_task` 로 아래 floor 작업 번호의 주소를 받아 `curl` 로 내려받는다(주소는 `_jwt=` 토큰까지 그대로). 안 되면 더 만들지 말고 그 사실을 보고한다.
1. **만든다.** Runway `generate_image`, 모델 nano-banana-2.1, ratio 3:4, imageSize 1K. 장면 25개를 "머리말 + 공통 꼬리말"로. floor·sofa·sink 는 이미 만든 작업 번호를 쓴다.
   많이 쓰이는 장면은 다른 느낌으로 더 만든다: floor 3장, deck 3장, brickWall·patio·sofa·bed·table 각 2장(재질·색을 확실히 다르게 — 마루: 밝은 오크/짙은 월넛/헤링본, 소파: 청회색/베이지/올리브, 데크: 삼나무/회색 합성목/짙은 티크).
   합계 약 34장 ≈ 136크레딧. `whoami` 로 잔액을 먼저 보고, 모자라면 장면당 1장만. 브랜드·로고·읽히는 글자가 들어간 사진은 버린다.
2. **넣는다.** 896x1200 JPEG(품질 85 안팎, 장당 500KB 이하)로 바꿔 `src/assets/scenes/<장면>.jpg`, 추가분은 `<장면>-2.jpg`, `<장면>-3.jpg`.
   코드는 이 이름들을 판마다 번갈아 쓰고, 한 바퀴 돌면 색·방향 변형을 덧입힌다(`src/render/photos.ts` 의 `sceneVariants`·`photoVariant`). 작업 번호를 아래 표에 적는다.
3. **눈으로 확인한다.** `npm run build` 후 Playwright 로 여러 판의 캔버스를 캡처해 본다: 사진이 실제로 뜨는가, 오염이 사진 위에서 또렷한가,
   구역 판(10·11·12·20·23·24·33·34·36·46·47·48·63~72)에서 구역마다 사진이 어색하지 않게 잘리는가, 같은 장면의 판들이 서로 다른가.
   오염이 묻혀 안 보이거나 구도가 어색한 사진은 다시 만들거나 뺀다(빼면 손그림으로 남는다).
4. **검사하고 올린다.** `tsc` → `npm test` → `npm run build` → `npm run e2e` → `npx cap sync`, 빌드 번호(iOS·Android) 1씩 올리고 main 에 push.
   바꾸기 전/후 비교 이미지를 사용자에게 보낸다.

| 장면 | Runway 작업 번호 |
|---|---|
| floor | 555897b9-5d78-4aed-ab5b-96e7b0ebbc86 |
| sofa | 00721337-d1ee-4460-afe6-855077533108 |
| sink | b5cae815-3f70-4f23-8024-e22d8c2216e4 |

## 공통 꼬리말

`Perfectly clean and spotless, soft natural daylight. No people, no text, no logos, no cleaning tools, no dirt, no stains. Sharp focus, true-to-life materials.`
닦을 표면이 화면을 가장자리까지 채워야 한다(오염이 화면 어디에나 놓인다).

## 장면별 머리말

| 장면 | 표면 | 프롬프트 머리말 |
|---|---|---|
| floor | 원목 | Photorealistic overhead photograph looking straight down at a clean light oak hardwood floor; planks fill the frame, thin white baseboard only along the top edge. |
| deck | 원목 | Photorealistic overhead photograph looking straight down at clean outdoor cedar deck boards filling the frame, running vertically, small gaps between boards. |
| brickWall | 벽돌 | Photorealistic straight-on photograph of a clean red brick exterior wall filling the frame, neat mortar lines. |
| patio | 돌 | Photorealistic overhead photograph looking straight down at clean grey stone patio pavers filling the frame. |
| sofa | 천 | Photorealistic straight-on close photograph of a blue-grey woven fabric sofa; backrest and seat cushions fill the frame. |
| bed | 천 | Photorealistic overhead photograph looking straight down at a neatly made bed with off-white linen duvet and two plain pillows at the top, filling the frame. |
| table | 원목 | Photorealistic overhead photograph looking straight down at a clean oak dining table top filling the frame. |
| kitchenTile | 타일 | Photorealistic straight-on photograph of a kitchen wall of glossy white ceramic tiles with pale grey grout filling the frame. |
| stove | 스테인리스 | Photorealistic overhead photograph looking straight down at a clean stainless steel gas cooktop with four burners filling the frame. |
| bathTile | 타일 | Photorealistic straight-on photograph of a bathroom wall of beige ceramic tiles with light grout filling the frame. |
| gardenChair | 플라스틱 | Photorealistic straight-on close photograph of a white plastic garden chair; its backrest and seat fill the frame. |
| fence | 페인트 | Photorealistic straight-on photograph of a white painted wooden garden fence, tight vertical boards filling the frame. |
| desk | 원목 | Photorealistic overhead photograph looking straight down at a clean wooden desk top filling the frame, a closed notebook in one corner. |
| tub | 도기 | Photorealistic overhead photograph looking straight down into a clean white bathtub filling the frame, chrome drain. |
| window | 유리 | Photorealistic straight-on photograph of a clean window with a white frame, blue sky and green garden softly visible outside, filling the frame. |
| closet | 페인트 | Photorealistic straight-on photograph of clean white painted wardrobe doors with slim handles filling the frame. |
| mirror | 유리 | Photorealistic straight-on photograph of a clean bathroom mirror with a thin frame reflecting a bright tiled bathroom, filling the frame. |
| sink | 스테인리스 | Photorealistic overhead photograph looking straight down at a clean brushed stainless steel double-bowl kitchen sink with a chrome faucet at the top. |
| fridge | 스테인리스 | Photorealistic straight-on photograph of clean stainless steel refrigerator doors with vertical handles filling the frame. |
| bathtub | 도기 | Photorealistic photograph of a clean white bathtub seen from above at a slight angle, filling the frame, white tiled wall behind. |
| toilet | 도기 | Photorealistic photograph of a clean white ceramic toilet seen from the front and slightly above, filling the frame, pale tiled floor. |
| grill | 금속 | Photorealistic overhead photograph looking straight down at a clean black barbecue grill grate filling the frame. |
| shelf | 원목 | Photorealistic straight-on photograph of a clean wooden bookshelf with tidy rows of plain books and two storage boxes, filling the frame. |
| basin | 도기 | Photorealistic overhead photograph looking straight down at a clean white ceramic bathroom washbasin with a chrome faucet, filling the frame. |
| showerglass | 유리 | Photorealistic straight-on photograph of a clean glass shower door with a chrome handle, pale tiled shower behind it, filling the frame. |
