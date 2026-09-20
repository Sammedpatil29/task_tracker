import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { ModalService } from '../../services/modal.service';
import { ModalComponent } from '../modal/modal.component';
import { HydrationService } from '../../services/hydration.service';
import { ThemeService } from '../../services/theme.service';

export interface TrackOption {
  id: string;
  title: string;
  badge: string;
  icon: string;
  color: string;
  description: string;
  path: string;
  actionText: string;
}

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterModule, ModalComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit, OnDestroy {
  userName: string = 'User';
  userEmoji: string = '🌱';
  year: number = new Date().getFullYear();

  // 3-Method Tracking Prompt Popup
  showTrackPrompt: boolean = false;
  private lastActiveUpdate: number = 0;

  trackOptions: TrackOption[] = [
    {
      id: 'discipline',
      title: 'Habits & Discipline',
      badge: 'Daily Consistency',
      icon: '📈',
      color: '#10b981',
      description: 'Check off daily habits, maintain unbroken streaks, and review your consistency matrix.',
      path: '/home',
      actionText: 'Track Habits'
    },
    {
      id: 'productivity',
      title: 'Productivity & Time',
      badge: '24h Allocation',
      icon: '⏱️',
      color: '#3b82f6',
      description: 'Log time intervals, track work vs recovery, and compare actual hours against 24h goals.',
      path: '/productivity',
      actionText: 'Track Time'
    },
    {
      id: 'diet',
      title: 'Diet & Nutrition',
      badge: 'Calories & Macros',
      icon: '🥗',
      color: '#f59e0b',
      description: 'Log meals, monitor daily calorie targets, track macronutrients, and log hydration.',
      path: '/diet',
      actionText: 'Track Nutrition'
    }
  ];

  navItems = [
    { label: 'Analytics & Insights', path: '/analytics', icon: '📊' },
    { label: 'Productivity Tracker', path: '/productivity', icon: '⏱️' },
    { label: 'Diet Tracker', path: '/diet', icon: '🥗' },
    { label: 'Discipline Tracker', path: '/home', icon: '📈' },
    { label: 'Settings & Profile', path: '/settings', icon: '⚙️' }
  ];

  constructor(
    private router: Router,
    public tracker: TaskTrackerService,
    private modalService: ModalService,
    public hydrationService: HydrationService,
    public themeService: ThemeService
  ) {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  ngOnInit() {
    const token = sessionStorage.getItem('trackJwt');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadUserData();
    this.tracker.loadTodayWater();

    // Check if we should prompt on initial app load / login
    this.checkPromptTrigger();

    // Attach listeners for tab reactivation after 1hr or away time
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      window.addEventListener('focus', this.onWindowFocus);
      window.addEventListener('click', this.onUserActivity, { passive: true });
      window.addEventListener('keydown', this.onKeydown);
    }
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      window.removeEventListener('focus', this.onWindowFocus);
      window.removeEventListener('click', this.onUserActivity);
      window.removeEventListener('keydown', this.onKeydown);
    }
  }

  checkPromptTrigger() {
    const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true';
    const sessionPromptShown = sessionStorage.getItem('sessionTrackPromptShown') === 'true';
    const lastPromptTime = Number(localStorage.getItem('lastTrackPromptTime') || '0');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Trigger if just logged in, or fresh session, or > 1 hour since last prompt
    if (justLoggedIn || !sessionPromptShown || (now - lastPromptTime >= oneHour)) {
      sessionStorage.removeItem('justLoggedIn');
      sessionStorage.setItem('sessionTrackPromptShown', 'true');
      this.openTrackPrompt();
    }
  }

  openTrackPrompt() {
    const now = Date.now();
    localStorage.setItem('lastTrackPromptTime', now.toString());
    localStorage.setItem('lastUserActiveTime', now.toString());
    this.showTrackPrompt = true;
  }

  closeTrackPrompt() {
    this.showTrackPrompt = false;
    const now = Date.now();
    localStorage.setItem('lastTrackPromptTime', now.toString());
    localStorage.setItem('lastUserActiveTime', now.toString());
  }

  selectTrackOption(path: string) {
    this.closeTrackPrompt();
    this.router.navigate([path]);
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const lastActive = Number(localStorage.getItem('lastUserActiveTime') || '0');
      const lastPrompt = Number(localStorage.getItem('lastTrackPromptTime') || '0');
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      // Re-prompt if tab was left backgrounded/inactive for >= 1 hr or >= 1 hr since last prompt
      if ((lastActive > 0 && now - lastActive >= oneHour) || (lastPrompt > 0 && now - lastPrompt >= oneHour)) {
        this.openTrackPrompt();
      } else {
        localStorage.setItem('lastUserActiveTime', now.toString());
      }
    } else {
      localStorage.setItem('lastUserActiveTime', Date.now().toString());
    }
  };

  private onWindowFocus = () => {
    if (document.visibilityState === 'visible') {
      this.onVisibilityChange();
    }
  };

  private onUserActivity = () => {
    const now = Date.now();
    if (now - this.lastActiveUpdate > 60000) {
      this.lastActiveUpdate = now;
      localStorage.setItem('lastUserActiveTime', now.toString());
    }
  };

  private onKeydown = (e: KeyboardEvent) => {
    this.onUserActivity();
    if (e.key === 'Escape' && this.showTrackPrompt) {
      this.closeTrackPrompt();
    }
  };

  loadUserData() {
    this.tracker.getDashboard().subscribe({
      next: (res: any) => {
        if (res?.user) {
          this.userName = res.user.name || 'User';
          this.userEmoji = res.user.emoji || '🌱';
          this.hydrationService.syncWithAccount({
            enabled: res.user.hydrationEnabled,
            soundEnabled: res.user.hydrationSoundEnabled,
            intervalMinutes: res.user.hydrationIntervalMinutes
          });
        }
      },
      error: (err) => {
        if (err.status === 401) {
          this.tracker.removeToken();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  async logout() {
    const confirmed = await this.modalService.confirm(
      'Sign Out 🚪',
      'Are you sure you want to log out of your Discipline Tracker session?',
      'Logout',
      true
    );

    if (confirmed) {
      this.tracker.removeToken();
      this.router.navigate(['/login']);
    }
  }
}
