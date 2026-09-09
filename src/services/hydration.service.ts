import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface HydrationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  intervalMinutes: number;
}

@Injectable({ providedIn: 'root' })
export class HydrationService {
  private readonly STORAGE_KEY = 'discipline_hydration_settings';

  private defaultSettings: HydrationSettings = {
    enabled: true,
    soundEnabled: true,
    intervalMinutes: 30
  };

  settings: HydrationSettings = { ...this.defaultSettings };
  
  showReminder$ = new BehaviorSubject<boolean>(false);
  private timer: any = null;

  constructor() {
    this.loadSettings();
    this.startReminderTimer();
  }

  loadSettings(): HydrationSettings {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.settings = { ...this.defaultSettings, ...JSON.parse(saved) };
      } catch {
        this.settings = { ...this.defaultSettings };
      }
    }
    return this.settings;
  }

  saveSettings(settings: HydrationSettings) {
    this.settings = { ...settings };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    this.startReminderTimer();
  }

  syncWithAccount(accountSettings: Partial<HydrationSettings>) {
    if (accountSettings) {
      if (typeof accountSettings.enabled === 'boolean') this.settings.enabled = accountSettings.enabled;
      if (typeof accountSettings.soundEnabled === 'boolean') this.settings.soundEnabled = accountSettings.soundEnabled;
      if (typeof accountSettings.intervalMinutes === 'number' && accountSettings.intervalMinutes > 0) {
        this.settings.intervalMinutes = accountSettings.intervalMinutes;
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
      this.startReminderTimer();
    }
  }

  startReminderTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (!this.settings.enabled) {
      return;
    }

    const intervalMs = Math.max(1, this.settings.intervalMinutes) * 60 * 1000;
    this.timer = setInterval(() => {
      this.triggerReminder();
    }, intervalMs);
  }

  triggerReminder() {
    this.showReminder$.next(true);

    if (this.settings.soundEnabled) {
      this.playWaterAlert();
    }

    setTimeout(() => {
      this.showReminder$.next(false);
    }, 8000);
  }

  dismissReminder() {
    this.showReminder$.next(false);
  }

  playWaterAlert() {
    this.playWaterChime();
    this.speakReminder();
  }

  playWaterChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      
      // Chime note 1 (Water drop bell tone)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);

      // Chime note 2 (Harmonious water bell)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12); // D6
      gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.55);

    } catch (e) {
      console.warn('Audio chime playback error:', e);
    }
  }

  speakReminder() {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop any previous speech
        const utterance = new SpeechSynthesisUtterance('Take a moment and have some water');
        utterance.rate = 0.92; // Calm, clear pacing
        utterance.pitch = 1.05; // Friendly, warm tone
        
        // Pick an English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('David')));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        // Slight delay so the water chime plays first
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 200);
      }
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}

