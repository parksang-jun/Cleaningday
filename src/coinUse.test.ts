import { describe, expect, it } from 'vitest';
import { canOfferSkip, SKIP_AFTER_FAILS, SKIP_COINS, skipStage, spend } from './coinUse';

const store = (unlocked: number, coins: number) => ({ coins, progress: { unlocked, stars: {} as Record<number, number>, bestTime: {} }, failRuns: { [unlocked]: 3 } as Record<number, number> });

describe('코인 쓰기', () => {
  it('모자라면 빼지 않는다', () => {
    const st = { coins: 39 };
    expect(spend(st, 40)).toBe(false);
    expect(st.coins).toBe(39);
    expect(spend({ coins: 40 }, 40)).toBe(true);
    expect(spend({ coins: 40 }, 0)).toBe(false);
  });
});

describe('판 건너뛰기', () => {
  it('여러 번 실패한 맨 앞 판에서만 보인다', () => {
    const st = store(10, 500);
    expect(canOfferSkip(st, 10, SKIP_AFTER_FAILS - 1, 96)).toBe(false);
    expect(canOfferSkip(st, 10, SKIP_AFTER_FAILS, 96)).toBe(true);
    expect(canOfferSkip(st, 9, 5, 96)).toBe(false); // 이미 깬 판
    expect(canOfferSkip(store(96, 500), 96, 5, 96)).toBe(false); // 마지막 판
  });

  it('코인을 내고 다음 판만 연다 — 별은 생기지 않는다', () => {
    const st = store(10, SKIP_COINS + 5);
    expect(skipStage(st, 10, 2, 96)).toBe(true);
    expect(st.coins).toBe(5);
    expect(st.progress.unlocked).toBe(11);
    expect(st.progress.stars[10]).toBeUndefined();
    expect(st.failRuns[10]).toBeUndefined();
  });

  it('코인이 모자라면 아무것도 바뀌지 않는다', () => {
    const st = store(10, SKIP_COINS - 1);
    expect(skipStage(st, 10, 2, 96)).toBe(false);
    expect(st.progress.unlocked).toBe(10);
    expect(st.coins).toBe(SKIP_COINS - 1);
  });
});
