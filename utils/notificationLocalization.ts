import { translations } from '@/constants/Translations';
import type { Language } from '@/services/scheduleService';
import { Assignment, AssignmentType } from '@/types/assignment';

import { formatLocalizedTime, formatMessage, formatRelativeTime } from './localization';

const assignmentTypeKeys = {
  [AssignmentType.HOMEWORK]: 'homework',
  [AssignmentType.TEST]: 'test',
  [AssignmentType.EXAM]: 'exam',
  [AssignmentType.PROJECT]: 'project',
  [AssignmentType.QUIZ]: 'quiz',
  [AssignmentType.LAB]: 'lab',
  [AssignmentType.ESSAY]: 'essay',
  [AssignmentType.PRESENTATION]: 'presentation',
  [AssignmentType.OTHER]: 'other',
} as const;

export function assignmentTypeLabel(type: AssignmentType, language: Language): string {
  return translations[language].assignments.types[assignmentTypeKeys[type]];
}

export function reminderBody(
  assignment: Pick<Assignment, 'title' | 'courseCode' | 'courseName' | 'dueDate'>,
  when: 'hour' | 'tomorrow' | number,
  language: Language,
): string {
  const text = translations[language].notificationMessages;
  const course = assignment.courseCode || assignment.courseName;
  const template =
    when === 'hour' ? text.dueInHour : when === 'tomorrow' ? text.dueTomorrow : text.dueInDays;
  return formatMessage(course ? template : template.replace(' {{course}}', ''), {
    title: assignment.title,
    course: course ? `(${course})` : '',
    time:
      when === 'tomorrow'
        ? formatLocalizedTime(new Date(assignment.dueDate), language)
        : typeof when === 'number'
          ? formatRelativeTime(when, 'day', language)
          : '',
  });
}
