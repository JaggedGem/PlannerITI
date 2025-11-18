import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { format } from 'date-fns';
// Refactored: remove direct runtime import of settingsService to break cycle.
// Consumers (settingsService) should call scheduleService.registerSettingsSync({...}) after import.

export interface Period {
  _id: string;
  starttime: string;
  endtime: string;
}

export interface CustomPeriod extends Period {
  name?: string;
  isCustom: boolean;
  isEnabled: boolean;
  color?: string;
  daysOfWeek?: number[]; // 1-5 for Monday-Friday
}

// Interface for recovery days data structure
export interface RecoveryDay {
  date: string; // format: "YYYY-MM-DD"
  replacedDay: string; // "monday", "tuesday", etc.
  reason: string;
  groupId: string; // if empty, applies to all groups
  groupName: string; // if empty, applies to all groups
  isActive: boolean;
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

export interface PeriodAssignmentCount {
  periodId: string;
  courseCode: string;
  count: number;
  dateKey?: string; // Format: "yyyy-MM-dd"
}

export interface ApiResponse {
  data: {
    monday: { [key: string]: DaySchedule };
    tuesday: { [key: string]: DaySchedule };
    wednesday: { [key: string]: DaySchedule };
    thursday: { [key: string]: DaySchedule };
    friday: { [key: string]: DaySchedule };
    [key: string]: { [key: string]: DaySchedule }; // For weekend recovery days
  };
  periods: Period[];
  recoveryDays?: RecoveryDay[]; // Add recovery days to the API response
  assignmentCounts?: PeriodAssignmentCount[]; // Add assignment counts
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
export type Language = 'en' | 'ro' | 'ru';
export type ScheduleView = 'day' | 'week';

export interface UserSettings {
  group: SubGroupType;
  language: Language;
  selectedGroupId: string;
  selectedGroupName: string;
  scheduleView: ScheduleView;
  customPeriods: CustomPeriod[];
}

// New interface for Subject
export interface Subject {
  id: string;
  name: string;
  isCustom?: boolean;
}

const API_BASE_URL = 'https://orar-api.ceiti.md/v1';

export const DAYS_MAP = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday'
} as const;

export const DAYS_MAP_INVERSE = {
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5
} as const;

// Initial reference date for week calculation (September 1, 2025)
const REFERENCE_DATE = new Date(2025, 8, 1); // Month 8 = September

// Export the cache keys so they can be accessed from outside
export const CACHE_KEYS = {
  SCHEDULE_PREFIX: 'schedule_cache_',
  SETTINGS: 'user_settings',
  LAST_FETCH_PREFIX: 'last_schedule_fetch_',
  GROUPS: 'groups_cache',
  RECOVERY_DAYS: 'recovery_days_cache',
  LAST_RECOVERY_SYNC: 'last_recovery_days_sync',
  SUBJECTS: 'subjects_cache', // New cache key for subjects
  ASSIGNMENT_COUNTS: 'assignment_counts_cache', // New cache key for assignment counts
};

const CACHE_EXPIRY = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const DEFAULT_GROUP_NAME = 'P-2422';

const PERIOD_TIMES_CACHE_KEY = 'period_times_cache';
const LAST_PERIOD_SYNC_KEY = 'last_period_sync';
// Removed interval logic: we now refresh on app load & manual refresh.
const PERIOD_SYNC_INTERVAL = 0; // No interval-based skip; kept for backward compatibility
const RECOVERY_DAYS_SYNC_INTERVAL = 0;

type SettingsListener = () => void;

interface PeriodTime {
  period: number;
  starttime: string;
  endtime: string;
}

interface PeriodTimes {
  monday: PeriodTime[];
  tuesday: PeriodTime[];
  wednesday: PeriodTime[];
  thursday: PeriodTime[];
  friday: PeriodTime[];
}

// Add platform-specific language detection
const getSystemLanguage = (): Language => {
  try {
    const locale = Platform.select({
      ios: NativeModules.SettingsManager.settings.AppleLocale,
      android: NativeModules.I18nManager.localeIdentifier,
      default: navigator?.language || 'en'
    }) || 'en';

    // Convert locale to our supported languages
    const lang = locale.toLowerCase().split(/[-_]/)[0];
    if (lang === 'ru') return 'ru';
    if (lang === 'ro' || lang === 'mo') return 'ro';
    return 'en';
  } catch (error) {
    return 'en';
  }
};

export const scheduleService = {
  // Default settings
  settings: {
    group: 'Subgroup 2' as SubGroupType,
    language: getSystemLanguage(),
    selectedGroupId: '',  // Will be set dynamically after fetching groups
    selectedGroupName: DEFAULT_GROUP_NAME,
    scheduleView: 'day' as ScheduleView,
    customPeriods: [] as CustomPeriod[]
  },  
  // Expose cache keys as a property of the service for external access
  CACHE_KEYS,
  
  listeners: new Set<SettingsListener>(),
  cachedGroups: [] as Group[],
  cachedRecoveryDays: [] as RecoveryDay[],
  cachedSubjects: [] as Subject[],
  cachedAssignmentCounts: [] as PeriodAssignmentCount[],
  // Debug controls
  _debug: false,
  _ready: false,
  _initializing: false,
  _settingsSyncCallbacks: [] as Array<() => void>,
  _isApplyingServerSettings: () => false, // optional callback provided by settingsService
  _triggerExternalSync: () => {},

  enableDebug(value: boolean) { this._debug = value; },
  log(...args: any[]) { if (this._debug) console.log('[scheduleService]', ...args); },
  isReady() { return this._ready; },
  async ready(): Promise<void> { if (this._ready) return; if (this._initializing) { return new Promise(res => { const i = setInterval(()=>{ if(this._ready){ clearInterval(i); res(); }},50); }); } await this.initialize(); },
  registerSettingsSync(options: { triggerSync: () => void; isApplyingServerSettings: () => boolean }) {
    this._triggerExternalSync = options.triggerSync;
    this._isApplyingServerSettings = options.isApplyingServerSettings;
  },

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
      // Silent error handling
    }
  },
  
  async saveSettings() {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      // Silent error handling
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
      // Get both schedule and recovery days from cache at once
      const [cachedData, cachedRecoveryDays, cachedAssignmentCounts] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEYS.SCHEDULE_PREFIX + groupId),
        AsyncStorage.getItem(CACHE_KEYS.RECOVERY_DAYS),
        AsyncStorage.getItem(CACHE_KEYS.ASSIGNMENT_COUNTS)
      ]);

      if (cachedData) {
        // Parse the cached data (this creates a new object, not a reference)
        const data = JSON.parse(cachedData);
        
        // Update cached recovery days in memory if available
        if (cachedRecoveryDays) {
          this.cachedRecoveryDays = JSON.parse(cachedRecoveryDays);
        }
        
        // Update cached assignment counts in memory if available
        if (cachedAssignmentCounts) {
          this.cachedAssignmentCounts = JSON.parse(cachedAssignmentCounts);
        }
        
        // Include recovery days and assignment counts in the response
        // Create new arrays to prevent mutation of in-memory caches
        data.recoveryDays = [...this.cachedRecoveryDays];
        data.assignmentCounts = [...this.cachedAssignmentCounts];
        
        // Return the data (JSON.parse already created a new object tree)
        return data;
      }
      return null;
    } catch (error) {
      // Silent error handling
      return null;
    }
  },

  async cacheSchedule(groupId: string, data: ApiResponse) {
    try {
      // Cache the schedule data with recovery days already integrated
      await AsyncStorage.setItem(CACHE_KEYS.SCHEDULE_PREFIX + groupId, JSON.stringify(data));
      await AsyncStorage.setItem(CACHE_KEYS.LAST_FETCH_PREFIX + groupId, new Date().toISOString());
    } catch (error) {
      // Silent error handling
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
      // Silent error handling
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
      // Silent error handling
      return [];
    }
  },
  
  async findAndSetDefaultGroup(targetName: string = DEFAULT_GROUP_NAME) {
    try {
      const groups = await this.getGroups();
      const targetGroup = groups.find(group => group.name === targetName);
      
      // Clear cached assignment counts when changing groups
      this.cachedAssignmentCounts = [];
      AsyncStorage.removeItem(CACHE_KEYS.ASSIGNMENT_COUNTS);
      
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
      // Silent error handling
      return false;
    }
  },

  async getClassSchedule(groupId: string = '', forceRefresh: boolean = false): Promise<ApiResponse> {
    const id = groupId || this.settings.selectedGroupId;
    
    try {
      // Load recovery days into memory first if not already loaded
      if (this.cachedRecoveryDays.length === 0) {
        const cachedRecoveryDays = await AsyncStorage.getItem(CACHE_KEYS.RECOVERY_DAYS);
        if (cachedRecoveryDays) {
          this.cachedRecoveryDays = JSON.parse(cachedRecoveryDays);
        }
      }

      // Get cached schedule data
      const cachedData = await this.getCachedSchedule(id);
      
      // Check if we need to refresh the cache in the background
      const shouldRefetch = await this.shouldRefetchSchedule(id);
      
      if (shouldRefetch || forceRefresh) {
        // Fetch new data in the background
        this.fetchAndCacheSchedule(id).catch(() => {});
        // Also refresh recovery days in background if needed
        this.syncRecoveryDays().catch(() => {});
        // Sync period times to ensure we have the latest data
        this.syncPeriodTimes().catch(() => {});
      }
      
      // Return cached data as schedule response
      if (cachedData) {
        return this.transformScheduleData(cachedData);
      }

      // If no cached data, try to fetch (this will only happen on first run)
      const freshData = await this.fetchAndCacheSchedule(id);
      // Ensure period times are synced on first run
      await this.syncPeriodTimes();
      return this.transformScheduleData(freshData);
    } catch (error) {
      // Silent error handling
      throw error;
    }
  },

  transformScheduleData(data: ApiResponse): ApiResponse {
    // Create a proper deep copy of the data to avoid mutating the cache
    const transformedData: ApiResponse = JSON.parse(JSON.stringify(data));

    // Process recovery days if we have them
    if (this.cachedRecoveryDays.length > 0) {
      this.cachedRecoveryDays.forEach(rd => {
        if (!rd.isActive || (rd.groupId !== '' && rd.groupId !== this.settings.selectedGroupId)) {
          return;
        }

        const date = new Date(rd.date);
        const dayIndex = date.getDay();
        
        // Only process weekend recovery days
        if (dayIndex !== 0 && dayIndex !== 6) {
          return;
        }

        const weekendKey = `weekend_${rd.date}`;
        const replacedDay = rd.replacedDay.toLowerCase() as keyof ApiResponse['data'];
        
        if (replacedDay in data.data) {
          // Copy the schedule from the replaced day
          transformedData.data[weekendKey] = JSON.parse(JSON.stringify(data.data[replacedDay]));
          
          // Mark all periods as recovery day items
          Object.values(transformedData.data[weekendKey]).forEach(schedules => {
            ['both', 'par', 'impar'].forEach(weekType => {
              (schedules as any)[weekType].forEach((item: any) => {
                item.isRecoveryDay = true;
                item.recoveryInfo = {
                  reason: rd.reason,
                  replacedDay: rd.replacedDay,
                  date: rd.date
                };
              });
            });
          });
        }
      });
    }

    transformedData.recoveryDays = this.cachedRecoveryDays;
    return transformedData;
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
      
      // Ensure recovery days are loaded before caching
      if (this.cachedRecoveryDays.length === 0) {
        await this.syncRecoveryDays();
      }
      
      // Apply recovery day transformations
      const transformedData = this.transformScheduleData(data);
      
      // Extract and store unique subjects
      await this.extractAndStoreSubjects(transformedData);
      
      await this.cacheSchedule(groupId, transformedData);
      return transformedData;
    } catch (error) {
      // Silent error handling
      throw error;
    }
  },

  async extractAndStoreSubjects(data: ApiResponse): Promise<void> {
    try {
      const subjects = new Map<string, Subject>();
      
      // Process each day in the schedule
      Object.values(data.data).forEach(daySchedule => {
        // Process each period in the day
        Object.values(daySchedule).forEach(schedules => {
          // Process schedules for both, even and odd weeks
          ['both', 'par', 'impar'].forEach(weekType => {
            const items = (schedules as any)[weekType] as ScheduleItem[];
            items.forEach(item => {
              const subjectName = item.subjectid.name;
              const subjectId = `subject_${subjectName.replace(/\s+/g, '_').toLowerCase()}`;
              
              if (!subjects.has(subjectId)) {
                subjects.set(subjectId, {
                  id: subjectId,
                  name: subjectName
                });
              }
            });
          });
        });
      });
      
      // Add custom periods as subjects
      this.settings.customPeriods.forEach(period => {
        const customId = `custom_${period._id}`;
        if (!subjects.has(customId) && period.name) {
          subjects.set(customId, {
            id: customId,
            name: period.name,
            isCustom: true
          });
        }
      });
      
      // Convert map to array and store
      this.cachedSubjects = Array.from(subjects.values());
      await AsyncStorage.setItem(CACHE_KEYS.SUBJECTS, JSON.stringify(this.cachedSubjects));
    } catch (error) {
      console.error('Error extracting subjects:', error);
    }
  },
  
  // Get the list of unique subjects
  async getSubjects(): Promise<Subject[]> {
    try {
      // Return cached subjects if available
      if (this.cachedSubjects.length > 0) {
        return this.cachedSubjects;
      }
      
      // Try to load subjects from storage
      const cachedSubjects = await AsyncStorage.getItem(CACHE_KEYS.SUBJECTS);
      if (cachedSubjects) {
        this.cachedSubjects = JSON.parse(cachedSubjects);
        return this.cachedSubjects;
      }
      
      // If no cached subjects and we have schedule data, extract subjects
      if (this.settings.selectedGroupId) {
        const scheduleData = await this.getClassSchedule(this.settings.selectedGroupId);
        await this.extractAndStoreSubjects(scheduleData);
        return this.cachedSubjects;
      }
      
      return [];
    } catch (error) {
      console.error('Error getting subjects:', error);
      return [];
    }
  },
  
  // Add a custom subject
  async addCustomSubject(name: string): Promise<Subject> {
    const newSubject: Subject = {
      id: `custom_subject_${Date.now()}`,
      name,
      isCustom: true
    };
    
    this.cachedSubjects.push(newSubject);
    await AsyncStorage.setItem(CACHE_KEYS.SUBJECTS, JSON.stringify(this.cachedSubjects));
    return newSubject;
  },
  
  // Update a subject
  async updateSubject(id: string, updates: Partial<Subject>): Promise<boolean> {
    const index = this.cachedSubjects.findIndex(s => s.id === id);
    if (index !== -1) {
      this.cachedSubjects[index] = {
        ...this.cachedSubjects[index],
        ...updates
      };
      await AsyncStorage.setItem(CACHE_KEYS.SUBJECTS, JSON.stringify(this.cachedSubjects));
      return true;
    }
    return false;
  },
  
  // Delete a custom subject
  async deleteCustomSubject(id: string): Promise<boolean> {
    const index = this.cachedSubjects.findIndex(s => s.id === id && s.isCustom);
    if (index !== -1) {
      this.cachedSubjects.splice(index, 1);
      await AsyncStorage.setItem(CACHE_KEYS.SUBJECTS, JSON.stringify(this.cachedSubjects));
      return true;
    }
    return false;
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

  async getPeriodTimes(): Promise<PeriodTimes | null> {
    try {
      const cachedTimes = await AsyncStorage.getItem(PERIOD_TIMES_CACHE_KEY);
      if (cachedTimes) {
        return JSON.parse(cachedTimes);
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  async syncPeriodTimes(force: boolean = false): Promise<void> {
    try {
      if (!force && PERIOD_SYNC_INTERVAL > 0) {
        const lastSync = await AsyncStorage.getItem(LAST_PERIOD_SYNC_KEY);
        if (lastSync) {
          const lastSyncTime = new Date(lastSync).getTime();
          if (Date.now() - lastSyncTime < PERIOD_SYNC_INTERVAL) return;
        }
      }
      const response = await fetch('https://papi.jagged.me/api/schedule');
      if (!response.ok) throw new Error('Failed to fetch period times');
      const periodTimes = await response.json();
      await AsyncStorage.setItem(PERIOD_TIMES_CACHE_KEY, JSON.stringify(periodTimes));
      await AsyncStorage.setItem(LAST_PERIOD_SYNC_KEY, new Date().toISOString());
      this.log('Period times synced');
    } catch (error) {
      this.log('Period times sync failed (using cached if available)');
    }
  },

  // Recovery Days feature implementation
  async getRecoveryDays(): Promise<RecoveryDay[]> {
    try {
      // Return cached recovery days if available
      if (this.cachedRecoveryDays.length > 0) {
        return this.cachedRecoveryDays;
      }

      // Try to get cached recovery days first
      const cachedRecoveryDays = await AsyncStorage.getItem(CACHE_KEYS.RECOVERY_DAYS);
      if (cachedRecoveryDays) {
        this.cachedRecoveryDays = JSON.parse(cachedRecoveryDays);
        return this.cachedRecoveryDays;
      }
      
      // If no cached recovery days, fetch from API
      await this.syncRecoveryDays();
      return this.cachedRecoveryDays;
    } catch (error) {
      // Silent error handling
      return [];
    }
  },

  async syncRecoveryDays(force: boolean = false): Promise<void> {
    try {
      if (!force && RECOVERY_DAYS_SYNC_INTERVAL > 0) {
        const lastSync = await AsyncStorage.getItem(CACHE_KEYS.LAST_RECOVERY_SYNC);
        if (lastSync) {
          const lastSyncTime = new Date(lastSync).getTime();
          if (Date.now() - lastSyncTime < RECOVERY_DAYS_SYNC_INTERVAL) return;
        }
      }
      if (!await this.hasInternetConnection()) return;
      const response = await fetch('https://papi.jagged.me/api/recovery-days');
      if (!response.ok) throw new Error('Failed to fetch recovery days');
      const recoveryDays: RecoveryDay[] = await response.json();
      await AsyncStorage.setItem(CACHE_KEYS.RECOVERY_DAYS, JSON.stringify(recoveryDays));
      await AsyncStorage.setItem(CACHE_KEYS.LAST_RECOVERY_SYNC, new Date().toISOString());
      this.cachedRecoveryDays = recoveryDays;
      this.log('Recovery days synced');
      if (this.settings.selectedGroupId) {
        const cachedData = await this.getCachedSchedule(this.settings.selectedGroupId);
        if (cachedData) {
          const transformedData = this.transformScheduleData(cachedData);
          await this.cacheSchedule(this.settings.selectedGroupId, transformedData);
        }
      }
    } catch (error) { this.log('Recovery days sync failed'); }
  },

  // Check if a specific date is a recovery day
  isRecoveryDay(date: Date): RecoveryDay | null {
    const dateString = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    // Ensure cachedRecoveryDays exists before calling find
    if (!this.cachedRecoveryDays || !Array.isArray(this.cachedRecoveryDays)) {
      return null;
    }
    
    // Find a matching recovery day that is active and applies to the current group
    const recoveryDay = this.cachedRecoveryDays.find(day => 
      day.date === dateString && 
      day.isActive && 
      (day.groupId === '' || day.groupId === this.settings.selectedGroupId)
    );
    
    return recoveryDay || null;
  },

  async getScheduleForDay(data: ApiResponse, dayName: keyof ApiResponse['data'] | undefined, date?: Date) {
    if (!dayName) return [];

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
      isCustom?: boolean;
      color?: string;
      isRecoveryDay?: boolean;
      recoveryReason?: string;
      replacedDayName?: string;
      assignmentCount: number;
    }> = [];

    const daySchedule = data.data[dayName];
    if (!daySchedule) return result;

    // Convert the date to a dateKey for assignment filtering
    const dateKey = date ? format(date, 'yyyy-MM-dd') : '';

    // Get period times from the custom API first
    const customPeriodTimes = await this.getPeriodTimes();
    // Convert dayName to string and determine corresponding day for API
    const dayOfWeekStr = typeof dayName === 'string' && dayName.includes('weekend') 
      ? 'monday' 
      : dayName as string; // Cast as string since we know it's a string key

    // Process each period synchronously since we already have all the data
    Object.entries(daySchedule).forEach(([periodNum, schedules]) => {
      const processScheduleItem = (item: ScheduleItem & { isRecoveryDay?: boolean; recoveryInfo?: any }, isEvenWeek?: boolean) => {
        const itemGroup = item.groupids.name;
        
        // Fix encoding and ensure we catch all variants of "entire class"
        const entireClassVariants = ['Clasă intreagă', 'Clas intreag', 'Clasa intreaga', 'Clasă întreagă', 'Clas întreag', 'Întreaga clasă', 'Class'];
        const entireClass = entireClassVariants.some(variant => 
          itemGroup.toLowerCase().includes(variant.toLowerCase()) || 
          itemGroup.toLowerCase().includes('intreag')
        );
        
        // Map API group naming to our app's naming convention
        let compareItemGroup = itemGroup;
        if (itemGroup.includes('Grupa 1') || itemGroup === 'Grupa 1') {
          compareItemGroup = 'Subgroup 1';
        } else if (itemGroup.includes('Grupa 2') || itemGroup === 'Grupa 2') {
          compareItemGroup = 'Subgroup 2';
        }
        
        // Only skip if not entireClass AND does not match selected subgroup
        if (!entireClass && compareItemGroup !== this.settings.group) {
          return;
        }

        // Try to get period times from custom API first, then fall back to original data
        let startTime = '';
        let endTime = '';
        
        if (customPeriodTimes && customPeriodTimes[dayOfWeekStr as keyof PeriodTimes]) {
          // Find the matching period in the custom period times
          const periodsForDay = customPeriodTimes[dayOfWeekStr as keyof PeriodTimes];
          const customPeriod = periodsForDay.find((p: PeriodTime) => p.period === parseInt(periodNum) - 1);
          if (customPeriod) {
            startTime = customPeriod.starttime;
            endTime = customPeriod.endtime;
          }
        }
        
        // Fall back to original period times if custom times not available
        if (!startTime || !endTime) {
          const periodIndex = parseInt(periodNum) - 1;
          const periodData = data.periods[periodIndex];
          startTime = periodData.starttime;
          endTime = periodData.endtime;
        }

        // If this is a recovery day item and it's the first period, add the info banner
        if (item.isRecoveryDay && periodNum === '1' && item.recoveryInfo) {
          result.push({
            period: 'recovery-info',
            startTime: '00:00',
            endTime: '00:01',
            className: `Recovery Day: ${item.recoveryInfo.reason}`,
            teacherName: '',
            roomNumber: '',
            isCustom: true,
            color: '#FF5733',
            isRecoveryDay: true,
            recoveryReason: item.recoveryInfo.reason,
            replacedDayName: item.recoveryInfo.replacedDay,
            assignmentCount: 0 // Recovery info never has assignments
          });
        }

        // Get assignment count for this period from cached assignment counts, filtering by date
        const periodId = periodNum.toString();
        const className = item.subjectid.name;
        let assignmentCount = 0;
        
        if (data.assignmentCounts && dateKey) {
          // First try to find by period ID and date
          const countByPeriod = data.assignmentCounts.find(ac => 
            ac.periodId === periodId && 
            ac.dateKey === dateKey
          );
          
          if (countByPeriod) {
            assignmentCount = countByPeriod.count;
          } else {
            // Then try by course name and date
            const countByCourse = data.assignmentCounts.find(ac => 
              ac.courseCode === className &&
              ac.dateKey === dateKey
            );
            
            if (countByCourse) {
              assignmentCount = countByCourse.count;
            }
          }
        }

        result.push({
          period: periodNum.toString(),
          startTime: startTime,
          endTime: endTime,
          className: item.subjectid.name,
          teacherName: item.teacherids.name,
          roomNumber: item.classroomids.name,
          isEvenWeek,
          group: compareItemGroup,
          isRecoveryDay: item.isRecoveryDay,
          recoveryReason: item.recoveryInfo?.reason,
          replacedDayName: item.recoveryInfo?.replacedDay,
          assignmentCount
        });
      };

      // Process all items for the current period
      schedules.both.forEach(item => processScheduleItem(item));
      schedules.par.forEach(item => processScheduleItem(item, true));
      schedules.impar.forEach(item => processScheduleItem(item, false));
    });

    // Add custom periods if they exist and are enabled
    if (date && this.settings.customPeriods.length > 0) {
      const currentDayOfWeek = date.getDay();
      // Map JavaScript's day (0=Sunday) to our days (1=Monday, 5=Friday)
      const mappedDayOfWeek = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
      
      this.settings.customPeriods.forEach(customPeriod => {
        // Check if this custom period is enabled and applies to this day
        if (customPeriod.isEnabled && 
            (!customPeriod.daysOfWeek || 
             customPeriod.daysOfWeek.includes(mappedDayOfWeek))) {
          
          // Get assignment count for this custom period, filtering by date
          let assignmentCount = 0;
          if (data.assignmentCounts && dateKey) {
            const periodCount = data.assignmentCounts.find(ac => 
              ac.periodId === customPeriod._id &&
              ac.dateKey === dateKey
            );
            
            if (periodCount) {
              assignmentCount = periodCount.count;
            }
          }
          
          result.push({
            period: customPeriod._id,
            startTime: customPeriod.starttime,
            endTime: customPeriod.endtime,
            className: customPeriod.name || 'Custom Period',
            teacherName: '',
            roomNumber: '',
            isCustom: true,
            color: customPeriod.color || '#4CC9F0',
            assignmentCount
          });
        }
      });
    }

    // Sort schedule by time
    const sortedSchedule = result.sort((a, b) => {
      // Put recovery day info at the top
      if (a.isRecoveryDay && a.period === 'recovery-info') return -1;
      if (b.isRecoveryDay && b.period === 'recovery-info') return 1;
      
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
  },

  // Custom period management
  addCustomPeriod(period: Omit<CustomPeriod, '_id'>) {
    const newPeriod = {
      ...period,
      _id: Date.now().toString(),
    };
    this.settings.customPeriods.push(newPeriod);
    this.saveSettings();
    this.notifyListeners();
    return newPeriod._id;
  },

  updateCustomPeriod(periodId: string, updates: Partial<CustomPeriod>) {
    const index = this.settings.customPeriods.findIndex(p => p._id === periodId);
    if (index !== -1) {
      // Create a new array with the updated period to avoid mutation
      const updatedPeriods = [...this.settings.customPeriods];
      updatedPeriods[index] = {
        ...updatedPeriods[index],
        ...updates
      };
      this.settings.customPeriods = updatedPeriods;
      this.saveSettings();
      this.notifyListeners();
      return true;
    }
    return false;
  },

  deleteCustomPeriod(periodId: string) {
    this.settings.customPeriods = this.settings.customPeriods.filter(p => p._id !== periodId);
    this.saveSettings();
    this.notifyListeners();
  },
  
  // Reset settings to defaults
  resetSettings() {
    this.settings = {
      group: 'Subgroup 2',
      language: getSystemLanguage(),
      selectedGroupId: '',
      selectedGroupName: DEFAULT_GROUP_NAME,
      scheduleView: 'day',
      customPeriods: []
    };
    
    // Also clear assignment counts when resetting
    this.cachedAssignmentCounts = [];
    AsyncStorage.removeItem(CACHE_KEYS.ASSIGNMENT_COUNTS);
    
    this.saveSettings();
    this.notifyListeners();
  },

  // Force refresh subjects for a specific group
  async refreshSubjects(groupId?: string): Promise<Subject[]> {
    try {
      // Use provided group ID or current selectedGroupId
      const targetGroupId = groupId || this.settings.selectedGroupId;
      
      if (!targetGroupId) {
        return [];
      }
      
      // Clear the cached subjects
      this.cachedSubjects = [];
      
      // Get fresh schedule data
      const scheduleData = await this.getClassSchedule(targetGroupId, true);
      
      // Extract and store subjects
      await this.extractAndStoreSubjects(scheduleData);
      
      return this.cachedSubjects;
    } catch (error) {
      return [];
    }
  },

  async updateAssignmentCounts(counts: PeriodAssignmentCount[]): Promise<void> {
    try {
      // Update the cached counts
      this.cachedAssignmentCounts = counts;
      
      // Store in AsyncStorage
      await AsyncStorage.setItem(CACHE_KEYS.ASSIGNMENT_COUNTS, JSON.stringify(counts));
      
      // Update the schedule data with new counts
      if (this.settings.selectedGroupId) {
        const cachedData = await this.getCachedSchedule(this.settings.selectedGroupId);
        if (cachedData) {
          cachedData.assignmentCounts = counts;
          await this.cacheSchedule(this.settings.selectedGroupId, cachedData);
          
          // Notify listeners to update UI
          this.notifyListeners();
        }
      }
    } catch (error) {
      console.error('Error updating assignment counts:', error);
    }
  },
  
  // Force refresh schedule regardless of cache age; fallback to cached when offline or failure
  async refreshSchedule(force: boolean = true): Promise<ApiResponse | null> {
    try {
      // Ensure we have a selected group; attempt to find default if missing
      if (!this.settings.selectedGroupId) {
        await this.findAndSetDefaultGroup();
      }
      const groupId = this.settings.selectedGroupId;
      if (!groupId) return null;

      const hasInternet = await this.hasInternetConnection();
      if (!hasInternet) {
        // Offline: return cached data if present
        const cached = await this.getCachedSchedule(groupId);
        return cached ? this.transformScheduleData(cached) : null;
      }

      // Online: attempt fresh fetch (always, per requirement)
      try {
        await Promise.all([
          this.syncRecoveryDays(true),
          this.syncPeriodTimes(true)
        ]);
        const fresh = await this.fetchAndCacheSchedule(groupId);
        return this.transformScheduleData(fresh);
      } catch (err) {
        // On failure, fallback to cache
        const cached = await this.getCachedSchedule(groupId);
        return cached ? this.transformScheduleData(cached) : null;
      }
    } catch (error) {
      // Final fallback
      try {
        if (this.settings.selectedGroupId) {
          const cached = await this.getCachedSchedule(this.settings.selectedGroupId);
          return cached ? this.transformScheduleData(cached) : null;
        }
      } catch (_) { /* silent */ }
      return null;
    }
  },

  async ensureSelectedGroup(): Promise<boolean> {
    if (this.settings.selectedGroupId) return true;
    const success = await this.findAndSetDefaultGroup();
    return success;
  },

  async clearScheduleCache(groupId?: string) {
    try {
      const gid = groupId || this.settings.selectedGroupId;
      if (!gid) return;
      await AsyncStorage.removeItem(CACHE_KEYS.SCHEDULE_PREFIX + gid);
      await AsyncStorage.removeItem(CACHE_KEYS.LAST_FETCH_PREFIX + gid);
      this.log('Cleared schedule cache for group', gid);
    } catch {}
  },

  async getLastScheduleFetchTime(groupId?: string): Promise<Date | null> {
    try {
      const gid = groupId || this.settings.selectedGroupId;
      if (!gid) return null;
      const lastFetch = await AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH_PREFIX + gid);
      return lastFetch ? new Date(lastFetch) : null;
    } catch {
      return null;
    }
  },
  async initialize() {
    if (this._ready || this._initializing) return;
    this._initializing = true;
    await this.loadSettings();
    // Load caches
    const [cachedRecoveryDays, cachedSubjects, cachedAssignmentCounts] = await Promise.all([
      AsyncStorage.getItem(CACHE_KEYS.RECOVERY_DAYS),
      AsyncStorage.getItem(CACHE_KEYS.SUBJECTS),
      AsyncStorage.getItem(CACHE_KEYS.ASSIGNMENT_COUNTS)
    ]);
    if (cachedRecoveryDays) this.cachedRecoveryDays = JSON.parse(cachedRecoveryDays);
    if (cachedSubjects) this.cachedSubjects = JSON.parse(cachedSubjects);
    if (cachedAssignmentCounts) this.cachedAssignmentCounts = JSON.parse(cachedAssignmentCounts);
    // Perform initial syncs (no interval gating)
    await Promise.all([
      this.syncPeriodTimes(true),
      this.syncRecoveryDays(true)
    ]);
    await this.ensureSelectedGroup();
    this._ready = true;
    this._initializing = false;
    this.log('Initialization complete');
  },
};

// Monkey patch update methods to trigger external sync only if provided
['updateSettings','addCustomPeriod','updateCustomPeriod','deleteCustomPeriod','resetSettings'].forEach(method => {
  const original = (scheduleService as any)[method];
  if (!original) return;
  (scheduleService as any)[method] = function(...args: any[]) {
    const result = original.apply(this, args);
    if (!this._isApplyingServerSettings()) {
      try { this._triggerExternalSync(); } catch {}
    }
    return result;
  };
});