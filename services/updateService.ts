import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'JaggedGem';
const REPO_NAME = 'PlannerITI';
const DISMISSED_VERSION_KEY = '@dismissed_update_version';
const LAST_CHECK_DATE_KEY = '@last_check_date';
const REMIND_LATER_DAYS = 7;

export const UPDATE_AVAILABLE_EVENT = 'UPDATE_AVAILABLE';

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  html_url: string;
  assets: {
    name: string;
    browser_download_url: string;
    size: number;
  }[];
}

export interface UpdateInfo {
  isAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  releaseUrl: string;
  publishedAt: string;
}

interface RemindLaterData {
  version: string;
  remindUntil: string;
}

class UpdateService {
  private currentChannel: 'beta' | 'production' | 'development';
  private currentVersion: string;
  private configuredVariant: string;
  private isExpoGo: boolean;

  /**
   * Infer release track from semantic prerelease tags (e.g. 1.2.0-beta.1).
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
   * In development (Expo Go), prefer the configured variant channel for release filtering.
   */
  private getReleaseChannelForFetch(): 'beta' | 'production' | 'development' {
    if (this.currentChannel === 'development') {
      const developmentTrack = this.getDevelopmentTrack();
      if (developmentTrack === 'beta') return 'beta';
      if (developmentTrack === 'production') return 'production';
    }

    return this.currentChannel;
  }

  /**
   * Map a GitHub release to app update info.
   */
  private mapReleaseToUpdateInfo(release: GitHubRelease): UpdateInfo {
    const downloadAsset = this.getPreferredDownloadAsset(release.assets);

    return {
      isAvailable: true,
      currentVersion: this.currentVersion,
      latestVersion: release.tag_name,
      releaseNotes: release.body || 'No release notes available.',
      downloadUrl: downloadAsset?.browser_download_url || '',
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
    };
  }

  /**
   * Pick the best matching downloadable asset for the current platform.
   */
  private getPreferredDownloadAsset(
    assets: GitHubRelease['assets']
  ): GitHubRelease['assets'][number] | undefined {
    const lowerCasedAssets = assets.map(asset => ({
      ...asset,
      name: asset.name.toLowerCase(),
    }));

    if (Platform.OS === 'android') {
      return (
        lowerCasedAssets.find(asset => asset.name.endsWith('.apk')) ||
        lowerCasedAssets.find(asset => asset.name.endsWith('.aab'))
      );
    }

    if (Platform.OS === 'ios') {
      return lowerCasedAssets.find(asset => asset.name.endsWith('.ipa'));
    }

    return lowerCasedAssets[0];
  }

  /**
   * Check if we should check for updates (once per calendar day)
   */
  private async shouldCheckForUpdate(): Promise<boolean> {
    try {
      const lastCheckDateStr = await AsyncStorage.getItem(LAST_CHECK_DATE_KEY);
      if (!lastCheckDateStr) return true;

      const now = new Date();
      const lastCheckDate = new Date(lastCheckDateStr);
      
      // Check if it's a different day
      const isSameDay = 
        now.getFullYear() === lastCheckDate.getFullYear() &&
        now.getMonth() === lastCheckDate.getMonth() &&
        now.getDate() === lastCheckDate.getDate();
      
      return !isSameDay;
    } catch (error) {
      console.error('Error checking update interval:', error);
      return true;
    }
  }

  /**
   * Update the last check date
   */
  private async updateLastCheckTime(): Promise<void> {
    try {
      const now = new Date();
      await AsyncStorage.setItem(LAST_CHECK_DATE_KEY, now.toISOString());
    } catch (error) {
      console.error('Error updating last check time:', error);
    }
  }

  /**
   * Get the latest release from GitHub for the current channel
   */
  private async fetchLatestRelease(): Promise<GitHubRelease | null> {
    try {
      const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const releases: GitHubRelease[] = await response.json();

      const releaseChannel = this.getReleaseChannelForFetch();

      // Filter releases based on channel
      let filteredReleases = releases;
      if (releaseChannel === 'beta') {
        // For beta, get both prereleases and releases
        filteredReleases = releases.filter(r => r.prerelease === true);
      } else if (releaseChannel === 'production') {
        // For production, get only stable releases
        filteredReleases = releases.filter(r => r.prerelease === false);
      }

      // Return the most recent release
      return filteredReleases.length > 0 ? filteredReleases[0] : null;
    } catch (error) {
      console.error('Error fetching latest release:', error);
      return null;
    }
  }

  /**
   * Compare version strings (semantic versioning)
   */
  private compareVersions(current: string, latest: string): number {
    // Remove 'v' prefix if present
    const currentClean = current.replace(/^v/, '');
    const latestClean = latest.replace(/^v/, '');

    const currentParts = currentClean.split('.').map(n => parseInt(n, 10) || 0);
    const latestParts = latestClean.split('.').map(n => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const c = currentParts[i] || 0;
      const l = latestParts[i] || 0;

      if (l > c) return 1; // Latest is newer
      if (l < c) return -1; // Current is newer (shouldn't happen)
    }

    return 0; // Versions are equal
  }

  /**
   * Check if a version was dismissed by the user
   */
  private async isVersionDismissed(version: string): Promise<boolean> {
    try {
      const dismissedVersion = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
      if (!dismissedVersion) {
        return false;
      }

      // Legacy values were stored as plain strings and acted like forever dismiss.
      // Ignore them so behavior follows the new 7-day remind-later policy.
      if (dismissedVersion === version) {
        return false;
      }

      const parsedData = JSON.parse(dismissedVersion) as RemindLaterData;
      if (!parsedData?.version || !parsedData?.remindUntil) {
        return false;
      }

      if (parsedData.version !== version) {
        return false;
      }

      return new Date(parsedData.remindUntil).getTime() > Date.now();
    } catch (error) {
      console.error('Error checking dismissed version:', error);
      return false;
    }
  }

  /**
   * Mark a version as dismissed
   */
  async dismissVersion(version: string): Promise<void> {
    try {
      const remindUntil = new Date();
      remindUntil.setDate(remindUntil.getDate() + REMIND_LATER_DAYS);

      const remindData: RemindLaterData = {
        version,
        remindUntil: remindUntil.toISOString(),
      };

      await AsyncStorage.setItem(DISMISSED_VERSION_KEY, JSON.stringify(remindData));
    } catch (error) {
      console.error('Error dismissing version:', error);
    }
  }

  /**
   * Clear dismissed version (for testing or when user manually checks)
   */
  async clearDismissedVersion(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DISMISSED_VERSION_KEY);
    } catch (error) {
      console.error('Error clearing dismissed version:', error);
    }
  }

  /**
   * Check for updates and return update information
   */
  async checkForUpdate(forceCheck: boolean = false): Promise<UpdateInfo | null> {
    try {
      // Skip if in development mode
      if (this.currentChannel === 'development') {
        return null;
      }

      // Check if we should perform an update check
      if (!forceCheck && !(await this.shouldCheckForUpdate())) {
        return null;
      }

      // Update last check time
      await this.updateLastCheckTime();

      // Fetch latest release
      const latestRelease = await this.fetchLatestRelease();
      if (!latestRelease) {
        return null;
      }

      const latestVersion = latestRelease.tag_name;
      
      // Compare versions
      const comparison = this.compareVersions(this.currentVersion, latestVersion);
      
      // If latest version is not newer, no update available
      if (comparison !== 1) {
        return null;
      }

      // Check if this version was dismissed
      if (!forceCheck && await this.isVersionDismissed(latestVersion)) {
        return null;
      }

      return this.mapReleaseToUpdateInfo(latestRelease);
    } catch (error) {
      console.error('Error checking for update:', error);
      return null;
    }
  }

  /**
   * Get current app version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Get current channel
   */
  getCurrentChannel(): string {
    return this.currentChannel;
  }

  /**
   * Get channel display text (shows configured variant when in Expo Go)
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

  /**
   * Manual update check (bypasses time restrictions and dismissals)
   */
  async manualCheckForUpdate(): Promise<UpdateInfo | null> {
    await this.clearDismissedVersion();

    const regularUpdate = await this.checkForUpdate(true);
    if (regularUpdate) {
      return regularUpdate;
    }

    // Developer simulation path: in development builds, reuse the latest release info
    // so the full update UX can be tested from Settings.
    if (this.currentChannel === 'development') {
      return this.getLatestReleaseForTesting();
    }

    return null;
  }

  /**
   * Force fetch latest release info for testing (developer mode)
   * Always returns update info regardless of version comparison
   */
  async getLatestReleaseForTesting(): Promise<UpdateInfo | null> {
    try {
      const latestRelease = await this.fetchLatestRelease();
      if (!latestRelease) {
        return null;
      }

      return this.mapReleaseToUpdateInfo(latestRelease);
    } catch (error) {
      console.error('Error fetching latest release for testing:', error);
      return null;
    }
  }
}

export const updateService = new UpdateService();
