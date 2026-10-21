import { NativeUpdateClient } from './nativeUpdateClient';

const mockLoad = jest.fn(() => {
  throw new Error('Missing Nitro object');
});
jest.mock('@rnforge/react-native-in-app-updates', () => mockLoad());
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-application', () => ({ applicationId: 'site.jagged.planneriti' }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
}));

test('missing native module is nonfatal and never retried within the adapter', async () => {
  Object.assign(globalThis, { __DEV__: false });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const client = new NativeUpdateClient();
    expect(await client.check()).toEqual({
      kind: 'unsupported',
      reason: 'native-module-unavailable',
    });
    expect(await client.check()).toEqual({
      kind: 'unsupported',
      reason: 'native-module-unavailable',
    });
    expect(mockLoad).toHaveBeenCalledTimes(1);
  } finally {
    warn.mockRestore();
  }
});
