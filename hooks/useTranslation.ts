import { useCallback, useEffect, useState } from 'react';
import { translations, Translation } from '@/constants/Translations';
import { scheduleService } from '@/services/scheduleService';

type NestedKeyOf<T> = {
  [K in keyof T & (string | number)]: T[K] extends object
    ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
    : `${K}`;
}[keyof T & (string | number)];

type TranslationPath = NestedKeyOf<typeof translations.en>;

export function useTranslation() {
  const [currentLanguage, setCurrentLanguage] = useState(scheduleService.getSettings().language);
  
  useEffect(() => {
    // Initial setup
    setCurrentLanguage(scheduleService.getSettings().language);
    
    // Subscribe to settings changes
    const unsubscribe = scheduleService.subscribe(() => {
      setCurrentLanguage(scheduleService.getSettings().language);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const t = useCallback(<K extends keyof Translation>(key: K): Translation[K] => {
    return translations[currentLanguage][key];
  }, [currentLanguage]);

  const formatDate = useCallback((date: Date, options: Intl.DateTimeFormatOptions) => {
    let locale;
    switch (currentLanguage) {
      case 'en':
        locale = 'en-US';
        break;
      case 'ru':
        locale = 'ru-RU';
        break;
      default:
        locale = 'ro-RO';
    }
    return date.toLocaleDateString(locale, options);
  }, [currentLanguage]);

  /**
   * Format a time string (HH:MM) to locale-specific format
   * English: H:MM AM/PM (12-hour)
   * Romanian/Russian: HH:MM (24-hour)
   */
  const formatTime = useCallback((timeString: string): string => {
    const [hours, minutes] = timeString.split(':').map(Number);
    
    if (currentLanguage === 'en') {
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }, [currentLanguage]);

  /**
   * Format a Date object to locale-specific time format
   * English: H:MM AM/PM (12-hour)
   * Romanian/Russian: HH:MM (24-hour)
   */
  const formatTimeFromDate = useCallback((date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    if (currentLanguage === 'en') {
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }, [currentLanguage]);

  /**
   * Format a single hour to locale-specific format
   * English: { hour: "1-12", period: "AM/PM" }
   * Romanian/Russian: "00-23" (string)
   */
  const formatHour = useCallback((hour: number): string | { hour: string; period: string } => {
    if (currentLanguage === 'en') {
      const period = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return { hour: hour12.toString(), period };
    } else {
      return hour.toString().padStart(2, '0');
    }
  }, [currentLanguage]);

  /**
   * Format a full date with optional time
   * @param date The date to format
   * @param includeTime Whether to include time (default: true)
   * @returns Localized date string (e.g., "15 January 2024" or "15 January 2024, 2:30 PM")
   */
  const formatFullDate = useCallback((date: Date, includeTime: boolean = true): string => {
    const t = translations[currentLanguage];
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthName = t.months[month];
    
    if (includeTime) {
      const timeStr = formatTimeFromDate(date);
      return `${day} ${monthName} ${year}, ${timeStr}`;
    } else {
      return `${day} ${monthName} ${year}`;
    }
  }, [currentLanguage, formatTimeFromDate]);

  /**
   * Format a date in compact format (numeric)
   * English: "M/D/YYYY" or "M/D/YYYY, H:MM AM/PM"
   * Romanian/Russian: "D.MM.YYYY" or "D.MM.YYYY, HH:MM"
   */
  const formatCompactDate = useCallback((date: Date, includeTime: boolean = true): string => {
    const day = date.getDate();
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();
    
    if (includeTime) {
      const timeStr = formatTimeFromDate(date);
      if (currentLanguage === 'en') {
        return `${month}/${day}/${year}, ${timeStr}`;
      } else {
        return `${day}.${month.toString().padStart(2, '0')}.${year}, ${timeStr}`;
      }
    } else {
      if (currentLanguage === 'en') {
        return `${month}/${day}/${year}`;
      } else {
        return `${day}.${month.toString().padStart(2, '0')}.${year}`;
      }
    }
  }, [currentLanguage, formatTimeFromDate]);

  /**
   * Format a date with weekday
   * @param date The date to format
   * @param useLongWeekday Whether to use long weekday names (default: false for short)
   * @returns Localized date string with weekday (e.g., "Mon, 15 January 2024, 2:30 PM")
   */
  const formatDateWithWeekday = useCallback((date: Date, useLongWeekday: boolean = false): string => {
    const t = translations[currentLanguage];
    const weekdayIndex = date.getDay();
    const weekday = useLongWeekday 
      ? t.weekdays.long[weekdayIndex] 
      : t.weekdays.short[weekdayIndex];
    
    const formattedDate = formatFullDate(date, true);
    return `${weekday}, ${formattedDate}`;
  }, [currentLanguage, formatFullDate]);

  return { 
    t, 
    formatDate,
    formatTime,
    formatTimeFromDate,
    formatHour,
    formatFullDate,
    formatCompactDate,
    formatDateWithWeekday,
    currentLanguage 
  };
}