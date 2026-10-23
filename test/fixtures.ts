import { Assignment, AssignmentType } from '@/types/assignment';

export const createAssignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  id: 'assignment-1',
  title: 'Read chapter one',
  description: '',
  courseCode: 'CS101',
  courseName: 'Computer science',
  dueDate: '2026-10-24T12:00:00.000Z',
  isCompleted: false,
  isPriority: false,
  assignmentType: AssignmentType.HOMEWORK,
  ...overrides,
});
