import { Platform, DeviceEventEmitter, EmitterSubscription } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from './authService';
import { scheduleService as scheduleServiceImport, UserSettings } from './scheduleService';
import Constants from "expo-constants";

// To avoid circular dependency, we'll set this after initialization
let scheduleService = scheduleServiceImport;

// API endpoint
const API_URL = 'https://papi.jagged.me';

// Get environment variables from Expo Constants
const getEnvVars = () => {
  const apiKey = Constants.expoConfig?.extra?.apiKey;

  if (!apiKey) {
    console.warn('API key not properly configured. Please check .env file or EAS secrets.');
  }

  return {
    API_KEY: apiKey,
  };
};

// Get API key from environment variables
const { API_KEY } = getEnvVars();

interface NotificationSettings {
  enabled: boolean;
  reminders: boolean;
  assignments: boolean;
  recoveryDays: boolean;
  customSchedule: boolean;
}

interface SyncableSettings {
  userSettings: UserSettings;
  notificationSettings: NotificationSettings;
  version: string;
  lastSyncTimestamp: number;
}

// Constants
const SETTINGS_DATA_LABEL = 'user_settings';
const NOTIFICATION_SETTINGS_KEY = '@planner_notification_settings';
const SETTINGS_SYNC_VERSION = '1'; // Increment when settings structure changes
const LAST_SETTINGS_SYNC_KEY = '@last_settings_sync';
const INITIAL_DOWNLOAD_DONE_KEY = '@initial_settings_download_done';
const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Add debounce timeout
const SYNC_DEBOUNCE_DELAY = 5000; // 5 seconds

// Default notification settings
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  reminders: true,
  assignments: true,
  recoveryDays: true,
  customSchedule: true,
};

class SettingsService {
  private static instance: SettingsService;
  private notificationSettings: NotificationSettings = DEFAULT_NOTIFICATION_SETTINGS;
  private isSyncing: boolean = false;
  private syncDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingSync: boolean = false;
  private authStateListener: EmitterSubscription | null = null;
  private initialDownloadDone: boolean = false;
  private applyingServerSettings: boolean = false;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
      SettingsService.instance.init();
    }
    return SettingsService.instance;
  }

  private async init(): Promise<void> {
    // Check if initial download has been done
    const initialDownloadDone = await AsyncStorage.getItem(INITIAL_DOWNLOAD_DONE_KEY);
    this.initialDownloadDone = initialDownloadDone === 'true';
    
    await this.loadNotificationSettings();
    
    // Only do time-based sync if initial download has been done already
    if (this.initialDownloadDone) {
      // Only sync to server based on time interval, not from server
      this.syncToServerIfNeeded().catch(error => {
      });
    }
    
    // Set up listener for auth state changes
    this.setupAuthStateListener();
  }

  // Load notification settings from local storage
  private async loadNotificationSettings(): Promise<void> {
    try {
      const savedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (savedSettings) {
        this.notificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
    }
  }

  // Save notification settings to local storage
  private async saveNotificationSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(this.notificationSettings));
    } catch (error) {
    }
  }

  // Get current notification settings
  getNotificationSettings(): NotificationSettings {
    return { ...this.notificationSettings };
  }

  // Update notification settings
  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    this.notificationSettings = { ...this.notificationSettings, ...settings };
    await this.saveNotificationSettings();
    // Trigger a sync to the server when settings are updated
    this.syncToServer().catch(error => {
    });
  }

  // Trigger sync to server after any settings update (including schedule settings)
  triggerSync(): void {
    // Skip sync if we're currently applying server settings
    if (this.applyingServerSettings) {
      return;
    }
    
    // Only run if user is authenticated
    if (authService.isAuthenticated()) {
      // Debounce the sync to avoid too many API calls
      this.pendingSync = true;
      
      if (this.syncDebounceTimeout) {
        clearTimeout(this.syncDebounceTimeout);
      }
      
      this.syncDebounceTimeout = setTimeout(() => {
        if (this.pendingSync) {
          this.syncToServer().catch(error => {
          });
          this.pendingSync = false;
        }
      }, SYNC_DEBOUNCE_DELAY);
    }
  }

  // Allow setting scheduleService reference after initialization to avoid circular dependency
  setScheduleService(service: typeof scheduleServiceImport): void {
    scheduleService = service;
    // Register callbacks to avoid direct import cycle side-effects
    scheduleService.registerSettingsSync({
      triggerSync: () => this.triggerSync(),
      isApplyingServerSettings: () => this.isApplyingServerSettings()
    });
  }

  // Prepare settings for sync
  private prepareSettingsForSync(): SyncableSettings {
    return {
      userSettings: scheduleService.getSettings(),
      notificationSettings: this.notificationSettings,
      version: SETTINGS_SYNC_VERSION,
      lastSyncTimestamp: Date.now(),
    };
  }

  // Check if we need to sync TO SERVER based on time interval
  async syncToServerIfNeeded(): Promise<boolean> {
    try {
      const lastSync = await AsyncStorage.getItem(LAST_SETTINGS_SYNC_KEY);
      const lastSyncTime = lastSync ? parseInt(lastSync, 10) : 0;
      
      // Sync if it's been more than a day since last sync
      if (Date.now() - lastSyncTime > SYNC_INTERVAL) {
        return await this.syncToServer();
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Sync only TO server (upload local settings)
  async syncToServer(): Promise<boolean> {
    // Only allow one sync operation at a time
    if (this.isSyncing || !authService.isAuthenticated()) {
      return false;
    }

    this.isSyncing = true;
    this.pendingSync = false; // Clear pending sync flag
    
    if (this.syncDebounceTimeout) {
      clearTimeout(this.syncDebounceTimeout);
      this.syncDebounceTimeout = null;
    }
    
    try {
      // Upload local settings to server
      const success = await this.uploadSettings();
      
      if (success) {
        // Update last sync timestamp
        await AsyncStorage.setItem(LAST_SETTINGS_SYNC_KEY, Date.now().toString());
      } else {
      }
      
      this.isSyncing = false;
      return success;
    } catch (error) {
      this.isSyncing = false;
      return false;
    }
  }

  // Make authenticated API request
  async makeAuthRequest(endpoint: string, method: string, body?: any): Promise<any> {
    if (!authService.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'api-key': API_KEY
    };

    // Get auth token from authService
    const token = await AsyncStorage.getItem('@auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Upload settings to server - making public so it can be called directly
  async uploadSettings(): Promise<boolean> {
    if (!authService.isAuthenticated()) {
      return false;
    }

    try {
      const settings = this.prepareSettingsForSync();
      
      // Get encryption password using the public method
      const encryptionPassword = await authService.getCredentialsForEncryption();
      if (!encryptionPassword) {
        return false;
      }
      
      // Make authenticated request to encrypt and store settings
      const response = await this.makeAuthRequest('/secure/encrypt-data', 'POST', {
        data_label: SETTINGS_DATA_LABEL,
        plaintext: JSON.stringify(settings),
        password: encryptionPassword
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Allow scheduleService to check if we're applying server settings
  isApplyingServerSettings(): boolean {
    return this.applyingServerSettings;
  }

  // Download settings from server
  private async downloadSettings(): Promise<boolean> {
    if (!authService.isAuthenticated()) {
      return false;
    }

    try {
      // First, check if settings exist on server
      const dataLabels = await this.makeAuthRequest('/secure/list-encrypted-data', 'GET');
      
      // Data labels are objects with a data_label property, not strings
      if (!Array.isArray(dataLabels) || !dataLabels.some(item => item.data_label === SETTINGS_DATA_LABEL)) {
        // No settings found on server
        return false;
      }
      
      
      // Get encryption password for decryption
      const encryptionPassword = await authService.getCredentialsForEncryption();
      if (!encryptionPassword) {
        return false;
      }
      
      // Settings exist, try to decrypt and download them
      const response = await this.makeAuthRequest('/secure/decrypt-data', 'POST', {
        data_label: SETTINGS_DATA_LABEL,
        password: encryptionPassword
      });
      
      
      if (!response.plaintext) {
        return false;
      }
      
      // Parse the downloaded settings
      const settings: SyncableSettings = JSON.parse(response.plaintext);
      
      // Set the flag to prevent triggering sync while applying server settings
      this.applyingServerSettings = true;
      
      try {
        // Always apply server settings over local settings
        if (settings.userSettings) {
          scheduleService.updateSettings(settings.userSettings);
        }
        
        if (settings.notificationSettings) {
          this.notificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...settings.notificationSettings };
          await this.saveNotificationSettings();
        }
      } finally {
        // Reset the flag after applying settings, even if there was an error
        this.applyingServerSettings = false;
      }
      
      // Mark that we've done the initial download
      this.initialDownloadDone = true;
      await AsyncStorage.setItem(INITIAL_DOWNLOAD_DONE_KEY, 'true');
      
      return true;
    } catch (error) {
      // Make sure the flag is reset even on error
      this.applyingServerSettings = false;
      return false;
    }
  }

  // Delete settings from server
  async deleteRemoteSettings(): Promise<boolean> {
    if (!authService.isAuthenticated()) {
      return false;
    }

    try {
      await this.makeAuthRequest(`/secure/delete-encrypted-data/${SETTINGS_DATA_LABEL}`, 'DELETE');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Force push settings to server (for manual sync)
  async forcePushSettings(): Promise<boolean> {
    if (!authService.isAuthenticated()) {
      return false;
    }
    
    try {
      // Clear any pending debounced sync
      if (this.syncDebounceTimeout) {
        clearTimeout(this.syncDebounceTimeout);
        this.syncDebounceTimeout = null;
      }
      
      this.pendingSync = false;
      
      // Check if we have the encryption password
      const encryptionPassword = await authService.getCredentialsForEncryption();
      if (!encryptionPassword) {
        return false;
      }
      
      // Force upload settings to server
      const success = await this.uploadSettings();
      
      if (success) {
        // Update last sync timestamp
        await AsyncStorage.setItem(LAST_SETTINGS_SYNC_KEY, Date.now().toString());
      }
      
      return success;
    } catch (error) {
      return false;
    }
  }

  // Add auth state change listener
  private setupAuthStateListener(): void {
    // Remove existing listener if any
    if (this.authStateListener) {
      this.authStateListener.remove();
    }
    
    // Add new listener - simplified to focus only on fresh login event
    this.authStateListener = DeviceEventEmitter.addListener('auth_state_changed', (event) => {
      // Only react to fresh login events - this is the only case where we need to sync from server
      if (event.isAuthenticated && !event.skipped && event.freshLogin) {
        this.syncAfterLogin();
      }
      // Don't log or process any other auth state changes
    });
  }
  
  // Sync settings specifically after login - ONLY downloads from server on login
  async syncAfterLogin(): Promise<boolean> {
    // Only proceed if user is authenticated
    if (!authService.isAuthenticated()) {
      return false;
    }
    
    // Don't run if already syncing
    if (this.isSyncing) {
      return false;
    }
    
    this.isSyncing = true;
    
    // Clear any pending sync operations
    if (this.syncDebounceTimeout) {
      clearTimeout(this.syncDebounceTimeout);
      this.syncDebounceTimeout = null;
    }
    
    this.pendingSync = false;
    
    try {
      // First try to download settings from server - this should happen ONLY on login
      const downloadSuccess = await this.downloadSettings();
      
      // If no settings found on server, then upload local settings
      if (!downloadSuccess) {
        await this.uploadSettings();
        
        // Mark initial download as done even if we uploaded instead
        this.initialDownloadDone = true;
        await AsyncStorage.setItem(INITIAL_DOWNLOAD_DONE_KEY, 'true');
      } else {
      }
      
      // Update last sync timestamp
      await AsyncStorage.setItem(LAST_SETTINGS_SYNC_KEY, Date.now().toString());
      
      this.isSyncing = false;
      return true;
    } catch (error) {
      this.isSyncing = false;
      return false;
    }
  }

  // Reset sync state - useful when logging out
  async resetSyncState(): Promise<void> {
    this.initialDownloadDone = false;
    await AsyncStorage.removeItem(INITIAL_DOWNLOAD_DONE_KEY);
    await AsyncStorage.removeItem(LAST_SETTINGS_SYNC_KEY);
  }

  // Cleanup resources
  cleanup(): void {
    // Remove auth state listener
    if (this.authStateListener) {
      this.authStateListener.remove();
      this.authStateListener = null;
    }
    
    // Clear any pending timeouts
    if (this.syncDebounceTimeout) {
      clearTimeout(this.syncDebounceTimeout);
      this.syncDebounceTimeout = null;
    }
  }

  setApplyingServerSettings(value: boolean): void {
    this.applyingServerSettings = value;
  }
}

const instance = SettingsService.getInstance();

// Ensure registration happens
instance.setScheduleService(scheduleServiceImport);

// Handle cleanup on app termination
if (Platform.OS !== 'web') {
  // For React Native, we should handle cleanup in componentWillUnmount of the App component
  // But we can at least prepare the method here
}

export default instance; 
