import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  constructor(
    public premiumService: PremiumService,
    public admobService: AdmobService
  ) {}

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
}

