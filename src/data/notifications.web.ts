/**
 * Web preview: browsers cannot schedule local notifications, so reminders are
 * saved but never fire. Same exports as notifications.ts, without loading
 * expo-notifications at all.
 */
import type { Scheduler } from './types';

export const CHANNEL_ID = 'reminders';

export const noopScheduler: Scheduler = {
  maxPending: 0,
  schedule: async () => null,
  cancel: async () => undefined,
  listScheduled: async () => [],
};

export const createScheduler = (): Scheduler => noopScheduler;
export const setupNotifications = async () => undefined;

export type ReminderPermission = {
  notifications: 'granted' | 'denied' | 'undetermined';
  canAsk: boolean;
  exact: boolean | null;
};

const GRANTED: ReminderPermission = { notifications: 'granted', canAsk: false, exact: null };
export const getReminderPermission = async (): Promise<ReminderPermission> => GRANTED;
export const askReminderPermission = async (): Promise<ReminderPermission> => GRANTED;
export const askExactAlarms = async () => undefined;
export const openAppSettings = async () => undefined;
export const noteIdOf = (): string | null => null;
export const listenForReminders = (): (() => void) => () => undefined;
