// 시드 기반 난수(mulberry32). 데일리 챌린지의 재현성과 이어하기(저장/복원)를 위해 내부 상태를 노출한다.

export interface Rng {
  /** [0, 1) 구간의 난수 */
  next(): number;
  /** 저장용 내부 상태 */
  state: number;
}

export function mulberry32(seed: number): Rng {
  const rng: Rng = {
    state: seed >>> 0,
    next() {
      rng.state = (rng.state + 0x6d2b79f5) >>> 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
  return rng;
}

/** 저장된 상태로 난수 생성기를 복원 */
export function restoreRng(state: number): Rng {
  const rng = mulberry32(0);
  rng.state = state >>> 0;
  return rng;
}

/** FNV-1a 32비트 문자열 해시 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 로컬 날짜 키(YYYY-MM-DD). 데일리 챌린지는 사용자의 현지 날짜 기준 */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 데일리 챌린지 시드 — 같은 날짜면 전 세계 동일한 조각 순서 */
export function dailySeed(date: Date = new Date()): number {
  return hashString(`jelly-blocks-daily-${dateKey(date)}`);
}

/** 클래식 모드용 무작위 시드 */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
