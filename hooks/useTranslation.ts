import { useCallback, useSyncExternalStore } from 'react';

import { Translation, translations } from '@/constants/Translations';
import { scheduleService } from '@/services/scheduleService';
import {
  formatCompactDate as formatCompactDateForLanguage,
  formatLocalizedDate,
  formatLocalizedDateWithWeekday,
} from '@/utils/dateLocalization';
import { formatClockTime, formatLocalizedTime, languageLocales } from '@/utils/localization';

export type Translate = <K extends keyof Translation>(key: K) => Translation[K];

const subscribeToLanguage = (listener: () => void) => scheduleService.subscribe(listener);
const getLanguageSnapshot = () => scheduleService.getSettings().language;

export function useTranslation() {
  const currentLanguage = useSyncExternalStore(
    subscribeToLanguage,
    getLanguageSnapshot,
    getLanguageSnapshot,
  );

  const t = useCallback<Translate>(
    <K extends keyof Translation>(key: K): Translation[K] => translations[currentLanguage][key],
    [currentLanguage],
  );
  const formatDate = useCallback(
    (date: Date, options: Intl.DateTimeFormatOptions) =>
      date.toLocaleDateString(languageLocales[currentLanguage], options),
    [currentLanguage],
  );
  const formatTimeFromDate = useCallback(
    (date: Date): string => formatLocalizedTime(date, currentLanguage),
    [currentLanguage],
  );
  const formatTime = useCallback(
    (timeString: string): string => formatClockTime(timeString, currentLanguage),
    [currentLanguage],
  );
  const formatHour = useCallback(
    (hour: number): string | { hour: string; period: string } => {
      if (currentLanguage === 'en') {
        return { hour: String(hour % 12 || 12), period: hour >= 12 ? 'PM' : 'AM' };
      }
      return String(hour).padStart(2, '0');
    },
    [currentLanguage],
  );
  const formatFullDate = useCallback(
    (date: Date, includeTime: boolean = true): string =>
      formatLocalizedDate(date, currentLanguage, includeTime),
    [currentLanguage],
  );
  const formatCompactDate = useCallback(
    (date: Date, includeTime: boolean = true): string =>
      formatCompactDateForLanguage(date, currentLanguage, includeTime),
    [currentLanguage],
  );
  const formatDateWithWeekday = useCallback(
    (date: Date, useLongWeekday: boolean = false): string =>
      formatLocalizedDateWithWeekday(date, currentLanguage, useLongWeekday),
    [currentLanguage],
  );

  return {
    t,
    formatDate,
    formatTime,
    formatTimeFromDate,
    formatHour,
    formatFullDate,
    formatCompactDate,
    formatDateWithWeekday,
    currentLanguage,
  };
}
