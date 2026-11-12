# 맥에서 운영 에이전트 돌리기

`install.command` 를 더블클릭하면 이 맥에 운영 에이전트가 설치된다(막히면 터미널에서 `bash install.command`).

**필요한 것**: git, Node.js, Claude Code(`claude`, 한 번 실행해 로그인), 권장: GitHub CLI(`gh auth login`).

| 무엇 | 언제 | 수동 실행 |
|---|---|---|
| 주간 운영 점검·업데이트 | 월 09:43 | `bash ~/SparkleCleanOps/run-routine.sh A` |
| 광고주 발굴 | 수 10:17 | `bash ~/SparkleCleanOps/run-routine.sh B` |
| 월간 정산 | 매월 3일 10:12 | `bash ~/SparkleCleanOps/run-routine.sh C` |

- 규칙과 권한은 `ops/agent/AGENT.md` 그대로다: main 직접 푸시·메일 발송·지급은 하지 않는다(실행 옵션에서도 막아 둠).
- 맥이 그 시각에 잠들어 있으면 깨어난 뒤 실행된다. 꺼져 있으면 건너뛴다.
- 결과: `~/SparkleCleanOps/Cleaningday/ops/agent/reports/`, 로그: `~/SparkleCleanOps/logs/`, 끝나면 알림 센터에 알림.
- Gmail: 이 맥의 Claude Code 에 Gmail 커넥터가 연결돼 있으면 초안을 만들고, 없으면 `reports/drafts/` 에 파일로 남긴다. 정산 자료는 `state/inbox/`·`state/metrics/` 에 넣어 두면 읽는다.
- **클라우드 예약 작업과 같이 켜 두면 같은 일을 두 번 한다.** 한쪽만 쓸 것.
- 제거: `bash uninstall.command`
