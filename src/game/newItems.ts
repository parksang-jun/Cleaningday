/**
 * '새 아이템' 알림에 무엇을 보여 줄지 정한다.
 *
 * 판을 시작할 때 받은 아이템 중 **이 판의 도구 칸(kit)에 실제로 나오는 것만** 알리고,
 * 이번 판에서 쓰지 않는 것은 다음에 그 아이템이 도구 칸에 처음 나오는 판까지 미뤄 둔다.
 * (1판에서 세제 칸이 비어 있는데 '새 아이템: 다목적 세정제'가 뜨던 문제 — 2026-11-13 자체 점검)
 */
export function splitNewItems(
  pending: readonly string[],
  justGranted: readonly string[],
  kit: ReadonlySet<string>,
): { announce: string[]; later: string[] } {
  const all = [...new Set([...pending, ...justGranted])];
  return {
    announce: all.filter((id) => kit.has(id)),
    later: all.filter((id) => !kit.has(id)),
  };
}
