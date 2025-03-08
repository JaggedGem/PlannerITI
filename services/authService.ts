import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, DeviceEventEmitter } from 'react-native';
import * as crypto from 'crypto-js';

const API_URL = 'https://papi.jagged.me';
const API_KEY = 'u5Xq2LgBSIWgyocdGoB7bx1IhJZ723XUkwwoKqSbDtc'; // This should be stored securely
const AUTH_STATE_CHANGE_EVENT = 'auth_state_changed';
const SKIP_LOGIN_KEY = '@planner_skip_login';
const AUTH_TOKEN_KEY = '@auth_token';

// Add timeout constants for network requests
const REQUEST_TIMEOUT = 8000; // 8 seconds timeout

interface AuthResponse {
  token: string;
  message?: string;
}

export interface UserData {
  email: string;
  idnp?: string;
  isEmailVerified: boolean;
}

class AuthService {
  private static instance: AuthService;
  private token: string | null = null;
  private userData: UserData | null = null;
  private skippedLogin: boolean = false;
  private isLoading: boolean = false;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async makeAuthRequest(endpoint: string, method: string, body?: any): Promise<any> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'api-key': API_KEY
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Create an AbortController to handle request timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
  
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Request failed');
      }
  
      return await response.json();
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

  async getSalt(email: string): Promise<string> {
    const response = await this.makeAuthRequest('/auth/get-salt/' + email, 'GET');
    return response.salt;
  }

  async signup(email: string, password: string, confirmPassword: string): Promise<AuthResponse> {
    // Generate a secure random salt using React Native's crypto
    const randomBytes = new Uint8Array(16);
    const getRandomValues = (global as any).crypto?.getRandomValues;
    if (getRandomValues) {
      getRandomValues(randomBytes);
    } else {
      // Fallback for older React Native versions
      for (let i = 0; i < randomBytes.length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const salt = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    const passwordHash = crypto.SHA256(password + salt).toString();
    const confirmPasswordHash = crypto.SHA256(confirmPassword + salt).toString();

    return await this.makeAuthRequest('/auth/signup', 'POST', {
      email,
      password_hash: passwordHash,
      confirm_password_hash: confirmPasswordHash,
      salt
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const salt = await this.getSalt(email);
    const passwordHash = crypto.SHA256(password + salt).toString();

    const response = await this.makeAuthRequest('/auth/login', 'POST', {
      email: email,
      password: passwordHash
    });

    if (response.access_token) {
      this.token = response.access_token;
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
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
    await this.makeAuthRequest('/auth/forgot-password', 'POST', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // Generate a secure random salt using React Native's crypto
    const randomBytes = new Uint8Array(16);
    const getRandomValues = (global as any).crypto?.getRandomValues;
    if (getRandomValues) {
      getRandomValues(randomBytes);
    } else {
      // Fallback for older React Native versions
      for (let i = 0; i < randomBytes.length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const salt = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    
    const passwordHash = crypto.SHA256(newPassword + salt).toString();

    try {
      await this.makeAuthRequest(`/auth/reset-password?token=${token}`, 'POST', {
        password_hash: passwordHash,
        confirm_password_hash: passwordHash,
        salt
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteAccount(password: string): Promise<void> {
    try {
      // Get the salt for the current user
      const email = this.userData?.email;
      if (!email) {
        throw new Error('User not authenticated');
      }
      
      const salt = await this.getSalt(email);
      const passwordHash = crypto.SHA256(password + salt).toString();
      
      await this.makeAuthRequest('/auth/delete-account/initiate', 'POST', {
        password_hash: passwordHash
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
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(SKIP_LOGIN_KEY);
    DeviceEventEmitter.emit(AUTH_STATE_CHANGE_EVENT, { 
      isAuthenticated: false,
      skipped: false 
    });
  }

  async loadUserData(): Promise<UserData | null> {
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
    return !!this.token;
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