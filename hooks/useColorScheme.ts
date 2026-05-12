import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Appearance,
  type ColorSchemeName,
} from 'react-native';
import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_PREFERENCE_STORAGE_KEY = '@planner_theme_preference';

let preference: ThemePreference = 'system';
let hydrated = false;
let hydrationPromise: Promise<ThemePreference> | null = null;
let appearanceSubscription: { remove: () => void } | null = null;

const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((subscriber) => {
    subscriber();
  });
};

const subscribe = (callback: () => void) => {
  subscribers.add(callback);

  return () => {
    subscribers.delete(callback);
  };
};

const normalizePreference = (value: string | null): ThemePreference => {
  if (value === 'dark' || value === 'light' || value === 'system') {
    return value;
  }

  return 'system';
};

const getSystemColorScheme = (): NonNullable<ColorSchemeName> => {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
};

const setupAppearanceSubscription = () => {
  if (appearanceSubscription) {
    return;
  }

  appearanceSubscription = Appearance.addChangeListener(() => {
    if (preference === 'system') {
      notifySubscribers();
    }
  });
};

export const getThemePreference = (): ThemePreference => preference;

export const getResolvedColorScheme = (): NonNullable<ColorSchemeName> => {
  if (preference === 'system') {
    return getSystemColorScheme();
  }

  return preference;
};

export const initializeThemePreference = async (): Promise<ThemePreference> => {
  setupAppearanceSubscription();

  if (hydrated) {
    return preference;
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  hydrationPromise = (async () => {
    try {
      const storedPreference = await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
      preference = normalizePreference(storedPreference);
    } catch {
      preference = 'system';
    } finally {
      hydrated = true;
      hydrationPromise = null;
      notifySubscribers();
    }

    return preference;
  })();

  return hydrationPromise;
};

export const setThemePreference = async (nextPreference: ThemePreference): Promise<void> => {
  if (preference === nextPreference) {
    return;
  }

  preference = nextPreference;
  notifySubscribers();

  try {
    await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextPreference);
  } catch {
    // Silent persistence fallback; runtime preference is already applied.
  }
};

export const useThemePreference = (): ThemePreference => {
  return useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
};

export const useColorScheme = (): ColorSchemeName => {
  return useSyncExternalStore(subscribe, getResolvedColorScheme, getResolvedColorScheme);
};

void initializeThemePreference().catch(() => {
  // Fall back to system theme until preference can be read.
});
