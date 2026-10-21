import type { InstallStateEvent, UpdateStatus } from '@rnforge/react-native-in-app-updates';

import { Platform } from 'react-native';

import * as Application from 'expo-application';
import Constants from 'expo-constants';

type NativeModule = typeof import('@rnforge/react-native-in-app-updates');
export type UpdatePolicy = 'flexible' | 'immediate';
export type NativeUpdateResult =
  | { kind: 'unsupported'; reason: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'unavailable'; status: UpdateStatus }
  | { kind: 'available'; status: UpdateStatus; flexibleAllowed: boolean; immediateAllowed: boolean }
  | { kind: 'ready' | 'in-progress' | 'downloading' | 'installing'; status: UpdateStatus };

const CHECK_TIMEOUT_MS = 4000;

/** Check calls may time out; install/UI promises must retain their coordinator lock until settled. */
async function withCheckDeadline<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Play update check timed out')),
          CHECK_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Thin, lazily loaded adapter. Importing the app on iOS/web/Expo Go never creates a Nitro object. */
export class NativeUpdateClient {
  private module: NativeModule | null = null;
  private moduleUnavailable = false;
  private statusRequest: Promise<UpdateStatus> | null = null;

  private unsupportedReason(): string | null {
    if (Platform.OS !== 'android') return 'unsupported-platform';
    if (Constants.executionEnvironment === 'storeClient') return 'expo-go';
    if (__DEV__ || Application.applicationId === 'site.jagged.planneriti.dev')
      return 'development-build';
    const isProduction = Application.applicationId === 'site.jagged.planneriti';
    const isPlayBeta =
      Application.applicationId === 'site.jagged.planneriti.beta' &&
      Constants.expoConfig?.extra?.betaPlayUpdatesEnabled === true;
    return isProduction || isPlayBeta ? null : 'package-not-enabled';
  }

  private load(): NativeModule | null {
    if (this.unsupportedReason() || this.moduleUnavailable) return null;
    if (!this.module) {
      try {
        // require must remain inside this guard: the library creates a Nitro hybrid object on import.
        this.module = require('@rnforge/react-native-in-app-updates') as NativeModule;
      } catch (error) {
        this.moduleUnavailable = true;
        console.warn('Native update module unavailable; rebuild the native app:', error);
      }
    }
    return this.module;
  }

  classify(status: UpdateStatus): NativeUpdateResult {
    const module = this.module;
    if (!status.supported) return { kind: 'unsupported', reason: status.reason };
    if (status.reason === 'developer-triggered-update-in-progress')
      return { kind: 'in-progress', status };
    if (module?.canCompleteFlexibleUpdate(status)) return { kind: 'ready', status };
    if (status.installStatus === 'installing') return { kind: 'installing', status };
    if (status.installStatus === 'pending' || status.installStatus === 'downloading')
      return { kind: 'downloading', status };
    if (status.updateAvailable === true) {
      return {
        kind: 'available',
        status,
        flexibleAllowed: module?.canStartFlexibleUpdate(status) === true,
        immediateAllowed: module?.canStartImmediateUpdate(status) === true,
      };
    }
    if (status.updateAvailable === false && status.reason === 'no-update-available')
      return { kind: 'unavailable', status };
    return { kind: 'failed', reason: status.reason };
  }

  async check(): Promise<NativeUpdateResult> {
    const reason = this.unsupportedReason();
    if (reason) return { kind: 'unsupported', reason };
    const module = this.load();
    if (!module) return { kind: 'unsupported', reason: 'native-module-unavailable' };
    try {
      // Retain an unresolved Play request across timeouts to avoid concurrent network requests.
      this.statusRequest ??= module.getUpdateStatus().finally(() => {
        this.statusRequest = null;
      });
      return this.classify(await withCheckDeadline(this.statusRequest));
    } catch (error) {
      console.warn('Google Play update check failed:', error);
      return { kind: 'failed', reason: 'play-check-failed' };
    }
  }

  async start(mode: UpdatePolicy): Promise<UpdateStatus> {
    const module = this.load();
    if (!module) throw new Error('Native updates are unavailable');
    return mode === 'immediate' ? module.startImmediateUpdate() : module.startFlexibleUpdate();
  }

  async complete(): Promise<UpdateStatus> {
    const module = this.load();
    if (!module) throw new Error('Native updates are unavailable');
    return module.completeFlexibleUpdate();
  }

  listen(status: UpdateStatus, listener: (event: InstallStateEvent) => void): (() => void) | null {
    const module = this.load();
    if (!module?.supportsInstallStateListener(status)) return null;
    const subscription = module.addInstallStateListener(listener);
    return () => subscription.remove();
  }

  canOpenStore(status: UpdateStatus): boolean {
    return this.load()?.canOpenStorePage(status) === true;
  }

  async openStore(): Promise<void> {
    await this.load()?.openStorePage();
  }
}
