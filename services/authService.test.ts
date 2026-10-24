import AsyncStorage from '@react-native-async-storage/async-storage';

import { DeviceEventEmitter } from 'react-native';

import { fetchCustomApi } from '@/utils/customApi';

import authService from './authService';
import { secureStorageService } from './secureStorageService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => (key === '@auth_version' ? '4' : null)),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));
jest.mock('./secureStorageService', () => ({
  secureStorageService: {
    getAuthToken: jest.fn(async () => 'stored-token'),
    setAuthToken: jest.fn(),
    clearAuthToken: jest.fn(),
  },
}));
jest.mock('@/utils/customApi', () => ({ fetchCustomApi: jest.fn() }));

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  jest.resetAllMocks();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async (key) => (key === '@auth_version' ? '4' : null));
  jest.mocked(secureStorageService.getAuthToken).mockResolvedValue('stored-token');
  await authService.logout();
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
});

const user = { email: 'student@example.com', is_verified: true };
const profileResponse = () =>
  new Response(JSON.stringify(user), { headers: { 'Content-Type': 'application/json' } });

it('keeps an authenticated session during connectivity failure', async () => {
  jest.mocked(fetchCustomApi).mockRejectedValueOnce(new TypeError('offline'));
  expect(await authService.loadUserData()).toBeNull();
  expect(authService.isAuthenticated()).toBe(true);
  expect(secureStorageService.clearAuthToken).not.toHaveBeenCalled();
});

it('retains the last successful profile on a transient server failure', async () => {
  jest.mocked(fetchCustomApi).mockResolvedValueOnce(profileResponse());
  await authService.loadUserData();
  jest
    .mocked(fetchCustomApi)
    .mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }));
  expect(await authService.loadUserData({ forceRefresh: true })).toEqual(user);
  expect(authService.isAuthenticated()).toBe(true);
});

it('invalidates a rejected session and clears cached identity', async () => {
  jest.mocked(fetchCustomApi).mockResolvedValueOnce(new Response('{}', { status: 401 }));
  await authService.loadUserData();
  expect(authService.isAuthenticated()).toBe(false);
  expect(secureStorageService.clearAuthToken).toHaveBeenCalled();
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@planner_user_cache');
});

it('does not restore profile data after logout during a request', async () => {
  let finish!: (response: Response) => void;
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  jest.mocked(fetchCustomApi).mockImplementationOnce(() => {
    started();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const request = authService.loadUserData();
  await fetching;
  await authService.logout();
  finish(profileResponse());
  expect(await request).toBeNull();
  expect(authService.getCurrentUser()).toBeNull();
  expect(authService.isAuthenticated()).toBe(false);
});

it('shares the result of concurrent profile loads', async () => {
  jest.mocked(fetchCustomApi).mockResolvedValueOnce(profileResponse());
  const results = await Promise.all([authService.loadUserData(), authService.loadUserData()]);
  expect(results).toEqual([user, user]);
  expect(fetchCustomApi).toHaveBeenCalledTimes(1);
});

it('re-authenticates an expired token without waiting on its own profile request', async () => {
  const tokenResponse = () =>
    new Response(JSON.stringify({ access_token: 'new-token' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  jest
    .mocked(fetchCustomApi)
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(profileResponse());
  await authService.login(user.email, 'test-password');
  jest
    .mocked(fetchCustomApi)
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
    .mockResolvedValueOnce(tokenResponse())
    .mockResolvedValueOnce(profileResponse());
  expect(await authService.loadUserData({ forceRefresh: true })).toEqual(user);
  expect(authService.isAuthenticated()).toBe(true);
});

it('loads a new login independently of an older in-flight profile request', async () => {
  let finishOld!: (response: Response) => void;
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  jest.mocked(fetchCustomApi).mockImplementationOnce(() => {
    started();
    return new Promise((resolve) => {
      finishOld = resolve;
    });
  });
  const older = authService.loadUserData();
  await fetching;
  const fresh = { email: 'new@example.com', is_verified: true };
  jest
    .mocked(fetchCustomApi)
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'new-token' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify(fresh), { headers: { 'Content-Type': 'application/json' } }),
    );
  await authService.login(fresh.email, 'test-password');
  finishOld(profileResponse());
  await older;
  expect(authService.getCurrentUser()).toEqual(fresh);
});

it('does not complete a login that was cancelled by logout', async () => {
  let finish!: (response: Response) => void;
  let started!: () => void;
  const fetching = new Promise<void>((resolve) => {
    started = resolve;
  });
  jest.mocked(fetchCustomApi).mockImplementationOnce(() => {
    started();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const login = authService.login(user.email, 'test-password');
  const cancelled = expect(login).rejects.toThrow('Sign-in cancelled');
  await fetching;
  await authService.logout();
  finish(
    new Response(JSON.stringify({ access_token: 'late-token' }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  await cancelled;
  expect(authService.isAuthenticated()).toBe(false);
});

it('caches sequential automatic profile loads until the five-minute TTL expires', async () => {
  jest.mocked(fetchCustomApi).mockResolvedValueOnce(profileResponse());
  const first = await authService.loadUserData();
  for (let index = 0; index < 10; index += 1) {
    expect(await authService.loadUserData()).toBe(first);
  }
  expect(fetchCustomApi).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now() + 5 * 60 * 1000);
  jest.mocked(fetchCustomApi).mockResolvedValueOnce(profileResponse());
  await authService.loadUserData();
  expect(fetchCustomApi).toHaveBeenCalledTimes(2);
});

it('allows explicit refreshes to bypass freshness while deduplicating concurrent refreshes', async () => {
  jest
    .mocked(fetchCustomApi)
    .mockResolvedValueOnce(profileResponse())
    .mockResolvedValueOnce(profileResponse());
  await authService.loadUserData();
  await Promise.all([
    authService.loadUserData({ forceRefresh: true }),
    authService.loadUserData({ forceRefresh: true }),
  ]);
  expect(fetchCustomApi).toHaveBeenCalledTimes(2);
});

it('does not start a request feedback loop when an auth subscriber reloads the profile', async () => {
  const listener = DeviceEventEmitter.addListener('auth_state_changed', () => {
    setTimeout(() => {
      void authService.loadUserData();
    }, 500);
  });
  try {
    jest.mocked(fetchCustomApi).mockImplementation(async () => profileResponse());
    await authService.loadUserData();
    await jest.advanceTimersByTimeAsync(2500);
    expect(fetchCustomApi).toHaveBeenCalledTimes(1);
  } finally {
    listener.remove();
  }
});

it('backs off automatic retries after an offline failure', async () => {
  jest
    .mocked(fetchCustomApi)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(profileResponse());
  await authService.loadUserData();
  await authService.loadUserData();
  expect(fetchCustomApi).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now() + 30_000);
  await authService.loadUserData();
  expect(fetchCustomApi).toHaveBeenCalledTimes(2);
});
