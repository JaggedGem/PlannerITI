import AsyncStorage from '@react-native-async-storage/async-storage';

import { DeviceEventEmitter } from 'react-native';

import Constants from 'expo-constants';

import { AuthResponse, UserData } from '@/types/auth';
import { ApiError } from '@/utils/apiError';
import { parseAuthResponse, parseUserData } from '@/utils/authData';
import { isRecord } from '@/utils/json';

import { fetchCustomApi } from '../utils/customApi';
import { GravatarProfile, getGravatarProfile } from './gravatarService';
import { secureStorageService } from './secureStorageService';

export { getGravatarHash, getGravatarProfile } from './gravatarService';

export type { UserData } from '@/types/auth';

const AUTH_STATE_CHANGE_EVENT = 'auth_state_changed';
const SKIP_LOGIN_KEY = '@planner_skip_login';
const LOGIN_DISMISSED_KEY = '@login_notification_dismissed';
const AUTH_VERSION_KEY = '@auth_version';
const CURRENT_AUTH_VERSION = '3'; // Increment this when auth system changes

// Add timeout constants for network requests
const USER_PROFILE_TTL_MS = 5 * 60 * 1000;
const PROFILE_RETRY_DELAY_MS = 30 * 1000;
const REQUEST_TIMEOUT = 8000; // 8 seconds timeout

const getApiKey = (): string | null => {
  const apiKey = String(Constants.expoConfig?.extra?.apiKey || '').trim();
  return apiKey || null;
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
  private sessionGeneration = 0;
  private profileFetchedAt: number | null = null;
  private profileRetryAt = 0;
  private profileRequest: { generation: number; promise: Promise<UserData | null> } | null = null;

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
        await AsyncStorage.setItem(AUTH_VERSION_KEY, CURRENT_AUTH_VERSION);
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
    body?: Record<string, unknown>,
    retry: boolean = true,
    useApiKey: boolean = false,
    useBearerToken: boolean = true,
  ): Promise<unknown> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (useApiKey) {
      const apiKey = getApiKey();
      if (apiKey) {
        headers['api-key'] = apiKey;
      }
    }

    if (this.token && useBearerToken) {
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
        if (response.status === 401 && retry && !this.isReloginInProgress) {
          // Try to relogin and retry the request
          const success = await this.attemptRelogin();
          if (success) {
            // Retry the original request with new token
            return this.makeAuthRequest(endpoint, method, body, false, useApiKey, useBearerToken);
          }
        }

        const errorText = await response.text();
        const fallbackMessage = `Request failed (${response.status})`;
        let message = fallbackMessage;

        if (errorText) {
          try {
            const errorData: unknown = JSON.parse(errorText);
            if (isRecord(errorData)) {
              message =
                typeof errorData.detail === 'string'
                  ? errorData.detail
                  : typeof errorData.message === 'string'
                    ? errorData.message
                    : fallbackMessage;
            }
          } catch {
            message = errorText;
          }
        }

        throw new ApiError(message, response.status);
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

  async signup(email: string, password: string, confirmPassword: string): Promise<AuthResponse> {
    try {
      const response = await this.makeAuthRequest(
        '/auth/signup',
        'POST',
        {
          email,
          password,
          confirm_password: confirmPassword,
        },
        true,
        true,
        false, // Don't include bearer token for signup
      );
      return parseAuthResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const generation = this.sessionGeneration;
    try {
      const response = await this.makeAuthRequest(
        '/auth/login',
        'POST',
        {
          email,
          password,
        },
        true,
        true,
        false, // Don't include bearer token for login
      );

      if (generation !== this.sessionGeneration) throw new Error('Sign-in cancelled');
      const authResponse = parseAuthResponse(response);
      const accessToken = authResponse.access_token || authResponse.token;

      if (accessToken) {
        this.sessionGeneration += 1;
        this.profileFetchedAt = null;
        this.profileRetryAt = 0;
        this.token = accessToken;
        this.lastLoginEmail = email;
        this.sessionPassword = password;
        await this.setPersistedToken(accessToken);
        // Clear skip login flag when user explicitly logs in
        await AsyncStorage.removeItem(SKIP_LOGIN_KEY);
        this.skippedLogin = false;
        await this.loadUserData({ forceRefresh: true });
        DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, {
          isAuthenticated: true,
          skipped: false,
          freshLogin: true,
        });
      }

      return authResponse;
    } catch (error) {
      throw error;
    }
  }

  private async attemptRelogin(): Promise<boolean> {
    const generation = this.sessionGeneration;
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
        true,
        false, // Don't include bearer token for relogin
      ); // Don't retry on this login attempt

      if (generation !== this.sessionGeneration) return false;
      const authResponse = parseAuthResponse(response);
      const accessToken = authResponse.access_token || authResponse.token;

      if (accessToken) {
        this.token = accessToken;
        await this.setPersistedToken(accessToken);
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
      await this.makeAuthRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`, 'POST');
      await this.loadUserData({ forceRefresh: true });
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
        `/auth/reset-password?token=${encodeURIComponent(token)}`,
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

      await this.makeAuthRequest('/auth/delete-account/initiate', 'POST', {
        password,
      });

      await this.logout();
    } catch (error) {
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.sessionGeneration += 1;
    this.profileRequest = null;
    this.profileFetchedAt = null;
    this.profileRetryAt = 0;
    this.isLoading = false;
    this.token = null;
    this.userData = null;
    this.skippedLogin = false;
    this.clearInMemoryCredentials();
    try {
      // Clear auth tokens and login flags.
      await this.clearPersistedToken();
      await AsyncStorage.removeItem(SKIP_LOGIN_KEY);
      await AsyncStorage.removeItem(LOGIN_DISMISSED_KEY);
      await AsyncStorage.removeItem('@planner_user_cache');

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
    this.sessionGeneration += 1;
    this.profileRequest = null;
    this.profileFetchedAt = null;
    this.profileRetryAt = 0;
    this.isLoading = false;
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

  async loadUserData(options: { forceRefresh?: boolean } = {}): Promise<UserData | null> {
    const generation = this.sessionGeneration;
    await this.checkAuthVersion();
    if (generation !== this.sessionGeneration) return null;
    if (this.profileRequest?.generation === generation) return this.profileRequest.promise;

    const age = this.profileFetchedAt === null ? null : Date.now() - this.profileFetchedAt;
    if (
      !options.forceRefresh &&
      ((this.userData && age !== null && age >= 0 && age < USER_PROFILE_TTL_MS) ||
        Date.now() < this.profileRetryAt)
    ) {
      return this.userData;
    }

    this.isLoading = true;
    const promise = this.fetchUserData(generation);
    this.profileRequest = { generation, promise };
    try {
      return await promise;
    } finally {
      if (this.profileRequest?.promise === promise) {
        this.profileRequest = null;
        this.isLoading = false;
      }
    }
  }

  private async fetchUserData(generation: number): Promise<UserData | null> {
    try {
      // First check if user has skipped login
      const hasSkippedLogin = await AsyncStorage.getItem(SKIP_LOGIN_KEY);
      if (generation !== this.sessionGeneration) {
        return null;
      }
      if (hasSkippedLogin === 'true') {
        this.skippedLogin = true;
        // Emit auth state with skipped = true
        DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, {
          isAuthenticated: false,
          skipped: true,
          freshLogin: false, // Not a fresh login
        });
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
          return null;
        }
        if (generation !== this.sessionGeneration) {
          return null;
        }
        this.token = storedToken;
      } catch (error) {
        console.error('Error loading stored auth token:', error);
        return null;
      }
    }

    // Finally, try to fetch user data with timeout
    try {
      const raw = await this.makeAuthRequest('/auth/me', 'GET', undefined, true, true);
      const userData = parseUserData(raw);
      if (generation !== this.sessionGeneration) {
        return null;
      }
      this.userData = userData;
      this.profileFetchedAt = Date.now();
      this.profileRetryAt = 0;
      DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, {
        isAuthenticated: true,
        skipped: false,
        freshLogin: false, // Not a fresh login, just loading existing auth
      });
      return userData;
    } catch (error) {
      if (generation !== this.sessionGeneration) {
        return null;
      }
      this.profileRetryAt = Date.now() + PROFILE_RETRY_DELAY_MS;
      // Connectivity and server failures do not invalidate a persisted session.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await this.logout();
      }
      return this.userData;
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
      console.error(`Error sending data for server-side encryption (key: '${key}'):`, error);
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
      console.warn('User not authenticated. Cannot delete encrypted data.');
      return;
    }

    try {
      await this.makeAuthRequest(`/secure/delete-encrypted-data/${key}`, 'DELETE');
    } catch (error) {
      console.error(`Error deleting encrypted data (key: '${key}'):`, error);
      throw error;
    }
  }
}

export default AuthService.getInstance();
