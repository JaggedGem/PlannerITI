import { act } from 'react-test-renderer';

import type { AppStateStatus } from 'react-native';

import { renderHook } from '@/test/renderHook';

import { useTimeUpdate } from './useTimeUpdate';

let mockOnStateChange: (state: AppStateStatus) => void;
const mockRemove = jest.fn();
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((_event: string, listener: typeof mockOnStateChange) => {
      mockOnStateChange = listener;
      return { remove: mockRemove };
    }),
  },
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(globalThis, 'setTimeout');
  jest.spyOn(globalThis, 'clearTimeout');
  jest.setSystemTime(new Date('2026-10-23T10:00:30Z'));
  jest.clearAllMocks();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('updates on minute boundaries instead of re-rendering the schedule every second', async () => {
  const hook = await renderHook(useTimeUpdate);
  const initial = hook.current;
  await act(async () => {
    jest.advanceTimersByTime(29_000);
  });
  expect(hook.current).toBe(initial);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(hook.current.toISOString()).toBe('2026-10-23T10:01:00.000Z');
  await hook.unmount();
  const scheduled = jest
    .mocked(setTimeout)
    .mock.calls.map((args, index) => ({
      delay: args[1],
      handle: jest.mocked(setTimeout).mock.results[index].value,
    }))
    .filter(({ delay }) => delay === 30_000 || delay === 60_000);
  expect(clearTimeout).toHaveBeenCalledWith(scheduled[scheduled.length - 1].handle);
  expect(mockRemove).toHaveBeenCalled();
});

it('pauses in the background and refreshes immediately on resume', async () => {
  const hook = await renderHook(useTimeUpdate);
  const initial = hook.current;
  await act(async () => {
    mockOnStateChange('background');
    jest.advanceTimersByTime(120_000);
  });
  expect(hook.current).toBe(initial);
  await act(async () => {
    mockOnStateChange('active');
  });
  expect(hook.current.getTime()).toBe(Date.now());
  await hook.unmount();
});

it('keeps a single clock under Strict Mode effect replay', async () => {
  const hook = await renderHook(useTimeUpdate, true);
  const clocks = jest
    .mocked(setTimeout)
    .mock.calls.map((args, index) => ({
      delay: args[1],
      handle: jest.mocked(setTimeout).mock.results[index].value,
    }))
    .filter(({ delay }) => delay === 30_000);
  expect(clocks).toHaveLength(2);
  expect(clearTimeout).toHaveBeenCalledWith(clocks[0].handle);
  await hook.unmount();
  expect(clearTimeout).toHaveBeenCalledWith(clocks[1].handle);
});
