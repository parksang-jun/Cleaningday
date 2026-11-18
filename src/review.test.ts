import { describe, expect, it } from 'vitest';
import { markReviewAsked, REVIEW_GAP_DAYS, REVIEW_MAX_ASKS, REVIEW_MIN_CLEARS, shouldAskReview } from './review';

const DAY = 86_400_000;
const withClears = (n: number, review?: { last: number; count: number }) => ({
  progress: { unlocked: n + 1, stars: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 2])) as Record<number, number> },
  review,
});

describe('평가 요청 시점', () => {
  it('별 3개 클리어이고 충분히 해 본 사람에게만 묻는다', () => {
    expect(shouldAskReview(withClears(REVIEW_MIN_CLEARS), 3, 0)).toBe(true);
    expect(shouldAskReview(withClears(REVIEW_MIN_CLEARS), 2, 0)).toBe(false);
    expect(shouldAskReview(withClears(REVIEW_MIN_CLEARS - 1), 3, 0)).toBe(false);
  });
  it('한 번 물었으면 간격이 지나야 다시 묻고, 상한을 넘기지 않는다', () => {
    const st = withClears(20);
    const t0 = 1_000 * DAY;
    markReviewAsked(st, t0);
    expect(shouldAskReview(st, 3, t0 + (REVIEW_GAP_DAYS - 1) * DAY)).toBe(false);
    expect(shouldAskReview(st, 3, t0 + REVIEW_GAP_DAYS * DAY)).toBe(true);
    for (let i = 1; i < REVIEW_MAX_ASKS; i++) markReviewAsked(st, t0 + i * REVIEW_GAP_DAYS * DAY);
    expect(st.review!.count).toBe(REVIEW_MAX_ASKS);
    expect(shouldAskReview(st, 3, t0 + 100 * REVIEW_GAP_DAYS * DAY)).toBe(false);
  });
});
