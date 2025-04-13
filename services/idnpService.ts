/**
 * Service for managing IDNP storage and synchronization
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from './authService';
import { DeviceEventEmitter } from 'react-native';
import Constants from "expo-constants";


// Get environment variables for API key
const getEnvVars = () => {
    const apiKey = Constants.expoConfig?.extra?.apiKey;
  
    if (!apiKey) {
      console.warn('API key not properly configured. Please check .env file or EAS secrets.');
    }
  
    return {
      API_KEY: apiKey,
    };
};

const envVars = getEnvVars();

// Storage keys
const IDNP_KEY = '@planner_idnp';
const IDNP_SYNC_ENABLED_KEY = '@planner_idnp_sync_enabled';
const IDNP_DATA_LABEL = 'user_idnp';
const INITIAL_IDNP_SYNC_DONE_KEY = '@initial_idnp_sync_done';
const AUTH_TOKEN_KEY = '@auth_token';

// API Endpoints
const API_BASE_URL = 'https://papi.jagged.me';
const API_ENDPOINTS = {
  ENCRYPT: '/secure/encrypt-data',
  DECRYPT: '/secure/decrypt-data',
  LIST: '/secure/list-encrypted-data',
  DELETE: '/secure/delete-encrypted-data'
};

class IdnpService {
  private syncEnabled: boolean = false;
  private initialSyncDone: boolean = false;
  private isSyncing: boolean = false;
  private authStateListener: any = null;

  constructor() {
    console.log('[IdnpService] Initializing service');
    this.init();
  }

  /**
   * Initialize the service and register auth listeners
   */
  private async init() {
    try {
      // Load sync preference
      const syncPref = await AsyncStorage.getItem(IDNP_SYNC_ENABLED_KEY);
      this.syncEnabled = syncPref === 'true';
      console.log('[IdnpService] Initialized with sync enabled:', this.syncEnabled);

      // Check if initial sync was done
      const initialSyncDone = await AsyncStorage.getItem(INITIAL_IDNP_SYNC_DONE_KEY);
      this.initialSyncDone = initialSyncDone === 'true';
      console.log('[IdnpService] Initial sync done status:', this.initialSyncDone);

      // Setup auth state listener
      this.setupAuthListener();
    } catch (error) {
      console.error('[IdnpService] Error during initialization:', error);
    }
  }

  /**
   * Get the locally stored IDNP
   */
  async getIdnp(): Promise<string | null> {
    try {
      const idnp = await AsyncStorage.getItem(IDNP_KEY);
      console.log('[IdnpService] Retrieved local IDNP:', idnp ? 'exists' : 'not found');
      return idnp;
    } catch (error) {
      console.error('[IdnpService] Error getting IDNP:', error);
      return null;
    }
  }

  /**
   * Store IDNP locally and sync to server if enabled
   */
  async setIdnp(idnp: string, shouldSync: boolean = this.syncEnabled): Promise<boolean> {
    try {
      console.log('[IdnpService] Setting IDNP locally, shouldSync:', shouldSync, 'syncEnabled:', this.syncEnabled);
      
      // Always save locally
      await AsyncStorage.setItem(IDNP_KEY, idnp);
      console.log('[IdnpService] IDNP saved locally');
      
      // Sync to server if enabled and requested
      if (shouldSync && this.syncEnabled) {
        console.log('[IdnpService] Attempting to sync IDNP to server');
        return await this.syncIdnpToServer();
      }
      return true;
    } catch (error) {
      console.error('[IdnpService] Error setting IDNP:', error);
      return false;
    }
  }

  /**
   * Clear the locally stored IDNP
   */
  async clearIdnp(): Promise<boolean> {
    try {
      console.log('[IdnpService] Clearing local IDNP');
      await AsyncStorage.removeItem(IDNP_KEY);
      return true;
    } catch (error) {
      console.error('[IdnpService] Error clearing IDNP:', error);
      return false;
    }
  }

  /**
   * Get the current sync preference
   */
  async isSyncEnabled(): Promise<boolean> {
    console.log('[IdnpService] Sync enabled status:', this.syncEnabled);
    return this.syncEnabled;
  }

  /**
   * Set the sync preference and handle server data accordingly
   */
  async setSyncEnabled(enabled: boolean): Promise<boolean> {
    try {
      console.log('[IdnpService] Setting sync enabled to:', enabled);
      this.syncEnabled = enabled;
      await AsyncStorage.setItem(IDNP_SYNC_ENABLED_KEY, enabled.toString());
      console.log('[IdnpService] Sync preference saved');
      
      if (enabled) {
        // If enabling sync, push current IDNP to server
        const idnp = await this.getIdnp();
        console.log('[IdnpService] Enabling sync, current IDNP exists:', !!idnp);
        if (idnp) {
          console.log('[IdnpService] Pushing existing IDNP to server');
          await this.syncIdnpToServer();
        }
      } else {
        // If disabling sync, delete from server
        console.log('[IdnpService] Disabling sync, removing IDNP from server');
        await this.deleteIdnpFromServer();
      }
      
      return true;
    } catch (error) {
      console.error('[IdnpService] Error setting sync enabled:', error);
      return false;
    }
  }

  /**
   * Make authenticated request to the API
   */
  private async makeAuthRequest(endpoint: string, method: string, body?: any): Promise<any> {
    console.log(`[IdnpService] Making ${method} request to ${endpoint}`);
    
    // Check if authenticated
    const isAuth = await authService.isAuthenticated();
    console.log('[IdnpService] Authentication status:', isAuth);
    if (!isAuth) {
      console.error('[IdnpService] User not authenticated');
      throw new Error('User not authenticated');
    }

    // Get auth token from AsyncStorage
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    console.log('[IdnpService] Auth token exists:', !!token);
    if (!token) {
      console.error('[IdnpService] Authentication token not available');
      throw new Error('Authentication token not available');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    console.log('[IdnpService] Full request URL:', url);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'api-key': envVars.API_KEY
    };
    
    console.log('[IdnpService] Using API key:', envVars.API_KEY !== 'API_KEY_NOT_FOUND' ? 'API key is set' : 'API key not found');

    const options: RequestInit = {
      method,
      headers
    };

    if (body) {
      options.body = JSON.stringify(body);
      console.log('[IdnpService] Request body:', JSON.stringify(body, null, 2));
    }

    console.log('[IdnpService] Sending request with options:', 
      JSON.stringify({ 
        method, 
        headers: { 
          ...headers, 
          Authorization: '[REDACTED]',
          'api-key': '[REDACTED]'
        } 
      }, null, 2));
    
    try {
      const response = await fetch(url, options);
      console.log('[IdnpService] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[IdnpService] API request failed: ${response.status}`, errorText);
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log('[IdnpService] Response data:', JSON.stringify(responseData, null, 2));
      return responseData;
    } catch (error) {
      console.error('[IdnpService] Fetch error:', error);
      throw error;
    }
  }

  /**
   * Sync the IDNP to the server
   */
  private async syncIdnpToServer(): Promise<boolean> {
    console.log('[IdnpService] Starting syncIdnpToServer, syncEnabled:', this.syncEnabled, 'isSyncing:', this.isSyncing);
    
    if (!this.syncEnabled || this.isSyncing) {
      console.log('[IdnpService] Sync skipped - disabled or already in progress');
      return false;
    }

    this.isSyncing = true;
    console.log('[IdnpService] Set isSyncing to true');

    try {
      const idnp = await this.getIdnp();
      console.log('[IdnpService] Retrieved IDNP for syncing, exists:', !!idnp);
      
      if (!idnp) {
        console.log('[IdnpService] No IDNP to sync');
        this.isSyncing = false;
        return false;
      }

      // Get encryption password
      console.log('[IdnpService] Requesting encryption credentials');
      const encryptionPassword = await authService.getCredentialsForEncryption();
      console.log('[IdnpService] Encryption password received:', !!encryptionPassword);
      
      if (!encryptionPassword) {
        console.error('[IdnpService] Cannot encrypt IDNP: encryption password not available');
        this.isSyncing = false;
        return false;
      }

      // Upload encrypted IDNP
      console.log('[IdnpService] Uploading encrypted IDNP with label:', IDNP_DATA_LABEL);
      const response = await this.makeAuthRequest(API_ENDPOINTS.ENCRYPT, 'POST', {
        data_label: IDNP_DATA_LABEL,
        plaintext: idnp,
        password: encryptionPassword
      });
      
      console.log('[IdnpService] Upload successful, response:', JSON.stringify(response, null, 2));

      this.isSyncing = false;
      console.log('[IdnpService] Set isSyncing to false');
      return true;
    } catch (error) {
      console.error('[IdnpService] Error syncing IDNP to server:', error);
      this.isSyncing = false;
      return false;
    }
  }

  /**
   * Fetch IDNP from server if available
   */
  private async syncIdnpFromServer(): Promise<boolean> {
    console.log('[IdnpService] Starting syncIdnpFromServer, syncEnabled:', this.syncEnabled, 'isSyncing:', this.isSyncing);
    
    if (!this.syncEnabled || this.isSyncing) {
      console.log('[IdnpService] Server sync skipped - disabled or already in progress');
      return false;
    }

    this.isSyncing = true;
    console.log('[IdnpService] Set isSyncing to true');

    try {
      // First check if IDNP exists on server
      console.log('[IdnpService] Checking if IDNP exists on server');
      const dataLabels = await this.makeAuthRequest(API_ENDPOINTS.LIST, 'GET');
      console.log('[IdnpService] Available data labels:', JSON.stringify(dataLabels, null, 2));
      
      const hasIdnpLabel = Array.isArray(dataLabels) && dataLabels.some(item => item.data_label === IDNP_DATA_LABEL);
      console.log('[IdnpService] IDNP data label exists on server:', hasIdnpLabel);
      
      if (!hasIdnpLabel) {
        // No IDNP found on server
        console.log('[IdnpService] No IDNP found on server');
        this.isSyncing = false;
        
        // If no IDNP on server but we have one locally and sync is enabled, push it
        const localIdnp = await this.getIdnp();
        console.log('[IdnpService] Local IDNP exists:', !!localIdnp, 'syncEnabled:', this.syncEnabled);
        
        if (localIdnp && this.syncEnabled) {
          console.log('[IdnpService] Pushing local IDNP to server since none exists there');
          await this.syncIdnpToServer();
        }
        
        return false;
      }
      
      // Get encryption password for decryption
      console.log('[IdnpService] Requesting encryption credentials for IDNP download');
      const encryptionPassword = await authService.getCredentialsForEncryption();
      console.log('[IdnpService] Encryption password received:', !!encryptionPassword);
      
      if (!encryptionPassword) {
        console.error('[IdnpService] Cannot decrypt IDNP: encryption password not available');
        this.isSyncing = false;
        return false;
      }
      
      // Download encrypted IDNP
      console.log('[IdnpService] Downloading encrypted IDNP');
      const response = await this.makeAuthRequest(API_ENDPOINTS.DECRYPT, 'POST', {
        data_label: IDNP_DATA_LABEL,
        password: encryptionPassword
      });
      
      console.log('[IdnpService] Download response received, plaintext exists:', !!response.plaintext);
      
      if (!response.plaintext) {
        console.error('[IdnpService] No plaintext found in server response');
        this.isSyncing = false;
        return false;
      }
      
      // Store the decrypted IDNP locally
      console.log('[IdnpService] Storing downloaded IDNP locally');
      await AsyncStorage.setItem(IDNP_KEY, response.plaintext);
      console.log('[IdnpService] IDNP successfully stored locally');
      
      this.isSyncing = false;
      console.log('[IdnpService] Set isSyncing to false');
      return true;
    } catch (error) {
      console.error('[IdnpService] Error syncing IDNP from server:', error);
      this.isSyncing = false;
      return false;
    }
  }

  /**
   * Delete IDNP from server
   */
  async deleteIdnpFromServer(): Promise<boolean> {
    console.log('[IdnpService] Starting deleteIdnpFromServer');
    try {
      // Skip if not authenticated
      const isAuth = await authService.isAuthenticated();
      console.log('[IdnpService] Authentication status for delete:', isAuth);
      
      if (!isAuth) {
        console.log('[IdnpService] Delete skipped - user not authenticated');
        return false;
      }
      
      console.log('[IdnpService] Deleting IDNP data with label:', IDNP_DATA_LABEL);
      await this.makeAuthRequest(`${API_ENDPOINTS.DELETE}/${IDNP_DATA_LABEL}`, 'DELETE');
      console.log('[IdnpService] IDNP successfully deleted from server');
      return true;
    } catch (error) {
      console.error('[IdnpService] Error deleting IDNP from server:', error);
      return false;
    }
  }

  /**
   * Setup auth listener to handle login events
   */
  private setupAuthListener(): void {
    console.log('[IdnpService] Setting up auth state listener');
    // Remove existing listener if any
    if (this.authStateListener) {
      console.log('[IdnpService] Removing existing auth listener');
      this.authStateListener.remove();
      this.authStateListener = null;
    }
    
    // Add new listener
    this.authStateListener = DeviceEventEmitter.addListener('auth_state_changed', (event) => {
      console.log('[IdnpService] Auth state changed:', JSON.stringify(event));
      // Only react to fresh login events
      if (event.isAuthenticated && !event.skipped && event.freshLogin) {
        console.log('[IdnpService] Fresh login detected, syncing IDNP from server');
        this.syncAfterLogin();
      }
    });
    console.log('[IdnpService] Auth state listener setup complete');
  }

  /**
   * Handle syncing after login - only fetch from server on login
   */
  private async syncAfterLogin(): Promise<boolean> {
    console.log('[IdnpService] Starting syncAfterLogin, initialSyncDone:', this.initialSyncDone, 
      'syncEnabled:', this.syncEnabled, 'isSyncing:', this.isSyncing);
    
    // Skip if already done initial sync or sync disabled
    if (this.initialSyncDone || !this.syncEnabled || this.isSyncing) {
      console.log('[IdnpService] Sync after login skipped');
      return false;
    }
    
    this.isSyncing = true;
    console.log('[IdnpService] Set isSyncing to true');
    
    try {
      // Try to download IDNP from server
      console.log('[IdnpService] Attempting to download IDNP from server');
      const downloadSuccess = await this.syncIdnpFromServer();
      console.log('[IdnpService] Download result:', downloadSuccess);
      
      // Mark initial sync as done regardless of outcome
      this.initialSyncDone = true;
      await AsyncStorage.setItem(INITIAL_IDNP_SYNC_DONE_KEY, 'true');
      console.log('[IdnpService] Marked initial sync as done');
      
      this.isSyncing = false;
      console.log('[IdnpService] Set isSyncing to false');
      return downloadSuccess;
    } catch (error) {
      console.error('[IdnpService] Error syncing after login:', error);
      this.isSyncing = false;
      return false;
    }
  }

  /**
   * Reset all sync status data (for logout/account deletion)
   */
  async resetSyncStatus(): Promise<void> {
    console.log('[IdnpService] Resetting sync status');
    try {
      await AsyncStorage.removeItem(INITIAL_IDNP_SYNC_DONE_KEY);
      this.initialSyncDone = false;
      console.log('[IdnpService] Sync status reset complete');
    } catch (error) {
      console.error('[IdnpService] Error resetting sync status:', error);
    }
  }
}

export default new IdnpService(); 