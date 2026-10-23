import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Crypto from 'expo-crypto';

import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { isRecord } from '@/utils/json';

export interface GravatarProfile {
  hash: string;
  display_name?: string;
  avatar_url?: string;
  location?: string;
  description?: string;
  pronouns?: string;
}

interface CacheEntry {
  timestamp: number;
  profile: GravatarProfile;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const memoryCache = new Map<string, CacheEntry>();
const retryAfter = new Map<string, number>();
const pendingRequests = new Map<string, Promise<GravatarProfile>>();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const avatarUrl = (value: unknown): string | undefined => {
  const text = optionalText(value);
  return text && /^https?:\/\//i.test(text) ? text : undefined;
};
const isFresh = (entry: CacheEntry): boolean => {
  const age = Date.now() - entry.timestamp;
  return age >= 0 && age < CACHE_TTL_MS;
};

export const getGravatarHash = (email: string): Promise<string> =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalizeEmail(email), {
    encoding: Crypto.CryptoEncoding.HEX,
  });

const readCacheEntry = (raw: string, fallback: GravatarProfile): CacheEntry | null => {
  const entry: unknown = JSON.parse(raw);
  if (
    !isRecord(entry) ||
    typeof entry.timestamp !== 'number' ||
    !Number.isFinite(entry.timestamp) ||
    !isRecord(entry.profile) ||
    entry.profile.hash !== fallback.hash
  )
    return null;
  const profile = entry.profile;
  return {
    timestamp: entry.timestamp,
    profile: {
      ...fallback,
      display_name: optionalText(profile.display_name),
      avatar_url: avatarUrl(profile.avatar_url) ?? fallback.avatar_url,
      location: optionalText(profile.location),
      description: optionalText(profile.description),
      pronouns: optionalText(profile.pronouns),
    },
  };
};

const parseProfile = (raw: unknown, fallback: GravatarProfile): GravatarProfile => {
  if (!isRecord(raw) || !Array.isArray(raw.entry)) throw new Error('Invalid Gravatar response');
  const entry: unknown = raw.entry[0];
  if (!entry) return fallback;
  if (!isRecord(entry)) throw new Error('Invalid Gravatar profile');
  const photo = Array.isArray(entry.photos)
    ? entry.photos.find((value: unknown) => isRecord(value) && value.type === 'thumbnail')
    : undefined;
  return {
    ...fallback,
    display_name: optionalText(entry.displayName) ?? optionalText(entry.preferredUsername),
    avatar_url:
      avatarUrl(entry.thumbnailUrl) ??
      (isRecord(photo) ? avatarUrl(photo.value) : undefined) ??
      fallback.avatar_url,
    location: optionalText(entry.currentLocation),
    description: optionalText(entry.aboutMe),
    pronouns: optionalText(entry.pronouns),
  };
};

async function loadProfile(email: string): Promise<GravatarProfile> {
  let cached = memoryCache.get(email);
  if (cached && (isFresh(cached) || Date.now() < (retryAfter.get(email) ?? 0)))
    return cached.profile;

  const hash = await getGravatarHash(email);
  const key = `@gravatar_cache:${hash}`;
  const fallback = { hash, avatar_url: `https://www.gravatar.com/avatar/${hash}?d=mp` };
  if (!cached) {
    try {
      const stored = await AsyncStorage.getItem(key);
      cached = stored ? (readCacheEntry(stored, fallback) ?? undefined) : undefined;
      if (cached) {
        memoryCache.set(email, cached);
        if (isFresh(cached)) return cached.profile;
      }
    } catch {
      // A broken or unavailable disk cache must not prevent a network refresh.
    }
  }

  try {
    const response = await fetchWithTimeout(`https://gravatar.com/${hash}.json`);
    if (!response.ok && response.status !== 404)
      throw new Error(`Gravatar request failed (${response.status})`);
    // A missing profile is a valid result and uses the same TTL as a successful profile.
    const profile =
      response.status === 404 ? fallback : parseProfile(await response.json(), fallback);
    const entry = { timestamp: Date.now(), profile };
    memoryCache.set(email, entry);
    retryAfter.delete(email);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch {
      /* The memory cache still protects against repeated requests. */
    }
    return profile;
  } catch (error) {
    // Preserve the last good avatar through offline/server failures instead of caching a failure for 24 hours.
    const entry = cached ?? { timestamp: Number.NEGATIVE_INFINITY, profile: fallback };
    memoryCache.set(email, entry);
    retryAfter.set(email, Date.now() + RETRY_DELAY_MS);
    console.warn('Could not refresh Gravatar profile; using cached avatar:', error);
    return entry.profile;
  }
}

export async function getGravatarProfile(email: string): Promise<GravatarProfile | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const pending = pendingRequests.get(normalized);
  if (pending) return pending;
  const request = loadProfile(normalized);
  pendingRequests.set(normalized, request);
  try {
    return await request;
  } finally {
    if (pendingRequests.get(normalized) === request) pendingRequests.delete(normalized);
  }
}
