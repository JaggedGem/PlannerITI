import AsyncStorage from '@react-native-async-storage/async-storage';

import { scheduleService } from '@/services/scheduleService';
import { createAssignment } from '@/test/fixtures';
import { AssignmentType } from '@/types/assignment';

import { mutateAssignments, parseAssignments, readStoredAssignments } from './assignmentRepository';
import {
  addAssignment,
  addSubtask,
  deleteAssignment,
  handleGroupChange,
  updateAssignment,
} from './assignmentStorage';
import { scheduleForNewAssignment } from './notificationHelper';

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
}));
jest.mock('expo-crypto', () => {
  let id = 0;
  return { randomUUID: () => `test-id-${++id}` };
});
jest.mock('@/services/scheduleService', () => ({
  scheduleService: {
    refreshSubjects: jest.fn(),
    updateAssignmentCounts: jest.fn(async () => undefined),
  },
}));
jest.mock('./notificationHelper', () => ({
  scheduleForNewAssignment: jest.fn(async () => undefined),
  cancelForDeletedAssignment: jest.fn(async () => undefined),
  handleCompletionStateChange: jest.fn(async () => undefined),
  updateNotificationsForUpdatedAssignment: jest.fn(async () => undefined),
}));

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
});

it('migrates legacy assignments and validates subtask data', () => {
  const [assignment] = parseAssignments([
    {
      id: 'old',
      title: 'Legacy',
      dueDate: '2026-10-24',
      subtasks: [null, { id: 's', title: 'Read', isCompleted: false }],
    },
  ]);
  expect(assignment.assignmentType).toBe(AssignmentType.HOMEWORK);
  expect(assignment.subtasks).toHaveLength(1);
  expect(assignment.isCompleted).toBe(false);
});

it.each([null, {}, [null], [{ id: 'broken', title: 'Invalid date', dueDate: 'bad' }]])(
  'rejects invalid storage without silently deleting entries: %j',
  (raw) => {
    expect(() => parseAssignments(raw)).toThrow();
  },
);

it('preserves concurrent assignment additions and generates distinct IDs', async () => {
  const assignments = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      addAssignment(createAssignment({ title: `Assignment ${i}` })),
    ),
  );
  expect(await readStoredAssignments()).toHaveLength(10);
  expect(new Set(assignments.map(({ id }) => id)).size).toBe(10);
});

it('preserves concurrent subtask edits and assignment updates', async () => {
  const assignment = await addAssignment(createAssignment());
  await Promise.all([
    addSubtask(assignment.id, 'Read'),
    addSubtask(assignment.id, 'Write'),
    updateAssignment(assignment.id, { title: 'Updated', id: 'unwanted-replacement' }),
  ]);
  const [stored] = await readStoredAssignments();
  expect(stored.id).toBe(assignment.id);
  expect(stored.title).toBe('Updated');
  expect(stored.subtasks?.map(({ title }) => title)).toEqual(['Read', 'Write']);
});

it('reports failed writes, skips notifications, and permits a later retry', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await expect(addAssignment(createAssignment())).rejects.toThrow('disk full');
  expect(scheduleForNewAssignment).not.toHaveBeenCalled();
  await addAssignment(createAssignment());
  expect(await readStoredAssignments()).toHaveLength(1);
});

it('does not replace unreadable or corrupt stored assignments with an empty array', async () => {
  mockStorage.set('assignments', '{broken');
  await expect(addAssignment(createAssignment())).rejects.toThrow();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(mockStorage.get('assignments')).toBe('{broken');
});

it('continues after a storage read failure without losing the previous list', async () => {
  mockStorage.set('assignments', JSON.stringify([createAssignment()]));
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('read failed'));
  await expect(deleteAssignment('assignment-1')).rejects.toThrow('read failed');
  await mutateAssignments((assignments) => {
    assignments[0].title = 'Still here';
  });
  expect((await readStoredAssignments())[0].title).toBe('Still here');
});

it('restores subjects by name and updates changed subject identifiers', async () => {
  mockStorage.set(
    'assignments',
    JSON.stringify([createAssignment({ subjectId: 'old', isOrphaned: true })]),
  );
  jest
    .mocked(scheduleService.refreshSubjects)
    .mockResolvedValueOnce([{ id: 'new', name: 'Computer science' }]);
  expect(await handleGroupChange('group-2')).toBe(true);
  expect(scheduleService.refreshSubjects).toHaveBeenCalledWith('group-2');
  expect((await readStoredAssignments())[0]).toMatchObject({ subjectId: 'new', isOrphaned: false });
});

it('preserves assignments when a subject refresh fails or returns no subjects', async () => {
  mockStorage.set('assignments', JSON.stringify([createAssignment({ subjectId: 'original' })]));
  jest.mocked(scheduleService.refreshSubjects).mockResolvedValueOnce([]);
  expect(await handleGroupChange()).toBe(false);
  expect((await readStoredAssignments())[0].isOrphaned).toBe(false);
});
