import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, DeviceEventEmitter } from 'react-native';
import * as crypto from 'crypto-js';
import Constants from "expo-constants";
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://papi.jagged.me';
const GRAVATAR_API_URL = 'https://api.gravatar.com/v3';

// Get environment variables from Expo Constants
const getEnvVars = () => {
  const gravatarKey = Constants.expoConfig?.extra?.gravatarApiKey;
  const apiKey = Constants.expoConfig?.extra?.apiKey;

  if (!gravatarKey || !apiKey) {
    console.warn('Environment variables not properly configured. Please check .env file or EAS secrets.');
  }

  return {
    GRAVATAR_API_KEY: gravatarKey,
    API_KEY: apiKey,
  };
};

const envVars = getEnvVars();

const AUTH_STATE_CHANGE_EVENT = 'auth_state_changed';
const SKIP_LOGIN_KEY = '@planner_skip_login';
const AUTH_TOKEN_KEY = '@auth_token';
const LOGIN_DISMISSED_KEY = '@login_notification_dismissed';
const GRAVATAR_CACHE_KEY = '@gravatar_cache';
const USER_CREDENTIALS_KEY = 'user_credentials';
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

interface UserCredentials {
  email: string;
  password: string;
}

const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const getGravatarHash = (email: string): string => {
  // Convert email to lowercase and trim
  const normalizedEmail = email.toLowerCase().trim();
  // Create SHA-256 hash
  return crypto.SHA256(normalizedEmail).toString();
};

export const getGravatarProfile = async (email: string): Promise<GravatarProfile | null> => {
  try {
    // Check cache first
    const cachedData = await AsyncStorage.getItem(GRAVATAR_CACHE_KEY);
    if (cachedData) {
      const cache: GravatarCache = JSON.parse(cachedData);
      // If cache is less than 24 hours old, use it
      if (Date.now() - cache.timestamp < CACHE_EXPIRY) {
        return cache.profile;
      }
    }

    const hash = getGravatarHash(email);
    const response = await fetch(`${GRAVATAR_API_URL}/profiles/${hash}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Bearer': envVars.GRAVATAR_API_KEY,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // User doesn't have a Gravatar profile, create a default one
        const defaultProfile: GravatarProfile = {
          hash,
          avatar_url: `https://www.gravatar.com/avatar/${hash}?d=mp`, // mp = mystery person
        };
        return defaultProfile;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const profile: GravatarProfile = await response.json();

    // Cache the profile
    const cacheData: GravatarCache = {
      timestamp: Date.now(),
      profile,
    };
    await AsyncStorage.setItem(GRAVATAR_CACHE_KEY, JSON.stringify(cacheData));

    return profile;
  } catch (error) {
    console.error('Error fetching Gravatar profile:', error);
    return null;
  }
};

class AuthService {
  private static instance: AuthService;
  private token: string | null = null;
  private userData: UserData | null = null;
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
    this.checkAuthVersion().catch(error => {
      console.error('Error during auth initialization:', error);
    });
  }

  // Add method to check and update auth version
  async checkAuthVersion(): Promise<boolean> {
    try {
      const storedVersion = await AsyncStorage.getItem(AUTH_VERSION_KEY);
      
      if (storedVersion !== CURRENT_AUTH_VERSION) {
        // Version mismatch - need to reset auth state
        console.log('Auth version changed, resetting authentication state');
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

  private async storeCredentials(email: string, password: string): Promise<void> {
    try {
      const credentials: UserCredentials = { email, password };
      // Use SecureStore instead of AsyncStorage + crypto
      await SecureStore.setItemAsync(
        USER_CREDENTIALS_KEY, 
        JSON.stringify(credentials)
      );
    } catch (error) {
      console.error('Error storing credentials:', error);
    }
  }

  private async getStoredCredentials(): Promise<UserCredentials | null> {
    try {
      const credentialsJson = await SecureStore.getItemAsync(USER_CREDENTIALS_KEY);
      if (!credentialsJson) {
        return null;
      }
      
      const credentials = JSON.parse(credentialsJson) as UserCredentials;
      return credentials;
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      return null;
    }
  }

  private async clearStoredCredentials(): Promise<void> {
    await SecureStore.deleteItemAsync(USER_CREDENTIALS_KEY);
  }

  private async makeAuthRequest(endpoint: string, method: string, body?: any, retry: boolean = true): Promise<any> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'api-key': envVars.API_KEY
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Create an AbortController to handle request timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
  
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        // Handle 401 Unauthorized - expired token
        if (response.status === 401 && retry && !this.isReloginInProgress) {
          // Try to relogin and retry the request
          const success = await this.attemptRelogin();
          if (success) {
            // Retry the original request with new token
            return this.makeAuthRequest(endpoint, method, body, false);
          }
        }
        
        const error = await response.json();
        throw new Error(error.detail || 'Request failed');
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
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
      const response = await this.makeAuthRequest('/auth/signup', 'POST', {
        email,
        password,
        confirm_password: confirmPassword
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.makeAuthRequest('/auth/login', 'POST', {
        email,
        password
      });

      if (response.access_token) {
        this.token = response.access_token;
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
        await this.storeCredentials(email, password);
        // Clear skip login flag when user explicitly logs in
        await AsyncStorage.removeItem(SKIP_LOGIN_KEY);
        this.skippedLogin = false;
        await this.loadUserData();
        DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, { 
          isAuthenticated: true,
          skipped: false 
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
      const credentials = await this.getStoredCredentials();
      if (!credentials) {
        this.isReloginInProgress = false;
        return false;
      }
      
      const response = await this.makeAuthRequest('/auth/login', 'POST', {
        email: credentials.email,
        password: credentials.password
      }, false); // Don't retry on this login attempt
      
      if (response.access_token) {
        this.token = response.access_token;
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
        await this.loadUserData();
        this.isReloginInProgress = false;
        return true;
      }
      
      this.isReloginInProgress = false;
      return false;
    } catch (error) {
      this.isReloginInProgress = false;
      return false;
    }
  }

  async verifyEmail(token: string): Promise<boolean> {
    try {
      await this.makeAuthRequest(`/auth/verify-email?token=${token}`, 'POST');
      await this.loadUserData();
      return true;
    } catch (error) {
      return false;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.makeAuthRequest('/auth/forgot-password', 'POST', { email });
    } catch (error) {
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      await this.makeAuthRequest(`/auth/reset-password?token=${token}`, 'POST', {
        password: newPassword,
        confirm_password: newPassword
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteAccount(password: string): Promise<void> {
    try {
      if (!this.userData?.email) {
        throw new Error('User not authenticated');
      }
      
      await this.makeAuthRequest('/auth/delete-account/initiate', 'POST', {
        password
      });
      
      await this.logout();
    } catch (error) {
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.token = null;
    this.userData = null;
    this.skippedLogin = false;
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(SKIP_LOGIN_KEY);
      await AsyncStorage.removeItem(LOGIN_DISMISSED_KEY);
      await this.clearStoredCredentials();
      DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, { 
        isAuthenticated: false,
        skipped: false 
      });
    } catch (error) {
    }
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
          skipped: true 
        });
        this.isLoading = false;
        return null;
      }
    } catch (error) {
      // Silent error handling
    }

    // Then check for auth token
    if (!this.token) {
      try {
        const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (!storedToken) {
          this.isLoading = false;
          return null;
        }
        this.token = storedToken;
      } catch (error) {
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
        skipped: false 
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
}

export default AuthService.getInstance();