import AsyncStorage from '@react-native-async-storage/async-storage';

import { Assignment, AssignmentType, Subtask } from '@/types/assignment';

import { isRecord } from './json';

export const ASSIGNMENTS_STORAGE_KEY = 'assignments';

const isSubtask = (value: unknown): value is Subtask =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.title === 'string' &&
  typeof value.isCompleted === 'boolean';

/** Validate persisted data and migrate the assignment type used by older app versions. */
export const parseAssignments = (value: unknown): Assignment[] => {
  if (!Array.isArray(value)) throw new Error('Invalid assignments data');
  return value.map((entry: unknown) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.title !== 'string' ||
      typeof entry.dueDate !== 'string' ||
      !Number.isFinite(Date.parse(entry.dueDate))
    ) {
      throw new Error('Invalid assignment entry');
    }
    return {
      id: entry.id,
      title: entry.title,
      description: typeof entry.description === 'string' ? entry.description : '',
      courseCode: typeof entry.courseCode === 'string' ? entry.courseCode : '',
      courseName: typeof entry.courseName === 'string' ? entry.courseName : '',
      dueDate: entry.dueDate,
      isCompleted: entry.isCompleted === true,
      isPriority: entry.isPriority === true,
      assignmentType:
        Object.values(AssignmentType).find((type) => type === entry.assignmentType) ??
        AssignmentType.HOMEWORK,
      periodId: typeof entry.periodId === 'string' ? entry.periodId : undefined,
      subjectId: typeof entry.subjectId === 'string' ? entry.subjectId : undefined,
      isOrphaned: entry.isOrphaned === true,
      subtasks: Array.isArray(entry.subtasks) ? entry.subtasks.filter(isSubtask) : [],
    };
  });
};

export const readStoredAssignments = async (): Promise<Assignment[]> => {
  const raw = await AsyncStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
  return raw ? parseAssignments(JSON.parse(raw)) : [];
};

let pendingMutation: Promise<unknown> = Promise.resolve();

/** Keep each read/modify/write together so concurrent UI actions cannot overwrite each other. */
export const mutateAssignments = <T>(update: (assignments: Assignment[]) => T): Promise<T> => {
  const result = pendingMutation.then(async () => {
    const assignments = await readStoredAssignments();
    const value = update(assignments);
    await AsyncStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
    return value;
  });
  // A failed write must reject its caller without blocking later operations.
  pendingMutation = result.catch(() => undefined);
  return result;
};

export const writeStoredAssignments = (assignments: Assignment[]): Promise<void> =>
  mutateAssignments((stored) => {
    stored.splice(0, stored.length, ...assignments);
  });
