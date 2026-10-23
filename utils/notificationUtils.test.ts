import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Notifications from 'expo-notifications';

import type { Language } from '@/services/scheduleService';
import { createAssignment } from '@/test/fixtures';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/types/notification';

import { createAndScheduleDailyDigest, scheduleAllNotifications } from './notificationUtils';

let mockLanguage: Language = 'en';
jest.mock('@/services/scheduleService', () => ({
  scheduleService: { getSettings: () => ({ language: mockLanguage }) },
}));

jest.mock('expo-constants', () => ({ executionEnvironment: 'standalone' }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'scheduled'),
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T08:00:00Z'));
  jest.clearAllMocks();
  mockLanguage = 'en';
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValue(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS));
});
afterEach(() => {
  jest.useRealTimers();
});

it('cancels a stale digest after the last assignment is removed', async () => {
  await createAndScheduleDailyDigest([]);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'daily-digest-notification',
  );
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('cancels a stale digest when notifications are disabled', async () => {
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValue(JSON.stringify({ ...DEFAULT_NOTIFICATION_SETTINGS, enabled: false }));
  await createAndScheduleDailyDigest([createAssignment()]);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'daily-digest-notification',
  );
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('includes only upcoming incomplete assignments in the digest', async () => {
  await createAndScheduleDailyDigest([
    createAssignment(),
    createAssignment({ id: 'done', isCompleted: true }),
    createAssignment({ id: 'past', dueDate: '2026-10-22T12:00:00Z' }),
  ]);
  const call = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
  expect(call.identifier).toBe('daily-digest-notification');
  expect(call.content.body).toContain('Read chapter one');
  expect(call.content.data).toMatchObject({ type: 'digest', navigateTo: 'assignments' });
});

it('loads notification settings once per batch and digest, rather than per assignment', async () => {
  await scheduleAllNotifications(
    Array.from({ length: 10 }, (_, i) => createAssignment({ id: `a-${i}` })),
  );
  expect(AsyncStorage.getItem).toHaveBeenCalledTimes(2);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
});

it.each(['ro', 'ru'] as const)(
  'schedules the actual digest in %s without English assignment labels',
  async (language) => {
    mockLanguage = language;
    await createAndScheduleDailyDigest([createAssignment()]);
    const call = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(call.content.title).toContain(language === 'ro' ? 'temă' : 'задание');
    expect(call.content.body).toContain(language === 'ro' ? 'Temă' : 'Домашнее задание');
    expect(call.content.body).not.toContain('Homework');
    expect(call.content.body).not.toContain(' at ');
  },
);
