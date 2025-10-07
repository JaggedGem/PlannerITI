import { translations } from '../constants/Translations';

/**
 * Formats a date according to the selected language
 * @param date The date to format
 * @param language The language ('en' | 'ro' | 'ru')
 * @param includeTime Whether to include time in the format (default: true)
 * @returns Localized date string
 */
export const formatLocalizedDate = (
  date: Date,
  language: 'en' | 'ro' | 'ru',
  includeTime: boolean = true
): string => {
  const t = translations[language];
  
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  
  const monthName = t.months[month];
  
  if (includeTime) {
    // English uses 12-hour format with AM/PM
    if (language === 'en') {
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      return `${day} ${monthName} ${year}, ${displayHours}:${minutes} ${period}`;
    } else {
      // Romanian and Russian use 24-hour format
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day} ${monthName} ${year}, ${hours}:${minutes}`;
    }
  } else {
    // Format: "15 January 2024"
    return `${day} ${monthName} ${year}`;
  }
};

/**
 * Formats a date in compact format (shorter month names for UI)
 * @param date The date to format
 * @param language The language ('en' | 'ro' | 'ru')
 * @param includeTime Whether to include time in the format (default: true)
 * @returns Compact localized date string
 */
export const formatCompactDate = (
  date: Date,
  language: 'en' | 'ro' | 'ru',
  includeTime: boolean = true
): string => {
  const day = date.getDate();
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  
  if (includeTime) {
    if (language === 'en') {
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      return `${month}/${day}/${year}, ${displayHours}:${minutes} ${period}`;
    } else {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}.${month.toString().padStart(2, '0')}.${year}, ${hours}:${minutes}`;
    }
  } else {
    if (language === 'en') {
      return `${month}/${day}/${year}`;
    } else {
      return `${day}.${month.toString().padStart(2, '0')}.${year}`;
    }
  }
};

/**
 * Formats a date with weekday according to the selected language
 * @param date The date to format
 * @param language The language ('en' | 'ro' | 'ru')
 * @param useLongWeekday Whether to use long weekday names (default: false)
 * @returns Localized date string with weekday
 */
export const formatLocalizedDateWithWeekday = (
  date: Date,
  language: 'en' | 'ro' | 'ru',
  useLongWeekday: boolean = false
): string => {
  const t = translations[language];
  
  const weekdayIndex = date.getDay();
  const weekday = useLongWeekday 
    ? t.weekdays.long[weekdayIndex] 
    : t.weekdays.short[weekdayIndex];
  
  const formattedDate = formatLocalizedDate(date, language, true);
  
  // Format: "Mon, 15 January 2024, 14:30" (en)
  // Format: "Lun, 15 Ianuarie 2024, 14:30" (ro)
  // Format: "Пнд, 15 Январь 2024, 14:30" (ru)
  return `${weekday}, ${formattedDate}`;
};
