// 잔존율 장치 — "내일 또 올 이유"를 한 군데서 정의한다.
//  1) 출석 달력: 7일 주기로 커지는 보상(3·5·7일째 부스터). 하루 빠지면 1일째부터. (지급은 economy.claimDailyBonus)
//  2) 오늘의 미션: 날짜로 정해지는 3개. 판을 깨면 진행되고, 홈에서 직접 받는다. 3개 모두 받으면 상자.
//  3) 복귀 보너스: 3일 이상 쉬었다 돌아오면 한 번.
//  4) 잔존 측정: 설치일·접속 일수를 기록하고 session_start 이벤트에 "설치 후 며칠째"를 싣는다.
import type { BoosterId } from './economy';
import type { Store } from './storage';

// ---------- 출석 달력 ----------
export interface AttendanceDay {
  coins: number;
  booster?: BoosterId;
}
/** 7일 주기 보상. 1일째는 30코인(기존과 동일), 7일째가 가장 크다 */
export const ATTENDANCE: AttendanceDay[] = [
  { coins: 30 },
  { coins: 40 },
  { coins: 50, booster: 'scan' },
  { coins: 60 },
  { coins: 80, booster: 'time' },
  { coins: 100 },
  { coins: 200, booster: 'bomb' },
];
/** 연속 n일째(1부터)의 보상 */
export function attendanceReward(streak: number): AttendanceDay {
  return ATTENDANCE[(Math.max(1, streak) - 1) % ATTENDANCE.length];
}
/** 달력 위치 0~6 */
export function attendanceIndex(streak: number): number {
  return (Math.max(1, streak) - 1) % ATTENDANCE.length;
}
/** 3일 이상 쉬었다 돌아온 사람에게 한 번 주는 코인 */
export const COMEBACK_COINS = 50;
export const COMEBACK_AFTER_DAYS = 3;

// ---------- 오늘의 미션 ----------
export type MissionId = 'clear' | 'stars' | 'perfect' | 'par' | 'safe';
export interface MissionDef {
  id: MissionId;
  icon: string;
  target: number;
}
export const MISSIONS: Record<MissionId, MissionDef> = {
  clear: { id: 'clear', icon: '🧹', target: 3 }, // 판 3개 깨기
  stars: { id: 'stars', icon: '⭐', target: 6 }, // 별 6개 모으기
  perfect: { id: 'perfect', icon: '🏆', target: 1 }, // 별 3개로 1판
  par: { id: 'par', icon: '⏱', target: 2 }, // 목표 시간 안에 2판
  safe: { id: 'safe', icon: '🛡', target: 2 }, // 표면 손상 없이 2판
};
export const MISSION_COINS = 40;
export const CHEST_COINS = 100;
const CHEST_BOOSTERS: BoosterId[] = ['scan', 'time', 'shield', 'bomb'];

export interface MissionState {
  day: string;
  ids: MissionId[];
  prog: Partial<Record<MissionId, number>>;
  claimed: MissionId[];
  chest: boolean;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 그날의 미션 3개: '판 깨기'는 항상, 나머지 둘은 날짜로 정한다(누구에게나 같은 날 같은 미션) */
export function missionIdsFor(day: string): MissionId[] {
  const rest: MissionId[] = ['stars', 'perfect', 'par', 'safe'];
  const h = hash(day);
  const a = h % rest.length;
  const b = (a + 1 + ((h >>> 8) % (rest.length - 1))) % rest.length;
  return ['clear', rest[a], rest[b]];
}
export function chestBooster(day: string): BoosterId {
  return CHEST_BOOSTERS[hash(`chest:${day}`) % CHEST_BOOSTERS.length];
}

/** 오늘의 미션 상태 — 날짜가 바뀌면 새로 뽑는다 */
export function missions(st: Store, today: string): MissionState {
  if (!st.daily.missions || st.daily.missions.day !== today) {
    st.daily.missions = { day: today, ids: missionIdsFor(today), prog: {}, claimed: [], chest: false };
  }
  return st.daily.missions;
}
export function missionProgress(m: MissionState, id: MissionId): number {
  return Math.min(MISSIONS[id].target, m.prog[id] ?? 0);
}
export function missionDone(m: MissionState, id: MissionId): boolean {
  return (m.prog[id] ?? 0) >= MISSIONS[id].target;
}

export interface ClearInfo {
  stars: number;
  /** 목표 시간 안에 끝냈나 */
  underPar: boolean;
  /** 표면 손상·위험 혼합 벌점이 없었나 */
  safe: boolean;
}
/** 판을 깼을 때 미션 진행. 이번에 새로 달성한 미션 id 를 돌려준다 */
export function recordClear(st: Store, info: ClearInfo, today: string): MissionId[] {
  const m = missions(st, today);
  const add: Record<MissionId, number> = {
    clear: 1,
    stars: info.stars,
    perfect: info.stars >= 3 ? 1 : 0,
    par: info.underPar ? 1 : 0,
    safe: info.safe ? 1 : 0,
  };
  const newly: MissionId[] = [];
  for (const id of m.ids) {
    const before = missionDone(m, id);
    m.prog[id] = Math.min(MISSIONS[id].target, (m.prog[id] ?? 0) + add[id]);
    if (!before && missionDone(m, id)) newly.push(id);
  }
  return newly;
}
/** 달성한 미션 보상 받기. 받았으면 코인 수, 아니면 0 */
export function claimMission(st: Store, id: MissionId, today: string): number {
  const m = missions(st, today);
  if (!m.ids.includes(id) || !missionDone(m, id) || m.claimed.includes(id)) return 0;
  m.claimed.push(id);
  st.coins += MISSION_COINS;
  return MISSION_COINS;
}
/** 받을 수 있는(달성했고 아직 안 받은) 미션 수 */
export function claimable(m: MissionState): number {
  return m.ids.filter((id) => missionDone(m, id) && !m.claimed.includes(id)).length;
}
export function chestReady(m: MissionState): boolean {
  return !m.chest && m.ids.every((id) => m.claimed.includes(id));
}
/** 미션 3개를 모두 받은 뒤 여는 상자 */
export function claimChest(st: Store, today: string): { coins: number; booster: BoosterId } | null {
  const m = missions(st, today);
  if (!chestReady(m)) return null;
  m.chest = true;
  const booster = chestBooster(today);
  st.coins += CHEST_COINS;
  st.boosters[booster]++;
  return { coins: CHEST_COINS, booster };
}

// ---------- 잔존 측정 ----------
function dayNumber(key: string): number {
  const [y, mo, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, mo - 1, d) / 86_400_000);
}
export function daysBetween(fromKey: string, toKey: string): number {
  return dayNumber(toKey) - dayNumber(fromKey);
}
/**
 * 접속 기록: 설치일과 접속한 날 수를 남긴다. 그날 첫 접속이면 { dayN: 설치 후 며칠째(0=설치일), days: 접속 일수 }, 아니면 null.
 * 분석 도구(Firebase 등)가 연결되면 dayN=1·7 인 session_start 수가 곧 1일차·7일차 잔존이다.
 */
export function recordVisit(st: Store, today: string): { dayN: number; days: number } | null {
  const s = st.stats;
  if (!s.firstDay) s.firstDay = today;
  if (s.lastDay === today) return null;
  s.lastDay = today;
  s.daysPlayed = (s.daysPlayed ?? 0) + 1;
  return { dayN: Math.max(0, daysBetween(s.firstDay, today)), days: s.daysPlayed };
}
