import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

const OTA_PENDING_UPDATE_KEY = '@ota_pending_update';

interface PendingOtaUpdateData {
  updateId: string | null;
  fetchedAt: string;
}

class UpdateService {
  private currentChannel: 'beta' | 'production' | 'development';
  private currentVersion: string;
  private configuredVariant: string;
  private isExpoGo: boolean;

  /**
   * Infer release track from semantic prerelease tags (e.g. 1.3.0-beta.1).
   */
  private inferTrackFromVersion(version: string | null | undefined): 'beta' | null {
    if (!version) {
      return null;
    }

    const normalized = version.trim().toLowerCase();
    if (/[-.](beta|alpha|rc|preview|pre)\b/.test(normalized)) {
      return 'beta';
    }

    return null;
  }

  /**
   * Resolve the intended release track while running in development channel.
   */
  private getDevelopmentTrack(): 'beta' | 'production' | 'development' {
    const versionTrack = this.inferTrackFromVersion(this.currentVersion);
    if (versionTrack) {
      return versionTrack;
    }

    const variantTrack = this.normalizeChannel(this.configuredVariant);
    if (variantTrack) {
      return variantTrack;
    }

    return 'development';
  }

  /**
   * Convert arbitrary channel/variant values to known app channels.
   */
  private normalizeChannel(
    value: string | null | undefined
  ): 'beta' | 'production' | 'development' | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();

    if (
      normalized === 'beta' ||
      normalized.includes('beta') ||
      normalized.includes('preview')
    ) {
      return 'beta';
    }

    if (
      normalized === 'production' ||
      normalized === 'prod' ||
      normalized.includes('production') ||
      normalized.includes('release')
    ) {
      return 'production';
    }

    if (
      normalized === 'development' ||
      normalized === 'dev' ||
      normalized.includes('development')
    ) {
      return 'development';
    }

    return null;
  }

  constructor() {
    // Check if we're running in Expo Go (not a standalone build)
    this.isExpoGo = Constants.executionEnvironment === 'storeClient';

    // Get variant from app.config.js (expo.extra.environment)
    this.configuredVariant = Constants.expoConfig?.extra?.environment || 'production';

    // Resolve release channel from multiple runtime sources.
    const channelFromUpdates = this.normalizeChannel(Updates.channel);
    const channelFromConfig = this.normalizeChannel(this.configuredVariant);

    // If running in Expo Go, always use development channel
    if (this.isExpoGo) {
      this.currentChannel = 'development';
      this.currentVersion = Constants.expoConfig?.version || '1.0.0';
      return;
    }

    // For standalone builds, trust expo-updates channel first, then app variant.
    this.currentChannel = channelFromUpdates || channelFromConfig || 'development';

    // Get current app version from native build
    this.currentVersion = Application.nativeApplicationVersion || '1.0.0';
  }

  /**
   * Get current app version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Returns short OTA identifier (first 8 chars), preferring updateGroup from manifest metadata.
   */
  getCurrentOtaVersionShort(): string {
    const manifestLike = Updates.manifest as any;
    const updateGroupId = manifestLike?.metadata?.updateGroup;
    if (typeof updateGroupId === 'string' && updateGroupId.length >= 8) {
      return updateGroupId.slice(0, 8);
    }

    const updateId = Updates.updateId;
    if (typeof updateId === 'string' && updateId.length >= 8) {
      return updateId.slice(0, 8);
    }

    return 'N/A';
  }

  /**
   * Expo OTA is only available in native builds (not Expo Go).
   */
  private canUseOtaUpdates(): boolean {
    return !this.isExpoGo && !__DEV__ && Updates.isEnabled;
  }

  /**
   * Persist OTA metadata so we can apply it on next cold launch.
   */
  private async markOtaPending(updateId: string | null): Promise<void> {
    try {
      const payload: PendingOtaUpdateData = {
        updateId,
        fetchedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(OTA_PENDING_UPDATE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Error saving pending OTA update:', error);
    }
  }

  /**
   * Read pending OTA metadata from storage.
   */
  private async getPendingOta(): Promise<PendingOtaUpdateData | null> {
    try {
      const raw = await AsyncStorage.getItem(OTA_PENDING_UPDATE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PendingOtaUpdateData;
      if (!parsed?.fetchedAt) {
        return null;
      }

      return {
        updateId: parsed.updateId || null,
        fetchedAt: parsed.fetchedAt,
      };
    } catch (error) {
      console.error('Error reading pending OTA update:', error);
      return null;
    }
  }

  /**
   * Clear pending OTA metadata.
   */
  private async clearPendingOta(): Promise<void> {
    try {
      await AsyncStorage.removeItem(OTA_PENDING_UPDATE_KEY);
    } catch (error) {
      console.error('Error clearing pending OTA update:', error);
    }
  }

  /**
   * Fetch OTA update in background and stage it for next launch.
   */
  async prepareOtaUpdateForNextLaunch(): Promise<boolean> {
    if (!this.canUseOtaUpdates()) {
      return false;
    }

    try {
      const updateCheck = await Updates.checkForUpdateAsync();
      if (!updateCheck.isAvailable) {
        return false;
      }

      const fetchResult = await Updates.fetchUpdateAsync();
      // Mark as pending even when the update was already cached by native code.
      await this.markOtaPending(fetchResult.manifest?.id ?? null);
      return true;
    } catch (error) {
      console.error('Error preparing OTA update:', error);
      return false;
    }
  }

  /**
   * Apply previously staged OTA update at app startup.
   * Returns true if a reload was triggered.
   */
  async applyPreparedOtaUpdateOnLaunch(): Promise<boolean> {
    if (!this.canUseOtaUpdates()) {
      return false;
    }

    const pending = await this.getPendingOta();
    if (!pending) {
      return false;
    }

    try {
      // Clear first to avoid reload loops if reload fails.
      await this.clearPendingOta();
      await Updates.reloadAsync();
      return true;
    } catch (error) {
      console.error('Error applying staged OTA update:', error);
      await this.markOtaPending(pending.updateId);
      return false;
    }
  }

  /**
   * Get current channel.
   */
  getCurrentChannel(): string {
    return this.currentChannel;
  }

  /**
   * Get channel display text (shows configured variant when in Expo Go).
   */
  getChannelDisplay(): string {
    if (this.isExpoGo) {
      const developmentTrack = this.getDevelopmentTrack();
      if (developmentTrack !== 'development') {
        return `development (${developmentTrack})`;
      }
    }

    return this.currentChannel;
  }
}

export const updateService = new UpdateService();
