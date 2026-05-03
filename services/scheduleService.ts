import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { format } from 'date-fns';
import { fetchCustomApi } from '../utils/customApi';
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

export type SpecialScheduleType = 'thesis' | 'exam';

export interface SpecialScheduleDocument {
  url: string;
  filename: string;
  semester: string | null;
  academicYear: string | null;
  examStudyYear: number | null;
  source: string | null;
}

interface BaseSpecialScheduleEvent {
  group: string;
  date: string;
  subject: string;
  teacher: string;
  room: string;
  subgroup: string | null;
  type: SpecialScheduleType;
}

export interface ThesisScheduleEvent extends BaseSpecialScheduleEvent {
  type: 'thesis';
  period: number | null;
  startTime: string | null;
  endTime: string | null;
}

export interface ExamScheduleEvent extends BaseSpecialScheduleEvent {
  type: 'exam';
  time: string | null;
}

export type SpecialScheduleEvent = ThesisScheduleEvent | ExamScheduleEvent;

export interface SpecialScheduleResponse {
  available: boolean;
  type: SpecialScheduleType;
  group: string | null;
  document: SpecialScheduleDocument | null;
  events: SpecialScheduleEvent[];
  reasonCode: string | null;
  reason: string | null;
  warnings: string[];
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

// Initial reference date for week calculation (January 12, 2026)
const REFERENCE_DATE = new Date(2026, 0, 12); // Month 0 = January, day = 12 (DD.MM.YYYY)

// Export the cache keys so they can be accessed from outside
export const CACHE_KEYS = {
  SCHEDULE_PREFIX: 'schedule_cache_',
  SETTINGS: 'user_settings',
  LAST_FETCH_PREFIX: 'last_schedule_fetch_',
  SPECIAL_SCHEDULE_PREFIX: 'special_schedule_cache_',
  LAST_SPECIAL_FETCH_PREFIX: 'last_special_schedule_fetch_',
  GROUPS: 'groups_cache',
  RECOVERY_DAYS: 'recovery_days_cache',
  LAST_RECOVERY_SYNC: 'last_recovery_days_sync',
  SUBJECTS: 'subjects_cache', // New cache key for subjects
  ASSIGNMENT_COUNTS: 'assignment_counts_cache', // New cache key for assignment counts
};

const CACHE_EXPIRY = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const SPECIAL_SCHEDULE_CACHE_EXPIRY = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_GROUP_NAME = 'P-2422';

const PERIOD_TIMES_CACHE_KEY = 'period_times_cache';
const LAST_PERIOD_SYNC_KEY = 'last_period_sync';
// Removed interval logic: we now refresh on app load & manual refresh.
const PERIOD_SYNC_INTERVAL = 0; // No interval-based skip; kept for backward compatibility

type SettingsListener = () => void;

interface PeriodTime {
  index: number;
  start: string;
  end: string;
}

interface RecoverySource {
  date?: string;
  weekday?: string;
  weekType?: string;
}

interface DateOverride {
  id: number;
  date: string;
  mode: 'times_override' | 'weekday_replace' | 'recover_with_custom' | 'recover_day';
  reason?: string;
  replaceWeekday?: string | null;
  groupId: string;
  groupName: string;
  isActive: boolean;
  hasRecoverySource?: boolean;
  hasCustomSchedule?: boolean;
  hasRemovedPeriods?: boolean;
  customPeriodCount?: number;
  removedPeriodCount?: number;
  recoverySource?: RecoverySource;
  source?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  periods?: PeriodTime[];
}

interface WeekScheduleDay {
  date?: string;
  weekday?: string;
  isWeekend?: boolean;
  isOverride?: boolean;
  dayState?: 'normal' | 'partial' | 'empty' | string;
  schedule?: PeriodTime[];
  baseSchedule?: PeriodTime[];
  removedPeriods?: Array<number | string>;
  removedPeriodCount?: number;
  override: DateOverride | null;
}

interface WeekScheduleResponse {
  week: {
    offset: number;
    anchorDate: string;
    startDate: string;
    endDate: string;
  };
  days: WeekScheduleDay[];
}

interface DatePeriodTimesEntry {
  date: string;
  weekday: string;
  isWeekend: boolean;
  isOverride: boolean;
  dayState?: 'normal' | 'partial' | 'empty' | string;
  schedule: PeriodTime[];
  baseSchedule: PeriodTime[];
  removedPeriods: Array<number | string>;
  removedPeriodCount: number;
  override: DateOverride | null;
}

type DatePeriodTimesMap = Record<string, DatePeriodTimesEntry>;

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

const WEEKDAY_LABELS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const isDateWeekend = (date: Date): boolean => date.getDay() === 0 || date.getDay() === 6;

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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
  cachedDatePeriodTimes: {} as DatePeriodTimesMap,
  cachedSubjects: [] as Subject[],
  cachedAssignmentCounts: [] as PeriodAssignmentCount[],
  specialScheduleFetchedThisSession: new Set<string>(),
  // Debug controls
  _debug: false,
  _ready: false,
  _initializing: false,
  _scheduleRefreshVersion: 0,
  _settingsSyncCallbacks: [] as Array<() => void>,
  _isApplyingServerSettings: () => false, // optional callback provided by settingsService
  _triggerExternalSync: () => {},

  enableDebug(value: boolean) { this._debug = value; },
  log(...args: any[]) { if (this._debug) console.log('[scheduleService]', ...args); },
  isReady() { return this._ready; },
  getScheduleRefreshVersion() { return this._scheduleRefreshVersion; },
  markScheduleRefreshed() {
    this._scheduleRefreshVersion += 1;
    this.notifyListeners();
  },
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

  getDateKey(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  },

  getCurrentPeriodCacheGroupKey(): string {
    return this.settings.selectedGroupId || '__all__';
  },

  makeDatePeriodCacheKey(dateKey: string, groupKey?: string): string {
    const resolvedGroupKey = groupKey ?? this.getCurrentPeriodCacheGroupKey();
    return `${resolvedGroupKey}::${dateKey}`;
  },

  getCachedDatePeriodEntry(dateKey: string): DatePeriodTimesEntry | null {
    const groupKey = this.getCurrentPeriodCacheGroupKey();
    const scoped = this.cachedDatePeriodTimes[this.makeDatePeriodCacheKey(dateKey, groupKey)];
    if (scoped) return scoped;

    // Backward compatibility with old date-only cache format and global fallback.
    return this.cachedDatePeriodTimes[dateKey] || this.cachedDatePeriodTimes[this.makeDatePeriodCacheKey(dateKey, '__all__')] || null;
  },

  getScopedDatePeriodEntry(dateKey: string, groupKey?: string): DatePeriodTimesEntry | null {
    const resolvedGroupKey = groupKey ?? this.getCurrentPeriodCacheGroupKey();
    return this.cachedDatePeriodTimes[this.makeDatePeriodCacheKey(dateKey, resolvedGroupKey)] || null;
  },

  setCachedDatePeriodEntry(dateKey: string, entry: DatePeriodTimesEntry) {
    const groupKey = this.getCurrentPeriodCacheGroupKey();
    this.cachedDatePeriodTimes[this.makeDatePeriodCacheKey(dateKey, groupKey)] = entry;
  },

  getDatePeriodEntriesForCurrentGroup(): DatePeriodTimesEntry[] {
    const groupKey = this.getCurrentPeriodCacheGroupKey();
    const prefix = `${groupKey}::`;

    const scopedEntries = Object.entries(this.cachedDatePeriodTimes)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value);

    if (scopedEntries.length > 0) {
      return scopedEntries;
    }

    // Fallback for legacy unscoped cache.
    return Object.entries(this.cachedDatePeriodTimes)
      .filter(([key]) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .map(([, value]) => value);
  },

  getWeekDateKeys(anchorDate: Date, weekOffset: number = 0): string[] {
    const target = new Date(anchorDate);
    target.setDate(target.getDate() + weekOffset * 7);

    const jsDay = target.getDay();
    const deltaToMonday = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(target);
    monday.setDate(target.getDate() + deltaToMonday);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return this.getDateKey(date);
    });
  },

  hasWeekInDatePeriodCache(anchorDate: Date, weekOffset: number = 0): boolean {
    const groupKey = this.getCurrentPeriodCacheGroupKey();
    const weekDateKeys = this.getWeekDateKeys(anchorDate, weekOffset);
    return weekDateKeys.every(key => Boolean(this.getScopedDatePeriodEntry(key, groupKey)));
  },

  normalizeWeekdayKey(weekday?: string): keyof ApiResponse['data'] | undefined {
    if (!weekday) return undefined;
    const normalized = weekday.toLowerCase();
    if (normalized in DAYS_MAP_INVERSE) {
      return normalized as keyof ApiResponse['data'];
    }
    return undefined;
  },

  getWeekdayKeyForDate(date: Date): keyof ApiResponse['data'] | undefined {
    const jsDay = date.getDay();
    if (jsDay < 1 || jsDay > 5) return undefined;
    return DAYS_MAP[jsDay as keyof typeof DAYS_MAP] as keyof ApiResponse['data'];
  },

  getWeekdayLabelForDate(date: Date): string {
    return WEEKDAY_LABELS[date.getDay()];
  },

  getRemovedPeriodNumbersForDisplay(entry: DatePeriodTimesEntry | null): number[] {
    if (!entry || !Array.isArray(entry.removedPeriods) || entry.removedPeriods.length === 0) {
      return [];
    }

    const numericRemoved = Array.from(new Set(
      entry.removedPeriods
        .map(period => Number(period))
        .filter(period => Number.isFinite(period))
        .map(period => Math.trunc(period))
        .filter(period => period >= 0)
    ));

    if (numericRemoved.length === 0) {
      return [];
    }

    const baseIndices = Array.from(new Set((entry.baseSchedule || []).map(period => period.index))).sort((a, b) => a - b);
    const activeIndices = Array.from(new Set((entry.schedule || []).map(period => period.index))).sort((a, b) => a - b);

    const matchesActiveSchedule = (removedIndices: number[]): boolean => {
      if (baseIndices.length === 0) return false;
      const removedSet = new Set(removedIndices);
      const remaining = baseIndices.filter(index => !removedSet.has(index));
      return remaining.length === activeIndices.length && remaining.every((value, idx) => value === activeIndices[idx]);
    };

    const asZeroBased = numericRemoved;
    const asOneBased = numericRemoved.map(period => period - 1).filter(period => period >= 0);
    const zeroBasedMatches = matchesActiveSchedule(asZeroBased);
    const oneBasedMatches = matchesActiveSchedule(asOneBased);

    let displayNumbers: number[];
    if (zeroBasedMatches && !oneBasedMatches) {
      displayNumbers = numericRemoved.map(period => period + 1);
    } else if (oneBasedMatches && !zeroBasedMatches) {
      displayNumbers = numericRemoved;
    } else {
      const treatAsZeroBased = numericRemoved.some(period => period === 0);
      displayNumbers = treatAsZeroBased
        ? numericRemoved.map(period => period + 1)
        : numericRemoved;
    }

    return Array.from(new Set(displayNumbers.filter(period => period > 0))).sort((a, b) => a - b);
  },

  buildOverrideInfoMessage(entry: DatePeriodTimesEntry | null): string {
    if (!entry?.isOverride) return '';

    const explicitReason = entry.override?.reason?.trim() || '';
    if (explicitReason) {
      return explicitReason;
    }

    const activeCount = Array.isArray(entry.schedule) ? entry.schedule.length : 0;
    const baseCount = Array.isArray(entry.baseSchedule) ? entry.baseSchedule.length : 0;
    const removedDisplay = this.getRemovedPeriodNumbersForDisplay(entry);
    const replacedWeekday = entry.override?.replaceWeekday || entry.override?.recoverySource?.weekday || '';
    const replacedWeekdayLabel = replacedWeekday
      ? `${replacedWeekday.charAt(0).toUpperCase()}${replacedWeekday.slice(1)}`
      : '';

    if (entry.dayState === 'empty' || (baseCount > 0 && activeCount === 0)) {
      return baseCount > 0
        ? `All ${baseCount} periods were removed for this day.`
        : 'No classes are scheduled for this day due to an override.';
    }

    const parts: string[] = [];

    if (removedDisplay.length > 0) {
      parts.push(`Removed periods: ${removedDisplay.join(', ')}.`);
    }

    if (baseCount > 0 && activeCount !== baseCount) {
      parts.push(`Showing ${activeCount} of ${baseCount} periods.`);
    } else if (entry.override?.hasCustomSchedule && activeCount > 0) {
      parts.push(`Custom schedule with ${activeCount} periods.`);
    }

    if (replacedWeekdayLabel) {
      parts.push(`Follows ${replacedWeekdayLabel} classes.`);
    }

    if (parts.length > 0) {
      return parts.join(' ');
    }

    return 'Temporary schedule override is active for this day.';
  },

  resolveWeekSchedulePeriods(day?: WeekScheduleDay | null): PeriodTime[] {
    if (!day) return [];

    if (Array.isArray(day.schedule) && day.schedule.length > 0) {
      return [...day.schedule].sort((a, b) => a.index - b.index);
    }

    const baseSchedule = Array.isArray(day.baseSchedule) ? [...day.baseSchedule] : [];
    if (baseSchedule.length === 0) {
      return [];
    }

    if (day.dayState === 'empty') {
      return [];
    }

    if (day.dayState === 'partial' || (Array.isArray(day.removedPeriods) && day.removedPeriods.length > 0)) {
      const removedPeriods = new Set((day.removedPeriods || []).map(period => String(period)));
      return baseSchedule.filter(period => {
        const periodIndex = String(period.index);
        const periodNumber = String(period.index + 1);
        return !removedPeriods.has(periodIndex) && !removedPeriods.has(periodNumber);
      });
    }

    return baseSchedule;
  },

  normalizeWeekScheduleDay(day: WeekScheduleDay | undefined, weekStart: Date | null, index: number): DatePeriodTimesEntry | null {
    const fallbackDate = weekStart ? addDays(weekStart, index) : null;
    const resolvedDate = day?.date || (fallbackDate ? this.getDateKey(fallbackDate) : '');
    if (!resolvedDate) return null;

    const resolvedDateObject = new Date(`${resolvedDate}T00:00:00`);
    const resolvedWeekday = day?.weekday || this.getWeekdayLabelForDate(resolvedDateObject);
    const resolvedSchedule = this.resolveWeekSchedulePeriods(day);
    const resolvedOverride = day?.override
      ? {
          ...day.override,
          mode: day.override.mode,
          recoverySource: day.override.recoverySource || undefined,
        }
      : null;

    return {
      date: resolvedDate,
      weekday: resolvedWeekday,
      isWeekend: day?.isWeekend ?? isDateWeekend(resolvedDateObject),
      isOverride: Boolean(resolvedOverride) || Boolean(day?.isOverride),
      dayState: day?.dayState,
      schedule: resolvedSchedule,
      baseSchedule: Array.isArray(day?.baseSchedule) ? [...day.baseSchedule] : [...resolvedSchedule],
      removedPeriods: Array.isArray(day?.removedPeriods) ? [...day.removedPeriods] : [],
      removedPeriodCount: typeof day?.removedPeriodCount === 'number'
        ? day.removedPeriodCount
        : (Array.isArray(day?.removedPeriods) ? day.removedPeriods.length : 0),
      override: resolvedOverride,
    };
  },

  buildRecoveryDaysFromDatePeriodTimes(): RecoveryDay[] {
    return this.getDatePeriodEntriesForCurrentGroup()
      .filter(entry => entry.isWeekend && entry.isOverride && entry.override?.isActive !== false)
      .map(entry => ({
        date: entry.date,
        replacedDay: entry.override?.replaceWeekday || entry.override?.recoverySource?.weekday || 'monday',
        reason: entry.override?.reason || '',
        groupId: entry.override?.groupId || '',
        groupName: entry.override?.groupName || '',
        isActive: entry.override?.isActive ?? true,
      }));
  },

  createFallbackScheduleItem(index: number): ScheduleItem {
    return {
      _id: `fallback_${index}`,
      subjectid: { name: `Period ${index + 1}` },
      teacherids: { name: '' },
      classroomids: { name: '' },
      groupids: { name: 'Class', entireclass: 'true' },
      cards: { period: String(index + 1), weeks: 'both', days: '' },
    };
  },

  buildFallbackApiResponseFromDatePeriodTimes(): ApiResponse {
    const response: ApiResponse = {
      data: {
        monday: {},
        tuesday: {},
        wednesday: {},
        thursday: {},
        friday: {},
      },
      periods: [],
      recoveryDays: this.buildRecoveryDaysFromDatePeriodTimes(),
      assignmentCounts: this.cachedAssignmentCounts,
    };

    const periodMap = new Map<number, Period>();

    this.getDatePeriodEntriesForCurrentGroup().forEach(entry => {
      if (!entry || !Array.isArray(entry.schedule)) return;

      let targetDay = this.normalizeWeekdayKey(entry.weekday);
      if (entry.override?.mode === 'weekday_replace' && entry.override.replaceWeekday) {
        targetDay = this.normalizeWeekdayKey(entry.override.replaceWeekday) || targetDay;
      }

      if (!targetDay) return;

      const dayKey = entry.isWeekend ? `weekend_${entry.date}` : targetDay;
      if (!response.data[dayKey]) {
        response.data[dayKey] = {};
      }

      entry.schedule.forEach(period => {
        const periodNum = String(period.index + 1);
        if (!response.data[dayKey][periodNum]) {
          response.data[dayKey][periodNum] = { both: [], par: [], impar: [] };
        }

        response.data[dayKey][periodNum].both.push(this.createFallbackScheduleItem(period.index));

        if (!periodMap.has(period.index)) {
          periodMap.set(period.index, {
            _id: `fallback_period_${period.index}`,
            starttime: period.start,
            endtime: period.end,
          });
        }
      });
    });

    response.periods = Array.from(periodMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, period]) => period);

    return response;
  },

  mergeWeekPeriodTimes(weekResponse: WeekScheduleResponse) {
    if (!weekResponse || !Array.isArray(weekResponse.days)) return;

    const weekStart = weekResponse.week?.startDate ? new Date(`${weekResponse.week.startDate}T00:00:00`) : null;
    const normalizedDays = Array.from({ length: 7 }, (_, index) => {
      const day = weekResponse.days[index];
      return this.normalizeWeekScheduleDay(day, weekStart, index);
    }).filter((day): day is DatePeriodTimesEntry => Boolean(day));

    normalizedDays.forEach(day => {
      this.setCachedDatePeriodEntry(day.date, day);
    });

    this.cachedRecoveryDays = this.buildRecoveryDaysFromDatePeriodTimes();
  },

  async getCachedSchedule(groupId: string): Promise<ApiResponse | null> {
    try {
      // Get schedule and related metadata from cache at once
      const [cachedData, cachedPeriodTimes, cachedRecoveryDays, cachedAssignmentCounts] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEYS.SCHEDULE_PREFIX + groupId),
        AsyncStorage.getItem(PERIOD_TIMES_CACHE_KEY),
        AsyncStorage.getItem(CACHE_KEYS.RECOVERY_DAYS),
        AsyncStorage.getItem(CACHE_KEYS.ASSIGNMENT_COUNTS)
      ]);

      if (cachedData) {
        const data = JSON.parse(cachedData);
        
        // Validate that the cached data has the expected structure
        if (!data || typeof data !== 'object' || !data.data || !data.periods) {
          this.log('Cached data is corrupted, clearing cache');
          await this.clearScheduleCache(groupId);
          return null;
        }
        
        // Validate that data.data has the expected day properties
        const hasValidDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].some(
          day => data.data[day] && typeof data.data[day] === 'object'
        );
        
        if (!hasValidDays) {
          this.log('Cached data has no valid days, clearing cache');
          await this.clearScheduleCache(groupId);
          return null;
        }
        
        if (cachedPeriodTimes) {
          try {
            this.cachedDatePeriodTimes = JSON.parse(cachedPeriodTimes);
          } catch (e) {
            this.cachedDatePeriodTimes = {};
          }
        }

        // Update cached recovery days in memory if available
        if (cachedRecoveryDays) {
          try {
            this.cachedRecoveryDays = JSON.parse(cachedRecoveryDays);
          } catch (e) {
            this.cachedRecoveryDays = [];
          }
        } else {
          this.cachedRecoveryDays = this.buildRecoveryDaysFromDatePeriodTimes();
        }

        // Always derive active recovery days from current group-scoped period cache.
        this.cachedRecoveryDays = this.buildRecoveryDaysFromDatePeriodTimes();
        
        // Update cached assignment counts in memory if available
        if (cachedAssignmentCounts) {
          try {
            this.cachedAssignmentCounts = JSON.parse(cachedAssignmentCounts);
          } catch (e) {
            this.cachedAssignmentCounts = [];
          }
        }
        
        // Include recovery days and assignment counts in the response
        data.recoveryDays = this.cachedRecoveryDays;
        data.assignmentCounts = this.cachedAssignmentCounts;
        
        return data;
      }
      return null;
    } catch (error) {
      // Silent error handling
      this.log('Error reading cache:', error);
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
  
  async refreshGroups(force: boolean = true): Promise<Group[]> {
    try {
      if (!force) {
        return this.getGroups();
      }

      // Only attempt a network fetch when we have connectivity
      if (!await this.hasInternetConnection()) {
        return this.getGroups();
      }

      const response = await fetch(`${API_BASE_URL}/grupe`);
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }

      const groups: Group[] = await response.json();
      this.cachedGroups = groups;
      await AsyncStorage.setItem(CACHE_KEYS.GROUPS, JSON.stringify(groups));

      // If we have a saved group name, realign the ID in case it changed upstream
      if (this.settings.selectedGroupName) {
        await this.findAndSetDefaultGroup(this.settings.selectedGroupName, groups);
      }

      return groups;
    } catch (error) {
      this.log('Group refresh failed', error);
      // Fall back to cached or stored groups
      return this.cachedGroups.length > 0 ? this.cachedGroups : await this.getGroups();
    }
  },

  async findAndSetDefaultGroup(targetName: string = DEFAULT_GROUP_NAME, groupsOverride?: Group[]) {
    try {
      const groups = groupsOverride ?? await this.getGroups();
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
    await this.ready();
    let id = groupId || this.settings.selectedGroupId;
    
    // Ensure a selected group exists before trying to read/fetch schedule
    if (!id) {
      await this.ensureSelectedGroup();
      id = this.settings.selectedGroupId;
    }
    
    if (!id) {
      return this.transformScheduleData({
        data: {
          monday: {},
          tuesday: {},
          wednesday: {},
          thursday: {},
          friday: {}
        },
        periods: [],
        recoveryDays: [],
        assignmentCounts: []
      });
    }
    
    try {
      // Get cached schedule data
      const cachedData = await this.getCachedSchedule(id);
      
      // Check if we need to refresh the cache in the background
      const shouldRefetch = await this.shouldRefetchSchedule(id);
      
      if (shouldRefetch || forceRefresh) {
        // Fetch new data in the background
        this.fetchAndCacheSchedule(id).catch(() => {});
        // Sync date-based period times to ensure we have the latest override data
        this.syncPeriodTimes().catch(() => {});
      }
      
      // Return cached data as schedule response
      if (cachedData) {
        return this.transformScheduleData(cachedData);
      }

      // If no cached data, try to fetch (this will only happen on first run)
      const freshData = await this.fetchAndCacheSchedule(id);
      return this.transformScheduleData(freshData);
    } catch (error) {
      const cachedData = await this.getCachedSchedule(id);
      if (cachedData) {
        return this.transformScheduleData(cachedData);
      }
      return this.transformScheduleData(this.buildFallbackApiResponseFromDatePeriodTimes());
    }
  },

  transformScheduleData(data: ApiResponse): ApiResponse {
    // Validate input data
    if (!data || !data.data || !data.periods) {
      this.log('Invalid data passed to transformScheduleData');
      return {
        data: {
          monday: {},
          tuesday: {},
          wednesday: {},
          thursday: {},
          friday: {}
        },
        periods: [],
        recoveryDays: [],
        assignmentCounts: []
      };
    }
    
    // Create a deep copy of the data
    const transformedData: ApiResponse = {
      ...data,
      data: { ...data.data }
    };

    transformedData.recoveryDays = this.buildRecoveryDaysFromDatePeriodTimes();
    return transformedData;
  },

  async fetchAndCacheSchedule(groupId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/orar?_id=${groupId}&tip=class`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      
      // Sync date-based times and overrides before transforming schedule.
      await this.syncPeriodTimes();
      
      // Apply recovery day transformations
      const transformedData = this.transformScheduleData(data);
      
      // Extract and store unique subjects
      await this.extractAndStoreSubjects(transformedData);
      
      await this.cacheSchedule(groupId, transformedData);
      return transformedData;
    } catch (error) {
      this.log('CEITI schedule fetch failed, using custom weekly fallback', error);
      await this.syncPeriodTimes(true);
      const fallbackData = this.buildFallbackApiResponseFromDatePeriodTimes();
      await this.cacheSchedule(groupId, fallbackData);
      return fallbackData;
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
        const endpoints = [`${API_BASE_URL}/grupe`];

        for (const endpoint of endpoints) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          try {
            const response = await fetch(endpoint, {
              method: 'HEAD',
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              return true;
            }
          } catch (error: unknown) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
              continue;
            }
          }
        }
        try {
          const response = await fetchCustomApi('/api/keepalive', {
            method: 'HEAD',
            timeoutMs: 5000,
          });
          return response.ok;
        } catch {
          return false;
        }
      }
      return navigator.onLine;
    } catch (error) {
      return false;
    }
  },

  normalizeSpecialScheduleGroupName(groupName?: string): string {
    const rawGroup = String(groupName || '').trim();
    if (!rawGroup) return '';

    // Canonical thesis/exam group format: X-YYZA with optional trailing R.
    // Some sources append extra suffixes (e.g. "P-2422c"), which should be removed.
    const canonicalMatch = rawGroup.match(/^([A-Za-z]-\d{3}[A-Za-z0-9])/);
    if (!canonicalMatch) return rawGroup;

    const canonicalBase = canonicalMatch[1];
    const keepTrailingR = /r$/i.test(rawGroup) && !canonicalBase.toUpperCase().endsWith('R');
    return keepTrailingR ? `${canonicalBase}R` : canonicalBase;
  },

  getSpecialScheduleCacheScope(groupName?: string): string {
    const normalizedGroup = this.normalizeSpecialScheduleGroupName(groupName);
    return normalizedGroup.length > 0 ? normalizedGroup : '__meta__';
  },

  getSpecialScheduleSessionKey(type: SpecialScheduleType, groupName?: string): string {
    return `${type}_${this.getSpecialScheduleCacheScope(groupName)}`;
  },

  getSpecialScheduleCacheKey(type: SpecialScheduleType, groupName?: string): string {
    return `${CACHE_KEYS.SPECIAL_SCHEDULE_PREFIX}${type}_${this.getSpecialScheduleCacheScope(groupName)}`;
  },

  getSpecialScheduleLastFetchKey(type: SpecialScheduleType, groupName?: string): string {
    return `${CACHE_KEYS.LAST_SPECIAL_FETCH_PREFIX}${type}_${this.getSpecialScheduleCacheScope(groupName)}`;
  },

  buildUnavailableSpecialSchedule(
    type: SpecialScheduleType,
    groupName?: string | null,
    reasonCode: string | null = 'unavailable',
    reason: string | null = null
  ): SpecialScheduleResponse {
    return {
      available: false,
      type,
      group: typeof groupName === 'string' && groupName.trim().length > 0 ? groupName.trim() : null,
      document: null,
      events: [],
      reasonCode,
      reason,
      warnings: [],
    };
  },

  normalizeSpecialScheduleDocument(document: any): SpecialScheduleDocument | null {
    if (!document || typeof document !== 'object') {
      return null;
    }

    const examStudyYearRaw = (document as { examStudyYear?: unknown }).examStudyYear;
    const parsedExamStudyYear =
      typeof examStudyYearRaw === 'number'
        ? examStudyYearRaw
        : typeof examStudyYearRaw === 'string' && examStudyYearRaw.trim().length > 0
          ? Number(examStudyYearRaw)
          : null;

    return {
      url: typeof (document as { url?: unknown }).url === 'string' ? (document as { url: string }).url : '',
      filename:
        typeof (document as { filename?: unknown }).filename === 'string'
          ? (document as { filename: string }).filename
          : '',
      semester:
        typeof (document as { semester?: unknown }).semester === 'string'
          ? (document as { semester: string }).semester
          : null,
      academicYear:
        typeof (document as { academicYear?: unknown }).academicYear === 'string'
          ? (document as { academicYear: string }).academicYear
          : null,
      examStudyYear: Number.isFinite(parsedExamStudyYear) ? Number(parsedExamStudyYear) : null,
      source:
        typeof (document as { source?: unknown }).source === 'string'
          ? (document as { source: string }).source
          : null,
    };
  },

  normalizeSpecialScheduleResponse(
    type: SpecialScheduleType,
    groupName: string | null,
    payload: any
  ): SpecialScheduleResponse {
    const rawGroup = typeof payload?.group === 'string' && payload.group.trim().length > 0
      ? payload.group.trim()
      : groupName;
    const resolvedType: SpecialScheduleType = payload?.type === 'exam' ? 'exam' : type;
    const rawEvents = Array.isArray(payload?.events) ? payload.events : [];

    const events: SpecialScheduleEvent[] = rawEvents
      .map((event: any): SpecialScheduleEvent | null => {
        if (!event || typeof event !== 'object') return null;

        const base = {
          group: typeof event.group === 'string' ? event.group : rawGroup || '',
          date: typeof event.date === 'string' ? event.date : '',
          subject: typeof event.subject === 'string' ? event.subject : '',
          teacher: typeof event.teacher === 'string' ? event.teacher : '',
          room: typeof event.room === 'string' ? event.room : '',
          subgroup: typeof event.subgroup === 'string' && event.subgroup.trim().length > 0 ? event.subgroup.trim() : null,
        };

        if (!base.date || !base.subject) return null;

        if (resolvedType === 'exam') {
          return {
            ...base,
            type: 'exam',
            time: typeof event.time === 'string' && event.time.trim().length > 0 ? event.time : null,
          };
        }

        const rawPeriod = typeof event.period === 'number'
          ? event.period
          : typeof event.period === 'string' && event.period.trim().length > 0
            ? Number(event.period)
            : null;

        return {
          ...base,
          type: 'thesis',
          period: Number.isFinite(rawPeriod) ? Number(rawPeriod) : null,
          startTime: typeof event.startTime === 'string' && event.startTime.trim().length > 0 ? event.startTime : null,
          endTime: typeof event.endTime === 'string' && event.endTime.trim().length > 0 ? event.endTime : null,
        };
      })
      .filter((event: SpecialScheduleEvent | null): event is SpecialScheduleEvent => Boolean(event));

    const warnings = Array.isArray(payload?.warnings)
      ? payload.warnings.filter((warning: unknown): warning is string => typeof warning === 'string')
      : [];

    return {
      available: Boolean(payload?.available),
      type: resolvedType,
      group: rawGroup,
      document: this.normalizeSpecialScheduleDocument(payload?.document),
      events,
      reasonCode: typeof payload?.reasonCode === 'string' ? payload.reasonCode : null,
      reason: typeof payload?.reason === 'string' ? payload.reason : null,
      warnings,
    };
  },

  async readSpecialScheduleCache(
    type: SpecialScheduleType,
    groupName?: string,
    enforceExpiry: boolean = true
  ): Promise<SpecialScheduleResponse | null> {
    try {
      const normalizedGroup = this.normalizeSpecialScheduleGroupName(groupName);
      const cacheKey = this.getSpecialScheduleCacheKey(type, groupName);
      const lastFetchKey = this.getSpecialScheduleLastFetchKey(type, groupName);
      const [cachedRaw, lastFetchRaw] = await Promise.all([
        AsyncStorage.getItem(cacheKey),
        AsyncStorage.getItem(lastFetchKey),
      ]);

      if (!cachedRaw) return null;

      if (enforceExpiry) {
        if (!lastFetchRaw) return null;
        const lastFetchMs = new Date(lastFetchRaw).getTime();
        if (!Number.isFinite(lastFetchMs)) return null;
        if (Date.now() - lastFetchMs > SPECIAL_SCHEDULE_CACHE_EXPIRY) {
          return null;
        }
      }

      const parsed = JSON.parse(cachedRaw);
      return this.normalizeSpecialScheduleResponse(type, normalizedGroup || null, parsed);
    } catch (error) {
      this.log('Failed to read special schedule cache', error);
      return null;
    }
  },

  async cacheSpecialSchedule(type: SpecialScheduleType, groupName: string | undefined, data: SpecialScheduleResponse): Promise<void> {
    try {
      const cacheKey = this.getSpecialScheduleCacheKey(type, groupName);
      const lastFetchKey = this.getSpecialScheduleLastFetchKey(type, groupName);
      await Promise.all([
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)),
        AsyncStorage.setItem(lastFetchKey, new Date().toISOString()),
      ]);
    } catch (error) {
      this.log('Failed to cache special schedule', error);
    }
  },

  async getSpecialSchedule(
    type: SpecialScheduleType,
    groupName?: string,
    forceRefresh: boolean = false
  ): Promise<SpecialScheduleResponse> {
    await this.ready();
    const normalizedGroup = this.normalizeSpecialScheduleGroupName(
      groupName || this.settings.selectedGroupName
    );
    const sessionKey = this.getSpecialScheduleSessionKey(type, normalizedGroup);

    if (this.specialScheduleFetchedThisSession.has(sessionKey)) {
      const cached = await this.readSpecialScheduleCache(type, normalizedGroup, false);
      if (cached) {
        return cached;
      }
    }

    if (!forceRefresh) {
      const freshCached = await this.readSpecialScheduleCache(type, normalizedGroup, true);
      if (freshCached) {
        return freshCached;
      }
    }

    const endpoint = type === 'exam' ? '/api/schedule/exams' : '/api/schedule/theses';
    const params = new URLSearchParams();
    if (normalizedGroup) {
      params.append('group', normalizedGroup);
    }

    const requestPath = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    try {
      const response = await fetchCustomApi(requestPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} schedule: ${response.status}`);
      }

      const payload = await response.json();
      const normalized = this.normalizeSpecialScheduleResponse(type, normalizedGroup || null, payload);
      await this.cacheSpecialSchedule(type, normalizedGroup, normalized);
      this.specialScheduleFetchedThisSession.add(sessionKey);
      return normalized;
    } catch (error) {
      const staleCached = await this.readSpecialScheduleCache(type, normalizedGroup, false);
      if (staleCached) {
        return staleCached;
      }

      const message = error instanceof Error ? error.message : `Unable to fetch ${type} schedule`;
      return this.buildUnavailableSpecialSchedule(type, normalizedGroup || null, 'fetch_failed', message);
    }
  },

  async getExamAndThesisSchedule(groupName?: string, forceRefresh: boolean = false): Promise<{
    thesis: SpecialScheduleResponse;
    exam: SpecialScheduleResponse;
  }> {
    const [thesis, exam] = await Promise.all([
      this.getSpecialSchedule('thesis', groupName, forceRefresh),
      this.getSpecialSchedule('exam', groupName, forceRefresh),
    ]);

    return { thesis, exam };
  },

  async getCachedSpecialSchedule(type: SpecialScheduleType, groupName?: string): Promise<SpecialScheduleResponse> {
    await this.ready();
    const normalizedGroup = this.normalizeSpecialScheduleGroupName(
      groupName || this.settings.selectedGroupName
    );
    const cached = await this.readSpecialScheduleCache(type, normalizedGroup, false);
    if (cached) return cached;
    return this.buildUnavailableSpecialSchedule(
      type,
      normalizedGroup || null,
      'cache_miss',
      'Special schedule is not cached yet'
    );
  },

  async getCachedExamAndThesisSchedule(groupName?: string): Promise<{
    thesis: SpecialScheduleResponse;
    exam: SpecialScheduleResponse;
  }> {
    const [thesis, exam] = await Promise.all([
      this.getCachedSpecialSchedule('thesis', groupName),
      this.getCachedSpecialSchedule('exam', groupName),
    ]);
    return { thesis, exam };
  },

  async prewarmSpecialSchedules(forceRefresh: boolean = true, groupName?: string): Promise<{
    thesis: SpecialScheduleResponse;
    exam: SpecialScheduleResponse;
  }> {
    await this.ready();
    const resolvedGroup = this.normalizeSpecialScheduleGroupName(
      groupName || this.settings.selectedGroupName
    );
    if (!resolvedGroup) {
      return {
        thesis: this.buildUnavailableSpecialSchedule('thesis', null, 'group_missing', 'No group selected'),
        exam: this.buildUnavailableSpecialSchedule('exam', null, 'group_missing', 'No group selected'),
      };
    }
    return this.getExamAndThesisSchedule(resolvedGroup, forceRefresh);
  },

  async getPeriodTimes(): Promise<DatePeriodTimesEntry | null> {
    const today = new Date();
    return this.getDatePeriodTimes(today);
  },

  async getDatePeriodTimes(date: Date): Promise<DatePeriodTimesEntry | null> {
    const dateKey = this.getDateKey(date);
    try {
      const cachedEntry = this.getCachedDatePeriodEntry(dateKey);
      if (cachedEntry) {
        return cachedEntry;
      }

      await this.syncPeriodTimesForDate(date, false);
      return this.getCachedDatePeriodEntry(dateKey);
    } catch {
      // Fallback to cached date if network fetch fails.
      return this.getCachedDatePeriodEntry(dateKey);
    }
  },

  async syncPeriodTimesForDate(date: Date, force: boolean = false): Promise<void> {
    const dateKey = this.getDateKey(date);

    if (!force && this.getScopedDatePeriodEntry(dateKey)) {
      return;
    }

    await this.syncPeriodTimesForWeek(date, 0, force);
  },

  async syncPeriodTimesForWeek(anchorDate: Date, weekOffset: number = 0, force: boolean = false): Promise<void> {
    if (!force && this.hasWeekInDatePeriodCache(anchorDate, weekOffset)) {
      return;
    }

    if (!force && PERIOD_SYNC_INTERVAL > 0) {
      const lastSync = await AsyncStorage.getItem(LAST_PERIOD_SYNC_KEY);
      if (lastSync) {
        const lastSyncTime = new Date(lastSync).getTime();
        if (Date.now() - lastSyncTime < PERIOD_SYNC_INTERVAL) {
          return;
        }
      }
    }

    const params = new URLSearchParams({
      anchor_date: this.getDateKey(anchorDate),
      week_offset: String(weekOffset)
    });
    if (this.settings.selectedGroupId) {
      params.append('group_id', this.settings.selectedGroupId);
    }

    const response = await fetchCustomApi(`/api/schedule/week?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch weekly period times');

    const weekResponse: WeekScheduleResponse = await response.json();
    this.mergeWeekPeriodTimes(weekResponse);

    await Promise.all([
      AsyncStorage.setItem(PERIOD_TIMES_CACHE_KEY, JSON.stringify(this.cachedDatePeriodTimes)),
      AsyncStorage.setItem(CACHE_KEYS.RECOVERY_DAYS, JSON.stringify(this.cachedRecoveryDays)),
      AsyncStorage.setItem(LAST_PERIOD_SYNC_KEY, new Date().toISOString())
    ]);

    this.log('Date-based period times synced for week', this.getDateKey(anchorDate), weekOffset);
  },

  async syncPeriodTimes(force: boolean = false): Promise<void> {
    try {
      await this.syncPeriodTimesForWeek(new Date(), 0, force);
    } catch (error) {
      this.log('Period times sync failed (using CEITI fallback)');
    }
  },

  async clearPeriodTimesCache(): Promise<void> {
    this.cachedDatePeriodTimes = {};
    this.cachedRecoveryDays = [];
    await Promise.all([
      AsyncStorage.removeItem(PERIOD_TIMES_CACHE_KEY),
      AsyncStorage.removeItem(CACHE_KEYS.RECOVERY_DAYS),
      AsyncStorage.removeItem(LAST_PERIOD_SYNC_KEY)
    ]);
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
      await this.syncPeriodTimes();
      this.cachedRecoveryDays = this.buildRecoveryDaysFromDatePeriodTimes();
      return this.cachedRecoveryDays;
    } catch (error) {
      // Silent error handling
      return [];
    }
  },

  async syncRecoveryDays(force: boolean = false): Promise<void> {
    try {
      await this.syncPeriodTimes(force);
      this.cachedRecoveryDays = this.buildRecoveryDaysFromDatePeriodTimes();
      await AsyncStorage.setItem(CACHE_KEYS.RECOVERY_DAYS, JSON.stringify(this.cachedRecoveryDays));
      await AsyncStorage.setItem(CACHE_KEYS.LAST_RECOVERY_SYNC, new Date().toISOString());
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
    const dateString = this.getDateKey(date);
    
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
    if (!dayName && !date) return [];

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

    // Validate input data structure
    if (!data || !data.data || typeof data.data !== 'object') {
      this.log('Invalid data structure in getScheduleForDay');
      return result;
    }

    const datePeriodTimes = date ? await this.getDatePeriodTimes(date) : null;
    const effectiveDateSchedule = Array.isArray(datePeriodTimes?.schedule) ? datePeriodTimes.schedule : null;
    const allowedDatePeriods = effectiveDateSchedule
      ? new Set(effectiveDateSchedule.map(period => String(period.index + 1)))
      : null;
    const replacedDayName =
      datePeriodTimes?.override?.replaceWeekday ||
      datePeriodTimes?.override?.recoverySource?.weekday ||
      undefined;
    const overrideReason = this.buildOverrideInfoMessage(datePeriodTimes);
    let overrideInfoAdded = false;

    const addOverrideInfoIfNeeded = () => {
      if (overrideInfoAdded || !overrideReason) {
        return;
      }

      result.push({
        period: 'recovery-info',
        startTime: '00:00',
        endTime: '00:01',
        className: `Schedule Override: ${overrideReason}`,
        teacherName: '',
        roomNumber: '',
        isCustom: true,
        color: '#FF5733',
        isRecoveryDay: Boolean(datePeriodTimes?.isWeekend && datePeriodTimes?.isOverride),
        recoveryReason: overrideReason,
        replacedDayName,
        assignmentCount: 0 // Recovery info never has assignments
      });

      overrideInfoAdded = true;
    };

    let daySchedule: { [key: string]: DaySchedule } | undefined;

    if (typeof dayName === 'string' && dayName.startsWith('weekend_') && data.data[dayName]) {
      daySchedule = data.data[dayName];
    }

    if (!daySchedule) {
      let effectiveDayName: keyof ApiResponse['data'] | undefined;

      // Primary: resolve by actual date and custom API metadata.
      if (datePeriodTimes?.override?.mode === 'weekday_replace' && datePeriodTimes.override.replaceWeekday) {
        effectiveDayName = this.normalizeWeekdayKey(datePeriodTimes.override.replaceWeekday);
      }

      // Recovery weekends often reuse another weekday's classes.
      if (!effectiveDayName && datePeriodTimes?.override?.recoverySource?.weekday) {
        effectiveDayName = this.normalizeWeekdayKey(datePeriodTimes.override.recoverySource.weekday);
      }

      if (!effectiveDayName && datePeriodTimes?.override?.replaceWeekday) {
        effectiveDayName = this.normalizeWeekdayKey(datePeriodTimes.override.replaceWeekday);
      }

      if (!effectiveDayName && datePeriodTimes?.weekday) {
        effectiveDayName = this.normalizeWeekdayKey(datePeriodTimes.weekday);
      }

      if (!effectiveDayName && date) {
        effectiveDayName = this.getWeekdayKeyForDate(date);
      }

      // Secondary: explicit caller-provided day key.
      if (!effectiveDayName && typeof dayName === 'string' && !dayName.startsWith('weekend_')) {
        effectiveDayName = this.normalizeWeekdayKey(dayName);
      }

      if (effectiveDayName) {
        daySchedule = data.data[effectiveDayName];
      }
    }

    // Convert the date to a dateKey for assignment filtering
    const dateKey = date ? format(date, 'yyyy-MM-dd') : '';
    addOverrideInfoIfNeeded();

    if ((!daySchedule || typeof daySchedule !== 'object') && effectiveDateSchedule?.length) {
      effectiveDateSchedule.forEach(period => {
        addOverrideInfoIfNeeded();

        const periodId = String(period.index + 1);
        let assignmentCount = 0;

        if (data.assignmentCounts && dateKey) {
          const countByPeriod = data.assignmentCounts.find(ac =>
            ac.periodId === periodId && ac.dateKey === dateKey
          );
          if (countByPeriod) {
            assignmentCount = countByPeriod.count;
          }
        }

        result.push({
          period: periodId,
          startTime: period.start,
          endTime: period.end,
          className: `Period ${period.index + 1}`,
          teacherName: '',
          roomNumber: '',
          isRecoveryDay: Boolean(datePeriodTimes?.isWeekend && datePeriodTimes?.isOverride),
          recoveryReason: datePeriodTimes?.override?.reason,
          replacedDayName,
          assignmentCount
        });
      });
    }

    // Process each period synchronously since we already have all the data
    Object.entries(daySchedule || {}).forEach(([periodNum, schedules]) => {
      if (allowedDatePeriods && !allowedDatePeriods.has(periodNum)) {
        return;
      }

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

        // Use date-resolved period times from custom API first, then fall back to CEITI.
        let startTime = '';
        let endTime = '';

        const periodIndex = parseInt(periodNum, 10) - 1;
        const datePeriod = datePeriodTimes?.schedule.find((p: PeriodTime) => p.index === periodIndex);
        if (datePeriod) {
          startTime = datePeriod.start;
          endTime = datePeriod.end;
        }
        
        // Fall back to original period times if custom times not available
        if (!startTime || !endTime) {
          if (data.periods && data.periods[periodIndex]) {
            const periodData = data.periods[periodIndex];
            startTime = periodData.starttime;
            endTime = periodData.endtime;
          }
        }

        // Add info banner when the selected date has an active override reason.
        addOverrideInfoIfNeeded();

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
          isRecoveryDay: Boolean(datePeriodTimes?.isWeekend && datePeriodTimes?.isOverride),
          recoveryReason: datePeriodTimes?.override?.reason,
          replacedDayName,
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
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const diffWeeks = Math.floor((date.getTime() - REFERENCE_DATE.getTime()) / weekMs);
    return diffWeeks % 2 === 0;
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
      this.settings.customPeriods[index] = {
        ...this.settings.customPeriods[index],
        ...updates
      };
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
    this.specialScheduleFetchedThisSession.clear();
    
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
  
  isScheduleDataEmpty(data: ApiResponse | null): boolean {
    if (!data || !data.data) return true;

    return !Object.values(data.data).some(daySchedule => {
      if (!daySchedule || typeof daySchedule !== 'object') return false;

      return Object.values(daySchedule).some((periodSet: any) => {
        if (!periodSet || typeof periodSet !== 'object') return false;

        return ['both', 'par', 'impar'].some(key => Array.isArray(periodSet[key]) && periodSet[key].length > 0);
      });
    });
  },
  
  // Force refresh schedule regardless of cache age; fallback to cached when offline or failure
  async refreshSchedule(force: boolean = true): Promise<ApiResponse | null> {
    try {
      await this.ready();

      if (force) {
        await this.clearPeriodTimesCache();
      }

      // Ensure we have a selected group; attempt to find default if missing
      if (!this.settings.selectedGroupId) {
        await this.findAndSetDefaultGroup();
      }
      let groupId = this.settings.selectedGroupId;
      if (!groupId) return null;

      const hasInternet = await this.hasInternetConnection();
      if (!hasInternet) {
        // Offline: return cached data if present
        const cached = await this.getCachedSchedule(groupId);
        this.markScheduleRefreshed();
        return cached ? this.transformScheduleData(cached) : null;
      }

      // Online: attempt fresh fetch (always, per requirement)
      try {
        await Promise.all([
          this.syncPeriodTimes(true)
        ]);
        let fresh = await this.fetchAndCacheSchedule(groupId);
        let transformed = this.transformScheduleData(fresh);
        const targetGroupName = this.settings.selectedGroupName;

        // If the schedule comes back empty, try realigning group ID from a refreshed list and retry once
        if (this.isScheduleDataEmpty(transformed) && targetGroupName) {
          try {
            const groups = await this.refreshGroups(true);
            const matchingGroup = groups.find(g => g.name === targetGroupName);

            if (matchingGroup && matchingGroup._id !== groupId) {
              groupId = matchingGroup._id;
              await this.findAndSetDefaultGroup(targetGroupName, groups);
              fresh = await this.fetchAndCacheSchedule(groupId);
              transformed = this.transformScheduleData(fresh);
            }
          } catch (retryError) {
            this.log('Retry with refreshed group list failed', retryError);
          }
        }
        
        // Notify listeners with an explicit refresh version bump.
        this.markScheduleRefreshed();
        
        return transformed;
      } catch (err) {
        // On failure, fallback to cache
        const cached = await this.getCachedSchedule(groupId);
        this.markScheduleRefreshed();
        return cached ? this.transformScheduleData(cached) : null;
      }
    } catch (error) {
      // Final fallback
      try {
        if (this.settings.selectedGroupId) {
          const cached = await this.getCachedSchedule(this.settings.selectedGroupId);
          this.markScheduleRefreshed();
          return cached ? this.transformScheduleData(cached) : null;
        }
      } catch (_) { /* silent */ }
      this.markScheduleRefreshed();
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
      await this.ready();
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
    const [cachedRecoveryDays, cachedPeriodTimes, cachedSubjects, cachedAssignmentCounts] = await Promise.all([
      AsyncStorage.getItem(CACHE_KEYS.RECOVERY_DAYS),
      AsyncStorage.getItem(PERIOD_TIMES_CACHE_KEY),
      AsyncStorage.getItem(CACHE_KEYS.SUBJECTS),
      AsyncStorage.getItem(CACHE_KEYS.ASSIGNMENT_COUNTS)
    ]);
    if (cachedRecoveryDays) this.cachedRecoveryDays = JSON.parse(cachedRecoveryDays);
    if (cachedPeriodTimes) this.cachedDatePeriodTimes = JSON.parse(cachedPeriodTimes);
    if (cachedSubjects) this.cachedSubjects = JSON.parse(cachedSubjects);
    if (cachedAssignmentCounts) this.cachedAssignmentCounts = JSON.parse(cachedAssignmentCounts);
    if (!cachedRecoveryDays) this.cachedRecoveryDays = this.buildRecoveryDaysFromDatePeriodTimes();
    await this.ensureSelectedGroup();
    // Perform initial sync after selected group is resolved.
    await this.syncPeriodTimes(true);
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
