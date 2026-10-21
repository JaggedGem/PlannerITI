import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InstallStateEvent, UpdateStatus } from '@rnforge/react-native-in-app-updates';

import { AppState, Platform } from 'react-native';

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { NativeUpdateClient } from './nativeUpdateClient';
import { UpdateService } from './updateService';

const mockRemoveInstall = jest.fn();
const mockRemoveAppState = jest.fn();
const mockLibraryLoaded = jest.fn();
let mockInstallListener: ((event: InstallStateEvent) => void) | undefined;
let mockAppStateListener: ((state: string) => void) | undefined;
const mockNative = {
  getUpdateStatus: jest.fn<Promise<UpdateStatus>, []>(),
  startImmediateUpdate: jest.fn<Promise<UpdateStatus>, []>(),
  startFlexibleUpdate: jest.fn<Promise<UpdateStatus>, []>(),
  completeFlexibleUpdate: jest.fn<Promise<UpdateStatus>, []>(),
  openStorePage: jest.fn(),
  canStartImmediateUpdate: (s: UpdateStatus) =>
    s.supported && s.updateAvailable === true && s.capabilities.immediate && s.allowed.immediate,
  canStartFlexibleUpdate: (s: UpdateStatus) =>
    s.supported && s.updateAvailable === true && s.capabilities.flexible && s.allowed.flexible,
  canCompleteFlexibleUpdate: (s: UpdateStatus) =>
    s.supported && s.capabilities.flexible && s.installStatus === 'downloaded',
  canOpenStorePage: (s: UpdateStatus) => s.capabilities.storePage,
  supportsInstallStateListener: (s: UpdateStatus) => s.capabilities.installStateListener,
  addInstallStateListener: jest.fn((listener: (event: InstallStateEvent) => void) => {
    mockInstallListener = listener;
    return { remove: mockRemoveInstall };
  }),
};
jest.mock('@rnforge/react-native-in-app-updates', () => {
  mockLibraryLoaded();
  return mockNative;
});
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((_name, listener) => {
      mockAppStateListener = listener;
      return { remove: mockRemoveAppState };
    }),
  },
}));
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
    expoConfig: { extra: { environment: 'production' } },
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

function status(overrides: Partial<UpdateStatus> = {}): UpdateStatus {
  return {
    platform: 'android',
    supported: true,
    updateAvailable: false,
    reason: 'no-update-available',
    capabilities: {
      immediate: true,
      flexible: true,
      storePage: true,
      latestVersionLookup: false,
      installStateListener: true,
    },
    allowed: { immediate: false, flexible: false },
    installStatus: 'unknown',
    ...overrides,
  };
}
const available = (allowed = { immediate: true, flexible: true }) =>
  status({ updateAvailable: true, reason: 'update-available', allowed });
const ready = () => ({
  ...availableWithStatus('downloaded'),
  reason: 'flexible-update-downloaded' as const,
});
const availableWithStatus = (installStatus: UpdateStatus['installStatus']) => ({
  ...available(),
  installStatus,
});
const storage = jest.mocked(AsyncStorage);
const updates = jest.mocked(Updates);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  Object.assign(globalThis, { __DEV__: false });
  Object.assign(Platform, { OS: 'android' });
  Object.assign(AppState, { currentState: 'active' });
  Object.assign(Application, { applicationId: 'site.jagged.planneriti' });
  Object.assign(Constants, { executionEnvironment: 'standalone' });
  Constants.expoConfig!.extra = { environment: 'production' };
  mockNative.getUpdateStatus.mockResolvedValue(status());
  mockNative.startFlexibleUpdate.mockResolvedValue(available());
  mockNative.startImmediateUpdate.mockResolvedValue(available());
  mockNative.completeFlexibleUpdate.mockResolvedValue(ready());
  storage.getItem.mockReset().mockResolvedValue(null);
  storage.setItem.mockReset().mockResolvedValue();
  storage.removeItem.mockReset().mockResolvedValue();
  updates.checkForUpdateAsync.mockResolvedValue({
    isAvailable: false,
  } as Updates.UpdateCheckResult);
  updates.reloadAsync.mockResolvedValue();
  mockInstallListener = undefined;
  mockAppStateListener = undefined;
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// These guard cases run before the library is ever loaded.
test.each(['ios', 'web', 'expo-go', 'development', 'dev-package', 'beta-not-enrolled'])(
  'does not load Nitro in %s',
  async (environment) => {
    if (environment === 'ios' || environment === 'web')
      Object.assign(Platform, { OS: environment });
    if (environment === 'expo-go')
      Object.assign(Constants, { executionEnvironment: 'storeClient' });
    if (environment === 'development') Object.assign(globalThis, { __DEV__: true });
    if (environment === 'dev-package')
      Object.assign(Application, { applicationId: 'site.jagged.planneriti.dev' });
    if (environment === 'beta-not-enrolled')
      Object.assign(Application, { applicationId: 'site.jagged.planneriti.beta' });
    expect((await new NativeUpdateClient().check()).kind).toBe('unsupported');
    expect(mockLibraryLoaded).not.toHaveBeenCalled();
    expect(mockNative.getUpdateStatus).not.toHaveBeenCalled();
  },
);

test('reports no update only after a successful Play check', async () => {
  expect((await new NativeUpdateClient().check()).kind).toBe('unavailable');
});
test.each([
  [{ immediate: false, flexible: true }],
  [{ immediate: true, flexible: false }],
  [{ immediate: true, flexible: true }],
  [{ immediate: false, flexible: false }],
])('reports actual allowed capabilities: %j', async (allowed) => {
  mockNative.getUpdateStatus.mockResolvedValue(available(allowed));
  expect(await new NativeUpdateClient().check()).toMatchObject({
    kind: 'available',
    flexibleAllowed: allowed.flexible,
    immediateAllowed: allowed.immediate,
  });
});
test('supports beta only with explicit opt-in and its own package', async () => {
  Object.assign(Application, { applicationId: 'site.jagged.planneriti.beta' });
  Constants.expoConfig!.extra = { environment: 'beta', betaPlayUpdatesEnabled: true };
  expect((await new NativeUpdateClient().check()).kind).toBe('unavailable');
  expect(mockNative.getUpdateStatus).toHaveBeenCalledTimes(1);
});
test('sideload is unsupported; a failed Play call is a failure', async () => {
  mockNative.getUpdateStatus.mockResolvedValueOnce(
    status({ supported: false, reason: 'unsupported-install-source' }),
  );
  expect(await new NativeUpdateClient().check()).toEqual({
    kind: 'unsupported',
    reason: 'unsupported-install-source',
  });
  mockNative.getUpdateStatus.mockRejectedValueOnce(new Error('offline'));
  expect((await new NativeUpdateClient().check()).kind).toBe('failed');
});
test('unknown availability never masquerades as no update', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(
    status({ updateAvailable: null, reason: 'context-unavailable' }),
  );
  expect((await new NativeUpdateClient().check()).kind).toBe('failed');
});
test('startup checks are single-flight across Strict Mode remounts and stage OTA after native check', async () => {
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  detach();
  const detachAgain = service.attachUpdateLifecycle();
  await Promise.all([service.initializeUpdates(), service.initializeUpdates()]);
  expect(mockNative.getUpdateStatus).toHaveBeenCalledTimes(1);
  expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  expect(mockNative.getUpdateStatus.mock.invocationCallOrder[0]).toBeLessThan(
    updates.checkForUpdateAsync.mock.invocationCallOrder[0],
  );
  expect(mockNative.addInstallStateListener).toHaveBeenCalledTimes(1);
  detachAgain();
  expect(mockRemoveInstall).toHaveBeenCalledTimes(1);
  expect(mockRemoveAppState).toHaveBeenCalledTimes(2);
});

test('Play failure still allows OTA staging', async () => {
  mockNative.getUpdateStatus.mockRejectedValue(new Error('offline'));
  await new UpdateService().initializeUpdates();
  expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  expect(updates.reloadAsync).not.toHaveBeenCalled();
});

test('hung Play request has a bounded startup and never initiates a late native flow', async () => {
  jest.useFakeTimers();
  let resolve!: (s: UpdateStatus) => void;
  mockNative.getUpdateStatus.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const service = new UpdateService();
  const startup = service.initializeUpdates();
  await jest.advanceTimersByTimeAsync(4001);
  await startup;
  expect(updates.checkForUpdateAsync).toHaveBeenCalled();
  expect(updates.reloadAsync).not.toHaveBeenCalled();
  resolve(available());
  await Promise.resolve();
  expect(mockNative.startImmediateUpdate).not.toHaveBeenCalled();
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
});

test('flexible is optional and the default, cancellation does not reprompt on foreground', async () => {
  jest.useFakeTimers();
  mockNative.getUpdateStatus.mockResolvedValue(available());
  mockNative.startFlexibleUpdate.mockResolvedValue({ ...available(), reason: 'user-canceled' });
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.initializeUpdates();
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
  await service.enableNativeUpdatePrompts();
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(1);
  expect(mockNative.startImmediateUpdate).not.toHaveBeenCalled();
  jest.setSystemTime(Date.now() + 60_001);
  mockAppStateListener?.('background');
  mockAppStateListener?.('active');
  await jest.advanceTimersByTimeAsync(0);
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(1);
  expect(mockNative.getUpdateStatus).toHaveBeenCalledTimes(3);
  expect(service.getNativeUpdateSnapshot().dismissed).toBe(true);
  detach();
});

test('opens Play consent directly once after app readiness, including repeated readiness calls', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(available());
  const service = new UpdateService();
  await service.initializeUpdates();
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
  await Promise.all([service.enableNativeUpdatePrompts(), service.enableNativeUpdatePrompts()]);
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(1);
  expect(service.getNativeUpdateSnapshot()).toMatchObject({ phase: 'downloading', busy: false });
  expect(mockNative.completeFlexibleUpdate).not.toHaveBeenCalled();
});

test('an update first detected on foreground opens consent only after app readiness', async () => {
  jest.useFakeTimers();
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.initializeUpdates();
  mockNative.getUpdateStatus.mockResolvedValue(available());
  jest.setSystemTime(Date.now() + 60_001);
  mockAppStateListener?.('background');
  mockAppStateListener?.('active');
  await jest.advanceTimersByTimeAsync(0);
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
  await service.enableNativeUpdatePrompts();
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(1);
  detach();
});

test('detecting an update on foreground opens Play consent when the app is already ready', async () => {
  jest.useFakeTimers();
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.initializeUpdates();
  await service.enableNativeUpdatePrompts();
  mockNative.getUpdateStatus.mockResolvedValue(available());
  jest.setSystemTime(Date.now() + 60_001);
  mockAppStateListener?.('background');
  mockAppStateListener?.('active');
  await jest.advanceTimersByTimeAsync(0);
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(1);
  detach();
});

test('a failed automatic flow keeps its retry action on foreground without reopening consent', async () => {
  jest.useFakeTimers();
  mockNative.getUpdateStatus.mockResolvedValue(available());
  mockNative.startFlexibleUpdate.mockRejectedValueOnce(new Error('Play flow failed'));
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.initializeUpdates();
  expect(await service.enableNativeUpdatePrompts()).toBe(false);
  expect(service.getNativeUpdateSnapshot()).toMatchObject({ phase: 'error', busy: false });
  jest.setSystemTime(Date.now() + 60_001);
  mockAppStateListener?.('background');
  mockAppStateListener?.('active');
  await jest.advanceTimersByTimeAsync(0);
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(1);
  expect(service.getNativeUpdateSnapshot().phase).toBe('error');
  expect(await service.startNativeUpdate()).toBe(true);
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(2);
  detach();
});

test('app readiness in the background defers consent until the next foreground without a throttle delay', async () => {
  jest.useFakeTimers();
  mockNative.getUpdateStatus.mockResolvedValue(available());
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.initializeUpdates();
  Object.assign(AppState, { currentState: 'background' });
  mockAppStateListener?.('background');
  expect(await service.enableNativeUpdatePrompts()).toBe(false);
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
  Object.assign(AppState, { currentState: 'active' });
  mockAppStateListener?.('active');
  await jest.advanceTimersByTimeAsync(0);
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(1);
  detach();
});

test.each([
  ['unavailable', status()],
  ['unsupported', status({ supported: false, reason: 'unsupported-install-source' })],
  ['downloaded', ready()],
  ['downloading', availableWithStatus('downloading')],
  ['store fallback', available({ immediate: true, flexible: false })],
] as const)('does not open consent automatically for %s', async (_label, nativeStatus) => {
  mockNative.getUpdateStatus.mockResolvedValue(nativeStatus);
  const service = new UpdateService();
  await service.initializeUpdates();
  expect(await service.enableNativeUpdatePrompts()).toBe(false);
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
  expect(mockNative.startImmediateUpdate).not.toHaveBeenCalled();
  expect(mockNative.openStorePage).not.toHaveBeenCalled();
});

test.each([
  ['flexible', { immediate: true, flexible: false }, null],
  ['immediate', { immediate: false, flexible: true }, 'flexible'],
  ['immediate', { immediate: true, flexible: true }, 'immediate'],
] as const)('policy %s with %j uses only %s', async (policy, allowed, mode) => {
  mockNative.getUpdateStatus.mockResolvedValue(available(allowed));
  await new UpdateService(policy).startNativeUpdate();
  expect(mockNative.startImmediateUpdate).toHaveBeenCalledTimes(mode === 'immediate' ? 1 : 0);
  expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(mode === 'flexible' ? 1 : 0);
});

test('flexible download can stage OTA, but only the explicit install action completes it', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(availableWithStatus('downloading'));
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.initializeUpdates();
  expect(updates.checkForUpdateAsync).toHaveBeenCalled();
  expect(mockNative.completeFlexibleUpdate).not.toHaveBeenCalled();
  mockInstallListener?.({
    platform: 'android',
    supported: true,
    installStatus: 'downloaded',
    reason: 'flexible-update-downloaded',
  });
  expect(service.getNativeUpdateSnapshot().phase).toBe('ready');
  mockNative.getUpdateStatus.mockResolvedValue(ready());
  expect(await service.completeNativeUpdate()).toBe(true);
  expect(mockNative.completeFlexibleUpdate).toHaveBeenCalledTimes(1);
  expect(await service.applyPreparedOtaUpdateOnLaunch()).toBe(false);
  detach();
});

test('recovers a downloaded flexible update on reopen and foreground', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(ready());
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.initializeUpdates();
  expect(service.getNativeUpdateSnapshot().phase).toBe('ready');
  mockAppStateListener?.('background');
  mockAppStateListener?.('active');
  await service.checkForNativeUpdate();
  expect(mockNative.getUpdateStatus).toHaveBeenCalledTimes(2);
  expect(updates.reloadAsync).not.toHaveBeenCalled();
  detach();
});

test('interrupted immediate update blocks OTA reload, offers recovery without pretending library can resume UI', async () => {
  mockNative.getUpdateStatus.mockResolvedValue({
    ...available(),
    reason: 'developer-triggered-update-in-progress',
  });
  storage.getItem.mockResolvedValue(
    JSON.stringify({
      updateId: 'pending',
      fetchedAt: 'now',
      runtimeVersion: '1.6.0',
      applicationId: Application.applicationId,
      nativeBuildVersion: '42',
    }),
  );
  const service = new UpdateService();
  await service.initializeUpdates();
  expect(updates.reloadAsync).not.toHaveBeenCalled();
  expect(updates.checkForUpdateAsync).toHaveBeenCalled();
  expect(service.getNativeUpdateSnapshot()).toMatchObject({
    phase: 'recovery',
    storeFallback: true,
  });
  await service.openNativeUpdateStore();
  expect(mockNative.openStorePage).toHaveBeenCalledTimes(1);
  expect(mockNative.startImmediateUpdate).not.toHaveBeenCalled();
});

test('native UI gate prevents concurrent OTA reload and repeated native flows', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(available());
  let resolve!: (s: UpdateStatus) => void;
  mockNative.startFlexibleUpdate.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const service = new UpdateService();
  const starting = service.startNativeUpdate();
  // Wait for the native UI promise to be pending.
  while (!mockNative.startFlexibleUpdate.mock.calls.length) await Promise.resolve();
  expect(await service.applyPreparedOtaUpdateOnLaunch()).toBe(false);
  expect(await service.startNativeUpdate()).toBe(false);
  resolve({ ...available(), reason: 'user-canceled' });
  await starting;
  expect(updates.reloadAsync).not.toHaveBeenCalled();
});

test('OTA reload retains the gate even after reloadAsync resolves', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(available());
  storage.getItem.mockResolvedValue(
    JSON.stringify({
      updateId: 'pending',
      fetchedAt: 'now',
      runtimeVersion: '1.6.0',
      applicationId: Application.applicationId,
      nativeBuildVersion: '42',
    }),
  );
  const service = new UpdateService();
  expect(await service.applyPreparedOtaUpdateOnLaunch()).toBe(true);
  expect(await service.enableNativeUpdatePrompts()).toBe(false);
  expect(await service.startNativeUpdate()).toBe(false);
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
});

test('listener cleanup is idempotent, late checks and events cannot attach after unmount', async () => {
  let resolve!: (s: UpdateStatus) => void;
  mockNative.getUpdateStatus.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  const checking = service.checkForNativeUpdate();
  detach();
  detach();
  resolve(available());
  await checking;
  expect(mockNative.addInstallStateListener).not.toHaveBeenCalled();
  expect(mockRemoveAppState).toHaveBeenCalledTimes(1);
});

test('completion failures remain recoverable and never reload OTA', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(ready());
  mockNative.completeFlexibleUpdate.mockRejectedValueOnce(new Error('install failed'));
  const service = new UpdateService();
  expect(await service.completeNativeUpdate()).toBe(false);
  expect(service.getNativeUpdateSnapshot()).toMatchObject({ phase: 'error', busy: false });
  expect(updates.reloadAsync).not.toHaveBeenCalled();
  expect(await service.completeNativeUpdate()).toBe(true);
});

test('successful immediate UI retains the gate while the native process is being replaced', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(available());
  const service = new UpdateService('immediate');
  expect(await service.startNativeUpdate()).toBe(true);
  expect(await service.applyPreparedOtaUpdateOnLaunch()).toBe(false);
  expect(updates.reloadAsync).not.toHaveBeenCalled();
});

test('Play declining a flow is a handled failure rather than a phantom download', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(available());
  mockNative.startFlexibleUpdate.mockResolvedValueOnce({
    ...available(),
    reason: 'update-not-allowed',
  });
  const service = new UpdateService();
  expect(await service.startNativeUpdate()).toBe(false);
  expect(service.getNativeUpdateSnapshot()).toMatchObject({ phase: 'error', busy: false });
});

test('install-ready events arriving before native consent resolves are preserved', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(available());
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  mockNative.startFlexibleUpdate.mockImplementationOnce(async () => {
    mockInstallListener?.({
      platform: 'android',
      supported: true,
      installStatus: 'downloaded',
      reason: 'flexible-update-downloaded',
    });
    return available();
  });
  expect(await service.startNativeUpdate()).toBe(true);
  expect(service.getNativeUpdateSnapshot()).toMatchObject({ phase: 'ready', busy: false });
  detach();
});

test.each([
  ['flexible', 'failed', 'error'],
  ['flexible', 'canceled', 'idle'],
  ['immediate', 'failed', 'error'],
  ['immediate', 'canceled', 'idle'],
] as const)(
  '%s consent cannot overwrite a newer %s install event',
  async (policy, installStatus, phase) => {
    mockNative.getUpdateStatus.mockResolvedValue(available());
    const service = new UpdateService(policy);
    const detach = service.attachUpdateLifecycle();
    const start =
      policy === 'flexible' ? mockNative.startFlexibleUpdate : mockNative.startImmediateUpdate;
    start.mockImplementationOnce(async () => {
      mockInstallListener?.({
        platform: 'android',
        supported: true,
        installStatus,
        reason: 'install-state-changed',
      });
      return available();
    });
    expect(await service.startNativeUpdate()).toBe(false);
    expect(service.getNativeUpdateSnapshot()).toMatchObject({ phase, busy: false });
    detach();
  },
);

test('an install failure event wins over the completion method returning cached ready status', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(ready());
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  mockNative.completeFlexibleUpdate.mockImplementationOnce(async () => {
    mockInstallListener?.({
      platform: 'android',
      supported: true,
      installStatus: 'failed',
      reason: 'install-state-changed',
    });
    return ready();
  });
  expect(await service.completeNativeUpdate()).toBe(false);
  expect(service.getNativeUpdateSnapshot()).toMatchObject({ phase: 'error', busy: false });
  detach();
});

test('a slow status snapshot cannot overwrite a newer install-ready event', async () => {
  mockNative.getUpdateStatus.mockResolvedValue(availableWithStatus('downloading'));
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.checkForNativeUpdate();
  let resolve!: (s: UpdateStatus) => void;
  mockNative.getUpdateStatus.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const checking = service.checkForNativeUpdate();
  mockInstallListener?.({
    platform: 'android',
    supported: true,
    installStatus: 'downloaded',
    reason: 'flexible-update-downloaded',
  });
  resolve(availableWithStatus('downloading'));
  await checking;
  expect(service.getNativeUpdateSnapshot().phase).toBe('ready');
  detach();
});

test('backgrounding while a check is pending never launches a new native UI', async () => {
  let resolve!: (s: UpdateStatus) => void;
  mockNative.getUpdateStatus.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const starting = new UpdateService().startNativeUpdate();
  Object.assign(AppState, { currentState: 'background' });
  resolve(available());
  expect(await starting).toBe(false);
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
});

test('download failures release the install gate and have no automatic retry loop', async () => {
  const service = new UpdateService();
  const detach = service.attachUpdateLifecycle();
  await service.checkForNativeUpdate();
  mockInstallListener?.({
    platform: 'android',
    supported: true,
    installStatus: 'failed',
    reason: 'install-state-changed',
    errorCode: '-1',
  });
  expect(service.getNativeUpdateSnapshot()).toMatchObject({ phase: 'error', busy: false });
  expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
  detach();
});

test('does not offer an unusable update action when Play allows no flow or store fallback', async () => {
  mockNative.getUpdateStatus.mockResolvedValue({
    ...available({ immediate: false, flexible: false }),
    capabilities: { ...status().capabilities, storePage: false },
  });
  const service = new UpdateService();
  expect((await service.checkForNativeUpdate()).kind).toBe('available');
  expect(service.getNativeUpdateSnapshot().phase).toBe('idle');
});

test.each(['read', 'clear'])(
  'native installation arriving during OTA marker %s defers reload and preserves the marker',
  async (stage) => {
    const pending = JSON.stringify({
      updateId: 'pending',
      fetchedAt: 'now',
      runtimeVersion: '1.6.0',
      applicationId: Application.applicationId,
      nativeBuildVersion: '42',
    });
    const installing = () =>
      mockInstallListener?.({
        platform: 'android',
        supported: true,
        installStatus: 'installing',
        reason: 'install-state-changed',
      });
    storage.getItem.mockImplementationOnce(async () => {
      if (stage === 'read') installing();
      return pending;
    });
    storage.removeItem.mockImplementationOnce(async () => {
      if (stage === 'clear') installing();
    });
    const service = new UpdateService();
    const detach = service.attachUpdateLifecycle();
    expect(await service.applyPreparedOtaUpdateOnLaunch()).toBe(false);
    expect(updates.reloadAsync).not.toHaveBeenCalled();
    if (stage === 'read') expect(storage.removeItem).not.toHaveBeenCalled();
    else expect(storage.setItem).toHaveBeenCalledWith('@ota_pending_update', pending);
    detach();
  },
);
