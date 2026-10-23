import type { Language } from '@/services/scheduleService';

import { formatLocalizedFullDate, formatLocalizedTime, languageLocales } from './localization';

export const formatLocalizedDate = (
  date: Date,
  language: Language,
  includeTime: boolean = true,
): string => {
  const formattedDate = formatLocalizedFullDate(date, language);
  return includeTime ? `${formattedDate}, ${formatLocalizedTime(date, language)}` : formattedDate;
};

export const formatCompactDate = (
  date: Date,
  language: Language,
  includeTime: boolean = true,
): string => {
  const formattedDate = new Intl.DateTimeFormat(languageLocales[language], {
    day: 'numeric',
    month: language === 'en' ? 'numeric' : '2-digit',
    year: 'numeric',
  }).format(date);
  return includeTime ? `${formattedDate}, ${formatLocalizedTime(date, language)}` : formattedDate;
};

export const formatLocalizedDateWithWeekday = (
  date: Date,
  language: Language,
  useLongWeekday: boolean = false,
): string => {
  const weekday = new Intl.DateTimeFormat(languageLocales[language], {
    weekday: useLongWeekday ? 'long' : 'short',
  }).format(date);
  return `${weekday}, ${formatLocalizedDate(date, language, true)}`;
};
