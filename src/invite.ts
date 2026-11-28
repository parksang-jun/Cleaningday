// 친구 추천 — 서버 없이 되는 범위만.
//  1) 공유 보너스: 공유 창(카카오톡·WhatsApp·문자…)을 열어 보내면 하루 1회 코인.
//     실제로 보냈는지는 앱이 알 수 없다(그래서 하루 1회). 공유는 보너스일 뿐, 플레이를 막는 조건이 아니다.
//  2) 초대 코드: 공유 글에 내 코드가 들어가고, 받은 친구가 입력하면 친구가 코인을 받는다(설치당 1회).
//     코드는 끝자리 검사 문자로 오타만 걸러 낸다. 초대한 사람 보상은 서버가 있어야 해서 없다.
import { todayKey } from './economy';
import type { Store } from './storage';

/** 공유 보너스 (하루 1회) */
export const SHARE_COINS = 50;
/** 초대 코드를 입력한 친구가 받는 코인 (설치당 1회) */
export const INVITE_COINS = 100;

/** 헷갈리는 글자(0·O, 1·I·L)를 뺀 31자 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const BODY_LEN = 6;

function checkChar(body: string): string {
  let sum = 7;
  for (let i = 0; i < body.length; i++) sum = (sum * 31 + ALPHABET.indexOf(body[i]) * (i + 3)) % 9973;
  return ALPHABET[sum % ALPHABET.length];
}

/** 새 초대 코드 (6자 + 검사 1자). rnd 는 테스트에서 고정 값을 넣기 위한 것 */
export function newInviteCode(rnd: () => number = Math.random): string {
  let body = '';
  for (let i = 0; i < BODY_LEN; i++) body += ALPHABET[Math.min(ALPHABET.length - 1, Math.floor(rnd() * ALPHABET.length))];
  return body + checkChar(body);
}

/** 입력값 정리: 공백·하이픈 제거, 대문자 */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isValidCode(input: string): boolean {
  const c = normalizeCode(input);
  if (c.length !== BODY_LEN + 1) return false;
  for (const ch of c) if (!ALPHABET.includes(ch)) return false;
  return checkChar(c.slice(0, BODY_LEN)) === c[BODY_LEN];
}

type InviteStore = Pick<Store, 'coins' | 'invite'>;

/** 내 초대 코드 (없으면 만든다) */
export function myInviteCode(st: InviteStore, rnd?: () => number): string {
  if (!st.invite?.code || !isValidCode(st.invite.code)) st.invite = { ...(st.invite ?? {}), code: newInviteCode(rnd) };
  return st.invite.code;
}

export function shareClaimedToday(st: InviteStore, today = todayKey()): boolean {
  return st.invite?.shareDay === today;
}

/** 공유를 마친 뒤 부른다. 오늘 처음이면 코인을 주고 받은 수를, 이미 받았으면 0 을 돌려준다 */
export function claimShare(st: InviteStore, today = todayKey()): number {
  myInviteCode(st);
  if (shareClaimedToday(st, today)) return 0;
  st.invite!.shareDay = today;
  st.coins += SHARE_COINS;
  return SHARE_COINS;
}

export type RedeemResult = 'ok' | 'invalid' | 'own' | 'used';

/** 친구에게 받은 코드를 입력한다 */
export function redeemInvite(st: InviteStore, input: string): RedeemResult {
  const mine = myInviteCode(st);
  if (st.invite!.redeemed) return 'used';
  if (!isValidCode(input)) return 'invalid';
  const code = normalizeCode(input);
  if (code === mine) return 'own';
  st.invite!.redeemed = code;
  st.coins += INVITE_COINS;
  return 'ok';
}
