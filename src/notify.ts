// 복귀 알림 (앱 전용, 기기 안에서만 예약되는 로컬 알림 — 서버·개인정보 없음)
//  앱을 열 때마다 예약을 새로 건다: 내일·3일 뒤·7일 뒤 저녁. 그 사이에 다시 열면 뒤로 밀리므로, 매일 오는 사람은 알림을 받지 않는다.
//  권한은 판을 2개 이상 깬 뒤 한 번만 묻는다. 설정에서 끌 수 있다. 웹에서는 아무것도 하지 않는다.
import { Capacitor } from '@capacitor/core';
import { track } from './analytics';
import { attendanceReward } from './retention';
import { getStore, persist } from './storage';
import { t } from './i18n';

const IDS = [9101, 9102, 9103];
/** 며칠 뒤, 몇 시에 */
const PLAN: { days: number; hour: number; minute: number }[] = [
  { days: 1, hour: 19, minute: 30 },
  { days: 3, hour: 19, minute: 30 },
  { days: 7, hour: 12, minute: 30 },
];
/** 권한을 묻기 전에 깨야 하는 판 수 — 게임이 마음에 든 뒤에 묻는다 */
export const ASK_AFTER_GAMES = 2;

export function notifySupported(): boolean {
  return Capacitor.isNativePlatform();
}

/** 예약할 알림 문구 (검사할 수 있게 순수 함수로) */
export function comebackMessages(streak: number, claimedToday: boolean): { title: string; body: string }[] {
  // 오늘 출석을 받았으면 내일은 연속 +1일째 보상, 아니면 지금 연속 그대로
  const tomorrow = attendanceReward(claimedToday ? streak + 1 : Math.max(1, streak));
  return [
    { title: t('notifyTitle'), body: t('notifyTomorrow', { c: tomorrow.coins }) },
    { title: t('notifyTitle'), body: t('notifyMissions') },
    { title: t('notifyTitle'), body: t('notifyComeback') },
  ];
}

function at(days: number, hour: number, minute: number, now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** 앱을 열 때·판을 끝낼 때 호출. 필요하면 권한을 묻고, 알림 예약을 새로 건다 */
export async function refreshComebackNotifications(todayKey: string): Promise<void> {
  if (!notifySupported()) return;
  const st = getStore();
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) });
    if (st.settings.notify === false) return;
    let perm = (await LocalNotifications.checkPermissions()).display;
    if (perm !== 'granted') {
      if (st.settings.notifyAsked || st.stats.gamesPlayed < ASK_AFTER_GAMES) return;
      st.settings.notifyAsked = true;
      persist();
      perm = (await LocalNotifications.requestPermissions()).display;
      track('notify_permission', { granted: perm === 'granted' });
      if (perm !== 'granted') return;
    }
    const msgs = comebackMessages(st.daily.streak, st.daily.bonusDay === todayKey);
    await LocalNotifications.schedule({
      notifications: PLAN.map((p, i) => ({ id: IDS[i], title: msgs[i].title, body: msgs[i].body, schedule: { at: at(p.days, p.hour, p.minute), allowWhileIdle: false } })),
    });
  } catch (e) {
    track('notify_error', { message: String(e) });
  }
}

/** 설정에서 알림을 껐을 때 */
export async function cancelComebackNotifications(): Promise<void> {
  if (!notifySupported()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) });
  } catch {
    /* 무시 */
  }
}
