// 이벤트 추적 추상화. 출시 시 Firebase Analytics(네이티브) 또는 GA4(웹)로 연결한다.
// 개인정보: 식별자 없이 이벤트명과 수치만 전송한다.
type Params = Record<string, string | number | boolean>;

const listeners: Array<(name: string, params?: Params) => void> = [];

export function onTrack(fn: (name: string, params?: Params) => void): void {
  listeners.push(fn);
}

export function track(name: string, params?: Params): void {
  if (import.meta.env.DEV) console.debug('[track]', name, params ?? '');
  for (const fn of listeners) {
    try {
      fn(name, params);
    } catch {
      /* 추적 실패는 게임에 영향 없음 */
    }
  }
}
