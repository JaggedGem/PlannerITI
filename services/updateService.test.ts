import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { UpdateService } from './updateService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('expo-application', () => ({
  applicationId: 'site.jagged.planneriti',
  nativeBuildVersion: '42',
  nativeApplicationVersion: '1.6.0',
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'standalone',
    expoConfig: { version: '1.6.0', extra: { environment: 'production' } },
  },
}));
jest.mock('expo-updates', () => ({
  isEnabled: true,
  runtimeVersion: '1.6.0',
  updateId: 'running-update',
  channel: 'production',
  manifest: {},
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

const storage = jest.mocked(AsyncStorage);
const updates = jest.mocked(Updates);
const pending = () =>
  JSON.stringify({
    updateId: 'next-update',
    fetchedAt: '2026-10-21T00:00:00.000Z',
    runtimeVersion: Updates.runtimeVersion,
    applicationId: Application.applicationId,
    nativeBuildVersion: Application.nativeBuildVersion,
  });

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(globalThis, { __DEV__: false });
  storage.getItem.mockResolvedValue(null);
  storage.removeItem.mockResolvedValue();
  updates.reloadAsync.mockResolvedValue();
  updates.checkForUpdateAsync.mockResolvedValue({
    isAvailable: false,
  } as Updates.UpdateCheckResult);
});

test('uses installed version and exact EAS channel instead of guessing from display version', () => {
  const service = new UpdateService();
  expect(service.getCurrentVersion()).toBe('1.6.0');
  expect(service.getCurrentChannel()).toBe('production');
  Object.assign(Updates, { channel: 'custom-release-preview' });
  expect(service.getCurrentChannel()).toBe('custom-release-preview');
  Object.assign(Updates, { channel: 'production' });
});

test('stages a fetched OTA with runtime and native build identity once per lifetime', async () => {
  updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as Updates.UpdateCheckResult);
  updates.fetchUpdateAsync.mockResolvedValue({
    manifest: { id: 'next-update' },
  } as Updates.UpdateFetchResult);
  const service = new UpdateService();
  await Promise.all([
    service.prepareOtaUpdateForNextLaunch(),
    service.prepareOtaUpdateForNextLaunch(),
  ]);
  expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  expect(JSON.parse(storage.setItem.mock.calls[0][1])).toMatchObject({
    updateId: 'next-update',
    runtimeVersion: '1.6.0',
    nativeBuildVersion: '42',
    applicationId: 'site.jagged.planneriti',
  });
  expect(updates.reloadAsync).not.toHaveBeenCalled();
});

test('applies valid OTA once, clearing the marker before reload', async () => {
  storage.getItem.mockResolvedValue(pending());
  updates.reloadAsync.mockImplementation(async () => {
    expect(storage.removeItem).toHaveBeenCalled();
  });
  const service = new UpdateService();
  expect(
    await Promise.all([
      service.applyPreparedOtaUpdateOnLaunch(),
      service.applyPreparedOtaUpdateOnLaunch(),
    ]),
  ).toEqual([true, true]);
  expect(updates.reloadAsync).toHaveBeenCalledTimes(1);
});

test.each([
  ['native build upgrade', { nativeBuildVersion: '41' }],
  ['runtime upgrade', { runtimeVersion: 'old-runtime' }],
  ['package mismatch', { applicationId: 'site.jagged.planneriti.beta' }],
  ['already running', { updateId: 'running-update' }],
])('does not reload a marker after %s', async (_label, override) => {
  storage.getItem.mockResolvedValue(JSON.stringify({ ...JSON.parse(pending()), ...override }));
  expect(await new UpdateService().applyPreparedOtaUpdateOnLaunch()).toBe(false);
  expect(storage.removeItem).toHaveBeenCalled();
  expect(updates.reloadAsync).not.toHaveBeenCalled();
});

test.each(['{"updateId":"old","fetchedAt":"old"}', '{invalid'])(
  'ignores unsafe legacy or malformed metadata %s',
  async (raw) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    storage.getItem.mockResolvedValue(raw);
    expect(await new UpdateService().applyPreparedOtaUpdateOnLaunch()).toBe(false);
    expect(updates.reloadAsync).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  },
);

test('does not recreate a failing reload marker', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  storage.getItem.mockResolvedValue(pending());
  updates.reloadAsync.mockRejectedValueOnce(new Error('reload failed'));
  expect(await new UpdateService().applyPreparedOtaUpdateOnLaunch()).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

test('Expo Go uses project version and does not invoke OTA APIs', async () => {
  Constants.executionEnvironment = 'storeClient' as typeof Constants.executionEnvironment;
  const service = new UpdateService();
  expect(service.getCurrentVersion()).toBe('1.6.0');
  expect(service.getChannelDisplay()).toBe('development (production)');
  expect(await service.prepareOtaUpdateForNextLaunch()).toBe(false);
  Constants.executionEnvironment = 'standalone' as typeof Constants.executionEnvironment;
});
