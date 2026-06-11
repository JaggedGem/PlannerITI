import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    GraficPePeriod,
    NextScheduledClass,
} from '@/types/academicCalendar';
import { toLocalDateKey } from '@/utils/academicCalendarUtils';

const NEXT_CLASS_CACHE_PREFIX = '@next_class_cache_';
const NEXT_CLASS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface NextClassCacheEntry {
    expiresAt: number;
    value: NextScheduledClass | null;
}

interface StoredNextClassCacheEntry {
    expiresAt: number;
    value:
        | (Omit<NextScheduledClass, 'date'> & {
              date: string;
          })
        | null;
}

export interface NextClassCacheLookup {
    found: boolean;
    value: NextScheduledClass | null;
}

interface BuildNextClassCacheKeyOptions {
    selectedGroupId: string;
    selectedGroupName: string;
    subgroup: string;
    scheduleRefreshVersion: number;
    fromDate: Date;
    sharedAcademicPeriod?: GraficPePeriod | null;
}

const memoryCache = new Map<string, NextClassCacheEntry>();

const normalizeKeyPart = (value: string): string =>
    value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');

const missingLookup = (): NextClassCacheLookup => ({
    found: false,
    value: null,
});

const lookupEntry = (
    entry: NextClassCacheEntry | undefined,
    now: number,
): NextClassCacheLookup => {
    if (!entry || entry.expiresAt <= now) return missingLookup();
    return { found: true, value: entry.value };
};

export const buildNextClassCacheKey = ({
    selectedGroupId,
    selectedGroupName,
    subgroup,
    scheduleRefreshVersion,
    fromDate,
    sharedAcademicPeriod,
}: BuildNextClassCacheKeyOptions): string => {
    const group =
        normalizeKeyPart(selectedGroupId) ||
        normalizeKeyPart(selectedGroupName) ||
        'NO_GROUP';
    const periodScope =
        sharedAcademicPeriod ?
            [
                sharedAcademicPeriod.type,
                sharedAcademicPeriod.startDate,
                sharedAcademicPeriod.endDate,
            ].join(':')
        :   `date:${toLocalDateKey(fromDate)}`;

    return [
        group,
        normalizeKeyPart(subgroup) || 'NO_SUBGROUP',
        `v${scheduleRefreshVersion}`,
        periodScope,
    ].join('|');
};

export const peekNextClassCache = (
    cacheKey: string,
    now: number = Date.now(),
): NextClassCacheLookup => {
    const entry = memoryCache.get(cacheKey);
    const lookup = lookupEntry(entry, now);
    if (!lookup.found && entry) memoryCache.delete(cacheKey);
    return lookup;
};

export const readNextClassCache = async (
    cacheKey: string,
    now: number = Date.now(),
): Promise<NextClassCacheLookup> => {
    const memoryLookup = peekNextClassCache(cacheKey, now);
    if (memoryLookup.found) return memoryLookup;

    try {
        const raw = await AsyncStorage.getItem(
            `${NEXT_CLASS_CACHE_PREFIX}${cacheKey}`,
        );
        if (!raw) return missingLookup();

        const stored = JSON.parse(raw) as StoredNextClassCacheEntry;
        if (!stored || stored.expiresAt <= now) {
            void AsyncStorage.removeItem(
                `${NEXT_CLASS_CACHE_PREFIX}${cacheKey}`,
            );
            return missingLookup();
        }

        const value =
            stored.value ?
                {
                    ...stored.value,
                    date: new Date(`${stored.value.date}T00:00:00`),
                }
            :   null;
        memoryCache.set(cacheKey, {
            expiresAt: stored.expiresAt,
            value,
        });
        return { found: true, value };
    } catch {
        return missingLookup();
    }
};

export const writeNextClassCache = async (
    cacheKey: string,
    value: NextScheduledClass | null,
    now: number = Date.now(),
): Promise<void> => {
    const expiresAt = now + NEXT_CLASS_CACHE_TTL_MS;
    memoryCache.set(cacheKey, { expiresAt, value });

    const stored: StoredNextClassCacheEntry = {
        expiresAt,
        value:
            value ?
                {
                    ...value,
                    date: toLocalDateKey(value.date),
                }
            :   null,
    };

    try {
        await AsyncStorage.setItem(
            `${NEXT_CLASS_CACHE_PREFIX}${cacheKey}`,
            JSON.stringify(stored),
        );
    } catch {
        // The in-memory cache still prevents repeated work in this session.
    }
};

export const clearNextClassCache = async (): Promise<void> => {
    memoryCache.clear();
    try {
        const keys = await AsyncStorage.getAllKeys();
        const nextClassKeys = keys.filter((key) =>
            key.startsWith(NEXT_CLASS_CACHE_PREFIX),
        );
        if (nextClassKeys.length > 0) {
            await AsyncStorage.multiRemove(nextClassKeys);
        }
    } catch {
        // Cache invalidation is best-effort.
    }
};

export const clearNextClassMemoryCache = (): void => {
    memoryCache.clear();
};
