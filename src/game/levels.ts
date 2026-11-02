// 스테이지 정의 — 표면, 오염 분포(시드 기반 얼룩), 기준 시간, 지급 아이템
import type { DetergentId, DirtType, SurfaceType, ToolId } from './catalog'

export interface DirtPatch {
  type: DirtType
  blobs: number // 얼룩 덩어리 수
  size: [number, number] // 반경 범위(칸)
  amount: [number, number] // 농도 범위 0~1
  coverage?: number // 0~1: 전체를 이 비율로 덮는 기본층(먼지 등)
}

export interface LevelDef {
  id: number
  scene: SceneId
  surface: SurfaceType
  patches: DirtPatch[]
  parSec: number
  /** 이 스테이지부터 무료로 지급되는 아이템 */
  grants: (ToolId | DetergentId)[]
  /** 힌트 키 (i18n) */
  hint?: string
}

export type SceneId = 'floor' | 'entrance' | 'kitchenTile' | 'stove' | 'window' | 'bathTile' | 'bathtub' | 'table' | 'sofa' | 'patio' | 'car' | 'bigClean'

export const GRID_W = 48
export const GRID_H = 64

export const LEVELS: LevelDef[] = [
  { id: 1, scene: 'floor', surface: 'wood', parSec: 25, grants: ['cloth', 'sponge', 'allpurpose'], hint: 'hintDust', patches: [{ type: 'dust', blobs: 10, size: [6, 11], amount: [0.5, 0.9], coverage: 0.35 }] },
  { id: 2, scene: 'entrance', surface: 'tile', parSec: 30, grants: [], hint: 'hintMud', patches: [{ type: 'mud', blobs: 9, size: [4, 8], amount: [0.6, 1] }, { type: 'dust', blobs: 4, size: [5, 9], amount: [0.3, 0.6] }] },
  { id: 3, scene: 'kitchenTile', surface: 'tile', parSec: 25, grants: [], hint: 'hintStain', patches: [{ type: 'stain', blobs: 8, size: [3, 6], amount: [0.6, 1] }, { type: 'dust', blobs: 3, size: [6, 10], amount: [0.3, 0.5] }] },
  { id: 4, scene: 'stove', surface: 'steel', parSec: 40, grants: ['degreaser'], hint: 'hintGrease', patches: [{ type: 'grease', blobs: 9, size: [4, 8], amount: [0.6, 1] }, { type: 'stain', blobs: 4, size: [2, 4], amount: [0.6, 0.9] }] },
  { id: 5, scene: 'window', surface: 'glass', parSec: 25, grants: [], hint: 'hintGlass', patches: [{ type: 'dust', blobs: 6, size: [7, 12], amount: [0.4, 0.8], coverage: 0.3 }, { type: 'stain', blobs: 5, size: [2, 4], amount: [0.5, 0.8] }] },
  { id: 6, scene: 'bathTile', surface: 'tile', parSec: 55, grants: ['descaler'], hint: 'hintScale', patches: [{ type: 'scale', blobs: 10, size: [4, 8], amount: [0.6, 1] }] },
  { id: 7, scene: 'bathtub', surface: 'ceramic', parSec: 40, grants: ['moldremover', 'brush'], hint: 'hintMold', patches: [{ type: 'mold', blobs: 8, size: [3, 7], amount: [0.6, 1] }, { type: 'scale', blobs: 5, size: [3, 6], amount: [0.5, 0.9] }] },
  { id: 8, scene: 'table', surface: 'wood', parSec: 25, grants: [], hint: 'hintWood', patches: [{ type: 'stain', blobs: 7, size: [3, 6], amount: [0.6, 1] }, { type: 'grease', blobs: 4, size: [3, 6], amount: [0.5, 0.8] }] },
  { id: 9, scene: 'sofa', surface: 'fabric', parSec: 25, grants: ['vacuum'], hint: 'hintFabric', patches: [{ type: 'dust', blobs: 8, size: [7, 12], amount: [0.5, 0.9], coverage: 0.4 }, { type: 'stain', blobs: 4, size: [3, 5], amount: [0.6, 0.9] }] },
  { id: 10, scene: 'patio', surface: 'stone', parSec: 40, grants: ['washer'], hint: 'hintPatio', patches: [{ type: 'mud', blobs: 10, size: [5, 10], amount: [0.7, 1] }, { type: 'mold', blobs: 5, size: [4, 7], amount: [0.5, 0.9] }] },
  { id: 11, scene: 'car', surface: 'paint', parSec: 30, grants: [], hint: 'hintCar', patches: [{ type: 'mud', blobs: 8, size: [4, 9], amount: [0.6, 1] }, { type: 'dust', blobs: 6, size: [7, 12], amount: [0.4, 0.7], coverage: 0.3 }] },
  { id: 12, scene: 'bigClean', surface: 'tile', parSec: 40, grants: [], hint: 'hintBig', patches: [
    { type: 'dust', blobs: 4, size: [6, 10], amount: [0.4, 0.7] },
    { type: 'grease', blobs: 4, size: [3, 6], amount: [0.6, 1] },
    { type: 'scale', blobs: 4, size: [3, 6], amount: [0.6, 1] },
    { type: 'mold', blobs: 3, size: [3, 5], amount: [0.6, 1] },
    { type: 'stain', blobs: 4, size: [2, 4], amount: [0.6, 1] },
  ] },
]

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id)
}
