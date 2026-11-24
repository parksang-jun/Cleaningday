# 장면 실사 사진 — 만들 목록과 프롬프트

손그림 배경을 쓰는 장면 25개를 실사 느낌 사진으로 바꾸기 위한 목록. 사진은 **깨끗한 상태**만 담는다(오염은 게임이 덧그린다).
파일은 `src/assets/scenes/<장면>.jpg` (896x1200, 3:4) 로 넣으면 그 장면을 쓰는 모든 판과 구역에 적용된다(`src/render/photos.ts`).

- 모델: nano-banana-2.1, 3:4, 1K (장당 4크레딧 → 25장 약 100크레딧)
- 상태(2026-11-23 완료): 장면 25개 전부 사진으로 넣었다(34장 — floor·deck 3장, brickWall·patio·sofa·bed·table 2장, 나머지 1장). Playwright 로 1~72판을 캡처해 확인했다.
  아래 "작업 순서"는 사진을 더하거나 바꿀 때 다시 쓴다. Runway 이미지 서버(`dnznrvs05pmza.cloudfront.net`)는 허용 도메인에 있어야 내려받을 수 있다.

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

| 파일 (`src/assets/scenes/`) | Runway 작업 번호 |
|---|---|
| floor.jpg | 555897b9-5d78-4aed-ab5b-96e7b0ebbc86 |
| floor-2.jpg | 8221de78-abcd-4869-8514-9d52810c7ecb |
| floor-3.jpg | cbc02708-8b77-4e48-8d57-7ea89ec0df7c |
| deck.jpg | 71c000c9-2770-40e6-a048-a57f71c22ff2 |
| deck-2.jpg | a1bf6ffe-6a80-40ad-8659-3837ec09a83a |
| deck-3.jpg | 0a6779ff-5eb3-4bbc-be0d-dea56a53fbba |
| brickWall.jpg | e7e176bf-1e10-47f3-86e4-89e6124d6788 |
| brickWall-2.jpg | 96ae95b1-f529-4199-a2b1-c2020d9c2f93 |
| patio.jpg | ed9a45fe-0380-410a-8a1a-c8782f8b30eb |
| patio-2.jpg | 64de8db5-1fc9-435c-95b6-884f1cb57db9 |
| sofa.jpg | 00721337-d1ee-4460-afe6-855077533108 |
| sofa-2.jpg | 87bfd856-4cf1-4265-8b9e-02469e497500 |
| bed.jpg | 63ca8cee-5758-44e4-b3ef-9a0192da8b01 |
| bed-2.jpg | 57a9689c-0657-4390-8bc7-82627ea1e70a |
| table.jpg | 394b8c48-07d0-4112-9235-485f45ed828d |
| table-2.jpg | f3546902-5dbd-491e-af81-edc68879b2d9 |
| kitchenTile.jpg | b444ab54-7dde-4b94-a2bd-1456749ac1b7 |
| stove.jpg | dc198ad1-4237-46d4-a2ed-3ff852b6abd7 |
| bathTile.jpg | 840df21b-a20d-4f65-89e9-9c4b1ac77095 |
| gardenChair.jpg | 073a450f-89e2-49f4-a455-e0240ebe950b |
| fence.jpg | b50d4249-2376-4079-9ce0-477b65ef867b |
| desk.jpg | dfae3714-1e91-48c1-8d98-06d233730466 |
| tub.jpg | a862575f-df41-421a-ac7a-533ebf47b643 |
| window.jpg | 9cc132dc-a624-46f6-aaf4-35aa38ca9449 |
| closet.jpg | e6188a30-4129-4ca8-85fb-ea422d117eb7 |
| mirror.jpg | 03720ba9-15a0-4388-9fa8-72c04d176d69 |
| sink.jpg | b5cae815-3f70-4f23-8024-e22d8c2216e4 |
| fridge.jpg | 5f4698d2-37aa-421d-bc64-eb7b1b2182fd |
| bathtub.jpg | 34e9ee44-431f-48d7-ad88-e4b168dea0af |
| toilet.jpg | 706ff789-cbc9-43f8-a55c-a2654c91ffc9 |
| grill.jpg | a75f8077-49d8-4a36-a619-d2b5432a20da |
| shelf.jpg | 158ba58f-7fba-4c9b-a242-ef64338ae08f |
| basin.jpg | 172f1500-efab-48f8-bbac-8ab8af175fa7 |
| showerglass.jpg | b7f8ae60-9c39-4827-b4f7-5d45eb30bf8d |

- gardenChair 는 처음 만든 것(b05b94aa-66b6-4667-81bf-2f31b3d41e9f, 잔디 배경)을 버리고 다시 만들었다 — 되풀이 판의 색 변형에서 잔디가 파랗게·빨갛게 변해 어색했다. 배경을 무채색(회색 바닥·벽)으로 바꿨다.

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

## 구역 판 전용 사진 (2026-11-24)

구역이 나뉜 21개 판은 장면 사진을 구역별로 잘라 붙이는 대신, 그 판 전용 한 장(`L<판>.jpg`)을 쓴다.
생성한 사진은 가구·경계선이 구역 사각형에 맞도록 가로·세로를 구간별로 늘리거나 줄여 맞췄다(경계 수치는 눈으로 잰 값).
모델 nano-banana-2.1, 3:4, 1K (장당 4크레딧, 합계 84).

| 배치 | 판 = Runway 작업 번호 |
|---|---|
| 거실: 마루 + 소파 (x 10–90 %, y 40–90 %) | 10 = 5008797d, 11 = 50056b51, 12 = 148b46d1 |
| 방: 마루 + 침대 (x 8–92 %, y 6–58 %) | 20 = 5c92013a, 23 = 12c70062, 24 = 2681b72c |
| 주방: 타일 36 % / 가스레인지 36 % / 나무 상판 28 % | 33 = 362a99b0, 34 = 5a5bb594, 36 = 171499b5 |
| 욕실: 타일 벽 55 % / 욕조 45 % | 46 = e72173ca, 47 = 552bf995, 48 = 26a22087 |
| 정원: 벽돌 벽 45 % / 데크 55 % | 63 = 4fdcc59c, 66 = d10068d9, 70 = 3af10b8a, 72 = 33b5a81c |
| 정원: 왼쪽 돌 파티오 / 오른쪽 데크 | 64 = b73e871f, 67 = 90e87294, 71 = 5cf9654c |
| 정원: 울타리 50 % / 플라스틱 벤치 50 % | 65 = c1ff3acb, 69 = 6de5e9cb |
