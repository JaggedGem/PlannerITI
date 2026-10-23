import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InstallStateEvent } from '@rnforge/react-native-in-app-updates';

import { AppState } from 'react-native';

import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { NATIVE_UPDATE_POLICY } from '@/constants/UpdatePolicy';

import {
  NativeUpdateClient,
  type NativeUpdateResult,
  type UpdatePolicy,
} from './nativeUpdateClient';

export type NativeUpdateSnapshot = {
  phase: 'idle' | 'available' | 'downloading' | 'ready' | 'installing' | 'recovery' | 'error';
  busy: boolean;
  dismissed: boolean;
  storeFallback: boolean;
};

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
  private reloadRequested = false;
  private otaPreparation: Promise<boolean> | null = null;
  private otaApplication: Promise<boolean> | null = null;
  private readonly native = new NativeUpdateClient();
  private nativeResult: NativeUpdateResult | null = null;
  private nativeCheck: Promise<NativeUpdateResult> | null = null;
  private startup: Promise<void> | null = null;
  private nativePromptsEnabled = false;
  private nativePromptAttempted = false;
  private nativeCompletionAttempted = false;
  private lastNativeCheck = 0;
  private installEventRevision = 0;
  private lifecycleUsers = 0;
  private removeInstallListener: (() => void) | null = null;
  private removeAppStateListener: (() => void) | null = null;
  private readonly subscribers = new Set<() => void>();
  private snapshot: NativeUpdateSnapshot = {
    phase: 'idle',
    busy: false,
    dismissed: false,
    storeFallback: false,
  };

  constructor(private readonly policy: UpdatePolicy = NATIVE_UPDATE_POLICY) {}

  getNativeUpdateSnapshot = (): NativeUpdateSnapshot => this.snapshot;

  subscribeToNativeUpdates = (listener: () => void): (() => void) => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  private publish(changes: Partial<NativeUpdateSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    this.subscribers.forEach((listener) => listener());
  }

  dismissNativeUpdate(): void {
    this.publish({ dismissed: true });
  }

  /** Retained by the one root layout. Strict Mode cleanup also removes native listeners. */
  attachUpdateLifecycle(): () => void {
    this.lifecycleUsers += 1;
    if (this.lifecycleUsers === 1) {
      let previous = AppState.currentState;
      const subscription = AppState.addEventListener('change', (next) => {
        const foregrounded = next === 'active' && previous !== 'active';
        previous = next;
        if (!foregrounded || this.snapshot.busy || this.disruptiveOperation === 'ota-reload')
          return;
        const recovering = ['downloading', 'ready', 'recovery'].includes(this.snapshot.phase);
        const refresh =
          recovering || Date.now() - this.lastNativeCheck > 60_000
            ? this.checkForNativeUpdate()
            : Promise.resolve();
        void refresh
          .then(() => this.promptForNativeUpdate())
          .catch((error) => console.warn('Update recovery failed:', error));
      });
      this.removeAppStateListener = () => subscription.remove();
      this.ensureInstallListener();
    }
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      if (--this.lifecycleUsers === 0) {
        this.nativePromptsEnabled = false;
        this.removeAppStateListener?.();
        this.removeAppStateListener = null;
        this.removeInstallListener?.();
        this.removeInstallListener = null;
      }
    };
  }

  private ensureInstallListener(): void {
    if (
      !this.lifecycleUsers ||
      this.removeInstallListener ||
      !this.nativeResult ||
      !('status' in this.nativeResult)
    )
      return;
    try {
      this.removeInstallListener = this.native.listen(this.nativeResult.status, (event) =>
        this.onInstallState(event),
      );
    } catch (error) {
      console.warn('Could not observe Play update installation:', error);
    }
  }

  private onInstallState(event: InstallStateEvent): void {
    if (!this.lifecycleUsers) return;
    this.installEventRevision += 1;
    if (event.installStatus === 'downloaded') {
      // Repeated downloaded notifications must not retry a failed/in-flight installation.
      if (this.nativeCompletionAttempted) return;
      this.publish({ phase: 'ready', dismissed: false, storeFallback: false });
      void this.promptForNativeUpdate();
    } else if (event.installStatus === 'pending' || event.installStatus === 'downloading') {
      this.publish({ phase: 'downloading' });
    } else if (event.installStatus === 'installing') {
      if (!this.reloadRequested) this.disruptiveOperation = 'native-install';
      this.publish({ phase: 'installing', busy: true, storeFallback: false });
    } else if (['failed', 'canceled', 'installed'].includes(event.installStatus)) {
      this.releaseOperation('native-install');
      if (event.installStatus === 'failed')
        console.warn('Play update download/install failed:', event.errorCode);
      this.publish({ phase: event.installStatus === 'failed' ? 'error' : 'idle', busy: false });
    }
  }

  checkForNativeUpdate(): Promise<NativeUpdateResult> {
    const revision = this.installEventRevision;
    this.nativeCheck ??= this.native
      .check()
      .then((result) => {
        this.nativeResult = result;
        this.lastNativeCheck = Date.now();
        // An install event arriving during a check is newer than its status snapshot.
        if (revision !== this.installEventRevision) return result;
        if (result.kind === 'in-progress' || result.kind === 'installing') {
          if (!this.reloadRequested) this.disruptiveOperation = 'native-install';
          this.publish({
            phase: result.kind === 'installing' ? 'installing' : 'recovery',
            busy: result.kind === 'installing' || this.snapshot.busy,
            storeFallback: result.kind === 'in-progress' && this.native.canOpenStore(result.status),
          });
        } else if (result.kind !== 'failed') {
          if (!this.snapshot.busy) this.releaseOperation('native-install');
          const canStart =
            result.kind === 'available' &&
            (result.flexibleAllowed || (this.policy === 'immediate' && result.immediateAllowed));
          const storeFallback =
            result.kind === 'available' && !canStart && this.native.canOpenStore(result.status);
          let phase: NativeUpdateSnapshot['phase'] = 'idle';
          if (result.kind === 'available' && (canStart || storeFallback)) {
            // Passive checks must preserve the retry action after a failed Play flow.
            phase = canStart && this.snapshot.phase === 'error' ? 'error' : 'available';
          } else if (result.kind === 'ready' || result.kind === 'downloading') {
            phase =
              result.kind === 'ready' &&
              this.nativeCompletionAttempted &&
              this.snapshot.phase === 'error'
                ? 'error'
                : result.kind;
          }
          this.publish({
            phase,
            storeFallback,
            ...(phase === 'ready' && this.snapshot.phase !== 'ready' ? { dismissed: false } : {}),
          });
        }
        this.ensureInstallListener();
        return result;
      })
      .finally(() => {
        this.nativeCheck = null;
      });
    return this.nativeCheck;
  }

  /** One startup workflow, shared by remounts and all callers. Never reload OTA on foreground. */
  initializeUpdates(): Promise<void> {
    this.startup ??= this.runStartupUpdates();
    return this.startup;
  }

  private async runStartupUpdates(): Promise<void> {
    const native = await this.checkForNativeUpdate();
    // A timed-out check cannot establish that an interrupted immediate flow is absent.
    // Stage OTA normally, but leave application to Expo's next compatible cold launch.
    if (native.kind !== 'failed' && (await this.applyPreparedOtaUpdateOnLaunch())) return;
    void this.prepareOtaUpdateForNextLaunch();
  }

  /** Start consent or finish a downloaded Play update after the app has rendered. */
  enableNativeUpdatePrompts(): Promise<boolean> {
    this.nativePromptsEnabled = true;
    return this.promptForNativeUpdate();
  }

  private async promptForNativeUpdate(): Promise<boolean> {
    if (!this.nativePromptsEnabled) return false;
    if (this.snapshot.phase === 'ready' && !this.nativeCompletionAttempted)
      return this.completeNativeUpdate();
    if (
      this.nativePromptAttempted ||
      this.nativeResult?.kind !== 'available' ||
      this.snapshot.dismissed ||
      this.snapshot.phase !== 'available' ||
      this.snapshot.storeFallback
    )
      return false;
    return this.startNativeUpdate();
  }

  /** Open Google's cancellable consent UI. Never escalate flexible to immediate. */
  async startNativeUpdate(): Promise<boolean> {
    if (AppState.currentState !== 'active' || !this.acquireOperation('native-flow')) return false;
    this.nativePromptAttempted = true;
    this.publish({ busy: true });
    try {
      const result = await this.checkForNativeUpdate();
      if (result.kind !== 'available' || AppState.currentState !== 'active') return false;
      const mode =
        this.policy === 'immediate' && result.immediateAllowed
          ? 'immediate'
          : result.flexibleAllowed
            ? 'flexible'
            : null;
      if (!mode) return false;
      const revision = this.installEventRevision;
      const status = await this.native.start(mode);
      // The flow returns cached AppUpdateInfo; newer terminal install events are authoritative.
      if (
        revision !== this.installEventRevision &&
        (this.snapshot.phase === 'error' || this.snapshot.phase === 'idle')
      )
        return false;
      if (status.reason === 'user-canceled' || status.installStatus === 'canceled') {
        this.publish({ phase: 'idle', dismissed: true });
        return false;
      }
      if (!status.supported || status.reason !== 'update-available') {
        this.publish({ phase: 'error', dismissed: false });
        return false;
      }
      if (mode === 'immediate') {
        // A successful flow result can precede process replacement, just like OTA reloadAsync.
        this.disruptiveOperation = 'native-install';
        this.publish({ phase: 'recovery', storeFallback: this.native.canOpenStore(status) });
        return true;
      }
      // Flow methods return pre-flow AppUpdateInfo. Events/foreground recovery supply fresh status.
      if (this.snapshot.phase !== 'ready' && this.snapshot.phase !== 'installing')
        this.publish({ phase: 'downloading' });
      return true;
    } catch (error) {
      console.warn('Could not start Play update:', error);
      this.publish({ phase: 'error', dismissed: false });
      return false;
    } finally {
      this.releaseOperation('native-flow');
      this.publish({
        busy: this.disruptiveOperation === 'native-install' && this.snapshot.phase !== 'recovery',
      });
      // A small download may finish while Google's consent promise still owns the gate.
      void this.promptForNativeUpdate();
    }
  }

  async completeNativeUpdate(): Promise<boolean> {
    if (AppState.currentState !== 'active' || !this.acquireOperation('native-flow')) return false;
    this.publish({ busy: true });
    try {
      // A downloaded install event is authoritative; the native method rechecks Play itself.
      const ready =
        this.snapshot.phase === 'ready' || (await this.checkForNativeUpdate()).kind === 'ready';
      if (!ready || AppState.currentState !== 'active') return false;
      this.nativeCompletionAttempted = true;
      // completeFlexibleUpdate may resolve before the process restarts. Keep the gate closed on success.
      this.disruptiveOperation = 'native-install';
      this.publish({ phase: 'installing', storeFallback: false });
      const revision = this.installEventRevision;
      const status = await this.native.complete();
      if (revision !== this.installEventRevision && this.snapshot.phase === 'error') return false;
      if (
        !status.supported ||
        status.reason !== 'flexible-update-downloaded' ||
        status.installStatus === 'failed'
      ) {
        this.releaseOperation('native-install');
        this.publish({ busy: false, phase: 'error' });
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Could not complete Play update:', error);
      this.releaseOperation('native-install');
      this.publish({ busy: false, phase: 'error' });
      return false;
    } finally {
      this.releaseOperation('native-flow');
      if (this.disruptiveOperation !== 'native-install') this.publish({ busy: false });
    }
  }

  async openNativeUpdateStore(): Promise<void> {
    if (
      !this.snapshot.storeFallback ||
      this.snapshot.busy ||
      this.disruptiveOperation === 'ota-reload'
    )
      return;
    try {
      await this.native.openStore();
    } catch (error) {
      console.warn('Could not open Play Store:', error);
    }
  }

  private readonly isExpoGo = Constants.executionEnvironment === 'storeClient';

  private acquireOperation(operation: DisruptiveOperation): boolean {
    if (this.reloadRequested || this.disruptiveOperation) return false;
    this.disruptiveOperation = operation;
    return true;
  }

  private releaseOperation(operation: DisruptiveOperation): void {
    if (this.disruptiveOperation === operation) this.disruptiveOperation = null;
  }

  /** App-displayed release label, delivered by the current build or OTA manifest. */
  getCurrentVersion(): string {
    const releaseVersion: unknown = Constants.expoConfig?.extra?.releaseVersion;
    if (typeof releaseVersion === 'string' && releaseVersion.trim()) {
      return releaseVersion.trim();
    }
    // Older manifests may lack the label; never use the Expo Go host's version.
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
        typeof parsed.runtimeVersion === 'string' &&
        parsed.runtimeVersion === Updates.runtimeVersion &&
        'applicationId' in parsed &&
        typeof parsed.applicationId === 'string' &&
        parsed.applicationId === Application.applicationId &&
        'nativeBuildVersion' in parsed &&
        typeof parsed.nativeBuildVersion === 'string' &&
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
    const native = this.nativeResult ?? (await this.checkForNativeUpdate());
    // Apply an already downloaded Play binary before considering a JS-only reload.
    if (native.kind === 'failed' || native.kind === 'ready' || this.snapshot.phase === 'ready')
      return false;
    if (!this.acquireOperation('ota-reload')) return false;
    try {
      const pending = await this.getPendingOta();
      if (!pending) {
        this.releaseOperation('ota-reload');
        return false;
      }
      // Install events/status can arrive while storage is being read or cleared.
      if (this.disruptiveOperation !== 'ota-reload') return false;
      await this.clearPendingOta();
      if (this.disruptiveOperation !== 'ota-reload') {
        await AsyncStorage.setItem(OTA_PENDING_UPDATE_KEY, JSON.stringify(pending));
        return false;
      }
      this.reloadRequested = true;
      await Updates.reloadAsync();
      // Keep the gate closed: reloadAsync resolves before the runtime is replaced.
      return true;
    } catch (error) {
      console.error('Error applying staged OTA update:', error);
      this.reloadRequested = false;
      this.releaseOperation('ota-reload');
      // Do not recreate a marker that can cause a reload loop on every launch.
      return false;
    }
  }
}

export const updateService = new UpdateService();
