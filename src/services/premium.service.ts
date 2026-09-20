import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { TaskTrackerService } from './task-tracker.service';
import { AdmobService } from './admob.service';

export interface PremiumState {
  isPremium: boolean;
  premiumUntil: number | null;
  remainingHours: number;
  remainingMinutes: number;
  remainingFormatted: string;
}

@Injectable({
  providedIn: 'root'
})
export class PremiumService {
  private readonly STORAGE_KEY = 'discipline_premium_until';
  private readonly STORAGE_LAST_AD_KEY = 'discipline_last_ad_watched';
  private readonly ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Reactive state
  public isPremium$ = new BehaviorSubject<boolean>(false);
  public premiumUntil$ = new BehaviorSubject<number | null>(null);
  public remainingHours$ = new BehaviorSubject<number>(0);
  public remainingMinutes$ = new BehaviorSubject<number>(0);
  public remainingFormatted$ = new BehaviorSubject<string>('Expired');

  // Modal & Video simulation state
  public isAdModalOpen$ = new BehaviorSubject<boolean>(false);
  public isAdPlaying$ = new BehaviorSubject<boolean>(false);
  public adCountdown$ = new BehaviorSubject<number>(10);
  public isClaimingReward$ = new BehaviorSubject<boolean>(false);
  public rewardGrantedAlert$ = new BehaviorSubject<boolean>(false);

  private checkTimer: any = null;
  private countdownInterval: any = null;

  constructor(
    private http: HttpClient,
    private trackerService: TaskTrackerService,
    private admobService: AdmobService,
    private ngZone: NgZone
  ) {
    this.initFromLocalStorage();

    // Start periodic 1-minute ticker
    this.checkTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.evaluateStatus();
      });
    }, 60000);

    // Initial sync with backend if user is already authenticated
    setTimeout(() => {
      if (this.trackerService.isTokenValid()) {
        this.syncWithBackend().catch(() => {});
      }
    }, 800);
  }

  /**
   * Load stored expiry from localStorage and evaluate initial status
   */
  private initFromLocalStorage(): void {
    const rawExpiry = localStorage.getItem(this.STORAGE_KEY);
    let expiryMs: number | null = null;
    if (rawExpiry) {
      const parsed = parseInt(rawExpiry, 10);
      if (!isNaN(parsed) && parsed > 0) {
        expiryMs = parsed;
      }
    }

    this.premiumUntil$.next(expiryMs);
    this.evaluateStatus();
  }

  /**
   * Recompute current premium state from timestamp
   */
  public evaluateStatus(): boolean {
    const expiry = this.premiumUntil$.value;
    const now = Date.now();

    if (expiry && expiry > now) {
      const diffMs = expiry - now;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      this.isPremium$.next(true);
      this.remainingHours$.next(hours);
      this.remainingMinutes$.next(minutes);
      this.remainingFormatted$.next(`${hours}h ${minutes}m`);

      // If active, ensure the blocking dialog is closed
      if (this.isAdModalOpen$.value) {
        this.isAdModalOpen$.next(false);
      }
      return true;
    } else {
      this.isPremium$.next(false);
      this.remainingHours$.next(0);
      this.remainingMinutes$.next(0);
      this.remainingFormatted$.next('Expired');

      // If user is authenticated on the app and not premium, trigger unclosable modal
      if (this.trackerService.isTokenValid() && !this.isAdModalOpen$.value) {
        this.isAdModalOpen$.next(true);
      }
      return false;
    }
  }

  /**
   * Explicitly check status and enforce dialog if not unlocked
   */
  public enforceAccessCheck(): void {
    const isUnlocked = this.evaluateStatus();
    if (!isUnlocked && this.trackerService.isTokenValid()) {
      this.isAdModalOpen$.next(true);
    }
  }

  /**
   * Open the unclosable daily ad modal
   */
  public openAdModal(): void {
    this.isAdModalOpen$.next(true);
  }

  /**
   * Start the Rewarded Ad flow:
   * Native: Google AdMob Rewarded Video
   * Web: Interactive sponsor video countdown player
   */
  public async watchAdAndUnlock(): Promise<void> {
    if (this.isAdPlaying$.value || this.isClaimingReward$.value) return;

    if (this.admobService.isNative()) {
      // Native Android flow
      const result = await this.admobService.showRewardedAd();
      if (result.success && result.rewarded) {
        await this.grantReward();
      } else {
        // Native ad couldn't load or failed; fall back to interactive web simulation player
        this.startInteractiveAdSimulation();
      }
    } else {
      // Web browser flow: interactive countdown player
      this.startInteractiveAdSimulation();
    }
  }

  /**
   * Interactive sponsor video player simulation for Web/Desktop
   */
  private startInteractiveAdSimulation(): void {
    this.isAdPlaying$.next(true);
    this.adCountdown$.next(10);

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
      this.ngZone.run(async () => {
        const current = this.adCountdown$.value;
        if (current > 1) {
          this.adCountdown$.next(current - 1);
        } else {
          // Finished countdown
          clearInterval(this.countdownInterval);
          this.isAdPlaying$.next(false);
          await this.grantReward();
        }
      });
    }, 1000);
  }

  /**
   * Grant 24 hours of premium access, update local & remote storage
   */
  public async grantReward(): Promise<void> {
    this.isClaimingReward$.next(true);

    const now = Date.now();
    let baseTime = now;
    const currentExpiry = this.premiumUntil$.value;
    if (currentExpiry && currentExpiry > now) {
      baseTime = currentExpiry;
    }

    const newExpiry = baseTime + this.ONE_DAY_MS;

    // Save locally
    localStorage.setItem(this.STORAGE_KEY, newExpiry.toString());
    localStorage.setItem(this.STORAGE_LAST_AD_KEY, now.toString());
    this.premiumUntil$.next(newExpiry);
    this.evaluateStatus();

    // Sync with backend API
    try {
      if (this.trackerService.isTokenValid()) {
        const headers = this.trackerService.getAuthHeaders();
        const res: any = await firstValueFrom(
          this.http.post(`${environment.apiUrl}/user/claim-ad-reward`, {}, { headers })
        );
        if (res?.premiumUntil) {
          const remoteExpiry = new Date(res.premiumUntil).getTime();
          localStorage.setItem(this.STORAGE_KEY, remoteExpiry.toString());
          this.premiumUntil$.next(remoteExpiry);
          this.evaluateStatus();
        }
      }
    } catch (err) {
      console.warn('⚠️ [Premium] Remote reward sync deferred (using offline grant):', err);
    } finally {
      this.isClaimingReward$.next(false);
      this.rewardGrantedAlert$.next(true);

      // Dismiss the unclosable modal after a brief celebration
      setTimeout(() => {
        this.rewardGrantedAlert$.next(false);
        this.isAdModalOpen$.next(false);
      }, 1600);
    }
  }

  /**
   * Sync with backend API status
   */
  public async syncWithBackend(): Promise<void> {
    if (!this.trackerService.isTokenValid()) return;

    try {
      const headers = this.trackerService.getAuthHeaders();
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/user/premium-status`, { headers })
      );

      if (res?.success && res.premiumUntil) {
        const remoteExpiry = new Date(res.premiumUntil).getTime();
        const localExpiry = this.premiumUntil$.value || 0;

        // Keep the latest timestamp
        const finalExpiry = Math.max(localExpiry, remoteExpiry);
        localStorage.setItem(this.STORAGE_KEY, finalExpiry.toString());
        this.premiumUntil$.next(finalExpiry);
      }
      this.evaluateStatus();
    } catch (err) {
      console.warn('⚠️ [Premium] Status sync error:', err);
    }
  }
}

