// 스토어 평가 요청 — 기분 좋은 순간(별 3개 클리어 직후)에만, 드물게 묻는다.
//  실제 창을 띄울지는 OS 가 정한다(iOS 는 1년에 3번까지). 여기서는 "언제 요청해 볼지"만 고른다.
//  너무 일찍(몇 판 안 해 본 사람) 묻거나 자주 물으면 낮은 별점만 돌아온다.
import type { Store } from './storage';

/** 요청 전 깨야 하는 판 수 */
export const REVIEW_MIN_CLEARS = 6;
/** 다시 묻기까지 간격 */
export const REVIEW_GAP_DAYS = 60;
/** 평생 요청 횟수 상한 */
export const REVIEW_MAX_ASKS = 3;

const DAY = 86_400_000;

export function shouldAskReview(st: { progress: Pick<Store['progress'], 'stars'>; review?: Store['review'] }, stars: number, now: number): boolean {
  if (stars < 3) return false;
  const clears = Object.values(st.progress.stars).filter((s) => s > 0).length;
  if (clears < REVIEW_MIN_CLEARS) return false;
  const r = st.review;
  if (!r) return true;
  if (r.count >= REVIEW_MAX_ASKS) return false;
  return now - r.last >= REVIEW_GAP_DAYS * DAY;
}

export function markReviewAsked(st: Pick<Store, 'review'>, now: number): void {
  st.review = { last: now, count: (st.review?.count ?? 0) + 1 };
}

/** 네이티브 평가 창 요청 (웹에서는 아무 일도 없다). 실패해도 게임에 영향이 없어야 한다 */
export async function requestNativeReview(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
