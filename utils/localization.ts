import { Translation, translations } from '@/constants/Translations';
import type { Language } from '@/services/scheduleService';

export const languageLocales: Record<Language, string> = {
  en: 'en-US',
  ro: 'ro-RO',
  ru: 'ru-RU',
};

// These objects are expensive to construct when many assignment rows update together.
const relativeTimeFormatters = new Map<Language, Intl.RelativeTimeFormat>();
const pluralRules = new Map<Language, Intl.PluralRules>();
const timeFormatters = new Map<Language, Intl.DateTimeFormat>();

/** Replace every occurrence, including repeated placeholders, without modifying user content. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/{{(\w+)}}/g, (placeholder: string, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder,
  );
}

export function formatRelativeTime(
  count: number,
  unit: Intl.RelativeTimeFormatUnit,
  language: Language,
): string {
  let formatter = relativeTimeFormatters.get(language);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(languageLocales[language], { numeric: 'always' });
    relativeTimeFormatters.set(language, formatter);
  }
  return formatter.format(count, unit);
}

export function formatAssignmentCount(count: number, language: Language): string {
  const forms = translations[language].notificationMessages.assignmentCount;
  let rules = pluralRules.get(language);
  if (!rules) {
    rules = new Intl.PluralRules(languageLocales[language]);
    pluralRules.set(language, rules);
  }
  const plural = rules.select(count);
  const template =
    plural === 'one' || plural === 'few' || plural === 'many' ? forms[plural] : forms.other;
  return formatMessage(template, { count });
}

export function formatRemainingTime(dueDate: string, language: Language): string {
  const due = new Date(dueDate);
  const text = translations[language];
  if (!Number.isFinite(due.getTime())) return text.common.unknown;
  const minutes = Math.floor((due.getTime() - Date.now()) / 60_000);
  if (minutes < 0) return text.assignments.status.overdue;
  if (minutes < 60) return formatRelativeTime(minutes, 'minute', language);
  if (minutes < 1440) return formatRelativeTime(Math.floor(minutes / 60), 'hour', language);
  if (minutes < 2880) return text.assignments.status.dueTomorrow;
  if (minutes < 10080) return formatRelativeTime(Math.floor(minutes / 1440), 'day', language);
  return formatRelativeTime(Math.floor(minutes / 10080), 'week', language);
}

export function formatLocalizedTime(date: Date, language: Language): string {
  let formatter = timeFormatters.get(language);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(languageLocales[language], {
      hour: language === 'en' ? 'numeric' : '2-digit',
      minute: '2-digit',
      hour12: language === 'en',
    });
    timeFormatters.set(language, formatter);
  }
  return formatter.format(date);
}

/** Preserve non-clock API labels instead of coercing them into invalid Dates. */
export function formatClockTime(time: string, language: Language): string {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time);
  if (!match) return time;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return formatLocalizedTime(date, language);
}

/** Month names in running dates require a different grammatical case in Russian. */
export function formatLocalizedFullDate(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(languageLocales[language], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatTranslatedWeekday(day: string, text: Translation): string {
  const index = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ].indexOf(day.trim().toLowerCase());
  return index >= 0 ? text.weekdays.long[index] : day;
}

export function formatAssessmentType(type: string, text: Translation): string {
  const normalized = type
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (normalized.includes('teza') || normalized.includes('thesis'))
    return text.grades.subjects.thesis;
  if (normalized.includes('examen') || normalized.includes('exam'))
    return text.grades.subjects.exam;
  if (normalized.includes('practic') || normalized.includes('practice'))
    return text.grades.categories.practice;
  return type;
}

export function formatReleaseChannel(channel: string, text: Translation): string {
  const known = (value: string) =>
    value === 'production' || value === 'beta' || value === 'development';
  const match = /^(production|beta|development)(?: \((production|beta|development)\))?$/.exec(
    channel,
  );
  if (!match || !known(match[1])) return channel;
  const suffix = match[2];
  return suffix && known(suffix)
    ? `${text.appInfo[match[1]]} (${text.appInfo[suffix]})`
    : text.appInfo[match[1]];
}
