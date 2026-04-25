import { format } from 'date-fns';
import {
  ExamScheduleEvent,
  SpecialScheduleEvent,
  SubGroupType,
  ThesisScheduleEvent,
} from '@/services/scheduleService';

const normalizeSubgroupValue = (value?: string | null): '1' | '2' | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === '1' || normalized.includes('grupa 1') || normalized.includes('subgroup 1')) {
    return '1';
  }
  if (normalized === '2' || normalized.includes('grupa 2') || normalized.includes('subgroup 2')) {
    return '2';
  }

  return null;
};

const normalizeSelectedSubgroup = (group: SubGroupType): '1' | '2' => (group === 'Subgroup 1' ? '1' : '2');

export const getSpecialScheduleDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

export const eventMatchesSelectedSubgroup = (eventSubgroup: string | null | undefined, selectedGroup: SubGroupType): boolean => {
  const normalizedEventSubgroup = normalizeSubgroupValue(eventSubgroup);
  if (!normalizedEventSubgroup) return true;
  return normalizedEventSubgroup === normalizeSelectedSubgroup(selectedGroup);
};

export const filterThesisEventsForDate = (
  events: ThesisScheduleEvent[],
  date: Date,
  selectedGroup: SubGroupType
): ThesisScheduleEvent[] => {
  const dateKey = getSpecialScheduleDateKey(date);
  return events.filter(
    (event) => event.date === dateKey && eventMatchesSelectedSubgroup(event.subgroup, selectedGroup)
  );
};

export const filterExamEventsForDate = (
  events: ExamScheduleEvent[],
  date: Date,
  selectedGroup: SubGroupType
): ExamScheduleEvent[] => {
  const dateKey = getSpecialScheduleDateKey(date);
  return events.filter(
    (event) => event.date === dateKey && eventMatchesSelectedSubgroup(event.subgroup, selectedGroup)
  );
};

export const thesisMatchesScheduleSlot = (
  thesis: ThesisScheduleEvent,
  slot: {
    period?: string | number | null;
    startTime?: string | null;
    endTime?: string | null;
    group?: string | null;
  },
  selectedGroup: SubGroupType
): boolean => {
  if (!eventMatchesSelectedSubgroup(thesis.subgroup, selectedGroup)) {
    return false;
  }

  const slotSubgroup = normalizeSubgroupValue(slot.group);
  const eventSubgroup = normalizeSubgroupValue(thesis.subgroup);
  if (slotSubgroup && eventSubgroup && slotSubgroup !== eventSubgroup) {
    return false;
  }

  const slotPeriod = slot.period !== undefined && slot.period !== null ? String(slot.period) : '';
  const thesisPeriod = thesis.period !== null && thesis.period !== undefined ? String(thesis.period) : '';
  if (slotPeriod && thesisPeriod && slotPeriod === thesisPeriod) {
    return true;
  }

  const slotStart = slot.startTime || '';
  const slotEnd = slot.endTime || '';
  if (slotStart && slotEnd && thesis.startTime && thesis.endTime) {
    return thesis.startTime === slotStart && thesis.endTime === slotEnd;
  }

  return false;
};

export const buildSpecialEventKey = (event: SpecialScheduleEvent): string => {
  const shared = `${event.type}-${event.date}-${event.subject}-${event.teacher}-${event.room}-${event.subgroup || ''}`;
  if (event.type === 'exam') {
    return `${shared}-${event.time || ''}`;
  }
  return `${shared}-${event.period ?? ''}-${event.startTime || ''}-${event.endTime || ''}`;
};

export const formatThesisTimeLabel = (event: ThesisScheduleEvent): string => {
  if (event.startTime && event.endTime) return `${event.startTime} - ${event.endTime}`;
  if (event.startTime) return event.startTime;
  return '';
};

export const formatExamTimeLabel = (event: ExamScheduleEvent): string => event.time || '';
