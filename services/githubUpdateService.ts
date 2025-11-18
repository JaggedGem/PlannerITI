import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const GITHUB_API_BASE = 'https://api.github.com/repos/JaggedGem/PlannerITI';
const DISMISSED_VERSION_KEY = '@github_update_dismissed_version';
const LAST_CHECK_KEY = '@github_update_last_check';
const CHECK_INTERVAL = 3600000; // 1 hour in milliseconds

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export interface UpdateInfo {
  isAvailable: boolean;
  release?: GitHubRelease;
  currentVersion: string;
  latestVersion: string;
}

class GitHubUpdateService {
  private appVariant: string;

  constructor() {
    // Get app variant from Expo constants
    this.appVariant = Constants.expoConfig?.extra?.environment || 'production';
  }

  /**
   * Check if we should check for updates (rate limiting)
   */
  private async shouldCheckForUpdates(): Promise<boolean> {
    try {
      const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
      if (!lastCheck) return true;

      const lastCheckTime = parseInt(lastCheck, 10);
      const now = Date.now();
      return now - lastCheckTime >= CHECK_INTERVAL;
    } catch (error) {
      return true;
    }
  }

  /**
   * Update the last check timestamp
   */
  private async updateLastCheckTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error updating last check time:', error);
    }
  }

  /**
   * Get the current app version
   */
  private getCurrentVersion(): string {
    return Constants.expoConfig?.version || '1.0.1';
  }

  /**
   * Compare two semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    // Remove 'v' prefix if present
    const version1 = v1.replace(/^v/, '');
    const version2 = v2.replace(/^v/, '');

    const parts1 = version1.split('.').map(Number);
    const parts2 = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }

    return 0;
  }

  /**
   * Fetch the latest release from GitHub
   */
  private async fetchLatestRelease(): Promise<GitHubRelease | null> {
    try {
      // For beta variant, check all releases including prereleases
      // For production, only check non-prerelease versions
      const endpoint = this.appVariant === 'beta' 
        ? `${GITHUB_API_BASE}/releases`
        : `${GITHUB_API_BASE}/releases/latest`;

      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();

      // For beta, find the latest prerelease or release
      if (this.appVariant === 'beta') {
        if (Array.isArray(data) && data.length > 0) {
          // Find the first release (prerelease or not) - they're ordered by date
          return data[0];
        }
        return null;
      }

      // For production, use the latest release
      return data;
    } catch (error) {
      console.error('Error fetching GitHub release:', error);
      return null;
    }
  }

  /**
   * Check if the user dismissed this version
   */
  private async isDismissed(version: string): Promise<boolean> {
    try {
      const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
      return dismissed === version;
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark a version as dismissed
   */
  async dismissUpdate(version: string): Promise<void> {
    try {
      await AsyncStorage.setItem(DISMISSED_VERSION_KEY, version);
    } catch (error) {
      console.error('Error dismissing update:', error);
    }
  }

  /**
   * Clear the dismissed version (for testing or when user updates)
   */
  async clearDismissed(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DISMISSED_VERSION_KEY);
    } catch (error) {
      console.error('Error clearing dismissed version:', error);
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdate(): Promise<UpdateInfo> {
    // Check rate limiting
    if (!(await this.shouldCheckForUpdates())) {
      const currentVersion = this.getCurrentVersion();
      return {
        isAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
      };
    }

    // Update last check time
    await this.updateLastCheckTime();

    const currentVersion = this.getCurrentVersion();
    const latestRelease = await this.fetchLatestRelease();

    if (!latestRelease) {
      return {
        isAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
      };
    }

    const latestVersion = latestRelease.tag_name;

    // Check if newer version is available
    const comparison = this.compareVersions(latestVersion, currentVersion);
    const isNewer = comparison > 0;

    // Check if user dismissed this version
    const dismissed = await this.isDismissed(latestVersion);

    return {
      isAvailable: isNewer && !dismissed,
      release: isNewer ? latestRelease : undefined,
      currentVersion,
      latestVersion,
    };
  }

  /**
   * Get the app variant (beta or production)
   */
  getAppVariant(): string {
    return this.appVariant;
  }
}

export const githubUpdateService = new GitHubUpdateService();
