# ECC 운영 키트

ECC(Claude Code 용 에이전트·스킬 묶음)로 게임 저장소를 운영하기 위한 설정. 싹싹 클린에서 쓰는 것을 다른 게임에도 그대로 옮길 수 있다.

## 들어 있는 것

| 파일 | 역할 |
|---|---|
| `AGENTS.md` | 프로젝트 규칙 — ECC 에이전트와 Claude Code 가 가장 먼저 읽는다 |
| `CLAUDE.md` | `AGENTS.md` 를 불러오는 한 줄 |
| `.claude/commands/game-fix.md` | 제보 → 재현 → 수정 → 테스트 → 리뷰 |
| `.claude/commands/game-feature.md` | 계획 → 승인 → 구현 → 검증 |
| `.claude/commands/game-release.md` | 출시 전 점검과 출시 노트 |
| `.claude/commands/game-status.md` | 현재 상태 요약 |

## 다른 게임에 적용

```
bash ops/ecc-kit/apply.sh ~/경로/다른게임
```

명령 4개를 복사하고, `AGENTS.md` 가 없으면 빈칸이 있는 틀을 만든다. 틀의 `<…>` 부분(게임 이름, 저장소, 명령, 폴더 설명)을 채우면 끝.

## 쓰는 법

저장소 폴더에서 Claude Code 를 열고:

```
/game-status
/game-fix 광고 보고 +1 누르면 멈춘다는 제보
/game-feature 욕실에 새 오염 2종
/game-release 1.3
```

## ECC 가 하는 일과 하지 않는 일

- 한다: 계획(planner), 테스트 먼저(tdd-guide), 코드 리뷰(code-reviewer), 빌드 오류 해결(build-error-resolver), 보안 점검(security-reviewer).
- 하지 않는다: 예약 실행, 스토어 제출, 광고주 발굴·정산. 이것들은 기존 운영 에이전트(`ops/agent`)와 운영자가 맡는다.
