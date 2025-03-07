import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as crypto from 'crypto-js';

const API_URL = 'https://papi.jagged.me';
const API_KEY = 'u5Xq2LgBSIWgyocdGoB7bx1IhJZ723XUkwwoKqSbDtc'; // This should be stored securely

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

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Request failed');
    }

    return await response.json();
  }

  async getSalt(email: string): Promise<string> {
    const response = await this.makeAuthRequest('/auth/get-salt', 'POST', { email });
    return response.salt;
  }

  async signup(email: string, password: string): Promise<AuthResponse> {
    const salt = crypto.lib.WordArray.random(128 / 8).toString();
    const passwordHash = crypto.SHA256(password + salt).toString();

    return await this.makeAuthRequest('/auth/signup', 'POST', {
      email,
      password_hash: passwordHash,
      salt
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const salt = await this.getSalt(email);
    const passwordHash = crypto.SHA256(password + salt).toString();

    const response = await this.makeAuthRequest('/auth/login', 'POST', {
      email,
      password_hash: passwordHash
    });

    if (response.token) {
      this.token = response.token;
      await AsyncStorage.setItem('auth_token', response.token);
      await this.loadUserData();
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
    await this.makeAuthRequest('/auth/reset-password', 'POST', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const salt = crypto.lib.WordArray.random(128 / 8).toString();
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

  async deleteAccount(): Promise<void> {
    await this.makeAuthRequest('/auth/delete-account', 'POST');
    await this.logout();
  }

  async logout(): Promise<void> {
    this.token = null;
    this.userData = null;
    await AsyncStorage.removeItem('auth_token');
  }

  async loadUserData(): Promise<UserData | null> {
    if (!this.token) {
      const storedToken = await AsyncStorage.getItem('auth_token');
      if (!storedToken) return null;
      this.token = storedToken;
    }

    try {
      const userData = await this.makeAuthRequest('/auth/me', 'GET');
      this.userData = userData;
      return userData;
    } catch (error) {
      await this.logout();
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getCurrentUser(): UserData | null {
    return this.userData;
  }
}

export default AuthService.getInstance();