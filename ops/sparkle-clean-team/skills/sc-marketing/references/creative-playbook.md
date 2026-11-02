# 크리에이티브 플레이북 — 청소 ASMR 숏폼·광고 소재

## 훅 7종(첫 1초)

| 포맷 | 장면 | 자막 훅 예(en / ko / ja) |
|---|---|---|
| 전/후 만족 | 먼지 덮인 원목 바닥 → 한 번 쓸면 결이 드러남, 마지막 반짝 | "One swipe." / "한 번에 쓱" / "ひと拭きでピカッ" |
| 소리 ASMR | 무자막·효과음 강조: 문지르는 소리 → 분사음 → 반짝 → 완료 팡파르 | (자막 최소) "🔊 on" / "소리 켜고 보세요" / "音ありで" |
| 세제의 힘 | 기름때 레인지: 그냥 문지르면 안 지워짐 → 세제 분사 후 쓱 | "Grease won't budge… until this." / "기름때, 그냥은 안 지워져요" / "油汚れ、これで一発" |
| 참여형 | 유리창 + 도구 3개(걸레·솔·스펀지), 1.5초 정지 | "Which one for glass?" / "유리엔 뭐 쓸래?" / "ガラスにはどれ？" |
| 실수 공감 | 차 도장에 솔 → 흠집 경고 토스트 | "Never brush your car." / "차에 솔 쓰면 안 돼요" / "車にブラシはNG" |
| 안전 상식 | 욕조: 곰팡이 제거제 + 물때 제거제 → 위험 혼합 경고 모달 | "Never mix these two." / "이 두 개는 절대 섞지 마세요" / "この2つは絶対に混ぜないで" |
| 별 3개 도전 | 6단계 샤워 타일 기준시간 카운트다운 | "55 seconds. Can you?" / "55초 안에 가능?" / "55秒でいける？" |

## 10~30초 구조

1초 훅(오염이 지워지는 순간 + 소리) → 6~20초 실제 플레이(손가락 오버레이, 화면 녹화 원본) → 2초 결과(별·반짝) → 2~3초 CTA("Free · No sign-up · Link in bio"). 전/후는 화면 분할보다 같은 화면 연속 진행이 신뢰도↑.

## 제작 규칙

- 세로 9:16, 안전 영역(상하 UI 가림) 고려해 자막은 중앙 1/3.
- 게임 원음 사용(자체 합성 효과음 — 저작권 문제 없음). 배경음악은 플랫폼 상업용 라이브러리만.
- 실제 게임과 다른 연출 금지(없는 장면·도구·물리 효과 합성 X). 속도 편집(배속)은 "2x" 표기 권장.
- 안전 상식 소재는 결론 자막 "절대 섞지 마세요 / 환기하세요"를 반드시 포함. 실제 세제 혼합 실사 촬영 금지.
- 스폰서 아이템 등장 시: 화면에 게임 내 "광고" 라벨이 보여야 하고, 캡션 첫 줄에 `#광고`. 성능 자막은 근거 화면 수치 범위만.

## 광고 표시(#광고) 규칙 — 세부 요건은 공정위 지침 웹 확인(확인 필요)

| 상황 | 표기 |
|---|---|
| 자사 게임 홍보 게시물(자사 계정) | 광고 표기 불필요한 경우가 많으나, 유료 광고 집행분은 플랫폼 "광고/Sponsored" 자동 표시 |
| 인플루언서에게 대가 제공(돈·얼리 액세스·굿즈) | 첫 줄/영상 첫 화면 `#광고` 또는 `#협찬`, 플랫폼 유료 파트너십 라벨, 더보기 뒤에 숨기지 않기 |
| 스폰서 브랜드 아이템이 나오는 영상 | `#광고` + "○○(가상예: BrightMax) 제휴" 명시 — 브랜드 광고이기도 함 |
| 영문 / 일문 | `#ad` `#sponsored` / `#PR` `#広告`(일본 스텔스 마케팅 규제 — 현행 요건 확인 필요) |

## 캡션·해시태그 믹스(15~20개, 사용 전 현재 인기도 확인)

- 대형: #satisfying #oddlysatisfying #asmr #cleaning #mobilegame
- 중형: #cleaningasmr #cleantok #satisfyingvideo #casualgame #puzzlegame
- 소형·브랜드: #sparkleclean #cleaninggame (앱명 확정 후 교체)
- 한국: #청소 #청소영상 #청소asmr #살림 #모바일게임 #힐링게임
- 일본: #掃除 #掃除動画 #スマホゲーム #ASMR #スッキリ

## 플레이어블 광고 브리프

- 길이 15~30초, 1단계 먼지(첫 드래그 쾌감) → 4단계 기름때 1부분(세제 분사 학습) → 엔드카드 "Play free" + 스토어 딥링크.
- 네트워크 규격(파일 크기·mraid 등)은 집행 전 각 네트워크 문서로 확인. 빌드는 `sc-dev` 가 `dist/` 를 단일 HTML로 인라인 번들링(이미지 자산이 없어 유리).

## 인플루언서 DM 초안(en)

Hi {name}, I make Sparkle Clean, a cleaning game where picking the right tool really matters — degreaser for grease, no brushes on glass, and it even warns you never to mix bleach-type and acidic cleaners. Your {video topic} videos are exactly the vibe. Would you try it and post a before/after clip? I can offer early access and a small fee for a dedicated short. Paid posts need a clear #ad / paid-partnership label. — Peter (solo developer, Korea)

## 성과 기준(초기 가정)

- 숏폼: 3초 유지율 ≥ 60%, 조회→프로필 2%+, 영상당 설치 추적(UTM/링크 단축)
- 유료: 소프트런치 CPI·D1 목표는 `sc-pm` kpi.md 기준, Tier 1 확장 조건 LTV:CPI ≥ 1.4
- 크리에이티브 피로 빠름 → 매주 5~10개 신규 소재
