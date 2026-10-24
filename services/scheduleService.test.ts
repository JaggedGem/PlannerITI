import AsyncStorage from '@react-native-async-storage/async-storage';

import { sampleSchedule } from '@/test/subjectColorFixtures';

import { scheduleService } from './scheduleService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
jest.mock('@/utils/customApi', () => ({ fetchCustomApi: jest.fn() }));

beforeEach(() => {
  scheduleService._ready = false;
  scheduleService._initializationPromise = null;
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('shares one initialization among concurrent callers and releases the lock', async () => {
  let finish!: () => void;
  const initialize = jest.spyOn(scheduleService, 'loadInitialState').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const requests = [scheduleService.ready(), scheduleService.ready(), scheduleService.initialize()];
  expect(initialize).toHaveBeenCalledTimes(1);
  finish();
  await Promise.all(requests);
  expect(scheduleService._initializing).toBe(false);
  expect(scheduleService._initializationPromise).toBeNull();
});

it('permits initialization to retry after a storage or network failure', async () => {
  const initialize = jest
    .spyOn(scheduleService, 'loadInitialState')
    .mockRejectedValueOnce(new Error('storage unavailable'))
    .mockResolvedValueOnce(undefined);
  await expect(scheduleService.ready()).rejects.toThrow('storage unavailable');
  await expect(scheduleService.ready()).resolves.toBeUndefined();
  expect(initialize).toHaveBeenCalledTimes(2);
});

it('does not expose mutable settings arrays to callers', () => {
  scheduleService.settings.customPeriods = [
    {
      _id: 'p1',
      name: 'Lunch',
      starttime: '12:00',
      endtime: '12:30',
      isCustom: true,
      isEnabled: true,
      daysOfWeek: [1],
    },
  ];
  const settings = scheduleService.getSettings();
  settings.customPeriods[0].daysOfWeek?.push(2);
  settings.customPeriods.length = 0;
  expect(scheduleService.getSettings().customPeriods).toHaveLength(1);
  expect(scheduleService.getSettings().customPeriods[0].daysOfWeek).toEqual([1]);
});

it('triggers external sync explicitly and suppresses it while applying downloaded settings', () => {
  const sync = jest.fn();
  let applying = false;
  scheduleService.registerSettingsSync({
    triggerSync: sync,
    isApplyingServerSettings: () => applying,
  });
  scheduleService.updateSettings({ language: 'ro' });
  expect(sync).toHaveBeenCalledTimes(1);
  applying = true;
  scheduleService.updateSettings({ language: 'en' });
  expect(sync).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.setItem).toHaveBeenCalled();
});

it('normalizes unknown schedule payloads and discards invalid events', () => {
  expect(scheduleService.normalizeSpecialScheduleResponse('exam', 'P-1', null).events).toEqual([]);
  const response = scheduleService.normalizeSpecialScheduleResponse('exam', 'P-1', {
    available: true,
    events: [null, 'invalid', { date: '2026-10-24', subject: 'Math', time: '09:00' }],
    warnings: ['valid', 42],
  });
  expect(response.events).toHaveLength(1);
  expect(response.warnings).toEqual(['valid']);
  expect(
    scheduleService.normalizeSpecialScheduleDocument({ examStudyYear: 'bad' })?.examStudyYear,
  ).toBeNull();
});

it('carries upstream subject identity into rendered lessons without changing assignment identifiers', async () => {
  const data = sampleSchedule();
  data.data.monday['1'].both[0].subjectid._id = 'stable-subject';
  const lessons = await scheduleService.getScheduleForDay(data, 'monday');
  expect(lessons.find((lesson) => lesson.period === '1')?.colorSubjectId).toBe('id:stable-subject');
  expect(lessons.find((lesson) => lesson.period === '2')?.colorSubjectId).toBe('name:creare web');
});

it('tags the timetable source group without mutating the cached source object', () => {
  const data = sampleSchedule();
  expect(scheduleService.transformScheduleData(data, 'group-a').colorGroupId).toBe('group-a');
  expect(data.colorGroupId).toBeUndefined();
});
