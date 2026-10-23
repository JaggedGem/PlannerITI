import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';

import authService, { UserData } from '@/services/authService';
import { renderHook } from '@/test/renderHook';

import { useAuth } from './useAuth';

let mockAuthChanged: () => void;
const mockRemove = jest.fn();
jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    addListener: jest.fn((_name: string, listener: () => void) => {
      mockAuthChanged = listener;
      return { remove: mockRemove };
    }),
  },
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('@/services/authService', () => ({
  __esModule: true,
  default: {
    loadUserData: jest.fn(),
    isAuthenticated: jest.fn(),
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
  },
}));
const user: UserData = { email: 'student@example.com', is_verified: true };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(user));
  jest.mocked(authService.isAuthenticated).mockReturnValue(true);
  jest.mocked(authService.loadUserData).mockResolvedValue(null);
});

it('retains cached identity while an authenticated session is offline', async () => {
  const hook = await renderHook(useAuth);
  expect(hook.current.user).toEqual(user);
  expect(hook.current.isInitialLoad).toBe(false);
  await hook.unmount();
  expect(mockRemove).toHaveBeenCalled();
});

it('does not restore a stale in-flight profile after logout', async () => {
  let finish!: (user: UserData | null) => void;
  jest.mocked(authService.loadUserData).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = await renderHook(useAuth);
  await act(async () => {
    jest.mocked(authService.isAuthenticated).mockReturnValue(false);
    mockAuthChanged();
    finish(user);
  });
  expect(hook.current.user).toBeNull();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await hook.unmount();
});

it('reflects a login performed in another screen', async () => {
  const hook = await renderHook(useAuth);
  const fresh = { ...user, email: 'fresh@example.com' };
  jest.mocked(authService.getCurrentUser).mockReturnValue(fresh);
  await act(async () => {
    mockAuthChanged();
  });
  expect(hook.current.user).toEqual(fresh);
  await hook.unmount();
});

it('uses cached automatic loads but requests fresh data for a manual reload', async () => {
  const hook = await renderHook(useAuth);
  expect(authService.loadUserData).toHaveBeenLastCalledWith({ forceRefresh: false });
  await act(async () => {
    await hook.current.reloadUser();
  });
  expect(authService.loadUserData).toHaveBeenLastCalledWith({ forceRefresh: true });
  await hook.unmount();
});
