import { act } from 'react-test-renderer';

import { UserSettings } from '@/services/scheduleService';
import { subjectColorService } from '@/services/subjectColorService';
import { renderHook } from '@/test/renderHook';
import { sampleSchedule } from '@/test/subjectColorFixtures';
import { normalizeColorLayout } from '@/utils/subjectColors/layout';

import { useSubjectColors } from './useSubjectColors';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
jest.mock('@/services/scheduleService', () => ({
  scheduleService: {
    getDatePeriodEntriesForCurrentGroup: () => [],
    isEvenWeek: () => true,
  },
}));

const settings: UserSettings = {
  group: 'Subgroup 1',
  language: 'en',
  selectedGroupId: 'integration-group',
  selectedGroupName: 'P-1',
  scheduleView: 'day',
  customPeriods: [],
};

it('gives daily and weekly consumers one identity, preserves custom colors and reuses the store', async () => {
  const data = sampleSchedule();
  const hook = await renderHook(() => ({
    daily: useSubjectColors(data, settings, null),
    weekly: useSubjectColors(data, { ...settings, scheduleView: 'week' }, null),
  }));
  await act(async () => {
    await subjectColorService.reconcile(
      'integration-group:Subgroup 1',
      normalizeColorLayout(data, settings.group),
    );
  });
  const item = { className: 'Matematica', colorSubjectId: 'name:matematica' };
  const day = hook.current.daily(item);
  const week = hook.current.weekly(item);
  expect(day).toEqual(week);
  expect(day.accent).toBe(
    subjectColorService.snapshot('integration-group:Subgroup 1')['name:matematica'].color,
  );
  expect(day.background).not.toBe(day.accent);
  const custom = { className: 'Lunch', period: 'lunch', isCustom: true, color: '#ff77aa' };
  expect(hook.current.daily(custom).accent).toBe('#ff77aa');
  expect(hook.current.weekly(custom)).toEqual(hook.current.daily(custom));
  await hook.unmount();
});

it('does not reconcile the previous group data while a group switch is loading', async () => {
  const reconcile = jest.spyOn(subjectColorService, 'reconcile');
  const data = { ...sampleSchedule(), colorGroupId: 'previous-group' };
  const hook = await renderHook(() =>
    useSubjectColors(data, { ...settings, selectedGroupId: 'next-group' }, null),
  );
  expect(reconcile).not.toHaveBeenCalled();
  expect(subjectColorService.snapshot('next-group:Subgroup 1')).toEqual({});
  await hook.unmount();
  reconcile.mockRestore();
});
