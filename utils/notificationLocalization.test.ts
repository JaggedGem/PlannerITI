import { createAssignment } from '@/test/fixtures';
import { AssignmentType } from '@/types/assignment';

import { assignmentTypeLabel, reminderBody } from './notificationLocalization';

it.each(['en', 'ro', 'ru'] as const)('translates every assignment type in %s', (language) => {
  for (const type of Object.values(AssignmentType)) {
    const label = assignmentTypeLabel(type, language);
    expect(label).toBeTruthy();
    if (language === 'ru') expect(label).toMatch(/[А-Яа-яЁё]/);
  }
});

it('keeps user titles intact and uses Russian reminder grammar', () => {
  const body = reminderBody(
    createAssignment({ title: 'Read  {{book}}', courseCode: 'CS' }),
    2,
    'ru',
  );
  expect(body).toContain('Read  {{book}}');
  expect(body).toContain('(CS)');
  expect(body).toContain('через 2 дня');
});

it('omits empty course parentheses and formats Romanian reminders in 24-hour time', () => {
  const assignment = createAssignment({
    courseCode: '',
    courseName: '',
    dueDate: new Date(2026, 0, 15, 14, 30).toISOString(),
  });
  const body = reminderBody(assignment, 'tomorrow', 'ro');
  expect(body).toContain('mâine la 14:30');
  expect(body).not.toContain('()');
  expect(body).not.toContain('  ');
});
