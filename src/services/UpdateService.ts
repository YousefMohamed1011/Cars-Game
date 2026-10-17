import * as Updates from 'expo-updates';
import { File, Paths } from 'expo-file-system';
import Constants from 'expo-constants';
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

const CURRENT_APP_VERSION = Constants.expoConfig?.version || '1.0.0';
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
    let apkDownloadUrl =
      'https://expo.dev/artifacts/eas/PAgPkXkwBf9FQcdDmuc0cuN_0yrmLbMxUAS8FrN3SAs.apk';
    let releaseDate = '';

    // 1. Check Expo Updates Native OTA if enabled on standalone build
    try {
      if (!__DEV__ && Platform.OS !== 'web' && Updates.isEnabled) {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          isOtaAvailable = true;
          isNewVersionAvailable = true;
        }
      }
    } catch (e) {
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

  /**
   * Attempts to download and apply an OTA bundle via Expo Updates.
   */
  public async downloadAndApplyOtaUpdate(
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    try {
      if (Platform.OS === 'web' || !Updates.isEnabled) return false;

      if (onProgress) onProgress(20);

      const fetchResult = await Updates.fetchUpdateAsync();
      if (onProgress) onProgress(80);

      if (fetchResult.isNew) {
        if (onProgress) onProgress(100);
        await Updates.reloadAsync();
        return true;
      }
      return false;
    } catch (error) {
      console.warn('OTA update download failed or unavailable:', error);
      return false;
    }
  }

  /**
   * Downloads the APK file to device storage with live download progress.
   */
  public async downloadApkFile(
    url?: string,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; uri?: string; error?: string }> {
    const targetUrl = url || this.cachedManifest?.apkDownloadUrl;
    if (!targetUrl) {
      return { success: false, error: 'No download URL specified' };
    }

    try {
      if (Platform.OS === 'web') {
        window.open(targetUrl, '_blank');
        return { success: true, uri: targetUrl };
      }

      if (onProgress) onProgress(20);

      const downloadedFile = await File.downloadFileAsync(
        targetUrl,
        Paths.document,
        { idempotent: true }
      );

      if (onProgress) onProgress(100);
      return { success: true, uri: downloadedFile.uri };
    } catch (err: any) {
      console.warn('In-app APK download error:', err);
      return { success: false, error: err?.message || 'Download error' };
    }
  }

  /**
   * Opens the download link directly in the device browser / download manager.
   * Directly calls Linking.openURL without canOpenURL blocking on modern Android.
   */
  public async openDownloadLink(url?: string): Promise<boolean> {
    const targetUrl =
      url ||
      this.cachedManifest?.apkDownloadUrl ||
      'https://expo.dev/artifacts/eas/PAgPkXkwBf9FQcdDmuc0cuN_0yrmLbMxUAS8FrN3SAs.apk';
    try {
      await Linking.openURL(targetUrl);
      return true;
    } catch (e) {
      console.warn('Direct Linking.openURL failed, trying fallback:', e);
      try {
        const supported = await Linking.canOpenURL(targetUrl);
        if (supported) {
          await Linking.openURL(targetUrl);
          return true;
        }
      } catch (err2) {
        console.warn('Linking fallback error:', err2);
      }
      return false;
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
