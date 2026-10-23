import { act } from 'react-test-renderer';

import { createAssignment } from '@/test/fixtures';
import { renderHook } from '@/test/renderHook';
import { Assignment } from '@/types/assignment';
import { getAssignments } from '@/utils/assignmentStorage';

import { useAssignments } from './useAssignments';

jest.mock('@/utils/assignmentStorage', () => ({
  getAssignments: jest.fn(),
  deleteAssignment: jest.fn(),
  toggleAssignmentCompletion: jest.fn(),
}));
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T10:00:00Z'));
  jest.mocked(getAssignments).mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

it('loads and separates archived assignments after Strict Mode replays its effect', async () => {
  jest
    .mocked(getAssignments)
    .mockResolvedValue([
      createAssignment(),
      createAssignment({ id: 'old', dueDate: '2026-10-22T10:00:00Z' }),
    ]);
  const hook = await renderHook(useAssignments, true);
  expect(hook.current.allAssignments).toHaveLength(1);
  expect(hook.current.archivedAssignments[0].id).toBe('old');
  await hook.unmount();
});

it('does not let an older refresh overwrite a newer result', async () => {
  jest.mocked(getAssignments).mockResolvedValueOnce([]);
  const hook = await renderHook(useAssignments);
  let resolveOlder!: (assignments: Assignment[]) => void;
  let resolveNewer!: (assignments: Assignment[]) => void;
  jest
    .mocked(getAssignments)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOlder = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNewer = resolve;
        }),
    );
  const older = hook.current.refreshAssignments();
  const newer = hook.current.refreshAssignments();
  await act(async () => {
    resolveNewer([createAssignment({ title: 'Newer' })]);
    await newer;
  });
  await act(async () => {
    resolveOlder([createAssignment({ title: 'Older' })]);
    await older;
  });
  expect(hook.current.allAssignments[0].title).toBe('Newer');
  await hook.unmount();
});
