import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface Period {
  _id: string;
  starttime: string;
  endtime: string;
}

export interface ScheduleItem {
  _id: string;
  subjectid: {
    name: string;
  };
  teacherids: {
    name: string;
  };
  classroomids: {
    name: string;
  };
  groupids: {
    name: string;
    entireclass: string;
  };
  cards: {
    period: string;
    weeks: string;
    days: string;
  };
}

interface DaySchedule {
  par: ScheduleItem[];
  impar: ScheduleItem[];
  both: ScheduleItem[];
}

export interface ApiResponse {
  data: {
    monday: { [key: string]: DaySchedule };
    tuesday: { [key: string]: DaySchedule };
    wednesday: { [key: string]: DaySchedule };
    thursday: { [key: string]: DaySchedule };
    friday: { [key: string]: DaySchedule };
  };
  periods: Period[];
}

export type GroupType = 'Grupa 1' | 'Grupa 2';
export type Language = 'en' | 'ro';

interface UserSettings {
  group: GroupType;
  language: Language;
}

const API_BASE_URL = 'https://orar-api.ceiti.md/v1';

export const DAYS_MAP = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday'
} as const;

// Initial reference date for week calculation (September 2, 2024)
const REFERENCE_DATE = new Date(2024, 8, 2); // Note: Month is 0-based, so 8 is September

const CACHE_KEYS = {
  SCHEDULE: 'schedule_cache',
  SETTINGS: 'user_settings',
  LAST_FETCH: 'last_schedule_fetch'
};

const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

type SettingsListener = () => void;

export const scheduleService = {
  // Default settings
  settings: {
    group: 'Grupa 2' as GroupType,
    language: 'en' as Language,
  },
  
  listeners: new Set<SettingsListener>(),

  subscribe(listener: SettingsListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },

  notifyListeners() {
    this.listeners.forEach(listener => listener());
  },

  async loadSettings() {
    try {
      const savedSettings = await AsyncStorage.getItem(CACHE_KEYS.SETTINGS);
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        this.notifyListeners();
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  },

  async saveSettings() {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  },

  updateSettings(newSettings: Partial<UserSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.notifyListeners();
  },

  getSettings(): UserSettings {
    return { ...this.settings };
  },

  async getCachedSchedule(): Promise<ApiResponse | null> {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.SCHEDULE);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.warn('Failed to get cached schedule:', error);
      return null;
    }
  },

  async cacheSchedule(data: ApiResponse) {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.SCHEDULE, JSON.stringify(data));
      await AsyncStorage.setItem(CACHE_KEYS.LAST_FETCH, new Date().toISOString());
    } catch (error) {
      console.warn('Failed to cache schedule:', error);
    }
  },

  async shouldRefetchSchedule(): Promise<boolean> {
    try {
      const lastFetch = await AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH);
      if (!lastFetch) return true;

      const lastFetchDate = new Date(lastFetch);
      const now = new Date();
      return now.getTime() - lastFetchDate.getTime() > CACHE_EXPIRY;
    } catch (error) {
      console.warn('Failed to check refetch status:', error);
      return true;
    }
  },

  async getClassSchedule(classId: string): Promise<ApiResponse> {
    try {
      // First, try to get cached data
      const cachedData = await this.getCachedSchedule();
      
      // Check if we need to refresh the cache in the background
      const shouldRefetch = await this.shouldRefetchSchedule();
      
      if (shouldRefetch) {
        // Try to fetch new data in the background
        this.fetchAndCacheSchedule(classId).catch(error => {
          console.warn('Background fetch failed:', error);
        });
      }
      
      // If we have cached data, use it
      if (cachedData) {
        return cachedData;
      }
      
      // If no cached data, try to fetch (this will only happen on first run)
      return await this.fetchAndCacheSchedule(classId);
    } catch (error) {
      console.error('Failed to get schedule:', error);
      throw error;
    }
  },

  async fetchAndCacheSchedule(classId: string): Promise<ApiResponse> {
    // Check for internet connectivity first
    if (!await this.hasInternetConnection()) {
      throw new Error('No internet connection');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orar?_id=${classId}&tip=class`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      await this.cacheSchedule(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      throw error;
    }
  },

  async hasInternetConnection(): Promise<boolean> {
    try {
      if (Platform.OS !== 'web') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(`${API_BASE_URL}/orar?_id=${CLASS_ID}&tip=class`, {
            method: 'HEAD',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return response.ok;
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            // Handle timeout
            return false;
          }
          throw error;
        }
      }
      return navigator.onLine;
    } catch (error) {
      return false;
    }
  },

  getScheduleForDay(data: ApiResponse, dayName: keyof ApiResponse['data'] | undefined) {
    if (!dayName) return [];
    
    const daySchedule = data.data[dayName];
    if (!daySchedule) return [];

    const result: Array<{
      period: string;
      startTime: string;
      endTime: string;
      className: string;
      teacherName: string;
      roomNumber: string;
      isEvenWeek?: boolean;
      group?: string;
      _height?: number;
      hasNextItem?: boolean;
    }> = [];

    // Process each period
    Object.entries(daySchedule).forEach(([period, schedules]) => {
      const periodData = data.periods[parseInt(period) - 1];
      
      const processScheduleItem = (item: ScheduleItem, isEvenWeek?: boolean) => {
        // Skip if item is for a different group
        const itemGroup = item.groupids.name;
        if (itemGroup !== 'Clasă intreagă' && 
            itemGroup !== this.settings.group && 
            itemGroup !== 'Clas� intreag�') {
          return;
        }

        result.push({
          period,
          startTime: periodData.starttime,
          endTime: periodData.endtime,
          className: item.subjectid.name,
          teacherName: item.teacherids.name,
          roomNumber: item.classroomids.name,
          isEvenWeek,
          group: itemGroup,
        });
      };

      // Add items for both weeks
      schedules.both.forEach(item => processScheduleItem(item));

      // Add items for even weeks
      schedules.par.forEach(item => processScheduleItem(item, true));

      // Add items for odd weeks
      schedules.impar.forEach(item => processScheduleItem(item, false));
    });

    // // todo: remove this test data
    // if (dayName === 'tuesday') {
    //   result.push({
    //     period: '7',
    //     startTime: '20:10',
    //     endTime: '21:00',
    //     className: 'Test Subject',
    //     teacherName: 'Test Teacher',
    //     roomNumber: 'Test Room',
    //     isEvenWeek: undefined, // Show for both weeks
    //     group: 'Clasă intreagă',
    //   });
    //   result.push({
    //     period: '8',
    //     startTime: '21:10',
    //     endTime: '22:00',
    //     className: 'Test Subject 2',
    //     teacherName: 'Test Teacher 2',
    //     roomNumber: 'Test Room 2',
    //     isEvenWeek: undefined,
    //     group: 'Clasă intreagă',
    //   });
    // }

    // Sort schedule by time
    const sortedSchedule = result.sort((a, b) => {
      const timeA = a.startTime.split(':').map(Number);
      const timeB = b.startTime.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    // Add hasNextItem flag
    sortedSchedule.forEach((item, index) => {
      item.hasNextItem = index < sortedSchedule.length - 1;
    });

    return sortedSchedule;
  },

  isEvenWeek(date: Date): boolean {
    const d1 = date;
    const d2 = REFERENCE_DATE;
    const perWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.floor((d1.valueOf() - d2.valueOf()) / perWeek + 1);
    return totalWeeks % 2 === 0;
  }
};

// Initialize settings from storage
scheduleService.loadSettings();

export const CLASS_ID = '67bd74693a5ec4923ab77dea';