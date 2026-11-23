# 장면 실사 사진 — 만들 목록과 프롬프트

손그림 배경을 쓰는 장면 25개를 실사 느낌 사진으로 바꾸기 위한 목록. 사진은 **깨끗한 상태**만 담는다(오염은 게임이 덧그린다).
파일은 `src/assets/scenes/<장면>.jpg` (896x1200, 3:4) 로 넣으면 그 장면을 쓰는 모든 판과 구역에 적용된다(`src/render/photos.ts`).

- 모델: nano-banana-2.1, 3:4, 1K (장당 4크레딧 → 25장 약 100크레딧)
- 상태(2026-11-24): 시험 3장(floor·sofa·sink)을 만들었으나, 클라우드 작업 환경에서 Runway 이미지 서버(`dnznrvs05pmza.cloudfront.net`)가
  막혀 있어 내려받지 못했다. 허용 도메인에 추가하면 이어서 진행한다.

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
