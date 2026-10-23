import { isSameDay } from 'date-fns';

import type { Period } from '@/services/scheduleService';
import type { Assignment } from '@/types/assignment';

import { timeToMinutes } from './time';

interface AssignmentFilter {
  date?: Date | null;
  startTime?: string;
  endTime?: string;
  subjectId?: string | null;
  courseCode?: string;
  incompleteOnly?: boolean;
}

export const filterAssignments = (
  assignments: Assignment[],
  periods: Period[],
  filter: AssignmentFilter,
): Assignment[] => {
  const start = filter.startTime ? timeToMinutes(filter.startTime) : null;
  const end = filter.endTime ? timeToMinutes(filter.endTime) : null;
  const periodById = new Map(periods.map((period) => [period._id, period]));

  return assignments.filter((assignment) => {
    if (filter.incompleteOnly && assignment.isCompleted) return false;
    if (filter.date && !isSameDay(new Date(assignment.dueDate), filter.date)) return false;
    if (
      (filter.subjectId || filter.courseCode) &&
      !(filter.subjectId && assignment.subjectId === filter.subjectId) &&
      !(filter.courseCode && assignment.courseCode === filter.courseCode)
    )
      return false;

    // Assignments without a period apply to the whole day.
    if (!assignment.periodId || (start === null && end === null)) return true;
    const period = periodById.get(assignment.periodId);
    if (!period) return false;
    const periodStart = timeToMinutes(period.starttime);
    const periodEnd = timeToMinutes(period.endtime);
    if (periodStart === null || periodEnd === null) return false;
    // Adjacent classes do not overlap.
    return (start === null || periodEnd > start) && (end === null || periodStart < end);
  });
};

export const matchesAssignmentClass = (
  assignment: Assignment,
  subjectId: string,
  className: string,
): boolean => {
  if (assignment.subjectId && subjectId) return assignment.subjectId === subjectId;
  const name = className.trim().toLowerCase();
  const courseName = assignment.courseName.trim().toLowerCase();
  const courseCode = assignment.courseCode.trim().toLowerCase();
  return Boolean(
    name &&
    ((courseName && courseName === name) ||
      (courseCode && courseCode === name.split(':')[0].trim())),
  );
};
