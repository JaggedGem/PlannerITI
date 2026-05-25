import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_STORAGE_KEY = '@auth_token';
const IDNP_STORAGE_KEY = '@planner_idnp';
const SECURE_STORE_NAMESPACE = 'planneriti';

const SECURE_STORE_ALLOWED_KEY = /^[A-Za-z0-9._-]+$/;

const toSecureStoreKey = (key: string): string => {
    const trimmedKey = key.trim();

    if (trimmedKey && SECURE_STORE_ALLOWED_KEY.test(trimmedKey)) {
        return trimmedKey;
    }

    const sanitized = trimmedKey
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return `${SECURE_STORE_NAMESPACE}_${sanitized || 'key'}`;
};

const canUseSecureStore = async (): Promise<boolean> => {
    try {
        return await SecureStore.isAvailableAsync();
    } catch {
        return false;
    }
};

const getWithMigration = async (key: string): Promise<string | null> => {
    const secureStoreKey = toSecureStoreKey(key);
    const secureStoreAvailable = await canUseSecureStore();

    if (secureStoreAvailable) {
        try {
            const secureValue = await SecureStore.getItemAsync(secureStoreKey);
            if (secureValue) {
                return secureValue;
            }
        } catch {
            // Fall back to legacy AsyncStorage path.
        }
    }

    const legacyValue = await AsyncStorage.getItem(key);
    if (!legacyValue) {
        return null;
    }

    if (secureStoreAvailable) {
        try {
            await SecureStore.setItemAsync(secureStoreKey, legacyValue);
            await AsyncStorage.removeItem(key);
        } catch {
            // Keep returning legacy value even if migration fails.
        }
    }

    return legacyValue;
};

const setSecureValue = async (key: string, value: string): Promise<void> => {
    const secureStoreKey = toSecureStoreKey(key);
    if (await canUseSecureStore()) {
        await SecureStore.setItemAsync(secureStoreKey, value);
        // Clean up legacy fallback storage if it exists.
        await AsyncStorage.removeItem(key);
        return;
    }

    await AsyncStorage.setItem(key, value);
};

const deleteSecureValue = async (key: string): Promise<void> => {
    const secureStoreKey = toSecureStoreKey(key);
    try {
        if (await canUseSecureStore()) {
            await SecureStore.deleteItemAsync(secureStoreKey);
        }
    } finally {
        await AsyncStorage.removeItem(key);
    }
};

export const secureStorageService = {
    AUTH_TOKEN_STORAGE_KEY,
    IDNP_STORAGE_KEY,
    getAuthToken: async (): Promise<string | null> =>
        getWithMigration(AUTH_TOKEN_STORAGE_KEY),
    setAuthToken: async (token: string): Promise<void> =>
        setSecureValue(AUTH_TOKEN_STORAGE_KEY, token),
    clearAuthToken: async (): Promise<void> =>
        deleteSecureValue(AUTH_TOKEN_STORAGE_KEY),
    getIdnp: async (): Promise<string | null> => getWithMigration(IDNP_STORAGE_KEY),
    setIdnp: async (idnp: string): Promise<void> =>
        setSecureValue(IDNP_STORAGE_KEY, idnp),
    clearIdnp: async (): Promise<void> => deleteSecureValue(IDNP_STORAGE_KEY),
};
