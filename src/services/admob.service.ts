import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import { BehaviorSubject } from 'rxjs';

export interface AdRewardResult {
  success: boolean;
  rewarded: boolean;
  type?: string;
  amount?: number;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdmobService {
  // Official Google AdMob Test Rewarded Ad Unit ID for Android
  // Source: https://developers.google.com/admob/android/test-ads
  public readonly GOOGLE_TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

  private isInitialized = false;
  private isAdLoadingSubject = new BehaviorSubject<boolean>(false);
  public isAdLoading$ = this.isAdLoadingSubject.asObservable();

  constructor() {
    if (Capacitor.isNativePlatform()) {
      this.initNativeAdMob().catch((err) => {
        console.warn('⚠️ [AdMob] Initial setup deferred:', err);
      });
    }
  }

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Initialize native Google Mobile Ads SDK
   */
  public async initNativeAdMob(): Promise<void> {
    if (!this.isNative() || this.isInitialized) return;

    try {
      await AdMob.initialize({
        initializeForTesting: true
      });
      this.isInitialized = true;
      console.log('✅ [AdMob] Native Google Mobile Ads initialized for testing.');

      // Setup listeners for reward events
      AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
        console.log('🎁 [AdMob] Reward granted event:', reward);
      });
    } catch (error) {
      console.warn('⚠️ [AdMob] Native initialization notice:', error);
    }
  }

  /**
   * Show Rewarded Ad.
   * On Native Android: prepares and presents Google AdMob Rewarded Video.
   * On Web/Desktop or fallback: returns fallback flag so interactive simulated player takes over.
   */
  public async showRewardedAd(): Promise<AdRewardResult> {
    if (!this.isNative()) {
      console.log('ℹ️ [AdMob] Web environment detected - interactive simulation available.');
      return {
        success: true,
        rewarded: true,
        type: 'web_simulation',
        amount: 1,
        message: 'Web simulated ad completed'
      };
    }

    this.isAdLoadingSubject.next(true);

    try {
      if (!this.isInitialized) {
        await this.initNativeAdMob();
      }

      console.log('🎯 [AdMob] Preparing native rewarded ad:', this.GOOGLE_TEST_REWARDED_ID);
      await AdMob.prepareRewardVideoAd({
        adId: this.GOOGLE_TEST_REWARDED_ID,
        isTesting: true
      });

      const rewardItem = await AdMob.showRewardVideoAd();
      console.log('🎁 [AdMob] User successfully completed reward ad:', rewardItem);

      this.isAdLoadingSubject.next(false);
      return {
        success: true,
        rewarded: true,
        type: rewardItem?.type || 'DailyAccess',
        amount: rewardItem?.amount || 1
      };
    } catch (error: any) {
      console.error('❌ [AdMob] Native reward ad failed or dismissed:', error);
      this.isAdLoadingSubject.next(false);

      // Graceful fallback for test devices without Google Play Services or network issues
      return {
        success: false,
        rewarded: false,
        message: error?.message || 'Failed to display native ad'
      };
    }
  }
}

