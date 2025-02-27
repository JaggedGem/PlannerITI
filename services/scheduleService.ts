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

export interface Group {
  _id: string;
  id: string;
  name: string;
  diriginte: {
    name: string;
  };
}

export type SubGroupType = 'Subgroup 1' | 'Subgroup 2';
export type Language = 'en' | 'ro';

interface UserSettings {
  group: SubGroupType;
  language: Language;
  selectedGroupId: string;
  selectedGroupName: string;
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
  SCHEDULE_PREFIX: 'schedule_cache_',
  SETTINGS: 'user_settings',
  LAST_FETCH_PREFIX: 'last_schedule_fetch_',
  GROUPS: 'groups_cache'
};

const CACHE_EXPIRY = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const DEFAULT_GROUP_NAME = 'P-2412';

type SettingsListener = () => void;

export const scheduleService = {
  // Default settings
  settings: {
    group: 'Subgroup 2' as SubGroupType,
    language: 'en' as Language,
    selectedGroupId: '',  // Will be set dynamically after fetching groups
    selectedGroupName: DEFAULT_GROUP_NAME
  },
  
  listeners: new Set<SettingsListener>(),
  cachedGroups: [] as Group[],

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
      
      // If we have a group name but no ID, try to fetch the ID
      if (!this.settings.selectedGroupId && this.settings.selectedGroupName) {
        await this.findAndSetDefaultGroup(this.settings.selectedGroupName);
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

  async getCachedSchedule(groupId: string): Promise<ApiResponse | null> {
    try {
      const cachedData = await AsyncStorage.getItem(CACHE_KEYS.SCHEDULE_PREFIX + groupId);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.warn('Failed to get cached schedule:', error);
      return null;
    }
  },

  async cacheSchedule(groupId: string, data: ApiResponse) {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.SCHEDULE_PREFIX + groupId, JSON.stringify(data));
      await AsyncStorage.setItem(CACHE_KEYS.LAST_FETCH_PREFIX + groupId, new Date().toISOString());
    } catch (error) {
      console.warn('Failed to cache schedule:', error);
    }
  },

  async shouldRefetchSchedule(groupId: string): Promise<boolean> {
    try {
      const lastFetch = await AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH_PREFIX + groupId);
      if (!lastFetch) return true;

      const lastFetchDate = new Date(lastFetch);
      const now = new Date();
      return now.getTime() - lastFetchDate.getTime() > CACHE_EXPIRY;
    } catch (error) {
      console.warn('Failed to check refetch status:', error);
      return true;
    }
  },

  async getGroups(): Promise<Group[]> {
    try {
      // Return cached groups if available
      if (this.cachedGroups.length > 0) {
        return this.cachedGroups;
      }

      // Try to get cached groups first
      const cachedGroups = await AsyncStorage.getItem(CACHE_KEYS.GROUPS);
      
      if (cachedGroups) {
        this.cachedGroups = JSON.parse(cachedGroups);
        
        // If we have a group name but no ID, set it now that we have groups data
        if (!this.settings.selectedGroupId && this.settings.selectedGroupName) {
          await this.findAndSetDefaultGroup(this.settings.selectedGroupName);
        }
        
        return this.cachedGroups;
      }
      
      // If no cached groups, fetch from API
      const response = await fetch(`${API_BASE_URL}/grupe`);
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      
      const groups: Group[] = await response.json();
      
      // Cache the groups for later use
      await AsyncStorage.setItem(CACHE_KEYS.GROUPS, JSON.stringify(groups));
      this.cachedGroups = groups;
      
      // Set default group ID if needed
      if (!this.settings.selectedGroupId && this.settings.selectedGroupName) {
        await this.findAndSetDefaultGroup(this.settings.selectedGroupName);
      }
      
      return groups;
    } catch (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
  },

  async findAndSetDefaultGroup(targetName: string = DEFAULT_GROUP_NAME) {
    try {
      const groups = await this.getGroups();
      const targetGroup = groups.find(group => group.name === targetName);
      
      if (targetGroup) {
        this.updateSettings({
          selectedGroupId: targetGroup._id,
          selectedGroupName: targetGroup.name
        });
        return true;
      }
      
      // If we couldn't find the target group, use the first group
      if (groups.length > 0) {
        this.updateSettings({
          selectedGroupId: groups[0]._id,
          selectedGroupName: groups[0].name
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error setting default group:', error);
      return false;
    }
  },

  async getClassSchedule(groupId: string = ''): Promise<ApiResponse> {
    const id = groupId || this.settings.selectedGroupId;
    
    try {
      // First, try to get cached data
      const cachedData = await this.getCachedSchedule(id);
      
      // Check if we need to refresh the cache in the background
      const shouldRefetch = await this.shouldRefetchSchedule(id);
      
      if (shouldRefetch) {
        // Try to fetch new data in the background
        this.fetchAndCacheSchedule(id).catch(error => {
          console.warn('Background fetch failed:', error);
        });
      }
      
      // If we have cached data, use it
      if (cachedData) {
        return cachedData;
      }
      
      // If no cached data, try to fetch (this will only happen on first run)
      return await this.fetchAndCacheSchedule(id);
    } catch (error) {
      console.error('Failed to get schedule:', error);
      throw error;
    }
  },

  async fetchAndCacheSchedule(groupId: string): Promise<ApiResponse> {
    // Check for internet connectivity first
    if (!await this.hasInternetConnection()) {
      throw new Error('No internet connection');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orar?_id=${groupId}&tip=class`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      await this.cacheSchedule(groupId, data);
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
          const response = await fetch(`${API_BASE_URL}/grupe`, {
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

    // Add test period
    // result.push({
    //   period: "test",
    //   startTime: "15:25",
    //   endTime: "16:25",
    //   className: "Test Period",
    //   teacherName: "Test Teacher",
    //   roomNumber: "Test Room",
    //   group: "Clasă intreagă"
    // });

    // Process each period
    Object.entries(daySchedule).forEach(([period, schedules]) => {
      const periodData = data.periods[parseInt(period) - 1];
      
      const processScheduleItem = (item: ScheduleItem, isEvenWeek?: boolean) => {
        // Skip if item is for a different group
        const itemGroup = item.groupids.name;
        const entireClass = itemGroup === 'Clasă intreagă' || itemGroup === 'Clas� intreag�';
        
        // Convert old group names to new ones for comparison
        const settingsGroup = this.settings.group === 'Subgroup 1' ? 'Grupa 1' : 'Grupa 2';
        const compareItemGroup = itemGroup === 'Grupa 1' ? 'Subgroup 1' : itemGroup === 'Grupa 2' ? 'Subgroup 2' : itemGroup;

        // Check if this item is for the current user's group
        if (!entireClass && compareItemGroup !== this.settings.group) {
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
          group: compareItemGroup, // Use normalized group name for display
        });
      };

      // Add items for both weeks
      schedules.both.forEach(item => processScheduleItem(item));

      // Add items for even weeks
      schedules.par.forEach(item => processScheduleItem(item, true));

      // Add items for odd weeks
      schedules.impar.forEach(item => processScheduleItem(item, false));
    });

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