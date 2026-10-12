import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { PremiumService } from '../../services/premium.service';
import { AdmobService } from '../../services/admob.service';

@Component({
  selector: 'app-premium-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './premium-modal.component.html',
  styleUrl: './premium-modal.component.css'
})
export class PremiumModalComponent {
  isShaking = false;
  isCheckingAccess = false;
  subscribeMessage = '';
  readonly playStoreUrl = 'https://play.google.com/store/apps/details?id=com.discipline.tasktracker';

  constructor(
    public premiumService: PremiumService,
    public admobService: AdmobService
  ) {}

  get isMobile(): boolean {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();
      return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
    }
    return false;
  }

  /**
   * Block outside click and gently shake card to indicate it is unclosable
   */
  onBackdropClick(): void {
    if (!this.premiumService.isAdPlaying$.value && !this.premiumService.rewardGrantedAlert$.value) {
      this.isShaking = true;
      setTimeout(() => {
        this.isShaking = false;
      }, 400);
    }
  }

  watchAd(): void {
    this.premiumService.watchAdAndUnlock();
  }

  onSubscribe(): void {
    this.subscribeMessage = 'Subscription plans coming soon! For now, unlock free access by viewing an ad on the mobile app.';
  }

  async checkAccess(): Promise<void> {
    if (this.isCheckingAccess) return;
    this.isCheckingAccess = true;
    this.subscribeMessage = '';
    try {
      await this.premiumService.syncWithBackend();
      if (!this.premiumService.isPremium$.value) {
        this.subscribeMessage = 'No active pass detected yet. Please watch an ad on mobile first.';
        setTimeout(() => {
          if (this.subscribeMessage.startsWith('No active')) {
            this.subscribeMessage = '';
          }
        }, 5000);
      }
    } catch {
      this.subscribeMessage = 'Unable to check status. Please check your internet connection.';
    } finally {
      this.isCheckingAccess = false;
    }
  }
}

