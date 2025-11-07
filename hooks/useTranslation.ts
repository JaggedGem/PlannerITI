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

  return { t, formatDate, currentLanguage };
}