import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

const OTA_PENDING_UPDATE_KEY = '@ota_pending_update';

type DisruptiveOperation = 'ota-reload' | 'native-flow' | 'native-install';

interface PendingOtaUpdateData {
  updateId: string;
  fetchedAt: string;
  runtimeVersion: string;
  applicationId: string;
  nativeBuildVersion: string;
}

/** One shared gate for operations which can replace or interrupt this JS runtime. */
export class UpdateService {
  private disruptiveOperation: DisruptiveOperation | null = null;
  private otaPreparation: Promise<boolean> | null = null;
  private otaApplication: Promise<boolean> | null = null;
  private readonly isExpoGo = Constants.executionEnvironment === 'storeClient';

  private acquireOperation(operation: DisruptiveOperation): boolean {
    if (this.disruptiveOperation) return false;
    this.disruptiveOperation = operation;
    return true;
  }

  private releaseOperation(operation: DisruptiveOperation): void {
    if (this.disruptiveOperation === operation) this.disruptiveOperation = null;
  }

  /** Installed binary version; the Expo Go host version is not the app's version. */
  getCurrentVersion(): string {
    return (
      (!this.isExpoGo && Application.nativeApplicationVersion) ||
      Constants.expoConfig?.version ||
      'N/A'
    );
  }

  getCurrentOtaVersionShort(): string {
    const manifest = Updates.manifest;
    const metadata = 'metadata' in manifest ? manifest.metadata : undefined;
    const updateGroup = metadata && 'updateGroup' in metadata ? metadata.updateGroup : undefined;
    if (typeof updateGroup === 'string' && updateGroup.length >= 8) return updateGroup.slice(0, 8);
    return Updates.updateId?.slice(0, 8) || 'N/A';
  }

  /** EAS channels are build metadata, independent of Play testing tracks. */
  getCurrentChannel(): string {
    if (this.isExpoGo) return 'development';
    const variant: unknown = Constants.expoConfig?.extra?.environment;
    return Updates.channel || (typeof variant === 'string' ? variant : 'development');
  }

  getChannelDisplay(): string {
    const variant: unknown = Constants.expoConfig?.extra?.environment;
    if (this.isExpoGo && (variant === 'beta' || variant === 'production')) {
      return `development (${variant})`;
    }
    return this.getCurrentChannel();
  }

  private canUseOtaUpdates(): boolean {
    return !this.isExpoGo && !__DEV__ && Updates.isEnabled;
  }

  private async markOtaPending(updateId: string): Promise<void> {
    const { runtimeVersion } = Updates;
    const { applicationId, nativeBuildVersion } = Application;
    // Missing build identity cannot safely authorize a later reload.
    if (!runtimeVersion || !applicationId || !nativeBuildVersion) return;
    try {
      const payload: PendingOtaUpdateData = {
        updateId,
        fetchedAt: new Date().toISOString(),
        runtimeVersion,
        applicationId,
        nativeBuildVersion,
      };
      await AsyncStorage.setItem(OTA_PENDING_UPDATE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Error saving pending OTA update:', error);
    }
  }

  private async getPendingOta(): Promise<PendingOtaUpdateData | null> {
    try {
      const raw = await AsyncStorage.getItem(OTA_PENDING_UPDATE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'updateId' in parsed &&
        typeof parsed.updateId === 'string' &&
        'fetchedAt' in parsed &&
        typeof parsed.fetchedAt === 'string' &&
        'runtimeVersion' in parsed &&
        parsed.runtimeVersion === Updates.runtimeVersion &&
        'applicationId' in parsed &&
        parsed.applicationId === Application.applicationId &&
        'nativeBuildVersion' in parsed &&
        parsed.nativeBuildVersion === Application.nativeBuildVersion &&
        parsed.updateId !== Updates.updateId
      ) {
        return parsed as PendingOtaUpdateData;
      }
      // Legacy, already applied, or different-binary markers cannot prove cache compatibility.
      // Expo's selection policy remains authoritative; staging can revalidate on this build.
      await this.clearPendingOta();
    } catch (error) {
      console.error('Error reading pending OTA update:', error);
      await this.clearPendingOta();
    }
    return null;
  }

  private async clearPendingOta(): Promise<void> {
    try {
      await AsyncStorage.removeItem(OTA_PENDING_UPDATE_KEY);
    } catch (error) {
      console.error('Error clearing pending OTA update:', error);
      throw error;
    }
  }

  /** Stage only: Expo also applies compatible downloaded updates itself on cold launch. */
  prepareOtaUpdateForNextLaunch(): Promise<boolean> {
    if (!this.canUseOtaUpdates()) return Promise.resolve(false);
    this.otaPreparation ??= this.prepareOta();
    return this.otaPreparation;
  }

  private async prepareOta(): Promise<boolean> {
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) return false;
      const result = await Updates.fetchUpdateAsync();
      if (!result.manifest?.id) return false;
      await this.markOtaPending(result.manifest.id);
      return true;
    } catch (error) {
      console.error('Error preparing OTA update:', error);
      return false;
    }
  }

  /** Apply a previously staged OTA once per JS lifetime, only when the gate is free. */
  applyPreparedOtaUpdateOnLaunch(): Promise<boolean> {
    if (!this.canUseOtaUpdates()) return Promise.resolve(false);
    this.otaApplication ??= this.applyOta();
    return this.otaApplication;
  }

  private async applyOta(): Promise<boolean> {
    if (!this.acquireOperation('ota-reload')) return false;
    try {
      const pending = await this.getPendingOta();
      if (!pending) {
        this.releaseOperation('ota-reload');
        return false;
      }
      await this.clearPendingOta();
      await Updates.reloadAsync();
      // Keep the gate closed: reloadAsync resolves before the runtime is replaced.
      return true;
    } catch (error) {
      console.error('Error applying staged OTA update:', error);
      this.releaseOperation('ota-reload');
      // Do not recreate a marker that can cause a reload loop on every launch.
      return false;
    }
  }
}

export const updateService = new UpdateService();
