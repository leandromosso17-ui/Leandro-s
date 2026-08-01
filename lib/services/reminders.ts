import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Reminder delivery on the senior's device.
 *
 * Placeholders on purpose: the demo has no push credentials. In production
 * `scheduleDoseReminder` becomes an `expo-notifications` trigger, the loud
 * reminder plays a bundled `expo-audio` sound, and the spoken reminder uses the
 * same ElevenLabs voice as the escalation call.
 */
export type ReminderPreferences = {
  loudSound: boolean;
  vibration: boolean;
  spokenReminder: boolean;
};

export const defaultReminderPreferences: ReminderPreferences = {
  loudSound: true,
  vibration: true,
  spokenReminder: false,
};

export type ScheduledReminder = {
  id: string;
  doseId: string;
  fireAt: string;
  title: string;
  body: string;
};

/** Placeholder for `Notifications.scheduleNotificationAsync`. */
export async function scheduleDoseReminder(
  reminder: ScheduledReminder,
): Promise<ScheduledReminder> {
  await Promise.resolve();
  return reminder;
}

export async function cancelDoseReminder(_id: string): Promise<void> {
  await Promise.resolve();
}

/** Loud reminder tone placeholder — replace with an `expo-audio` player. */
export async function playLoudReminder(): Promise<void> {
  await Promise.resolve();
}

/** Vibration reminder: real haptics on device, no-op on web. */
export async function vibrateReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Light confirmation feedback after a successful tap. */
export async function confirmFeedback(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Spoken reminder placeholder — wired to the voice provider in production. */
export async function speakReminder(_text: string): Promise<void> {
  await Promise.resolve();
}
