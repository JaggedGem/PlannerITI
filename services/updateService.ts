import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Network from 'expo-network';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'JaggedGem';
const REPO_NAME = 'PlannerITI';
const DISMISSED_VERSION_KEY = '@dismissed_update_version';
const LAST_CHECK_DATE_KEY = '@last_check_date';
const OTA_PENDING_UPDATE_KEY = '@ota_pending_update';
const UPDATE_SETTINGS_KEY = '@update_settings';
const DOWNLOADED_UPDATE_KEY = '@downloaded_update_info';
const UPDATE_DOWNLOAD_ROOT = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
const UPDATE_DOWNLOAD_DIR = UPDATE_DOWNLOAD_ROOT ? `${UPDATE_DOWNLOAD_ROOT}updates` : '';
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
  downloadAssetName: string;
  downloadSize: number;
  releaseUrl: string;
  publishedAt: string;
  downloadedFilePath?: string | null;
  isDownloaded?: boolean;
  targetAbi?: string | null;
}

interface UpdateSettings {
  autoDownloadOnWifi: boolean;
}

interface DownloadedUpdateInfo {
  version: string;
  assetName: string;
  fileUri: string;
  downloadedAt: string;
  size: number;
  abi: string | null;
}

interface RemindLaterData {
  version: string;
  remindUntil: string;
}

interface PendingOtaUpdateData {
  updateId: string | null;
  fetchedAt: string;
}

const DEFAULT_UPDATE_SETTINGS: UpdateSettings = {
  autoDownloadOnWifi: true,
};

class UpdateService {
  private currentChannel: 'beta' | 'production' | 'development';
  private currentVersion: string;
  private configuredVariant: string;
  private isExpoGo: boolean;
  private updateSettingsCache: UpdateSettings | null = null;
  private activeDownloadVersion: string | null = null;

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

  private sanitizeFileName(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
  }

  private getAndroidTargetAbi(): string | null {
    if (Platform.OS !== 'android') {
      return null;
    }

    const supported = Device.supportedCpuArchitectures;
    if (!supported || supported.length === 0) {
      return null;
    }

    const normalized = supported.map(abi => abi.toLowerCase());
    const matches = (tokens: string[]) =>
      normalized.some(item => tokens.some(token => item.includes(token)));

    if (matches(['arm64', 'aarch64'])) return 'arm64-v8a';
    if (matches(['armeabi', 'armv7', 'armv7a', 'armv7-a'])) return 'armeabi-v7a';
    if (matches(['x86_64', 'x86-64', 'amd64'])) return 'x86_64';
    if (matches(['x86'])) return 'x86';

    return null;
  }

  private getAbiMatchTokens(abi: string): string[] {
    switch (abi) {
      case 'arm64-v8a':
        return ['arm64-v8a', 'arm64_v8a', 'arm64', 'aarch64'];
      case 'armeabi-v7a':
        return ['armeabi-v7a', 'armeabi_v7a', 'armv7', 'armeabi'];
      case 'x86_64':
        return ['x86_64', 'x86-64', 'amd64'];
      case 'x86':
        return ['x86'];
      default:
        return [abi.toLowerCase()];
    }
  }

  private assetNameMatchesAbiToken(assetName: string, token: string): boolean {
    if (token === 'x86') {
      if (assetName.includes('x86_64') || assetName.includes('x86-64')) {
        return false;
      }

      return /(^|[^a-z0-9])x86([^a-z0-9]|$)/.test(assetName);
    }

    return assetName.includes(token);
  }

  private async getUpdateSettings(): Promise<UpdateSettings> {
    if (this.updateSettingsCache) {
      return this.updateSettingsCache;
    }

    try {
      const raw = await AsyncStorage.getItem(UPDATE_SETTINGS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<UpdateSettings>) : null;
      this.updateSettingsCache = {
        ...DEFAULT_UPDATE_SETTINGS,
        ...(parsed || {}),
      };
    } catch (error) {
      console.error('Error loading update settings:', error);
      this.updateSettingsCache = { ...DEFAULT_UPDATE_SETTINGS };
    }

    return this.updateSettingsCache;
  }

  async getAutoDownloadOnWifiSetting(): Promise<boolean> {
    const settings = await this.getUpdateSettings();
    return settings.autoDownloadOnWifi;
  }

  async setAutoDownloadOnWifiSetting(enabled: boolean): Promise<void> {
    const settings = await this.getUpdateSettings();
    this.updateSettingsCache = { ...settings, autoDownloadOnWifi: enabled };

    try {
      await AsyncStorage.setItem(
        UPDATE_SETTINGS_KEY,
        JSON.stringify(this.updateSettingsCache)
      );
    } catch (error) {
      console.error('Error saving update settings:', error);
    }
  }

  async initializeUpdateStorage(): Promise<void> {
    await this.cleanupDownloadedUpdateIfStale();
  }

  private async ensureUpdateDirectory(): Promise<string | null> {
    if (!UPDATE_DOWNLOAD_ROOT || !UPDATE_DOWNLOAD_DIR) {
      return null;
    }

    try {
      const info = await FileSystem.getInfoAsync(UPDATE_DOWNLOAD_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(UPDATE_DOWNLOAD_DIR, { intermediates: true });
      }
      return UPDATE_DOWNLOAD_DIR;
    } catch (error) {
      console.error('Error preparing update directory:', error);
      return null;
    }
  }

  private async getDownloadedUpdateInfo(): Promise<DownloadedUpdateInfo | null> {
    try {
      const raw = await AsyncStorage.getItem(DOWNLOADED_UPDATE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as DownloadedUpdateInfo;
      if (!parsed?.fileUri || !parsed?.version) {
        return null;
      }

      const fileInfo = await FileSystem.getInfoAsync(parsed.fileUri);
      if (!fileInfo.exists) {
        await AsyncStorage.removeItem(DOWNLOADED_UPDATE_KEY);
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('Error reading downloaded update info:', error);
      return null;
    }
  }

  async getDownloadedUpdateForVersion(
    version: string,
    assetName?: string
  ): Promise<DownloadedUpdateInfo | null> {
    const downloaded = await this.getDownloadedUpdateInfo();
    if (!downloaded || downloaded.version !== version) {
      return null;
    }

    if (assetName) {
      const assetMatch = downloaded.assetName
        ? downloaded.assetName.toLowerCase() === assetName.toLowerCase()
        : true;
      if (!assetMatch) {
        return null;
      }
    }

    return downloaded;
  }

  private async saveDownloadedUpdateInfo(info: DownloadedUpdateInfo): Promise<void> {
    try {
      await AsyncStorage.setItem(DOWNLOADED_UPDATE_KEY, JSON.stringify(info));
    } catch (error) {
      console.error('Error saving downloaded update info:', error);
    }
  }

  private async removeDownloadedUpdate(info?: DownloadedUpdateInfo | null): Promise<void> {
    const target = info || await this.getDownloadedUpdateInfo();
    if (!target) {
      return;
    }

    try {
      await FileSystem.deleteAsync(target.fileUri, { idempotent: true });
    } catch (error) {
      console.warn('Error removing downloaded update file:', error);
    }

    try {
      await AsyncStorage.removeItem(DOWNLOADED_UPDATE_KEY);
    } catch (error) {
      console.error('Error clearing downloaded update metadata:', error);
    }
  }

  private async cleanupDownloadedUpdateIfStale(): Promise<void> {
    const downloaded = await this.getDownloadedUpdateInfo();
    if (!downloaded) {
      return;
    }

    const comparison = this.compareVersions(this.currentVersion, downloaded.version);
    if (comparison !== 1) {
      await this.removeDownloadedUpdate(downloaded);
    }
  }

  private async isWifiConnection(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return Boolean(state.isConnected) && state.type === Network.NetworkStateType.WIFI;
    } catch (error) {
      console.error('Error checking network state:', error);
      return false;
    }
  }

  private async withLocalDownloadState(updateInfo: UpdateInfo): Promise<UpdateInfo> {
    const downloaded = await this.getDownloadedUpdateForVersion(
      updateInfo.latestVersion,
      updateInfo.downloadAssetName
    );

    if (!downloaded) {
      return updateInfo;
    }

    return {
      ...updateInfo,
      isDownloaded: true,
      downloadedFilePath: downloaded.fileUri,
    };
  }

  private async maybeAutoDownloadUpdate(updateInfo: UpdateInfo): Promise<UpdateInfo> {
    if (Platform.OS !== 'android') {
      return updateInfo;
    }

    if (updateInfo.isDownloaded || !updateInfo.downloadUrl) {
      return updateInfo;
    }

    const autoDownload = await this.getAutoDownloadOnWifiSetting();
    if (!autoDownload) {
      return updateInfo;
    }

    const onWifi = await this.isWifiConnection();
    if (!onWifi) {
      return updateInfo;
    }

    const downloaded = await this.downloadUpdate(updateInfo);
    return downloaded || updateInfo;
  }

  async downloadUpdate(updateInfo: UpdateInfo): Promise<UpdateInfo | null> {
    if (!updateInfo.downloadUrl) {
      return null;
    }

    if (this.activeDownloadVersion === updateInfo.latestVersion) {
      return updateInfo;
    }

    const existing = await this.withLocalDownloadState(updateInfo);
    if (existing.isDownloaded) {
      return existing;
    }

    const downloadDir = await this.ensureUpdateDirectory();
    if (!downloadDir) {
      return null;
    }

    const prior = await this.getDownloadedUpdateInfo();
    if (prior && prior.version !== updateInfo.latestVersion) {
      await this.removeDownloadedUpdate(prior);
    }

    const assetName = updateInfo.downloadAssetName || `${REPO_NAME}-${updateInfo.latestVersion}.apk`;
    const fileName = this.sanitizeFileName(assetName);
    const fileUri = `${downloadDir}/${fileName}`;

    this.activeDownloadVersion = updateInfo.latestVersion;

    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        const result = await FileSystem.downloadAsync(updateInfo.downloadUrl, fileUri);
        const downloadedFileInfo = await FileSystem.getInfoAsync(result.uri);
        const resolvedSize =
          'size' in downloadedFileInfo && typeof downloadedFileInfo.size === 'number'
            ? downloadedFileInfo.size
            : 0;
        const meta: DownloadedUpdateInfo = {
          version: updateInfo.latestVersion,
          assetName,
          fileUri: result.uri,
          downloadedAt: new Date().toISOString(),
          size: updateInfo.downloadSize || resolvedSize,
          abi: updateInfo.targetAbi || null,
        };
        await this.saveDownloadedUpdateInfo(meta);
        return { ...updateInfo, isDownloaded: true, downloadedFilePath: result.uri };
      }

      const meta: DownloadedUpdateInfo = {
        version: updateInfo.latestVersion,
        assetName,
        fileUri,
        downloadedAt: new Date().toISOString(),
        size: updateInfo.downloadSize || 0,
        abi: updateInfo.targetAbi || null,
      };
      await this.saveDownloadedUpdateInfo(meta);
      return { ...updateInfo, isDownloaded: true, downloadedFilePath: fileUri };
    } catch (error) {
      console.error('Error downloading update:', error);
      return null;
    } finally {
      this.activeDownloadVersion = null;
    }
  }

  async installDownloadedUpdate(version?: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    const downloaded = await this.getDownloadedUpdateInfo();
    if (!downloaded) {
      return false;
    }

    if (version && downloaded.version !== version) {
      return false;
    }

    try {
      const contentUri = await FileSystem.getContentUriAsync(downloaded.fileUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/vnd.android.package-archive',
      });
      return true;
    } catch (error) {
      console.error('Error launching update installer:', error);
      return false;
    }
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
      downloadAssetName: downloadAsset?.name || '',
      downloadSize: downloadAsset?.size || 0,
      releaseUrl: release.html_url,
      publishedAt: release.published_at,
      targetAbi: this.getAndroidTargetAbi(),
    };
  }

  /**
   * Pick the best matching downloadable asset for the current platform.
   */
  private getPreferredDownloadAsset(
    assets: GitHubRelease['assets']
  ): GitHubRelease['assets'][number] | undefined {
    const normalizedAssets = assets.map(asset => ({
      asset,
      name: asset.name.toLowerCase(),
    }));

    if (Platform.OS === 'android') {
      const abi = this.getAndroidTargetAbi();
      const apkAssets = normalizedAssets.filter(item => item.name.endsWith('.apk'));

      if (abi) {
        const tokens = this.getAbiMatchTokens(abi);
        const abiMatch = apkAssets.find(item =>
          tokens.some(token => this.assetNameMatchesAbiToken(item.name, token))
        );

        if (abiMatch) {
          return abiMatch.asset;
        }
      }

      const universalMatch = apkAssets.find(item => item.name.includes('universal'));
      if (universalMatch) {
        return universalMatch.asset;
      }

      if (apkAssets.length > 0) {
        return apkAssets[0].asset;
      }

      return undefined;
    }

    if (Platform.OS === 'ios') {
      return normalizedAssets.find(item => item.name.endsWith('.ipa'))?.asset;
    }

    return normalizedAssets[0]?.asset;
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

      await this.cleanupDownloadedUpdateIfStale();

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

      const updateInfo = await this.withLocalDownloadState(
        this.mapReleaseToUpdateInfo(latestRelease)
      );
      return await this.maybeAutoDownloadUpdate(updateInfo);
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

  async clearDownloadedUpdatePackage(): Promise<void> {
    await this.removeDownloadedUpdate();
  }

  async prepareLatestReleaseDownloadForTesting(): Promise<UpdateInfo | null> {
    const update = await this.getLatestReleaseForTesting();
    if (!update) {
      return null;
    }

    if (update.isDownloaded) {
      return update;
    }

    if (!update.downloadUrl) {
      return update;
    }

    return await this.downloadUpdate(update);
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

      return await this.withLocalDownloadState(
        this.mapReleaseToUpdateInfo(latestRelease)
      );
    } catch (error) {
      console.error('Error fetching latest release for testing:', error);
      return null;
    }
  }
}

export const updateService = new UpdateService();
