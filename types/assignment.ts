// Assignment type enum
export enum AssignmentType {
  HOMEWORK = 'Homework',
  TEST = 'Test',
  EXAM = 'Exam',
  PROJECT = 'Project',
  QUIZ = 'Quiz',
  LAB = 'Lab',
  ESSAY = 'Essay',
  PRESENTATION = 'Presentation',
  OTHER = 'Other',
}

// Assignment interface
export interface Assignment {
  id: string;
  title: string;
  description: string;
  courseCode: string;
  courseName: string;
  dueDate: string; // ISO date string
  isCompleted: boolean;
  isPriority: boolean;
  assignmentType: AssignmentType; // Type of assignment
  periodId?: string; // Optional period ID from scheduleService
  subjectId?: string; // Optional subject ID from scheduleService
  isOrphaned?: boolean; // Flag to mark if the assignment's subject no longer exists in current group
  subtasks?: Subtask[]; // Optional array of subtasks
}

// Subtask interface
export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

// Assignment group interface for grouping by date
export interface AssignmentGroup {
  title: string;
  date: string;
  assignments: Assignment[];
}
