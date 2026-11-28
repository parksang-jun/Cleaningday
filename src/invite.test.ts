import { describe, expect, it } from 'vitest';
import { claimShare, INVITE_COINS, isValidCode, myInviteCode, newInviteCode, normalizeCode, redeemInvite, SHARE_COINS, shareClaimedToday } from './invite';
import type { Store } from './storage';

const fresh = (): Pick<Store, 'coins' | 'invite'> => ({ coins: 0 });
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('초대 코드', () => {
  it('만든 코드는 7자이고 검사를 통과한다', () => {
    for (let i = 0; i < 200; i++) {
      const c = newInviteCode();
      expect(c).toHaveLength(7);
      expect(isValidCode(c)).toBe(true);
    }
  });

  it('한 글자만 틀려도(오타) 걸러 낸다', () => {
    const c = newInviteCode(seq(0.1, 0.5, 0.9, 0.3, 0.7, 0.2));
    const wrong = (c[0] === '2' ? '3' : '2') + c.slice(1);
    expect(isValidCode(wrong)).toBe(false);
    expect(isValidCode(c.slice(0, 6))).toBe(false);
    expect(isValidCode('')).toBe(false);
    expect(isValidCode('O0I1L!!')).toBe(false);
  });

  it('소문자·공백·하이픈이 섞여도 같은 코드로 본다', () => {
    const c = newInviteCode(seq(0.4));
    const typed = ` ${c.slice(0, 3).toLowerCase()}-${c.slice(3)} `;
    expect(normalizeCode(typed)).toBe(c);
    expect(isValidCode(typed)).toBe(true);
  });

  it('내 코드는 한 번 만들어지면 바뀌지 않는다', () => {
    const st = fresh();
    const a = myInviteCode(st);
    expect(myInviteCode(st)).toBe(a);
  });
});

describe('공유 보너스', () => {
  it('하루에 한 번만 준다', () => {
    const st = fresh();
    expect(claimShare(st, '2026-11-28')).toBe(SHARE_COINS);
    expect(shareClaimedToday(st, '2026-11-28')).toBe(true);
    expect(claimShare(st, '2026-11-28')).toBe(0);
    expect(st.coins).toBe(SHARE_COINS);
  });

  it('다음 날에는 다시 받는다', () => {
    const st = fresh();
    claimShare(st, '2026-11-28');
    expect(shareClaimedToday(st, '2026-11-29')).toBe(false);
    expect(claimShare(st, '2026-11-29')).toBe(SHARE_COINS);
    expect(st.coins).toBe(SHARE_COINS * 2);
  });
});

describe('초대 코드 입력', () => {
  const friend = newInviteCode(seq(0.6, 0.2, 0.8));

  it('친구 코드를 넣으면 한 번만 코인을 받는다', () => {
    const st = fresh();
    expect(redeemInvite(st, friend)).toBe('ok');
    expect(st.coins).toBe(INVITE_COINS);
    expect(redeemInvite(st, newInviteCode(seq(0.05)))).toBe('used');
    expect(st.coins).toBe(INVITE_COINS);
  });

  it('틀린 코드·내 코드는 받지 못하고, 그 뒤에 올바른 코드는 받을 수 있다', () => {
    const st = fresh();
    const mine = myInviteCode(st);
    expect(redeemInvite(st, 'ABC')).toBe('invalid');
    expect(redeemInvite(st, mine)).toBe('own');
    expect(st.coins).toBe(0);
    expect(redeemInvite(st, friend === mine ? newInviteCode(seq(0.33)) : friend)).toBe('ok');
  });
});
