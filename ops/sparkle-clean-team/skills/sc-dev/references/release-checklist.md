# 릴리스 체크리스트

## 공통
- [ ] `npm test`(9개+) / `npm run build` / `npm run e2e` 통과, 스크린샷 육안 확인(홈·청소 중·결과·세제 분사·손상 경고·위험 혼합·상점·근거 화면, ko/en/ja)
- [ ] 밸런스 봇 시간(`/tmp/balance.txt`)이 모든 스테이지 `parSec × 1.3` 미만, 이전 버전 대비 변화 기록
- [ ] 버전 올림 + CHANGELOG
- [ ] `.env`: `VITE_ADMOB_TESTING=false`, 실제 광고 단위 ID 6개(Android/iOS × 전면·보상형·배너), `VITE_PRIVACY_URL` 유효(200 응답)
- [ ] **AdMob 앱 ID TODO 해소**: `android/app/src/main/AndroidManifest.xml` `com.google.android.gms.ads.APPLICATION_ID`, `ios/App/App/Info.plist` `GADApplicationIdentifier` — 테스트 ID(`ca-app-pub-3940256099942544~...`)가 남아 있으면 중단
- [ ] **개인정보 처리방침** `public/privacy.html` TODO(운영자 상호·주소·이메일·개인정보 보호책임자) 기입, 공개 URL 호스팅, 스토어 등록 정보와 일치
- [ ] 스토어 설명·처리방침에 광고 포함 고지 + 스폰서(브랜드 제휴) 아이템 존재 고지
- [ ] **스폰서**: 출시 빌드에 `sample: true` 가상 브랜드가 노출되지 않음(`sc-sponsors` 검수 체크리스트 통과 건만 노출), 모든 스폰서 아이템에 "광고" 라벨·근거 화면 동작
- [ ] 위험 혼합 경고·표면 손상 경고 문구 3개 언어 확인

## Google Play (AAB)
- [ ] `android/app/build.gradle` versionCode 증가, targetSdk 최신 요구치 확인(웹 검색)
- [ ] `AD_ID` 권한 선언 유지(광고 ID 사용)
- [ ] 데이터 안전 섹션: 광고 ID(광고·분석), 기기 ID, 앱 상호작용 — 광고 SDK 공개 문서 기준
- [ ] 광고 포함 = 예, 콘텐츠 등급 설문(IARC), 타깃 연령 설정 — 아동 포함 여부는 `sc-cs` 결정에 따름(아동 포함 시 Families 정책·인증 광고 SDK 요건 확인 필요)
- [ ] 스크린샷 4~8장(ko/en/ja) — 실제 게임 화면, 피처 그래픽 1024×500, 짧은 설명 80자·전체 설명 4,000자(현재 규격 웹 확인)
- [ ] 내부 테스트 → 비공개 테스트(소프트런치 국가) → 프로덕션 단계적 출시(10% → 50% → 100%)

## App Store (Xcode Archive)
- [ ] `GADApplicationIdentifier` 실제 값, `NSUserTrackingUsageDescription` 문구(현재 영어 1종 — 현지화 검토), `SKAdNetworkItems` 목록 갱신
- [ ] 앱 개인정보 라벨: 식별자·사용 데이터 → 제3자 광고·분석, 추적 = 예(ATT)
- [ ] 연령 등급 설문(아동 대상 여부와 일관), 수출 규정 준수 체크
- [ ] 스크린샷 필수 규격(웹 확인) — 세로
- [ ] TestFlight → 심사 제출(리뷰 노트: 광고·보상형 코인 2배·아이템 체험, 스폰서 아이템은 "Ad" 표시된 브랜드 제휴임을 설명)

## 웹 포털
- [ ] Poki: `VITE_AD_PROVIDER=poki` 빌드, SDK `gameplayStart/Stop`·광고 호출 확인, 로딩 빠르게, 모바일 세로 대응
- [ ] CrazyGames: `VITE_AD_PROVIDER=crazygames` 빌드, 외부 링크·개인정보 링크 정책 확인
- [ ] 포털 빌드의 스폰서 아이템: 포털 정책(제3자 광고·브랜드 노출) 확인 전까지 비활성(플래그 구현 필요 — `sc-dev` TODO)
- [ ] itch.io: HTML 업로드, 임베드 세로 비율

## 출시 직후 24시간
- [ ] 크래시율(<1%)·ANR, 광고 필레이트·eCPM, 리뷰 모니터링, 롤백 기준(크래시율 2% 초과 시 단계적 출시 중단)
