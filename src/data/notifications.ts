/**
 * Local reminders through expo-notifications. The database decides what
 * should fire; this only mirrors it into the OS (see repo.reconcileReminders).
 * Web has no scheduled notifications, so it gets a no-op scheduler.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { Scheduler } from './types';

export const CHANNEL_ID = 'reminders';

export const noopScheduler: Scheduler = {
  maxPending: 0,
  schedule: async () => null,
  cancel: async () => undefined,
  listScheduled: async () => [],
};

export function createScheduler(): Scheduler {
  if (Platform.OS === 'web') return noopScheduler;
  return {
    // iOS keeps 64 pending per app; leave room for the system.
    maxPending: Platform.OS === 'ios' ? 60 : 200,
    async schedule({ noteId, title, body, fireAt }) {
      return Notifications.scheduleNotificationAsync({
        content: { title, body, data: { noteId }, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: CHANNEL_ID,
          // Uses the exact alarm when it is allowed, best effort otherwise.
          delivery: 'alarmClock',
        },
      });
    },
    cancel: (osId) => Notifications.cancelScheduledNotificationAsync(osId),
    async listScheduled() {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      return all.map((n) => {
        const id = n.content.data?.noteId;
        return { osId: n.identifier, noteId: typeof id === 'string' ? id : null };
      });
    },
  };
}

/** Show reminders even while the app is open, and create the Android channel. */
export async function setupNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: AndroidImportance.HIGH,
    });
  }
}

export type ReminderPermission = {
  /** Can notifications be shown at all? */
  notifications: 'granted' | 'denied' | 'undetermined';
  canAsk: boolean;
  /** Android 12+: can they fire at the exact minute? null where it does not apply. */
  exact: boolean | null;
};

export async function getReminderPermission(): Promise<ReminderPermission> {
  if (Platform.OS === 'web') return { notifications: 'granted', canAsk: false, exact: null };
  const p = await Notifications.getPermissionsAsync();
  let exact: boolean | null = null;
  if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
    try {
      exact = (await Notifications.getExactAlarmPermissionsAsync()).granted;
    } catch {
      exact = null;
    }
  }
  return { notifications: p.granted ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined', canAsk: p.canAskAgain, exact };
}

export async function askReminderPermission(): Promise<ReminderPermission> {
  if (Platform.OS !== 'web') {
    const cur = await Notifications.getPermissionsAsync();
    if (!cur.granted && cur.canAskAgain) await Notifications.requestPermissionsAsync();
  }
  return getReminderPermission();
}

/** Opens the system page where exact alarms can be allowed (Android 12+). */
export async function askExactAlarms() {
  try {
    await Notifications.requestExactAlarmPermissionsAsync();
  } catch {
    await Linking.openSettings();
  }
}

export const openAppSettings = () => Linking.openSettings();

/** The note id a notification belongs to, if any. */
export function noteIdOf(response: Notifications.NotificationResponse | null | undefined): string | null {
  const id = response?.notification.request.content.data?.noteId;
  return typeof id === 'string' ? id : null;
}

/**
 * Listen for reminders: `onFired` when one is delivered while the app is open,
 * `onOpened` when one is tapped (including the tap that launched the app).
 */
export function listenForReminders(onFired: (noteId: string) => void, onOpened: (noteId: string) => void): () => void {
  const open = (resp: Notifications.NotificationResponse | null) => {
    const id = noteIdOf(resp);
    if (!id) return;
    onOpened(id);
    Notifications.clearLastNotificationResponse();
  };
  open(Notifications.getLastNotificationResponse());
  const tapped = Notifications.addNotificationResponseReceivedListener(open);
  const received = Notifications.addNotificationReceivedListener((n) => {
    const id = n.request.content.data?.noteId;
    if (typeof id === 'string') onFired(id);
  });
  return () => {
    tapped.remove();
    received.remove();
  };
}
