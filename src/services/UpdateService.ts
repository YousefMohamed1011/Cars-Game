import * as Updates from 'expo-updates';
import { Platform, Linking } from 'react-native';

export interface VersionManifest {
  version: string;
  versionCode: number;
  releaseDate: string;
  minSupportedVersion: string;
  changelog: string[];
  apkDownloadUrl: string;
  otaUpdateEnabled: boolean;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  isOtaAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  changelog: string[];
  apkDownloadUrl: string;
  releaseDate?: string;
}

const CURRENT_APP_VERSION = '1.0.0';
const REMOTE_VERSION_URL =
  'https://raw.githubusercontent.com/YousefMohamed1011/Cars-Game/main/version.json';

class UpdateService {
  private static instance: UpdateService;
  private cachedManifest: VersionManifest | null = null;

  private constructor() {}

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  public getCurrentVersion(): string {
    return CURRENT_APP_VERSION;
  }

  public async checkForUpdates(): Promise<UpdateCheckResult> {
    let isOtaAvailable = false;
    let isNewVersionAvailable = false;
    let latestVersion = CURRENT_APP_VERSION;
    let changelog: string[] = [];
    let apkDownloadUrl = 'https://www.mediafire.com';
    let releaseDate = '';

    // 1. Check Expo Updates Native OTA (if running on a standalone native build)
    try {
      if (!__DEV__ && Platform.OS !== 'web') {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          isOtaAvailable = true;
          isNewVersionAvailable = true;
        }
      }
    } catch (e) {
      // In development or web, Updates.checkForUpdateAsync may throw or not be supported
      console.log('Native OTA check info:', e);
    }

    // 2. Check Remote GitHub version manifest
    try {
      const response = await fetch(REMOTE_VERSION_URL + `?t=${Date.now()}`);
      if (response.ok) {
        const manifest: VersionManifest = await response.json();
        this.cachedManifest = manifest;
        latestVersion = manifest.version;
        changelog = manifest.changelog || [];
        apkDownloadUrl = manifest.apkDownloadUrl || apkDownloadUrl;
        releaseDate = manifest.releaseDate || '';

        if (this.compareVersions(manifest.version, CURRENT_APP_VERSION) > 0) {
          isNewVersionAvailable = true;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch remote version manifest:', err);
    }

    return {
      isUpdateAvailable: isNewVersionAvailable || isOtaAvailable,
      isOtaAvailable,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion,
      changelog,
      apkDownloadUrl,
      releaseDate,
    };
  }

  public async downloadAndApplyOtaUpdate(
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    try {
      if (Platform.OS === 'web') return false;

      if (onProgress) onProgress(20);

      // Fetch the OTA update bundle
      const fetchResult = await Updates.fetchUpdateAsync();
      if (onProgress) onProgress(80);

      if (fetchResult.isNew) {
        if (onProgress) onProgress(100);
        // Reload app into the new update bundle seamlessly
        await Updates.reloadAsync();
        return true;
      }
      return false;
    } catch (error) {
      console.warn('OTA update download failed:', error);
      return false;
    }
  }

  public async openDownloadLink(url?: string): Promise<void> {
    const targetUrl = url || this.cachedManifest?.apkDownloadUrl || 'https://www.mediafire.com';
    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      }
    } catch (e) {
      console.warn('Cannot open download URL:', e);
    }
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
    const parts2 = v2.split('.').map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
}

export const updateService = UpdateService.getInstance();
