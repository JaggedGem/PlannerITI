import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

import { getGravatarProfile } from './gravatarService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  CryptoEncoding: { HEX: 'hex' },
  digestStringAsync: jest.fn(async (_algorithm: string, email: string) => `hash-${email}`),
}));
jest.mock('@/utils/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }));

const DAY_MS = 24 * 60 * 60 * 1000;
const metadata = () =>
  new Response(
    JSON.stringify({
      entry: [{ displayName: 'Student', thumbnailUrl: 'https://example.com/avatar.jpg' }],
    }),
  );
let email: string;
let sequence = 0;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T12:00:00Z'));
  jest.clearAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  email = `student-${++sequence}@example.com`;
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('deduplicates concurrent requests for the same normalized email', async () => {
  jest.mocked(fetchWithTimeout).mockResolvedValueOnce(metadata());
  const profiles = await Promise.all([
    getGravatarProfile(email),
    getGravatarProfile(` ${email.toUpperCase()} `),
    getGravatarProfile(email),
  ]);
  expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
  expect(profiles[0]).toBe(profiles[1]);
  expect(profiles[0]?.avatar_url).toBe('https://example.com/avatar.jpg');
});

it('uses memory cache without disk or network work during the 24-hour TTL', async () => {
  jest.mocked(fetchWithTimeout).mockResolvedValueOnce(metadata());
  const first = await getGravatarProfile(email);
  const second = await getGravatarProfile(email);
  expect(first).toBe(second);
  expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
  expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
});

it('uses a valid persistent cache after a cold start', async () => {
  const profile = { hash: `hash-${email}`, avatar_url: 'https://example.com/persisted.jpg' };
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValueOnce(JSON.stringify({ timestamp: Date.now() - 1000, profile }));
  expect((await getGravatarProfile(email))?.avatar_url).toBe(profile.avatar_url);
  expect(fetchWithTimeout).not.toHaveBeenCalled();
});

it('refreshes after expiration and keeps a stale avatar with retry backoff on failure', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest
    .mocked(fetchWithTimeout)
    .mockResolvedValueOnce(metadata())
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(metadata());
  const first = await getGravatarProfile(email);
  jest.setSystemTime(Date.now() + DAY_MS);
  expect(await getGravatarProfile(email)).toBe(first);
  expect(await getGravatarProfile(email)).toBe(first);
  expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
  // A failed refresh does not replace the last good persistent avatar.
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now() + 5 * 60 * 1000);
  await getGravatarProfile(email);
  expect(fetchWithTimeout).toHaveBeenCalledTimes(3);
});

it('caches missing profiles so their default avatar does not cause repeated lookups', async () => {
  jest.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response('', { status: 404 }));
  expect((await getGravatarProfile(email))?.avatar_url).toContain('?d=mp');
  await getGravatarProfile(email);
  expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
});

it('recovers from corrupt storage instead of repeatedly failing before fetching', async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce('invalid JSON');
  jest.mocked(fetchWithTimeout).mockResolvedValueOnce(metadata());
  expect((await getGravatarProfile(email))?.display_name).toBe('Student');
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
});

it('keeps fetched data in memory even if persistence fails', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  jest.mocked(fetchWithTimeout).mockResolvedValueOnce(metadata());
  expect((await getGravatarProfile(email))?.display_name).toBe('Student');
  expect((await getGravatarProfile(email))?.display_name).toBe('Student');
  expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
});

it('backs off first-load failures and retries rather than caching a failed result for a whole day', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest
    .mocked(fetchWithTimeout)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(metadata());
  await getGravatarProfile(email);
  await getGravatarProfile(email);
  expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
  jest.setSystemTime(Date.now() + 5 * 60 * 1000);
  expect((await getGravatarProfile(email))?.display_name).toBe('Student');
});

it('does not share cached identity between different accounts', async () => {
  jest.mocked(fetchWithTimeout).mockResolvedValueOnce(metadata()).mockResolvedValueOnce(metadata());
  const first = await getGravatarProfile(email);
  const second = await getGravatarProfile('other-' + email);
  expect(first?.hash).not.toBe(second?.hash);
  expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
});

it('does not request a profile for an empty email', async () => {
  expect(await getGravatarProfile('  ')).toBeNull();
  expect(fetchWithTimeout).not.toHaveBeenCalled();
});
