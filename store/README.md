# store/ — 스토어·광고 인증용 공개 파일

## app-ads.txt
AdMob 이 "이 앱의 광고 수익은 이 계정 것"임을 확인하는 파일. 없으면 AdMob 이 광고 게재를 제한할 수 있다.

- 내용: `google.com, <AdMob 게시자 ID>, DIRECT, f08c47fec0942fa0` (AdMob 콘솔 › 앱 › app-ads.txt 에서 주는 문구와 같은 형식)
- 게시자 ID 는 `AndroidManifest.xml`·`Info.plist` 의 앱 ID(`ca-app-pub-<숫자>~…`) 앞부분과 같아야 한다 → `src/storeFiles.test.ts` 가 검사한다.

### 어디에 올려야 하나 (AdMob 도움말 9363762 기준)
- AdMob 은 스토어 등록 정보의 **개발자 웹사이트**(Play: 연락처 정보 › 웹사이트, App Store: 마케팅 URL)의 **호스트 이름 최상위**에서만 찾는다: `https://<호스트>/app-ads.txt`. 하위 경로(`/Cleaningday/app-ads.txt`)는 찾지 않는다.
- 지금 공개 페이지는 `https://parksang-jun.github.io/Cleaningday/` → AdMob 은 `https://parksang-jun.github.io/app-ads.txt` 를 찾는다. 이 주소는 `parksang-jun.github.io` 라는 이름의 별도 저장소(사용자 사이트)가 있어야 생긴다(2026-11-14 확인: 없음).
- 그래서 이 폴더의 파일을 그 자리에 올리는 일은 결재(`app-ads-host`) 후에 한다. 이 파일은 일부러 `public/`·`docs/` 에 두지 않았다(앱 번들·하위 경로 사이트에 넣어도 AdMob 이 못 찾음).
- 올린 뒤 AdMob 이 확인하기까지 최대 24시간.
