import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import * as crypto from 'crypto-js';
import { fetchCustomApi } from '../utils/customApi';
import { secureStorageService } from './secureStorageService';

const GRAVATAR_AVATAR_BASE_URL = 'https://www.gravatar.com/avatar';
const GRAVATAR_PROFILE_BASE_URL = 'https://gravatar.com';

const AUTH_STATE_CHANGE_EVENT = 'auth_state_changed';
const SKIP_LOGIN_KEY = '@planner_skip_login';
const LOGIN_DISMISSED_KEY = '@login_notification_dismissed';
const GRAVATAR_CACHE_KEY = '@gravatar_cache';
const AUTH_VERSION_KEY = '@auth_version';
const CURRENT_AUTH_VERSION = '3'; // Increment this when auth system changes

// Add timeout constants for network requests
const REQUEST_TIMEOUT = 8000; // 8 seconds timeout

interface AuthResponse {
    token: string;
    message?: string;
}

export interface UserData {
    email: string;
    idnp?: string;
    is_verified: boolean;
}

interface GravatarProfile {
    hash: string;
    display_name?: string;
    avatar_url?: string;
    location?: string;
    description?: string;
    pronouns?: string;
}

interface GravatarCache {
    timestamp: number;
    profile: GravatarProfile;
}

interface GravatarJsonProfileEntry {
    displayName?: string;
    preferredUsername?: string;
    thumbnailUrl?: string;
    aboutMe?: string;
    currentLocation?: string;
    pronouns?: string;
    photos?: {
        type?: string;
        value?: string;
    }[];
}

interface GravatarJsonProfileResponse {
    entry?: GravatarJsonProfileEntry[];
}

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const getGravatarCacheKey = (hash: string) => `${GRAVATAR_CACHE_KEY}:${hash}`;

export const getGravatarHash = (email: string): string => {
    // Convert email to lowercase and trim
    const normalizedEmail = email.toLowerCase().trim();
    // Create SHA-256 hash
    return crypto.SHA256(normalizedEmail).toString();
};

export const getGravatarProfile = async (
    email: string,
): Promise<GravatarProfile | null> => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
        return null;
    }

    const hash = getGravatarHash(normalizedEmail);
    const cacheKey = getGravatarCacheKey(hash);
    const fallbackProfile: GravatarProfile = {
        hash,
        avatar_url: `${GRAVATAR_AVATAR_BASE_URL}/${hash}?d=mp`,
    };

    try {
        // Check cache first
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
            const cache: GravatarCache = JSON.parse(cachedData);
            // If cache is less than 24 hours old, use it
            if (Date.now() - cache.timestamp < CACHE_EXPIRY) {
                return cache.profile;
            }
        }

        let profile: GravatarProfile = fallbackProfile;
        const profileResponse = await fetch(
            `${GRAVATAR_PROFILE_BASE_URL}/${hash}.json`,
        );

        if (profileResponse.ok) {
            const profileJson =
                (await profileResponse.json()) as GravatarJsonProfileResponse;
            const entry = profileJson.entry?.[0];
            const thumbnailPhoto = entry?.photos?.find(
                (photo) => photo.type === 'thumbnail',
            )?.value;

            profile = {
                ...fallbackProfile,
                display_name:
                    entry?.displayName?.trim() ||
                    entry?.preferredUsername?.trim() ||
                    undefined,
                avatar_url:
                    entry?.thumbnailUrl ||
                    thumbnailPhoto ||
                    fallbackProfile.avatar_url,
                location: entry?.currentLocation || undefined,
                description: entry?.aboutMe || undefined,
                pronouns: entry?.pronouns || undefined,
            };
        } else if (profileResponse.status !== 404) {
            console.warn(
                `Failed to load Gravatar profile metadata (status: ${profileResponse.status})`,
            );
        }

        // Cache the profile
        const cacheData: GravatarCache = {
            timestamp: Date.now(),
            profile,
        };
        await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify(cacheData),
        );

        return profile;
    } catch (error) {
        console.error('Error fetching Gravatar profile:', error);
        return fallbackProfile;
    }
};

class AuthService {
    private static instance: AuthService;
    private token: string | null = null;
    private userData: UserData | null = null;
    private lastLoginEmail: string | null = null;
    private sessionPassword: string | null = null;
    private skippedLogin: boolean = false;
    private isLoading: boolean = false;
    private isReloginInProgress: boolean = false;

    private constructor() {}

    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
            // Initialize auth check on first getInstance call
            AuthService.instance.init();
        }
        return AuthService.instance;
    }

    // Initialize and check auth version
    private init(): void {
        // Run async initialization in background
        this.checkAuthVersion().catch((error) => {
            console.error('Error during auth initialization:', error);
        });
    }

    // Add method to check and update auth version
    async checkAuthVersion(): Promise<boolean> {
        try {
            const storedVersion = await AsyncStorage.getItem(AUTH_VERSION_KEY);

            if (storedVersion !== CURRENT_AUTH_VERSION) {
                // Version mismatch - need to reset auth state
                await this.logout();
                await AsyncStorage.setItem(
                    AUTH_VERSION_KEY,
                    CURRENT_AUTH_VERSION,
                );
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error checking auth version:', error);
            return false;
        }
    }

    // Public method to force auth reset
    async forceAuthReset(): Promise<void> {
        await this.logout();
        await AsyncStorage.setItem(AUTH_VERSION_KEY, CURRENT_AUTH_VERSION);
    }

    // Add getGravatarProfile as a public method
    async getGravatarProfile(email: string): Promise<GravatarProfile | null> {
        return getGravatarProfile(email);
    }

    private async setPersistedToken(token: string): Promise<void> {
        await secureStorageService.setAuthToken(token);
    }

    private async getPersistedToken(): Promise<string | null> {
        return secureStorageService.getAuthToken();
    }

    private async clearPersistedToken(): Promise<void> {
        await secureStorageService.clearAuthToken();
    }

    private clearInMemoryCredentials(): void {
        this.lastLoginEmail = null;
        this.sessionPassword = null;
    }

    private async makeAuthRequest(
        endpoint: string,
        method: string,
        body?: any,
        retry: boolean = true,
    ): Promise<any> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetchCustomApi(endpoint, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                timeoutMs: REQUEST_TIMEOUT,
            });

            if (!response.ok) {
                // Handle 401 Unauthorized - expired token
                if (
                    response.status === 401 &&
                    retry &&
                    !this.isReloginInProgress
                ) {
                    // Try to relogin and retry the request
                    const success = await this.attemptRelogin();
                    if (success) {
                        // Retry the original request with new token
                        return this.makeAuthRequest(
                            endpoint,
                            method,
                            body,
                            false,
                        );
                    }
                }

                const errorText = await response.text();
                const fallbackMessage = `Request failed (${response.status})`;
                let message = fallbackMessage;

                if (errorText) {
                    try {
                        const errorData = JSON.parse(errorText) as {
                            detail?: string;
                            message?: string;
                        };
                        message = errorData.detail || errorData.message || fallbackMessage;
                    } catch {
                        message = errorText;
                    }
                }

                throw new Error(message);
            }

            // Check if response has content before parsing JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.indexOf('application/json') !== -1) {
                return await response.json();
            } else {
                // Return empty object or handle non-JSON response as needed
                return {};
            }
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
            }
            throw error;
        }
    }

    async signup(
        email: string,
        password: string,
        confirmPassword: string,
    ): Promise<AuthResponse> {
        try {
            const response = await this.makeAuthRequest(
                '/auth/signup',
                'POST',
                {
                    email,
                    password,
                    confirm_password: confirmPassword,
                },
            );
            return response;
        } catch (error) {
            throw error;
        }
    }

    async login(email: string, password: string): Promise<AuthResponse> {
        try {
            const response = await this.makeAuthRequest('/auth/login', 'POST', {
                email,
                password,
            });

            if (response.access_token) {
                this.token = response.access_token;
                this.lastLoginEmail = email;
                this.sessionPassword = password;
                await this.setPersistedToken(response.access_token);
                // Clear skip login flag when user explicitly logs in
                await AsyncStorage.removeItem(SKIP_LOGIN_KEY);
                this.skippedLogin = false;
                await this.loadUserData();
                DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, {
                    isAuthenticated: true,
                    skipped: false,
                    freshLogin: true,
                });
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    private async attemptRelogin(): Promise<boolean> {
        if (this.isReloginInProgress) {
            return false;
        }

        this.isReloginInProgress = true;
        try {
            if (!this.lastLoginEmail || !this.sessionPassword) {
                this.isReloginInProgress = false;
                return false;
            }

            const response = await this.makeAuthRequest(
                '/auth/login',
                'POST',
                {
                    email: this.lastLoginEmail,
                    password: this.sessionPassword,
                },
                false,
            ); // Don't retry on this login attempt

            if (response.access_token) {
                this.token = response.access_token;
                await this.setPersistedToken(response.access_token);
                await this.loadUserData();
                this.isReloginInProgress = false;
                return true;
            }

            this.isReloginInProgress = false;
            return false;
        } catch {
            this.isReloginInProgress = false;
            return false;
        }
    }

    async verifyEmail(token: string): Promise<boolean> {
        try {
            await this.makeAuthRequest(
                `/auth/verify-email?token=${token}`,
                'POST',
            );
            await this.loadUserData();
            return true;
        } catch {
            return false;
        }
    }

    async requestPasswordReset(email: string): Promise<void> {
        try {
            await this.makeAuthRequest('/auth/forgot-password', 'POST', {
                email,
            });
        } catch (error) {
            throw error;
        }
    }

    async resetPassword(token: string, newPassword: string): Promise<boolean> {
        try {
            await this.makeAuthRequest(
                `/auth/reset-password?token=${token}`,
                'POST',
                {
                    password: newPassword,
                    confirm_password: newPassword,
                },
            );
            return true;
        } catch {
            return false;
        }
    }

    async deleteAccount(password: string): Promise<void> {
        try {
            if (!this.userData?.email) {
                throw new Error('User not authenticated');
            }

            await this.makeAuthRequest(
                '/auth/delete-account/initiate',
                'POST',
                {
                    password,
                },
            );

            await this.logout();
        } catch (error) {
            throw error;
        }
    }

    async logout(): Promise<void> {
        this.token = null;
        this.userData = null;
        this.skippedLogin = false;
        this.clearInMemoryCredentials();
        try {
            // Clear auth tokens and login flags.
            await this.clearPersistedToken();
            await AsyncStorage.removeItem(SKIP_LOGIN_KEY);
            await AsyncStorage.removeItem(LOGIN_DISMISSED_KEY);

            // Reset settings sync state keys directly
            await AsyncStorage.removeItem('@initial_settings_download_done');
            await AsyncStorage.removeItem('@last_settings_sync');

            DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, {
                isAuthenticated: false,
                skipped: false,
                freshLogin: false,
            });
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }

    async skipLogin(): Promise<void> {
        this.token = null;
        this.userData = null;
        this.skippedLogin = true;
        this.clearInMemoryCredentials();
        await this.clearPersistedToken();
        await AsyncStorage.setItem(SKIP_LOGIN_KEY, 'true');
        DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, {
            isAuthenticated: false,
            skipped: true,
            freshLogin: false,
        });
    }

    async loadUserData(): Promise<UserData | null> {
        // Check auth version first before loading user data
        await this.checkAuthVersion();

        // Prevent multiple concurrent loading operations
        if (this.isLoading) {
            return this.userData;
        }

        this.isLoading = true;

        try {
            // First check if user has skipped login
            const hasSkippedLogin = await AsyncStorage.getItem(SKIP_LOGIN_KEY);
            if (hasSkippedLogin === 'true') {
                this.skippedLogin = true;
                // Emit auth state with skipped = true
                DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, {
                    isAuthenticated: false,
                    skipped: true,
                    freshLogin: false, // Not a fresh login
                });
                this.isLoading = false;
                return null;
            }
        } catch (error) {
            console.error('Error checking skip login status:', error);
        }

        // Then check for auth token
        if (!this.token) {
            try {
                const storedToken = await this.getPersistedToken();
                if (!storedToken) {
                    this.isLoading = false;
                    return null;
                }
                this.token = storedToken;
            } catch (error) {
                console.error('Error loading stored auth token:', error);
                this.isLoading = false;
                return null;
            }
        }

        // Finally, try to fetch user data with timeout
        try {
            const userData = await this.makeAuthRequest('/auth/me', 'GET');
            this.userData = userData;
            DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, {
                isAuthenticated: true,
                skipped: false,
                freshLogin: false, // Not a fresh login, just loading existing auth
            });
            this.isLoading = false;
            return userData;
        } catch (error: any) {
            // Only logout if it's not a timeout error
            if (error.message !== 'Request timeout') {
                await this.logout();
            }
            this.isLoading = false;
            return null;
        }
    }

    isAuthenticated(): boolean {
        const auth = !!this.token;
        return auth;
    }

    hasSkippedLogin(): boolean {
        return this.skippedLogin;
    }

    getCurrentUser(): UserData | null {
        return this.userData;
    }

    isLoadingUserData(): boolean {
        return this.isLoading;
    }

    async getAccessToken(): Promise<string | null> {
        if (this.token) {
            return this.token;
        }

        const storedToken = await this.getPersistedToken();
        if (storedToken) {
            this.token = storedToken;
        }
        return this.token;
    }

    // Session-only credential used for secure sync operations.
    async getCredentialsForEncryption(): Promise<string | null> {
        return this.sessionPassword;
    }

    /**
     * Sends plaintext data and the user's password to the server for encryption and storage.
     * @param key The key identifying the data type (e.g., 'idnp').
     * @param data The string data to encrypt and sync.
     */
    async encryptAndSyncData(key: string, data: string): Promise<void> {
        if (!this.isAuthenticated()) {
            console.warn('User not authenticated. Cannot sync encrypted data.');
            // Optionally throw an error or return early
            return;
            // throw new Error('User not authenticated');
        }

        try {
            const password = await this.getCredentialsForEncryption();
            if (!password) {
                console.error('Could not retrieve credentials for encryption.');
                throw new Error('Credentials not found for encryption.');
            }

            // Send the plaintext data and password to the server endpoint
            // The server will handle the encryption using the provided password
            await this.makeAuthRequest('/secure/encrypt-data', 'POST', {
                data_label: key, // Changed from 'key' to 'data_label' to match settingsService pattern
                plaintext: data,
                password,
            });
        } catch (error) {
            console.error(
                `Error sending data for server-side encryption (key: '${key}'):`,
                error,
            );
            // Optionally re-throw or handle the error (e.g., show a notification)
            throw error; // Re-throwing to allow the caller to handle it
        }
    }

    /**
     * Deletes encrypted data from the server.
     * @param key The key identifying the data type to delete (e.g., 'idnp').
     */
    async deleteEncryptedData(key: string): Promise<void> {
        if (!this.isAuthenticated()) {
            console.warn(
                'User not authenticated. Cannot delete encrypted data.',
            );
            return;
        }

        try {
            await this.makeAuthRequest(
                `/secure/delete-encrypted-data/${key}`,
                'DELETE',
            );
        } catch (error) {
            console.error(
                `Error deleting encrypted data (key: '${key}'):`,
                error,
            );
            throw error;
        }
    }
}

export default AuthService.getInstance();
