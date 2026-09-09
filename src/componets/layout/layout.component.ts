import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { ModalService } from '../../services/modal.service';
import { ModalComponent } from '../modal/modal.component';
import { HydrationService } from '../../services/hydration.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterModule, ModalComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {
  userName: string = 'User';
  userEmoji: string = '🌱';
  year: number = new Date().getFullYear();

  navItems = [
    { label: 'Discipline Tracker', path: '/home', icon: '📈' },
    { label: 'Analytics & Insights', path: '/analytics', icon: '📊' },
    { label: 'Settings & Profile', path: '/settings', icon: '⚙️' }
  ];

  constructor(
    private router: Router,
    private tracker: TaskTrackerService,
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
  }

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
          sessionStorage.removeItem('trackJwt');
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
      sessionStorage.removeItem('trackJwt');
      this.router.navigate(['/login']);
    }
  }
}
