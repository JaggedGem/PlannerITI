import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'JaggedGem';
const REPO_NAME = 'PlannerITI';
const LAST_UPDATE_CHECK_KEY = '@last_update_check';
const DISMISSED_VERSION_KEY = '@dismissed_update_version';
const LAST_CHECK_DATE_KEY = '@last_check_date';
const CHECK_INTERVAL = 1000 * 60 * 60 * 24; // Check once per day

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

class UpdateService {
  private currentChannel: 'beta' | 'production' | 'development' = 'development';
  private currentVersion: string = '';

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Determine the current channel based on the app variant
    const variant = Constants.expoConfig?.extra?.environment || 'development';
    
    if (variant === 'production') {
      this.currentChannel = 'production';
    } else if (variant === 'beta') {
      this.currentChannel = 'beta';
    } else {
      this.currentChannel = 'development';
    }

    // Get current app version
    this.currentVersion = Application.nativeApplicationVersion || '1.0.0';
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

      // Filter releases based on channel
      let filteredReleases = releases;
      if (this.currentChannel === 'beta') {
        // For beta, get both prereleases and releases
        filteredReleases = releases.filter(r => r.prerelease === true);
      } else if (this.currentChannel === 'production') {
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
      return dismissedVersion === version;
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
      await AsyncStorage.setItem(DISMISSED_VERSION_KEY, version);
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

      // Find the appropriate download asset (APK for Android)
      const apkAsset = latestRelease.assets.find(asset => 
        asset.name.toLowerCase().endsWith('.apk')
      );

      return {
        isAvailable: true,
        currentVersion: this.currentVersion,
        latestVersion: latestVersion,
        releaseNotes: latestRelease.body || 'No release notes available.',
        downloadUrl: apkAsset?.browser_download_url || '',
        releaseUrl: latestRelease.html_url,
        publishedAt: latestRelease.published_at,
      };
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
   * Manual update check (bypasses time restrictions and dismissals)
   */
  async manualCheckForUpdate(): Promise<UpdateInfo | null> {
    await this.clearDismissedVersion();
    return this.checkForUpdate(true);
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

      const latestVersion = latestRelease.tag_name;
      
      // Find the appropriate download asset (APK for Android)
      const apkAsset = latestRelease.assets.find(asset => 
        asset.name.toLowerCase().endsWith('.apk')
      );

      return {
        isAvailable: true,
        currentVersion: this.currentVersion,
        latestVersion: latestVersion,
        releaseNotes: latestRelease.body || 'No release notes available.',
        downloadUrl: apkAsset?.browser_download_url || '',
        releaseUrl: latestRelease.html_url,
        publishedAt: latestRelease.published_at,
      };
    } catch (error) {
      console.error('Error fetching latest release for testing:', error);
      return null;
    }
  }
}

export const updateService = new UpdateService();
