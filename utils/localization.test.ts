import { translations } from '@/constants/Translations';

import { formatLocalizedDate } from './dateLocalization';
import {
  formatAssessmentType,
  formatAssignmentCount,
  formatClockTime,
  formatMessage,
  formatRelativeTime,
  formatReleaseChannel,
  formatRemainingTime,
  formatTranslatedWeekday,
} from './localization';

it('replaces repeated placeholders without interpreting user text as a template', () => {
  expect(
    formatMessage('{{title}} / {{title}} / {{count}}', { title: '$& {{count}}', count: 2 }),
  ).toBe('$& {{count}} / $& {{count}} / 2');
});

it.each([
  [1, '1 задание'],
  [2, '2 задания'],
  [5, '5 заданий'],
  [11, '11 заданий'],
  [21, '21 задание'],
  [22, '22 задания'],
  [25, '25 заданий'],
])('uses Russian plural forms for %i assignments', (count, expected) => {
  expect(formatAssignmentCount(count, 'ru')).toBe(expected);
});

it.each([
  [0, '0 teme'],
  [1, '1 temă'],
  [2, '2 teme'],
  [20, '20 de teme'],
  [101, '101 teme'],
])('uses Romanian plural forms for %i assignments', (count, expected) => {
  expect(formatAssignmentCount(count, 'ro')).toBe(expected);
});

it('inflects relative units rather than concatenating translated words', () => {
  expect(formatRelativeTime(1, 'minute', 'ru')).toBe('через 1 минуту');
  expect(formatRelativeTime(2, 'minute', 'ru')).toBe('через 2 минуты');
  expect(formatRelativeTime(5, 'day', 'ru')).toBe('через 5 дней');
  expect(formatRelativeTime(1, 'hour', 'ro')).toBe('peste 1 oră');
  expect(formatRelativeTime(2, 'hour', 'en')).toBe('in 2 hours');
});

it('uses the Russian genitive month in a full date', () => {
  const date = new Date(2026, 0, 15, 14, 30);
  expect(formatLocalizedDate(date, 'ru', false)).toContain('15 января');
  expect(formatLocalizedDate(date, 'ro', true)).toContain('14:30');
  expect(formatLocalizedDate(date, 'en', true)).toContain('2:30 PM');
});

it('formats remaining time in the selected language, including invalid dates', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T10:00:00Z'));
  try {
    expect(formatRemainingTime('2026-10-23T10:22:00Z', 'ru')).toBe('через 22 минуты');
    expect(formatRemainingTime('2026-10-23T09:00:00Z', 'ro')).toBe(
      translations.ro.assignments.status.overdue,
    );
    expect(formatRemainingTime('invalid', 'ru')).toBe(translations.ru.common.unknown);
  } finally {
    jest.useRealTimers();
  }
});

it('translates API weekday identifiers while preserving unknown server content', () => {
  expect(formatTranslatedWeekday('monday', translations.ro)).toBe('Luni');
  expect(formatTranslatedWeekday('Monday', translations.ru)).toBe('Понедельник');
  expect(formatTranslatedWeekday('custom event', translations.ru)).toBe('custom event');
});

it('translates known assessment types and leaves official free-form types intact', () => {
  expect(formatAssessmentType('Practică', translations.en)).toBe('Practice');
  expect(formatAssessmentType('Teză', translations.ru)).toBe('Семестровая работа');
  expect(formatAssessmentType('Examen', translations.en)).toBe('Exam');
  expect(formatAssessmentType('Official category', translations.ro)).toBe('Official category');
});

it('translates standard release channels while preserving custom channel identifiers', () => {
  expect(formatReleaseChannel('production', translations.ru)).toBe('Основной');
  expect(formatReleaseChannel('development (beta)', translations.ro)).toBe('Dezvoltare (Beta)');
  expect(formatReleaseChannel('my-production-channel', translations.ru)).toBe(
    'my-production-channel',
  );
});

it('formats clock values and preserves non-clock API labels', () => {
  expect(formatClockTime('14:30:00', 'en')).toBe('2:30 PM');
  expect(formatClockTime('00:00', 'ru')).toBe('00:00');
  expect(formatClockTime('08:00', 'ro')).toBe('08:00');
  expect(formatClockTime('time pending', 'en')).toBe('time pending');
});

describe('Hermes without optional Intl constructors', () => {
  const relativeTimeDescriptor = Object.getOwnPropertyDescriptor(Intl, 'RelativeTimeFormat')!;
  const pluralDescriptor = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!;
  beforeEach(() => {
    Object.defineProperty(Intl, 'RelativeTimeFormat', { configurable: true, value: undefined });
    Object.defineProperty(Intl, 'PluralRules', { configurable: true, value: undefined });
  });
  afterEach(() => {
    Object.defineProperty(Intl, 'RelativeTimeFormat', relativeTimeDescriptor);
    Object.defineProperty(Intl, 'PluralRules', pluralDescriptor);
  });
  it.each([
    [1, 'minute', 'ru', 'через 1 минуту'],
    [22, 'minutes', 'ru', 'через 22 минуты'],
    [11, 'day', 'ru', 'через 11 дней'],
    [-5, 'day', 'ru', '5 дней назад'],
    [1, 'hour', 'ro', 'peste 1 oră'],
    [20, 'hour', 'ro', 'peste 20 de ore'],
    [2, 'week', 'en', 'in 2 weeks'],
    [0, 'minute', 'en', 'in 0 minutes'],
  ] as const)(
    'formats %i %s in %s without native Intl support',
    (count, unit, language, expected) => {
      expect(formatRelativeTime(count, unit, language)).toBe(expected);
    },
  );
  it('keeps assignment countdowns usable through timer updates', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T10:00:00Z'));
    try {
      expect(formatRemainingTime('2026-10-23T12:00:00Z', 'ro')).toBe('peste 2 ore');
      jest.advanceTimersByTime(60_000);
      expect(formatRemainingTime('2026-10-23T12:00:00Z', 'ro')).toBe('peste 1 oră');
      expect(formatAssignmentCount(22, 'ru')).toBe('22 задания');
      expect(formatAssignmentCount(20, 'ro')).toBe('20 de teme');
    } finally {
      jest.useRealTimers();
    }
  });
});
