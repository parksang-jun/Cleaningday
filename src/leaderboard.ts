// 랭킹 — iOS 는 Game Center, Android 는 Play 게임 서비스. 점수는 "모은 별 총합".
//  웹에서는 아무 일도 하지 않는다. 로그인 실패·미설정이어도 게임 진행에는 영향이 없어야 한다.
//  네이티브 쪽 구현: ios/App/App/AppDelegate.swift(LeaderboardPlugin), android/.../LeaderboardPlugin.java
import { totalStars } from './game/gates';

/** App Store Connect 에 만드는 순위표 ID (Android 는 strings.xml 의 leaderboard_total_stars 를 쓴다) */
export const LEADERBOARD_ID = 'total_stars';

export interface LeaderboardNative {
  signIn(opts: { interactive: boolean }): Promise<{ signedIn: boolean }>;
  submitScore(opts: { leaderboardId: string; score: number }): Promise<void>;
  show(opts: { leaderboardId: string }): Promise<void>;
}

/** 순위표에 올리는 점수: 모은 별 총합 (0 이상의 정수) */
export function rankScore(stars: Record<number, number>): number {
  return Math.max(0, Math.floor(totalStars(stars)));
}

export interface Leaderboard {
  /** 앱을 켤 때 조용히 로그인하고 현재 점수를 올린다 */
  start(score: number): Promise<boolean>;
  /** 점수가 지난번에 올린 값보다 클 때만 올린다. 올렸으면 true */
  submit(score: number): Promise<boolean>;
  /** 순위표 화면을 연다. 로그인이 안 되거나 열 수 없으면 false */
  show(score: number): Promise<boolean>;
}

/** native 가 null 이면(웹) 모든 호출이 false 로 끝난다 */
export function createLeaderboard(native: LeaderboardNative | null): Leaderboard {
  let signedIn = false;
  let sent = -1;

  async function signIn(interactive: boolean): Promise<boolean> {
    if (!native) return false;
    if (signedIn) return true;
    try {
      signedIn = (await native.signIn({ interactive })).signedIn === true;
    } catch {
      signedIn = false;
    }
    return signedIn;
  }

  async function submit(score: number): Promise<boolean> {
    if (!native || !signedIn) return false;
    if (!Number.isFinite(score) || score <= sent) return false;
    try {
      await native.submitScore({ leaderboardId: LEADERBOARD_ID, score });
      sent = score;
      return true;
    } catch {
      return false;
    }
  }

  return {
    async start(score) {
      if (!(await signIn(false))) return false;
      await submit(score);
      return true;
    },
    submit,
    async show(score) {
      if (!(await signIn(true))) return false;
      await submit(score);
      try {
        await native!.show({ leaderboardId: LEADERBOARD_ID });
        return true;
      } catch {
        return false;
      }
    },
  };
}

let shared: Leaderboard | null = null;

/** 앱에서 쓰는 단일 인스턴스 (네이티브에서만 플러그인을 붙인다) */
export async function leaderboard(): Promise<Leaderboard> {
  if (shared) return shared;
  let native: LeaderboardNative | null = null;
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) native = registerPlugin<LeaderboardNative>('Leaderboard');
  } catch {
    native = null;
  }
  shared = createLeaderboard(native);
  return shared;
}
