import Constants from 'expo-constants';
import { Platform } from 'react-native';

const LOCAL_BIND_ADDRESS = '0.0.0.0';
const LOCAL_DEFAULT_PORT = '5000';
const REMOTE_CUSTOM_API_BASE_URL = 'https://papi.jagged.site';

let hasWarnedLocalFallback = false;
let hasLoggedResolutionInfo = false;
let lastLoggedSuccessfulBaseUrl: string | null = null;

const getConfiguredEnvironment = (): string => String(Constants.expoConfig?.extra?.environment || '').toLowerCase();

const isDevelopmentMode = (): boolean => {
  const env = getConfiguredEnvironment();
  return (typeof __DEV__ !== 'undefined' && __DEV__) || env === 'development' || env === 'dev';
};

const normalizePort = (rawPort?: unknown): string => {
  const value = String(rawPort || LOCAL_DEFAULT_PORT).trim();
  return /^\d+$/.test(value) ? value : LOCAL_DEFAULT_PORT;
};

const extractHostFromUri = (uri?: string | null): string | null => {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;

  const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
  const hostPort = withoutProtocol.split('/')[0];
  const host = hostPort.split(':')[0]?.trim();

  if (!host) return null;
  return host;
};

const getExpoHostCandidates = (): string[] => {
  const possibleHostUris: Array<string | undefined> = [
    Constants.expoConfig?.hostUri,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).manifest?.hostUri,
    (Constants as any).manifest2?.extra?.expoClient?.hostUri,
  ];

  const blockedHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
  const hosts = new Set<string>();

  possibleHostUris.forEach((uri) => {
    const host = extractHostFromUri(uri);
    if (!host) return;
    if (blockedHosts.has(host)) return;
    hosts.add(host);
  });

  return Array.from(hosts);
};

const getConfiguredLocalBaseUrls = (): string[] => {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const configuredLocalUrl = typeof extra?.customApiLocalUrl === 'string' ? extra.customApiLocalUrl.trim() : '';
  const configuredLocalHost = typeof extra?.customApiLocalHost === 'string' ? extra.customApiLocalHost.trim() : '';
  const port = normalizePort(extra?.customApiLocalPort);

  const urls: string[] = [];
  if (configuredLocalUrl) {
    urls.push(configuredLocalUrl.replace(/\/$/, ''));
  }
  if (configuredLocalHost) {
    urls.push(`http://${configuredLocalHost}:${port}`);
  }

  return urls;
};

const getConfiguredLocalPort = (): string => {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  return normalizePort(extra?.customApiLocalPort);
};

const getDefaultLocalBaseUrls = (): string[] => {
  const urls: string[] = [];
  const port = getConfiguredLocalPort();

  getExpoHostCandidates().forEach((host) => {
    urls.push(`http://${host}:${port}`);
  });

  if (Platform.OS === 'android') {
    urls.push(`http://10.0.2.2:${port}`);
  }

  if (Platform.OS === 'ios') {
    urls.push(`http://127.0.0.1:${port}`);
  }

  // Keep bind address as last local attempt for desktop/web edge-cases.
  urls.push(`http://${LOCAL_BIND_ADDRESS}:${port}`);

  return urls;
};

const dedupeUrls = (urls: string[]): string[] => {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const normalized = url.trim().replace(/\/$/, '');
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

interface CustomApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export const getCustomApiBaseUrls = (): string[] => {
  if (!isDevelopmentMode()) {
    return [REMOTE_CUSTOM_API_BASE_URL];
  }

  const localCandidates = dedupeUrls([
    ...getConfiguredLocalBaseUrls(),
    ...getDefaultLocalBaseUrls(),
  ]);

  return [...localCandidates, REMOTE_CUSTOM_API_BASE_URL];
};

const isAbortError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError');

export const fetchCustomApi = async (path: string, options: CustomApiFetchOptions = {}): Promise<Response> => {
  const { timeoutMs = 8000, ...requestInit } = options;
  const baseUrls = getCustomApiBaseUrls();
  const remoteIndex = baseUrls.indexOf(REMOTE_CUSTOM_API_BASE_URL);
  const localCandidates = remoteIndex >= 0 ? baseUrls.slice(0, remoteIndex) : [];
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const developmentMode = isDevelopmentMode();
  let lastError: unknown = null;

  if (developmentMode && !hasLoggedResolutionInfo) {
    hasLoggedResolutionInfo = true;
    console.log(`[custom-api] Resolution order: ${baseUrls.join(' -> ')}`);
  }

  for (let index = 0; index < baseUrls.length; index += 1) {
    const baseUrl = baseUrls[index];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${normalizedPath}`, {
        ...requestInit,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (developmentMode && lastLoggedSuccessfulBaseUrl !== baseUrl) {
        lastLoggedSuccessfulBaseUrl = baseUrl;
        console.log(`[custom-api] Using endpoint: ${baseUrl}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      if (
        developmentMode &&
        index === remoteIndex - 1 &&
        remoteIndex > 0 &&
        !hasWarnedLocalFallback &&
        !isAbortError(error)
      ) {
        hasWarnedLocalFallback = true;
        const detail = error instanceof Error ? error.message : String(error);
        console.warn(
          `[custom-api] Local development endpoints failed (${localCandidates.join(', ')}); falling back to ${REMOTE_CUSTOM_API_BASE_URL}.`,
          detail
        );
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Custom API request failed');
};
