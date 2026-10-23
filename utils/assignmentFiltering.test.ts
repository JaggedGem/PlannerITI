import { createAssignment } from '@/test/fixtures';

import { filterAssignments, matchesAssignmentClass } from './assignmentFiltering';
import { hourFromIndex, hourIndex, timeToMinutes } from './time';

const periods = [
  { _id: 'morning', starttime: '9:00', endtime: '9:45' },
  { _id: 'later', starttime: '10:00', endtime: '10:45' },
];

it('compares unpadded times numerically and excludes adjacent periods', () => {
  const assignments = [
    createAssignment({ periodId: 'morning' }),
    createAssignment({ id: 'later', periodId: 'later' }),
  ];
  expect(
    filterAssignments(assignments, periods, { startTime: '9:45', endTime: '10:45' }).map(
      ({ id }) => id,
    ),
  ).toEqual(['later']);
});

it('supports either time bound and keeps assignments that apply to the whole day', () => {
  const assignments = [createAssignment(), createAssignment({ id: 'early', periodId: 'morning' })];
  expect(filterAssignments(assignments, periods, { startTime: '10:00' })).toEqual([assignments[0]]);
  expect(filterAssignments(assignments, periods, { endTime: '09:00' })).toEqual([assignments[0]]);
});

it('matches either subject or course when both identifiers are supplied', () => {
  const assignments = [
    createAssignment({ subjectId: 'old-id' }),
    createAssignment({ id: 'other', courseCode: 'MATH' }),
  ];
  expect(filterAssignments(assignments, [], { subjectId: 'new-id', courseCode: 'CS101' })).toEqual([
    assignments[0],
  ]);
});

it('filters completed assignments and dates without mutating input', () => {
  const assignments = [
    createAssignment(),
    createAssignment({ isCompleted: true }),
    createAssignment({ dueDate: '2026-10-25T12:00:00Z' }),
  ];
  expect(
    filterAssignments(assignments, [], {
      date: new Date('2026-10-24T12:00:00Z'),
      incompleteOnly: true,
    }),
  ).toEqual([assignments[0]]);
  expect(assignments).toHaveLength(3);
});

it('does not match similar course codes or conflicting subject identifiers', () => {
  expect(matchesAssignmentClass(createAssignment({ courseCode: 'CS1' }), '', 'CS101: Intro')).toBe(
    false,
  );
  expect(
    matchesAssignmentClass(createAssignment({ subjectId: 'one' }), 'two', 'Computer science'),
  ).toBe(false);
  expect(matchesAssignmentClass(createAssignment(), '', 'CS101: Intro')).toBe(true);
});

it.each(['24:00', '9:60', 'bad', '', '-1:30'])('rejects invalid clock values: %s', (time) => {
  expect(timeToMinutes(time)).toBeNull();
});

it.each([0, 1, 11, 12, 13, 23])('round-trips the 12-hour scroll index for hour %i', (hour) => {
  expect(hourFromIndex(hourIndex(hour, true), true, hour >= 12)).toBe(hour);
});
