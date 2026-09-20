import { Injectable, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { OtaKit } from '@otakit/capacitor-updater';
import { BehaviorSubject, Observable } from 'rxjs';
import { ModalService } from './modal.service';

/** Key used to flag that an OTA update was just applied (survives reload) */
const OTA_UPDATED_KEY = 'discipline_tracker_ota_just_updated';

@Injectable({
  providedIn: 'root'
})
export class OtaService {
  private isDownloadingSubject = new BehaviorSubject<boolean>(false);
  public readonly isDownloading$: Observable<boolean> = this.isDownloadingSubject.asObservable();

  private downloadProgressSubject = new BehaviorSubject<number>(0);
  public readonly downloadProgress$: Observable<number> = this.downloadProgressSubject.asObservable();

  private progressInterval: any = null;

  constructor(
    private modalService: ModalService,
    private ngZone: NgZone
  ) {}

  /**
   * Initializes OtaKit on native device.
   * Flow: download silently → apply and restart immediately → notify user after reload.
   */
  async initialize() {
    if (!Capacitor.isNativePlatform()) {
      console.log('ℹ️ [OtaKit] Running in browser, skipping native OTA checks.');
      return;
    }

    try {
      await OtaKit.notifyAppReady();
      console.log('✅ [OtaKit] notifyAppReady sent');
    } catch (e) {
      console.warn('[OtaKit] notifyAppReady warning:', e);
    }

    // Show "App updated" modal/alert if we just came back from an OTA apply
    this.showPostUpdateNotification();

    // Start silent background OTA check & auto-apply
    this.setupOtaUpdates();
  }

  private async setupOtaUpdates() {
    try {
      // Listen for background download completion
      await OtaKit.addListener('updateStaged', async (event: any) => {
        console.log('📦 [OtaKit] Event updateStaged received:', event);
        await this.completeDownloadAndRestart(event.bundle?.version || '');
      });

      // Listen for updateAvailable event from background policy
      await OtaKit.addListener('updateAvailable', async (latest: any) => {
        console.log('🚀 [OtaKit] Event updateAvailable received:', latest);
        await this.startDownloadAndRestart(latest?.version);
      });

      // Listen for failure to reset progress cleanly
      await OtaKit.addListener('downloadFailed', (event: any) => {
        console.warn('❌ [OtaKit] Event downloadFailed received:', event);
        this.resetDownloadState();
      });

      // Check if an update was already staged from a previous session
      const state = await OtaKit.getState();
      console.log('📊 [OtaKit] Current state:', JSON.stringify(state));
      if (state.staged) {
        console.log('📌 [OtaKit] Staged update waiting:', state.staged?.version);
        await this.completeDownloadAndRestart(state.staged?.version || '');
        return;
      }

      // Perform background check & download
      console.log('🔎 [OtaKit] Checking for updates on CDN...');
      const check = await OtaKit.check();
      console.log('🔎 [OtaKit] Check result:', JSON.stringify(check));

      if (check.kind === 'update_available') {
        console.log('🚀 [OtaKit] New update available:', check.latest?.version);
        await this.startDownloadAndRestart(check.latest?.version);
      } else if (check.kind === 'already_staged') {
        console.log('📌 [OtaKit] Update already staged:', check.latest?.version);
        await this.completeDownloadAndRestart(check.latest?.version || '');
      } else {
        console.log('✅ [OtaKit] App is up to date.');
      }
    } catch (err) {
      console.warn('❌ [OtaKit] Update check error:', err);
      this.resetDownloadState();
    }
  }

  /**
   * Starts downloading OTA bundle and automatically restarts/applies the app once download completes.
   */
  async startDownloadAndRestart(version?: string): Promise<{ success: boolean; message: string }> {
    if (!Capacitor.isNativePlatform()) {
      console.log('ℹ️ [OtaKit] Skipping download on non-native platform.');
      return { success: false, message: 'OTA updates require physical device.' };
    }

    if (this.isDownloadingSubject.value) {
      console.log('⏳ [OtaKit] Download already in progress...');
      return { success: true, message: 'Download already in progress...' };
    }

    this.startProgressSimulation();

    try {
      console.log('📥 [OtaKit] Calling OtaKit.download()...');
      const downloadRes = await OtaKit.download();
      console.log('📥 [OtaKit] Download result:', JSON.stringify(downloadRes));

      if (downloadRes.kind === 'staged' || (downloadRes as any).kind === 'already_staged') {
        const targetVer = (downloadRes as any).bundle?.version || version || '';
        await this.completeDownloadAndRestart(targetVer);
        return { success: true, message: 'Update downloaded! Restarting app...' };
      } else {
        this.resetDownloadState();
        return { success: false, message: `Download returned status: ${downloadRes.kind}` };
      }
    } catch (err: any) {
      this.resetDownloadState();
      console.error('❌ [OtaKit] Error downloading OTA bundle:', err);
      return { success: false, message: err?.message || 'Download failed' };
    }
  }

  private startProgressSimulation() {
    this.clearIntervalIfActive();
    this.ngZone.run(() => {
      this.isDownloadingSubject.next(true);
      this.downloadProgressSubject.next(10);
    });

    let current = 10;
    this.progressInterval = setInterval(() => {
      if (current < 92) {
        const step = Math.max(1, Math.floor((92 - current) / 6));
        current += step;
        this.ngZone.run(() => {
          this.downloadProgressSubject.next(current);
        });
      }
    }, 180);
  }

  private async completeDownloadAndRestart(version: string) {
    this.clearIntervalIfActive();
    this.ngZone.run(() => {
      this.isDownloadingSubject.next(true);
      this.downloadProgressSubject.next(100);
    });

    if (version) {
      localStorage.setItem(OTA_UPDATED_KEY, version);
    }

    // Brief delay to allow visually reaching 100%
    await new Promise(resolve => setTimeout(resolve, 600));

    try {
      console.log(`🔄 [OtaKit] Restarting app to apply update v${version}...`);
      await OtaKit.apply(); // Triggers reload/restart of the app with new bundle
    } catch (e) {
      console.error('❌ [OtaKit] Failed to restart and apply update:', e);
      this.resetDownloadState();
    }
  }

  private resetDownloadState() {
    this.clearIntervalIfActive();
    this.ngZone.run(() => {
      this.isDownloadingSubject.next(false);
      this.downloadProgressSubject.next(0);
    });
  }

  private clearIntervalIfActive() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private async showPostUpdateNotification() {
    const version = localStorage.getItem(OTA_UPDATED_KEY);
    if (!version) return;

    localStorage.removeItem(OTA_UPDATED_KEY);

    try {
      await this.modalService.alert(
        'App Updated! 🎉',
        `Discipline Tracker has been updated to version ${version} with the latest features and performance enhancements.`
      );
    } catch (e) {
      console.log('Post-update alert dismissed or closed');
    }
  }

  /**
   * Manually check for an update (e.g. from Settings screen)
   */
  async checkForUpdate(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      await this.modalService.alert('Web Version', 'You are using the web version, which is always up to date.');
      return;
    }

    try {
      const check = await OtaKit.check();
      if (check.kind === 'update_available') {
        const confirmed = await this.modalService.confirm(
          'Update Available 🚀',
          `A new version (${check.latest?.version}) is available. Would you like to download and update now?`,
          'Update Now'
        );
        if (confirmed) {
          await this.startDownloadAndRestart(check.latest?.version);
        }
      } else {
        await this.modalService.alert('Up to Date ✅', 'You are already running the latest version of Discipline Tracker.');
      }
    } catch (err: any) {
      await this.modalService.alert('Check Failed', 'Could not reach the update server. Please check your internet connection.');
    }
  }
}

