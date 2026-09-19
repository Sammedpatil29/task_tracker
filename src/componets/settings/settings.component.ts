import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { ModalService } from '../../services/modal.service';
import { HydrationService, HydrationSettings } from '../../services/hydration.service';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, LoaderComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  // Profile state
  userName: string = '';
  userEmail: string = '';
  userEmoji: string = '🌱';
  
  isLoading: boolean = true;
  isSaving: boolean = false;

  availableEmojis: string[] = [
    '🌱', '🔥', '🚀', '💪', '⚡', '🎯', '👑', '🧠', '✨', '🏆',
    '😀', '😎', '🤓', '😇', '🤠', '🦁', '🐺', '🦊', '🦅', '💎'
  ];

  // Theme state
  themeOptions: { label: string; value: ThemeMode; icon: string; desc: string }[] = [
    { label: 'Light Mode', value: 'light', icon: '☀️', desc: 'Clean, bright interface' },
    { label: 'Dark Mode', value: 'dark', icon: '🌙', desc: 'Sleek obsidian night theme' },
    { label: 'System Default', value: 'system', icon: '💻', desc: 'Syncs with your OS theme' }
  ];

  // Hydration state
  hydrationEnabled: boolean = true;
  hydrationSoundEnabled: boolean = true;
  hydrationIntervalMinutes: number = 30;

  intervalOptions = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1 hour', value: 60 },
    { label: '1.5 hrs', value: 90 },
    { label: '2 hours', value: 120 }
  ];

  constructor(
    private tracker: TaskTrackerService,
    private modalService: ModalService,
    private router: Router,
    public hydrationService: HydrationService,
    public themeService: ThemeService
  ) {}

  async logout() {
    const confirmed = await this.modalService.confirm(
      'Sign Out 🚪',
      'Are you sure you want to log out of your Discipline Tracker session?',
      'Logout',
      true
    );

    if (confirmed) {
      sessionStorage.removeItem('trackJwt');
      this.router.navigate(['/login']);
    }
  }

  selectTheme(theme: ThemeMode) {
    this.themeService.setTheme(theme);
  }

  ngOnInit() {
    this.loadProfile();
    this.loadHydrationSettings();
  }

  loadProfile() {
    this.isLoading = true;
    this.tracker.getDashboard().subscribe({
      next: (res: any) => {
        if (res?.user) {
          this.userName = res.user.name || '';
          this.userEmail = res.user.email || '';
          this.userEmoji = res.user.emoji || '🌱';

          if (res.user.hydrationEnabled !== undefined) {
            this.hydrationEnabled = res.user.hydrationEnabled;
          }
          if (res.user.hydrationSoundEnabled !== undefined) {
            this.hydrationSoundEnabled = res.user.hydrationSoundEnabled;
          }
          if (res.user.hydrationIntervalMinutes !== undefined) {
            this.hydrationIntervalMinutes = res.user.hydrationIntervalMinutes;
          }

          this.hydrationService.syncWithAccount({
            enabled: this.hydrationEnabled,
            soundEnabled: this.hydrationSoundEnabled,
            intervalMinutes: this.hydrationIntervalMinutes
          });
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load profile:', err);
        this.isLoading = false;
      }
    });
  }

  loadHydrationSettings() {
    const s = this.hydrationService.loadSettings();
    this.hydrationEnabled = s.enabled;
    this.hydrationSoundEnabled = s.soundEnabled;
    this.hydrationIntervalMinutes = s.intervalMinutes;
  }

  selectEmoji(emoji: string) {
    this.userEmoji = emoji;
  }

  setInterval(val: number) {
    this.hydrationIntervalMinutes = val;
  }

  testChime() {
    this.hydrationService.playWaterAlert();
  }

  saveProfile() {
    if (!this.userName || !this.userName.trim()) {
      this.modalService.alert('Invalid Name', 'Please enter a valid full name.');
      return;
    }

    this.isSaving = true;
    const updateData = {
      name: this.userName.trim(),
      emoji: this.userEmoji
    };

    this.tracker.updateProfile(updateData).subscribe({
      next: () => {
        this.isSaving = false;
        this.modalService.alert(
          'Profile Updated! ✅',
          'Your profile name and avatar emoji have been saved successfully.'
        );
      },
      error: (err) => {
        console.error('Failed to update profile:', err);
        this.isSaving = false;
        this.modalService.alert(
          'Update Failed',
          err?.error?.error || 'Failed to update profile. Please verify your backend server connection.'
        );
      }
    });
  }

  saveHydrationSettings() {
    const settings: HydrationSettings = {
      enabled: this.hydrationEnabled,
      soundEnabled: this.hydrationSoundEnabled,
      intervalMinutes: this.hydrationIntervalMinutes
    };

    // Save locally
    this.hydrationService.saveSettings(settings);

    // Save to user account in database
    this.tracker.updateHydrationSettings(settings).subscribe({
      next: () => {
        this.modalService.alert(
          'Hydration Preferences Saved! 💧',
          `Preferences saved to your account! Reminders will trigger every ${this.hydrationIntervalMinutes} minutes with sound alert ${this.hydrationSoundEnabled ? 'enabled 🔊' : 'muted 🔇'}.`
        );
      },
      error: (err) => {
        console.warn('Hydration sync warning:', err);
        this.modalService.alert(
          'Saved Locally 💧',
          `Preferences saved locally in your browser. Reminders will trigger every ${this.hydrationIntervalMinutes} minutes.`
        );
      }
    });
  }
}
