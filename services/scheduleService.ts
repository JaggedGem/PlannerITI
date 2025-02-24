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
const REFERENCE_DATE = new Date(2024, 8, 2);

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

  updateSettings(newSettings: Partial<UserSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.notifyListeners();
  },

  getSettings(): UserSettings {
    return { ...this.settings };
  },

  async getClassSchedule(classId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/orar?_id=${classId}&tip=class`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      throw error;
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

    return result.sort((a, b) => parseInt(a.period) - parseInt(b.period));
  },

  isEvenWeek(date: Date): boolean {
    const perWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.floor((date.valueOf() - REFERENCE_DATE.valueOf()) / perWeek + 1);
    return totalWeeks % 2 === 0;
  }
};

export const CLASS_ID = '6793abb21adedc068609b02b';