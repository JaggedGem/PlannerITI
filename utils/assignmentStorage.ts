import { format, isSameDay, isToday, isTomorrow, parseISO } from 'date-fns';

import * as Crypto from 'expo-crypto';

import type { Translate } from '@/hooks/useTranslation';
import { Assignment, AssignmentGroup, Subtask } from '@/types/assignment';

import { Period, PeriodAssignmentCount, scheduleService } from '../services/scheduleService';
import { filterAssignments, matchesAssignmentClass } from './assignmentFiltering';
import {
  mutateAssignments,
  readStoredAssignments,
  writeStoredAssignments,
} from './assignmentRepository';
import {
  cancelForDeletedAssignment,
  handleCompletionStateChange,
  scheduleForNewAssignment,
  updateNotificationsForUpdatedAssignment,
} from './notificationHelper';

export { AssignmentType } from '@/types/assignment';
export type { Assignment, AssignmentGroup, Subtask } from '@/types/assignment';

// Get all assignments
export const getAssignments = async (): Promise<Assignment[]> => {
  try {
    return await readStoredAssignments();
  } catch (error) {
    console.error('Error getting assignments:', error);
    return [];
  }
};

// Save assignments
export const saveAssignments = writeStoredAssignments;

// Helper function to update assignment counts in schedule service
const updateAssignmentCountsInSchedule = async () => {
  try {
    const assignments = await getAssignments();

    // Only include non-completed assignments in the counts
    const activeAssignments = assignments.filter((a) => !a.isCompleted);

    // Group assignments by date
    const assignmentsByDate = new Map<string, Assignment[]>();

    // First group assignments by due date
    activeAssignments.forEach((assignment) => {
      const dueDate = new Date(assignment.dueDate);
      const dateKey = format(dueDate, 'yyyy-MM-dd');

      if (!assignmentsByDate.has(dateKey)) {
        assignmentsByDate.set(dateKey, []);
      }

      assignmentsByDate.get(dateKey)?.push(assignment);
    });

    // Create the final counts array with date information
    const counts: PeriodAssignmentCount[] = [];

    // Process each date's assignments
    assignmentsByDate.forEach((dateAssignments, dateKey) => {
      // Create maps for period and course counts for this date
      const periodCounts = new Map<string, number>();
      const courseCounts = new Map<string, number>();

      // Count assignments by period and course for this date
      dateAssignments.forEach((assignment) => {
        // Count by period if available
        if (assignment.periodId) {
          const current = periodCounts.get(assignment.periodId) || 0;
          periodCounts.set(assignment.periodId, current + 1);
        }

        // Count by course code
        const current = courseCounts.get(assignment.courseCode) || 0;
        courseCounts.set(assignment.courseCode, current + 1);
      });

      // Add period-based counts with date information
      periodCounts.forEach((count, periodId) => {
        counts.push({
          periodId,
          courseCode: '',
          count,
          dateKey, // Add date information
        });
      });

      // Add course-based counts with date information
      courseCounts.forEach((count, courseCode) => {
        counts.push({
          periodId: '',
          courseCode,
          count,
          dateKey, // Add date information
        });
      });
    });

    // Update counts in schedule service
    await scheduleService.updateAssignmentCounts(counts);
  } catch (error) {
    console.error('Error updating assignment counts:', error);
  }
};

export const addAssignment = async (
  assignment: Omit<Assignment, 'id' | 'isCompleted'>,
): Promise<Assignment> => {
  const newAssignment: Assignment = {
    ...assignment,
    id: Crypto.randomUUID(),
    isCompleted: false,
    subtasks: assignment.subtasks || [],
  };
  await mutateAssignments((assignments) => assignments.push(newAssignment));
  await scheduleForNewAssignment(newAssignment);
  await updateAssignmentCountsInSchedule();
  return newAssignment;
};

export const toggleAssignmentCompletion = async (id: string): Promise<void> => {
  const result = await mutateAssignments((assignments) => {
    const assignment = assignments.find((item) => item.id === id);
    if (!assignment) return null;
    const wasCompleted = assignment.isCompleted;
    assignment.isCompleted = !wasCompleted;
    if (!wasCompleted) {
      assignment.subtasks = assignment.subtasks?.map((subtask) => ({
        ...subtask,
        isCompleted: true,
      }));
    }
    return { assignment, wasCompleted };
  });
  if (!result) return;
  await handleCompletionStateChange(result.assignment, result.wasCompleted, id);
  await updateAssignmentCountsInSchedule();
};

export const deleteAssignment = async (id: string): Promise<void> => {
  await mutateAssignments((assignments) => {
    const index = assignments.findIndex((assignment) => assignment.id === id);
    if (index !== -1) assignments.splice(index, 1);
  });
  await cancelForDeletedAssignment(id);
  await updateAssignmentCountsInSchedule();
};

export const updateAssignment = async (id: string, updates: Partial<Assignment>): Promise<void> => {
  const updated = await mutateAssignments((assignments) => {
    const index = assignments.findIndex((assignment) => assignment.id === id);
    if (index === -1) return null;
    const assignment = { ...assignments[index], ...updates, id };
    assignments[index] = assignment;
    return assignment;
  });
  if (!updated) return;
  await updateNotificationsForUpdatedAssignment(id, updated);
  await updateAssignmentCountsInSchedule();
};

// Group assignments by date
export const groupAssignmentsByDate = (
  assignments: Assignment[],
  t?: Translate,
  formatDate?: (date: Date, options: Intl.DateTimeFormatOptions) => string,
): AssignmentGroup[] => {
  // Create a map to group assignments by date
  const groupMap: Map<string, Assignment[]> = new Map();

  // Sort assignments by due date
  const sortedAssignments = [...assignments].sort((a, b) => {
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  // Group assignments by day
  sortedAssignments.forEach((assignment) => {
    const dueDate = new Date(assignment.dueDate);
    const dateKey = format(dueDate, 'yyyy-MM-dd');

    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, []);
    }

    groupMap.get(dateKey)?.push(assignment);
  });

  // Convert map to array of groups
  const groups: AssignmentGroup[] = [];

  groupMap.forEach((assignmentsForDate, dateKey) => {
    const date = parseISO(dateKey);
    let title;
    let formattedDate;

    // If translations are provided, use them
    if (t) {
      // Special handling for today and tomorrow
      if (isToday(date)) {
        title = t('assignments').days.today;
      } else if (isTomorrow(date)) {
        title = t('assignments').days.tomorrow;
      } else {
        // Get the day of the week
        const dayOfWeek = t('weekdays').long[date.getDay()];
        // Get the month
        const month = t('months')[date.getMonth()];
        // Format as "Day, Month Day"
        title = `${dayOfWeek}, ${month} ${date.getDate()}`;
      }

      // Format the date with localization if formatDate is provided
      if (formatDate) {
        formattedDate = formatDate(date, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } else {
        formattedDate = format(date, 'MMMM d, yyyy');
      }
    } else {
      // Fallback to English formats if no translations are provided
      title = format(date, 'EEEE, MMM d');
      if (isToday(date)) {
        title = 'Today';
      } else if (isTomorrow(date)) {
        title = 'Tomorrow';
      }
      formattedDate = format(date, 'MMMM d, yyyy');
    }

    groups.push({
      title,
      date: formattedDate,
      assignments: assignmentsForDate,
    });
  });

  return groups;
};

// Get all course names and codes
export const getCourses = async (): Promise<{ code: string; name: string }[]> => {
  const assignments = await getAssignments();

  // Create a map to deduplicate courses
  const coursesMap = new Map<string, { code: string; name: string }>();

  assignments.forEach((assignment) => {
    if (!coursesMap.has(assignment.courseCode)) {
      coursesMap.set(assignment.courseCode, {
        code: assignment.courseCode,
        name: assignment.courseName,
      });
    }
  });

  // Convert map to array
  return Array.from(coursesMap.values());
};

// Get all periods from schedule service
export const getSchedulePeriods = async (): Promise<Period[]> => {
  try {
    // Get the current selected group ID from scheduleService
    const { selectedGroupId } = scheduleService.getSettings();

    // Fetch the schedule for the selected group
    const scheduleData = await scheduleService.getClassSchedule(selectedGroupId);

    // Return the periods from the schedule data
    return scheduleData.periods || [];
  } catch (error) {
    console.error('Error getting schedule periods:', error);
    return [];
  }
};

// Get a formatted list of periods for the assignment form
export const getFormattedPeriods = async (): Promise<{ label: string; value: string }[]> => {
  const periods = await getSchedulePeriods();

  return periods.map((period) => ({
    label: `Period ${period._id}: ${period.starttime} - ${period.endtime}`,
    value: period._id,
  }));
};

// Get period by ID
export const getPeriodById = async (periodId: string): Promise<Period | undefined> => {
  const periods = await getSchedulePeriods();
  return periods.find((period) => period._id === periodId);
};

// Get assignments for a specific period
export const getAssignmentsForPeriod = async (
  periodId: string,
  date?: Date,
): Promise<Assignment[]> => {
  try {
    const assignments = await getAssignments();

    return assignments.filter((assignment) => {
      // First check if this assignment is for this period
      const periodMatch = assignment.periodId === periodId;
      if (!periodMatch) return false;

      // If date filter is provided, check if assignment is due on that date
      if (date) {
        const assignmentDate = new Date(assignment.dueDate);
        if (!isSameDay(assignmentDate, date)) {
          return false;
        }
      }

      // Don't show completed assignments in the schedule view
      return !assignment.isCompleted;
    });
  } catch (error) {
    console.error('Error getting assignments for period:', error);
    return [];
  }
};

// Get assignments for a specific course on a specific date
export const getAssignmentsForCourseAndDate = async (
  courseCode: string,
  date: Date,
): Promise<Assignment[]> => {
  try {
    const assignments = await getAssignments();
    const dateString = format(date, 'yyyy-MM-dd');

    return assignments.filter(
      (assignment) =>
        assignment.courseCode === courseCode &&
        format(new Date(assignment.dueDate), 'yyyy-MM-dd') === dateString &&
        !assignment.isCompleted,
    );
  } catch (error) {
    console.error('Error getting assignments for course and date:', error);
    return [];
  }
};

// Reconcile subjects against the latest persisted assignments, preserving concurrent edits.
export const handleGroupChange = async (groupId?: string): Promise<boolean> => {
  try {
    const subjects = await scheduleService.refreshSubjects(groupId);
    // A failed/offline refresh also returns an empty list; preserve assignments in that case.
    if (subjects.length === 0) return false;
    const subjectIds = new Set(subjects.map((subject) => subject.id));
    const subjectByName = new Map(
      subjects.map((subject) => [subject.name.trim().toLowerCase(), subject]),
    );
    return await mutateAssignments((assignments) => {
      let changed = false;
      for (let index = 0; index < assignments.length; index += 1) {
        const assignment = assignments[index];
        const idMatches = assignment.subjectId && subjectIds.has(assignment.subjectId);
        const matched = subjectByName.get(assignment.courseName.trim().toLowerCase());
        const isOrphaned = !idMatches && !matched;
        const subjectId = idMatches ? assignment.subjectId : (matched?.id ?? assignment.subjectId);
        if (Boolean(assignment.isOrphaned) !== isOrphaned || assignment.subjectId !== subjectId) {
          assignments[index] = { ...assignment, subjectId, isOrphaned };
          changed = true;
        }
      }
      return changed;
    });
  } catch (error) {
    console.error('Error reconciling assignment subjects:', error);
    return false;
  }
};

// Export the update function so it can be called from assignments.tsx
export const refreshAssignmentCounts = async (): Promise<void> => {
  await updateAssignmentCountsInSchedule();
};

export const addSubtask = async (assignmentId: string, title: string): Promise<Subtask | null> =>
  mutateAssignments((assignments) => {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment) return null;
    const subtask: Subtask = { id: Crypto.randomUUID(), title, isCompleted: false };
    assignment.subtasks = [...(assignment.subtasks || []), subtask];
    return subtask;
  });

export const toggleSubtaskCompletion = async (
  assignmentId: string,
  subtaskId: string,
): Promise<void> => {
  await mutateAssignments((assignments) => {
    const subtask = assignments
      .find((item) => item.id === assignmentId)
      ?.subtasks?.find((item) => item.id === subtaskId);
    if (subtask) subtask.isCompleted = !subtask.isCompleted;
  });
};

export const deleteSubtask = async (assignmentId: string, subtaskId: string): Promise<void> => {
  await mutateAssignments((assignments) => {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (assignment?.subtasks)
      assignment.subtasks = assignment.subtasks.filter((item) => item.id !== subtaskId);
  });
};

export const updateSubtask = async (
  assignmentId: string,
  subtaskId: string,
  updates: Partial<Subtask>,
): Promise<void> => {
  await mutateAssignments((assignments) => {
    const subtask = assignments
      .find((item) => item.id === assignmentId)
      ?.subtasks?.find((item) => item.id === subtaskId);
    if (subtask) Object.assign(subtask, updates, { id: subtaskId });
  });
};

export const updateAllSubtaskCompletion = async (
  assignmentId: string,
  isCompleted: boolean,
): Promise<void> => {
  await mutateAssignments((assignments) => {
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (assignment?.subtasks)
      assignment.subtasks = assignment.subtasks.map((subtask) => ({ ...subtask, isCompleted }));
  });
};

export const getSubtasksForAssignment = async (assignmentId: string): Promise<Subtask[]> => {
  const assignments = await getAssignments();
  return assignments.find((assignment) => assignment.id === assignmentId)?.subtasks || [];
};

interface AssignmentTimeRange {
  startTime?: string;
  endTime?: string;
}

export const getFilteredAssignments = async (
  dateFilter?: Date | null,
  timeRange?: AssignmentTimeRange | null,
  subjectId?: string | null,
): Promise<Assignment[]> => {
  const assignments = await getAssignments();
  const periods = timeRange?.startTime || timeRange?.endTime ? await getSchedulePeriods() : [];
  return filterAssignments(assignments, periods, { date: dateFilter, ...timeRange, subjectId });
};

export const getAssignmentsForDate = async (
  date: Date,
  timeRange?: AssignmentTimeRange,
): Promise<Assignment[]> => {
  const assignments = await getFilteredAssignments(date, timeRange);
  return assignments.filter((assignment) => !assignment.isCompleted);
};

export const getAssignmentsForTimeRange = async (
  date: Date,
  startTime?: string,
  endTime?: string,
  subjectId?: string,
  courseCode?: string,
): Promise<Assignment[]> => {
  const assignments = await getAssignments();
  const periods = startTime || endTime ? await getSchedulePeriods() : [];
  return filterAssignments(assignments, periods, {
    date,
    startTime,
    endTime,
    subjectId,
    courseCode,
    incompleteOnly: true,
  });
};

export const getAssignmentsForClass = async (
  date: Date,
  subjectId: string,
  className: string,
  startTime?: string,
  endTime?: string,
): Promise<Assignment[]> => {
  const assignments = await getAssignmentsForTimeRange(date, startTime, endTime);
  return assignments.filter((assignment) =>
    matchesAssignmentClass(assignment, subjectId, className),
  );
};
