import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'discipline_theme';
  
  theme$ = new BehaviorSubject<ThemeMode>('system');
  isDark$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initTheme();
  }

  private initTheme() {
    const saved = (localStorage.getItem(this.STORAGE_KEY) as ThemeMode) || 'system';
    this.setTheme(saved);

    // Listen for OS system theme changes if set to system
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (this.theme$.value === 'system') {
          this.applyTheme(e.matches);
        }
      });
    }
  }

  setTheme(theme: ThemeMode) {
    this.theme$.next(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);

    let isDark = false;
    if (theme === 'dark') {
      isDark = true;
    } else if (theme === 'light') {
      isDark = false;
    } else if (theme === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    this.applyTheme(isDark);
  }

  toggleTheme() {
    const nextTheme: ThemeMode = this.isDark$.value ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  private applyTheme(isDark: boolean) {
    this.isDark$.next(isDark);
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }
}
