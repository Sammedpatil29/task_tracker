import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { ModalService } from '../../services/modal.service';
import { HydrationService } from '../../services/hydration.service';
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-home',
  imports: [FormsModule, CommonModule, LoaderComponent, RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  @ViewChild('exportArea', { static: false }) exportArea!: ElementRef;

  fromDate = '';
  toDate = '';
  dates: string[] = [];
  isLoggedIn: boolean = false;
  isDataUpdating: boolean = false;
  isLoading: boolean = true;
  userName = '';
  year = new Date().getFullYear();
  userEmoji = '🙂';
  newTaskName = '';
  newTaskTarget = 3;
  todayStr = this.format(new Date());
  viewMode: 'day' | 'week' | 'month' = 'week';
  selectedDate = this.todayStr;
  showWaterReminder = false;

  heatmapDays: any[] = [];
  mockApiResponse: any;

  constructor(
    public tracker: TaskTrackerService,
    private router: Router,
    private modalService: ModalService,
    public hydrationService: HydrationService
  ) {}

  ngOnInit() {
    const token = sessionStorage.getItem('trackJwt');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    this.isLoggedIn = true;
    
    // Subscribe to configurable hydration service
    this.hydrationService.showReminder$.subscribe(show => {
      this.showWaterReminder = show;
    });

    this.initDates();
    this.getDashboard();
  }

  initDates() {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 15);

    this.fromDate = this.format(start);
    this.toDate = this.format(today);
    this.generateDates();
  }

  generateDates() {
    this.dates = [];
    const d = new Date(this.fromDate);
    const end = new Date(this.toDate);

    while (d <= end) {
      this.dates.push(this.format(d));
      d.setDate(d.getDate() + 1);
    }
  }

  format(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  toggle(task: any, date: string) {
    const currentlyCompleted = this.tracker.isCompleted(task.id, date);
    const completed = !currentlyCompleted;

    const data = {
      taskId: task.id,
      date: date,
      completed: completed
    };

    this.isDataUpdating = true;
    this.tracker.completions(data).subscribe({
      next: (res: any) => {
        this.tracker.toggle(task.id, date);
        this.setViewMode(this.viewMode);
        this.isDataUpdating = false;
      },
      error: (err) => {
        console.error('Error updating completion:', err);
        this.isDataUpdating = false;
        this.modalService.alert('Completion Error', err?.error?.error || 'Failed to update habit completion status.');
      }
    });
  }

  toggleTaskEnabled(task: any) {
    this.isDataUpdating = true;
    this.tracker.toggleTaskStatus(task.id).subscribe({
      next: (updatedTask: any) => {
        task.enabled = updatedTask.enabled;
        this.buildHeatmap();
        this.isDataUpdating = false;
      },
      error: (err) => {
        console.error('Failed to toggle task status:', err);
        task.enabled = !task.enabled; // revert UI checkbox
        this.isDataUpdating = false;
        this.modalService.alert('Status Error', err?.error?.error || 'Failed to update habit status.');
      }
    });
  }

  async deleteTask(task: any) {
    if (!task?.id) return;

    const confirmed = await this.modalService.confirm(
      'Delete Habit 🗑️',
      `Are you sure you want to delete "${task.name}"? All logged completions will be permanently removed.`,
      'Delete Habit',
      true
    );

    if (!confirmed) return;

    this.isDataUpdating = true;
    this.tracker.deleteTask(task.id).subscribe({
      next: () => {
        // Remove task from list
        this.tracker.tasks = this.tracker.tasks.filter(t => t.id !== task.id);
        
        // Remove related completions from store map
        this.dates.forEach(d => {
          this.tracker.store.delete(this.tracker.key(task.id, d));
        });

        this.buildHeatmap();
        this.isDataUpdating = false;
      },
      error: (err) => {
        console.error('Failed to delete task:', err);
        this.isDataUpdating = false;
        
        if (err.status === 404) {
          this.modalService.alert('Endpoint Not Found (404)', 'Delete route not found on backend. If running locally, please restart the server ("npm run dev" in task_tracker_backend).');
        } else {
          this.modalService.alert('Delete Failed', err?.error?.error || 'Failed to delete task. Please verify backend connection.');
        }
      }
    });
  }

  todayPercentage() {
    const today = this.format(new Date());
    const enabled = this.tracker.tasks.filter(t => t.enabled);
    if (enabled.length === 0) return 0;

    let done = 0;
    enabled.forEach(t => {
      if (this.tracker.isCompleted(t.id, today)) done++;
    });

    return Math.round((done / enabled.length) * 100);
  }

  weeklyPercentage() {
    const enabled = this.tracker.tasks.filter(t => t.enabled);
    if (enabled.length === 0) return 0;

    const today = new Date();
    let totalScore = 0;

    enabled.forEach(task => {
      let taskCompletions = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        if (this.tracker.isCompleted(task.id, this.format(d))) {
          taskCompletions++;
        }
      }

      // Calculate percentage against this habit's weekly target (capped at 100%)
      const target = Math.max(1, task.weeklyTarget || 1);
      const achievement = Math.min(100, Math.round((taskCompletions / target) * 100));
      totalScore += achievement;
    });

    return Math.round(totalScore / enabled.length);
  }

  monthlyPercentage() {
    const enabled = this.tracker.tasks.filter(t => t.enabled);
    if (enabled.length === 0) return 0;

    const today = new Date();
    let totalScore = 0;

    enabled.forEach(task => {
      let taskCompletions = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        if (this.tracker.isCompleted(task.id, this.format(d))) {
          taskCompletions++;
        }
      }

      // Expected target in 30 days based on weekly frequency
      const monthlyTarget = Math.max(1, Math.round((task.weeklyTarget || 1) * (30 / 7)));
      const achievement = Math.min(100, Math.round((taskCompletions / monthlyTarget) * 100));
      totalScore += achievement;
    });

    return Math.round(totalScore / enabled.length);
  }

  disciplineScore() {
    const enabled = this.tracker.tasks.filter(t => t.enabled);
    if (enabled.length === 0) return 0;

    return Math.round(
      this.todayPercentage() * 0.30 +
      this.weeklyPercentage() * 0.45 +
      this.monthlyPercentage() * 0.25
    );
  }

  strongestTask() {
    return this.taskConsistency(true);
  }

  weakestTask() {
    return this.taskConsistency(false);
  }

  taskConsistency(best: boolean) {
    const enabled = this.tracker.tasks.filter(t => t.enabled);
    if (enabled.length === 0 || this.dates.length === 0) return null;

    let result: string | null = null;
    let score = best ? -1 : 10000;

    enabled.forEach(task => {
      let done = 0;
      this.dates.forEach(d => {
        if (this.tracker.isCompleted(task.id, d)) done++;
      });

      // Target expected over the selected dates range
      const expected = Math.max(1, Math.round(this.dates.length * ((task.weeklyTarget || 1) / 7)));
      const pct = Math.round((done / expected) * 100);

      if (best) {
        if (pct > score) {
          score = pct;
          result = task.name;
        }
      } else {
        if (pct < score) {
          score = pct;
          result = task.name;
        }
      }
    });

    return result;
  }

  currentStreak() {
    const enabled = this.tracker.tasks.filter(t => t.enabled);
    if (enabled.length === 0) return 0;

    const today = new Date();
    const todayStr = this.format(today);

    // Check if Today is already fully completed
    const todayCompletedAll = enabled.every(t => this.tracker.isCompleted(t.id, todayStr));

    // Calculate unbroken streak starting from Yesterday backwards
    let pastStreak = 0;
    for (let i = 1; i <= 365; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dStr = this.format(d);

      const allCompleted = enabled.every(t => this.tracker.isCompleted(t.id, dStr));
      if (allCompleted) {
        pastStreak++;
      } else {
        break;
      }
    }

    // If today is completed, add +1 to streak; otherwise preserve past streak without resetting to 0
    return todayCompletedAll ? pastStreak + 1 : pastStreak;
  }

  onDateChange() {
    const from = new Date(this.fromDate);
    const to = new Date(this.toDate);

    const diff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);

    if (diff < 0 || diff > 14) {
      this.modalService.alert('Invalid Date Range', 'Please select a range of maximum 15 days.');
      return;
    }

    this.generateDates();
  }

  async addTaskPrompt() {
    const result = await this.modalService.openAddTask();
    if (!result || !result.name) return;

    this.isLoading = true;

    this.tracker.addTask(result).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.tracker.tasks.push(res);
        this.buildHeatmap();
      },
      error: (err) => {
        this.isLoading = false;
        console.error(err);
        this.modalService.alert('Add Habit Failed', err?.error?.error || 'Failed to create new habit. Please try again.');
      }
    });
  }

  exportCSV() {
    const rows: string[] = [];
    const header = ['Task', ...this.dates];
    rows.push(header.join(','));

    this.tracker.tasks.forEach(task => {
      const row = [task.name];
      this.dates.forEach(d => {
        const val = this.tracker.isCompleted(task.id, d) ? '1' : '0';
        row.push(val);
      });
      rows.push(row.join(','));
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `discipline_tracker_${this.todayStr}.csv`;
    a.click();

    window.URL.revokeObjectURL(url);
  }

  exportAsImage() {
    window.print();
  }

  setViewMode(mode: 'day' | 'week' | 'month') {
    this.viewMode = mode;
    this.buildHeatmap();
  }

  onViewDateChange() {
    this.buildHeatmap();
  }

  buildHeatmap() {
    this.heatmapDays = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const base = new Date(this.selectedDate);
    base.setHours(0, 0, 0, 0);

    const days =
      this.viewMode === 'day' ? 1 :
      this.viewMode === 'week' ? 7 : 30;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      d.setHours(0, 0, 0, 0);

      if (d.getTime() > today.getTime()) continue;

      const percent = this.dayCompletionPercent(d);

      this.heatmapDays.push({
        date: this.format(d),
        label:
          this.viewMode === 'day'
            ? 'Today'
            : this.viewMode === 'week'
              ? d.toLocaleDateString('en-US', { weekday: 'short' })
              : d.getDate().toString(),
        percent
      });
    }
  }

  dayCompletionPercent(date: Date) {
    let done = 0;
    let total = 0;

    this.tracker.tasks.forEach(task => {
      if (!task.enabled) return;

      total++;
      if (this.tracker.isCompleted(task.id, this.format(date))) {
        done++;
      }
    });

    return total ? Math.round((done / total) * 100) : 0;
  }

  getHeatClass(percent: number) {
    if (percent === 0) return 'hm-0';
    if (percent <= 25) return 'hm-1';
    if (percent <= 50) return 'hm-2';
    if (percent <= 75) return 'hm-3';
    return 'hm-4';
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
      this.isLoggedIn = false;
      this.router.navigate(['/login']);
    }
  }

  getDashboard() {
    this.isLoading = true;
    this.tracker.getDashboard().subscribe({
      next: (res: any) => {
        this.mockApiResponse = res;
        this.tracker.tasks = this.mockApiResponse.tasks || [];

        this.tracker.clearStore();
        if (this.mockApiResponse.completions) {
          this.mockApiResponse.completions.forEach((c: any) => {
            this.tracker.setCompletion(c.taskId, c.date, c.completed);
          });
        }

        if (this.mockApiResponse.user) {
          this.userName = this.mockApiResponse.user.name || '';
          this.userEmoji = this.mockApiResponse.user.emoji || '🙂';
        }

        this.buildHeatmap();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Failed to load dashboard:', error);
        this.isLoading = false;
        if (error.status === 401) {
          this.logout();
        }
      }
    });
  }
}
