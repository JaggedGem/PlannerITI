import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDays,
  differenceInDays,
  format,
  isToday,
  parseISO,
  startOfDay,
} from 'date-fns';

import { scheduleService } from '@/services/scheduleService';
import { getAssignments } from '@/utils/assignmentStorage';
import { getNotificationSettings } from '@/utils/notificationUtils';

import type { Assignment } from '@/utils/assignmentStorage';
import type { Period, ScheduleItem } from '@/services/scheduleService';
import type { StudentGrades } from '@/services/gradesService';

export interface WidgetClassInfo {
  subjectName: string;
  teacher: string;
  room: string;
  startTime: string;
  endTime: string;
  isOngoing: boolean;
  periodIndex: number;
}

export interface WidgetDaySummary {
  date: string;
  dayName: string;
  isSchoolDay: boolean;
  isWeekend: boolean;
  classes: WidgetClassInfo[];
  currentClassIndex: number;
  nextClass: WidgetClassInfo | null;
  freeWindows: { start: string; end: string }[];
  academicPeriod: string;
}

export interface WidgetAssignmentItem {
  id: string;
  title: string;
  courseName: string;
  dueDate: string;
  dueDaysLeft: number;
  isUrgent: boolean;
  isSoon: boolean;
  isLater: boolean;
  assignmentType: string;
  isCompleted: boolean;
  isPriority: boolean;
}

export interface WidgetGradeImpact {
  subjectName: string;
  currentAverage: number;
  needToScore: number;
  targetAverage: number;
  grades: number[];
  isWeakest: boolean;
}

export interface WidgetNotificationItem {
  id: string;
  title: string;
  body: string;
  dueDate: string;
  daysUntilDue: number;
  type: string;
}

export interface WidgetExamInfo {
  subject: string;
  date: string;
  daysLeft: number;
  type: string;
  grade: string;
  needsAttention: boolean;
}

export interface WidgetEndOfDayData {
  totalClasses: number;
  completedTasks: number;
  totalTasks: number;
  tomorrowClasses: number;
  tomorrowTests: number;
  message: string;
}

const GRADES_CACHE_PREFIX = '@grades_cache_data_';

async function getGradesFromCache(): Promise<StudentGrades | null> {
  try {
    const idnp = await AsyncStorage.getItem('@planner_idnp');
    if (!idnp) return null;
    const cached = await AsyncStorage.getItem(`${GRADES_CACHE_PREFIX}${idnp}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export async function getWidgetAssignments(): Promise<WidgetAssignmentItem[]> {
  try {
    const assignments = await getAssignments();
    const now = new Date();
    const today = startOfDay(now);

    return assignments
      .filter((a: Assignment) => !a.isCompleted)
      .map((a: Assignment) => {
        const due = parseISO(a.dueDate);
        const daysLeft = differenceInDays(startOfDay(due), today);
        return {
          id: a.id,
          title: a.title,
          courseName: a.courseName,
          dueDate: a.dueDate,
          dueDaysLeft: daysLeft,
          isUrgent: daysLeft <= 1,
          isSoon: daysLeft > 1 && daysLeft <= 3,
          isLater: daysLeft > 3,
          assignmentType: a.assignmentType,
          isCompleted: a.isCompleted,
          isPriority: a.isPriority,
        };
      })
      .sort((a: WidgetAssignmentItem, b: WidgetAssignmentItem) => {
        const typeOrder: Record<string, number> = { Exam: 0, Project: 1, Test: 2, Quiz: 3, Lab: 4, Homework: 5, Essay: 6, Presentation: 7, Other: 8 };
        const aOrder = typeOrder[a.assignmentType] ?? 9;
        const bOrder = typeOrder[b.assignmentType] ?? 9;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.dueDaysLeft - b.dueDaysLeft;
      });
  } catch {
    return [];
  }
}

export async function getWidgetDaySummary(): Promise<WidgetDaySummary | null> {
  try {
    await scheduleService.ready();
    const settings = await scheduleService.getSettings();
    const groupId = settings.selectedGroupId;
    if (!groupId) return null;

    const response = await scheduleService.refreshSchedule(false);
    if (!response) return null;

    const now = new Date();
    const today = format(now, 'EEEE').toLowerCase();
    const todayDate = format(now, 'yyyy-MM-dd');

    const dayDataMap = response.data?.[today];
    if (!dayDataMap || typeof dayDataMap !== 'object') {
      return {
        date: todayDate,
        dayName: today,
        isSchoolDay: false,
        isWeekend: today === 'saturday' || today === 'sunday',
        classes: [],
        currentClassIndex: -1,
        nextClass: null,
        freeWindows: [],
        academicPeriod: 'weekend',
      };
    }

    const periods: Period[] = response.periods || [];
    const weekType = getWeekType(now);

    const allItems: ScheduleItem[] = [];
    for (const key of Object.keys(dayDataMap)) {
      const dd = dayDataMap[key];
      if (dd) {
        if (dd.par) allItems.push(...dd.par);
        if (dd.impar) allItems.push(...dd.impar);
        if (dd.both) allItems.push(...dd.both);
      }
    }

    const periodMap = new Map(periods.map((p: Period) => [p._id, p]));
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const subgroup = settings.group;

    const classes: WidgetClassInfo[] = allItems
      .filter((item: ScheduleItem) => {
        const weeks = item.cards?.weeks || '';
        if (weeks === 'par' && weekType !== 'odd') return false;
        if (weeks === 'impar' && weekType !== 'even') return false;
        const subgroupMatch = !item.groupids?.entireclass || item.groupids.entireclass === 'all' || item.groupids.entireclass === subgroup;
        return subgroupMatch;
      })
      .map((item: ScheduleItem) => {
        const periodObj = periodMap.get(item.cards?.period);
        const startTime = periodObj?.starttime || '';
        const endTime = periodObj?.endtime || '';
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        return {
          subjectName: item.subjectid?.name || 'Unknown',
          teacher: item.teacherids?.name || '',
          room: item.classroomids?.name || '',
          startTime,
          endTime,
          isOngoing: nowMinutes >= startMin && nowMinutes < endMin,
          periodIndex: startMin,
        };
      })
      .sort((a: WidgetClassInfo, b: WidgetClassInfo) => a.periodIndex - b.periodIndex);

    const currentClassIndex = classes.findIndex((c: WidgetClassInfo) => c.isOngoing);
    const nextClassIdx = classes.findIndex((c: WidgetClassInfo) => !c.isOngoing && c.periodIndex > nowMinutes);
    const nextClass = nextClassIdx >= 0 ? classes[nextClassIdx] : null;

    const freeWindows: { start: string; end: string }[] = [];
    for (let i = 0; i < classes.length - 1; i++) {
      if (classes[i].endTime && classes[i + 1].startTime) {
        const gapStart = classes[i].endTime;
        const gapEnd = classes[i + 1].startTime;
        const gapStartMin = parseInt(gapStart.split(':')[0]) * 60 + parseInt(gapStart.split(':')[1]);
        const gapEndMin = parseInt(gapEnd.split(':')[0]) * 60 + parseInt(gapEnd.split(':')[1]);
        const gapDuration = gapEndMin - gapStartMin;
        if (gapDuration >= 20) {
          freeWindows.push({ start: gapStart, end: gapEnd });
        }
      }
    }

    const isWeekend = today === 'saturday' || today === 'sunday';

    return {
      date: todayDate,
      dayName: today,
      isSchoolDay: classes.length > 0,
      isWeekend,
      classes,
      currentClassIndex,
      nextClass,
      freeWindows,
      academicPeriod: isWeekend ? 'weekend' : 'teaching',
    };
  } catch {
    return null;
  }
}

function getWeekType(date: Date): 'odd' | 'even' {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return weekNum % 2 === 0 ? 'even' : 'odd';
}

export function getMinutesUntilNextClass(classes: WidgetClassInfo[]): number {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const next = classes.find((c) => !c.isOngoing && c.periodIndex > nowMinutes);
  if (!next) return 0;
  return next.periodIndex - nowMinutes;
}

export async function getWidgetGradeImpact(): Promise<WidgetGradeImpact[]> {
  try {
    const gradesData = await getGradesFromCache();
    if (!gradesData?.currentGrades?.length) return [];

    const subjects: WidgetGradeImpact[] = [];
    for (const semester of gradesData.currentGrades) {
      for (const subject of semester.subjects) {
        const numericGrades = subject.grades
          .filter((g: string) => /^\d+$/.test(g))
          .map(Number);
        if (numericGrades.length === 0) continue;

        const currentAvg = numericGrades.reduce((a: number, b: number) => a + b, 0) / numericGrades.length;
        const targetAvg = Math.min(Math.ceil(currentAvg) + 1, 10);
        const needToScore = findGradeNeeded(numericGrades, targetAvg);

        subjects.push({
          subjectName: subject.name,
          currentAverage: Math.round(currentAvg * 100) / 100,
          needToScore,
          targetAverage: targetAvg,
          grades: numericGrades,
          isWeakest: false,
        });
      }
    }

    if (subjects.length > 0) {
      const sorted = [...subjects].sort((a, b) => a.currentAverage - b.currentAverage);
      sorted[0].isWeakest = true;
    }

    return subjects;
  } catch {
    return [];
  }
}

function findGradeNeeded(grades: number[], target: number): number {
  if (grades.length === 0) return target;
  const sum = grades.reduce((a, b) => a + b, 0);
  const needed = target * (grades.length + 1) - sum;
  return Math.max(1, Math.min(10, Math.round(needed * 10) / 10));
}

export async function getWidgetExams(): Promise<WidgetExamInfo[]> {
  try {
    const gradesData = await getGradesFromCache();
    if (!gradesData?.exams?.length) return [];

    const now = new Date();
    return gradesData.exams
      .filter((e: { isUpcoming?: boolean }) => e.isUpcoming !== false)
      .map((e: { name: string; type: string; grade: string; date?: string }) => {
        let examDate = now;
        if (e.date) {
          examDate = parseISO(e.date);
        } else {
          examDate = addDays(now, 14);
        }
        const daysLeft = differenceInDays(startOfDay(examDate), now);
        return {
          subject: e.name,
          date: format(examDate, 'yyyy-MM-dd'),
          daysLeft,
          type: e.type,
          grade: e.grade || 'TBD',
          needsAttention: daysLeft <= 7 && (!e.grade || e.grade === 'TBD'),
        };
      })
      .sort((a: WidgetExamInfo, b: WidgetExamInfo) => a.daysLeft - b.daysLeft);
  } catch {
    return [];
  }
}

export async function getWidgetEndOfDay(): Promise<WidgetEndOfDayData | null> {
  try {
    const summary = await getWidgetDaySummary();

    const allAssignments = await getAssignments();
    const todayTasks = allAssignments.filter((a: Assignment) => {
      if (!a.dueDate) return false;
      return isToday(parseISO(a.dueDate));
    });
    const completedTasks = todayTasks.filter((a: Assignment) => a.isCompleted).length;
    const totalTasks = todayTasks.length;

    const messages = [
      'Stay productive!',
      'Great work today!',
      'Keep up the momentum!',
      'You\'ve got this!',
      'Small steps lead to big wins!',
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];

    return {
      totalClasses: summary?.classes.length || 0,
      completedTasks,
      totalTasks,
      tomorrowClasses: 0,
      tomorrowTests: 0,
      message,
    };
  } catch {
    return null;
  }
}

export async function getWidgetNotifications(): Promise<WidgetNotificationItem[]> {
  try {
    const settings = await getNotificationSettings();
    if (!settings.enabled) return [];

    const assignments = await getAssignments();
    const now = new Date();
    const today = startOfDay(now);

    return assignments
      .filter((a: Assignment) => !a.isCompleted)
      .map((a: Assignment) => {
        const due = parseISO(a.dueDate);
        const daysUntilDue = differenceInDays(startOfDay(due), today);
        return {
          id: a.id,
          title: a.title,
          body: `${a.courseName} - ${a.assignmentType}`,
          dueDate: a.dueDate,
          daysUntilDue,
          type: a.assignmentType,
        };
      })
      .filter((n: WidgetNotificationItem) => n.daysUntilDue <= 7 && n.daysUntilDue >= 0)
      .sort((a: WidgetNotificationItem, b: WidgetNotificationItem) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function getTotalPendingAssignments(): Promise<number> {
  try {
    const assignments = await getAssignments();
    return assignments.filter((a: Assignment) => !a.isCompleted).length;
  } catch {
    return 0;
  }
}