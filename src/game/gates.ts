// 별 관문 — 다음 구역은 판을 깨는 것만으로는 열리지 않고, 그때까지 모은 별이 일정 수를 넘어야 한다.
//  별 1개 클리어는 기본 도구로 누구나 가능하다. 관문은 "앞 구역을 좀 더 잘 닦고 오라"는 요구이고,
//  그걸 쉽게 해 주는 것이 도구 강화·부스터다 — 코인이 필요한 순간이 여기서 생긴다.
//  첫 구역은 관문이 없고, 뒤로 갈수록 요구 비율이 오른다(최대 75% = 판당 평균 2.25개).
import { WORLDS, type AreaInfo } from './levels'

/** 구역 순서별 요구 비율 (앞 구역들 최대 별 수 대비). 목록보다 뒤 구역은 마지막 값 */
export const GATE_RATIOS = [0, 0.5, 0.6, 0.67, 0.7, 0.75] as const

export function allAreas(): AreaInfo[] {
  return WORLDS.flatMap((w) => w.areas)
}

/** 이 구역을 여는 데 필요한 누적 별 수 */
export function areaGate(areaId: string, areas: AreaInfo[] = allAreas()): number {
  const i = areas.findIndex((a) => a.id === areaId)
  if (i <= 0) return 0
  const before = areas.slice(0, i).reduce((n, a) => n + a.levelIds.length, 0)
  const ratio = GATE_RATIOS[Math.min(i, GATE_RATIOS.length - 1)]
  return Math.floor(before * 3 * ratio)
}

export function totalStars(stars: Record<number, number>): number {
  return Object.values(stars).reduce((a, b) => a + b, 0)
}

/** 이 판이 속한 구역 */
export function areaOf(levelId: number, areas: AreaInfo[] = allAreas()): AreaInfo | undefined {
  return areas.find((a) => a.levelIds.includes(levelId))
}

/** 이 판의 구역 관문까지 모자란 별 수 (0 = 열림) */
export function starsShort(levelId: number, stars: Record<number, number>, areas: AreaInfo[] = allAreas()): number {
  const a = areaOf(levelId, areas)
  if (!a) return 0
  return Math.max(0, areaGate(a.id, areas) - totalStars(stars))
}
