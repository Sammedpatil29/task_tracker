import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { ModalService } from '../../services/modal.service';
import { LoaderComponent } from '../loader/loader.component';

export interface ProductivityCategory {
  id?: number;
  name: string;
  targetHours: number;
  emoji: string;
  color: string;
}

export interface ActivityLog {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  CategoryId?: number;
  ProductivityCategory?: ProductivityCategory;
}

export interface CategorySummary {
  category: ProductivityCategory;
  loggedMinutes: number;
  loggedHours: number;
  targetHours: number;
  progressPct: number;
}

export interface CompareCategorySegment {
  categoryId?: number;
  name: string;
  emoji: string;
  color: string;
  loggedMinutes: number;
  loggedHours: number;
  targetHours: number;
  slotHeightPct: number;
  fillPct: number;
  isOverTarget: boolean;
  overflowHours: number;
}

export interface CompareDay {
  date: string;
  formattedDate: string;
  shortDate?: string;
  dayLabel: string;
  shortDay: string;
  isToday: boolean;
  totalLoggedMinutes: number;
  totalLoggedHours: number;
  unallocatedMinutes: number;
  unallocatedHours: number;
  segments: CompareCategorySegment[];
}

import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-productivity',
  imports: [CommonModule, FormsModule, LoaderComponent, RouterModule],
  templateUrl: './productivity.component.html',
  styleUrl: './productivity.component.css'
})
export class ProductivityComponent implements OnInit {
  isLoading: boolean = true;
  isSavingLog: boolean = false;
  isSavingCategories: boolean = false;

  // Selected Date
  selectedDate: string = this.formatDate(new Date());

  // Data
  categories: ProductivityCategory[] = [];
  logs: ActivityLog[] = [];

  // Compare Modal State (Goals vs Actuals Graph)
  showCompareModal: boolean = false;
  isLargeView: boolean = false;
  compareRange: '7d' | '14d' | '30d' = '7d';
  compareDays: CompareDay[] = [];
  isLoadingCompare: boolean = false;

  // Log Form State
  logTitle: string = '';
  logCategoryId: number | null = null;
  logStartTime: string = '09:00';
  logEndTime: string = '09:30';

  // Category Configuration Modal State
  showCategoryModal: boolean = false;
  isOnboarding: boolean = false;
  editingCategories: ProductivityCategory[] = [];

  // Color Palette Options for Categories
  availableColors = [
    '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#64748b'
  ];

  // Default 24h Template
  default24hTemplate: ProductivityCategory[] = [
    { name: 'Sleep', targetHours: 8.0, emoji: '😴', color: '#6366f1' },
    { name: 'Work', targetHours: 5.0, emoji: '💼', color: '#3b82f6' },
    { name: 'Entertainment', targetHours: 3.0, emoji: '🎮', color: '#ec4899' },
    { name: 'Extra Productivity', targetHours: 3.0, emoji: '⚡', color: '#10b981' },
    { name: 'Daily Routine', targetHours: 2.5, emoji: '☕', color: '#f59e0b' },
    { name: 'Health & Fitness', targetHours: 2.5, emoji: '🥗', color: '#14b8a6' }
  ];

  constructor(
    private tracker: TaskTrackerService,
    private modalService: ModalService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initTimes();
    this.loadInitialData();
  }

  initTimes() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const nextH = String((now.getHours() + 1) % 24).padStart(2, '0');
    this.logStartTime = `${h}:00`;
    this.logEndTime = `${nextH}:00`;
  }

  loadInitialData() {
    this.isLoading = true;
    this.tracker.getProductivityCategories().subscribe({
      next: (cats: any) => {
        this.categories = cats || [];

        if (this.categories.length === 0) {
          // Onboarding flow: open category modal with default 24h allocation
          this.isOnboarding = true;
          this.editingCategories = JSON.parse(JSON.stringify(this.default24hTemplate));
          this.showCategoryModal = true;
          this.isLoading = false;
        } else {
          this.logCategoryId = this.categories[0]?.id || null;
          this.loadLogs();
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadLogs() {
    this.tracker.getActivityLogs(this.selectedDate).subscribe({
      next: (logs: any) => {
        this.logs = logs || [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // --- DATE NAVIGATION ---

  navigateDate(deltaDays: number) {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + deltaDays);
    this.selectedDate = this.formatDate(d);
    this.loadLogs();
  }

  setToday() {
    this.selectedDate = this.formatDate(new Date());
    this.loadLogs();
  }

  isToday(): boolean {
    return this.selectedDate === this.formatDate(new Date());
  }

  get selectedDateFormatted(): string {
    const [y, m, day] = this.selectedDate.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    const dayName = d.toLocaleDateString('default', { weekday: 'long' });
    const monthName = d.toLocaleDateString('default', { month: 'short' });
    return `${dayName}, ${monthName} ${day}, ${y}`;
  }

  // --- STATS & COMPUTATIONS ---

  get totalLoggedMinutes(): number {
    return this.logs.reduce((acc, log) => acc + log.durationMinutes, 0);
  }

  get totalLoggedHours(): number {
    return Math.round((this.totalLoggedMinutes / 60) * 10) / 10;
  }

  get remainingHours(): number {
    return Math.max(0, Math.round((24 - this.totalLoggedHours) * 10) / 10);
  }

  get totalLoggedHoursFormatted(): string {
    const h = Math.floor(this.totalLoggedMinutes / 60);
    const m = this.totalLoggedMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  get categorySummaries(): CategorySummary[] {
    const map = new Map<number, number>();
    for (const log of this.logs) {
      const catId = (log as any).ProductivityCategoryId || log.CategoryId || log.ProductivityCategory?.id;
      if (catId) {
        map.set(Number(catId), (map.get(Number(catId)) || 0) + log.durationMinutes);
      }
    }

    return this.categories.map(cat => {
      const loggedMin = cat.id ? (map.get(Number(cat.id)) || 0) : 0;
      const loggedH = Math.round((loggedMin / 60) * 10) / 10;
      const targetH = cat.targetHours || 1;
      const pct = Math.min(100, Math.round((loggedH / targetH) * 100));

      return {
        category: cat,
        loggedMinutes: loggedMin,
        loggedHours: loggedH,
        targetHours: targetH,
        progressPct: pct
      };
    });
  }

  // --- MODAL COMPUTATIONS ---

  get modalTotalHours(): number {
    const total = this.editingCategories.reduce((acc, c) => acc + (Number(c.targetHours) || 0), 0);
    return Math.round(total * 10) / 10;
  }

  get isModalHoursValid(): boolean {
    return Math.abs(this.modalTotalHours - 24.0) < 0.05;
  }

  // --- COMPARE GOALS VS ACTUALS GRAPH ENGINE ---

  openCompareModal() {
    this.router.navigate(['/analytics'], { queryParams: { tab: 'productivity' } });
  }

  closeCompareModal() {
    this.showCompareModal = false;
  }

  setCompareRange(range: '7d' | '14d' | '30d') {
    this.compareRange = range;
    this.loadCompareData();
  }

  loadCompareData() {
    this.isLoadingCompare = true;
    const daysCount = this.compareRange === '7d' ? 7 : this.compareRange === '14d' ? 14 : 30;

    const today = new Date();
    const startD = new Date();
    startD.setDate(startD.getDate() - (daysCount - 1));

    const startDateStr = this.formatDate(startD);
    const endDateStr = this.formatDate(today);

    this.tracker.getActivityLogs({ startDate: startDateStr, endDate: endDateStr }).subscribe({
      next: (allLogs: any) => {
        this.processCompareDays(daysCount, allLogs || []);
        this.isLoadingCompare = false;
        this.scrollCompareToEnd();
      },
      error: () => {
        this.isLoadingCompare = false;
      }
    });
  }

  private processCompareDays(daysCount: number, allLogs: any[]) {
    const todayStr = this.formatDate(new Date());
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Group logs by date
    const logsByDate = new Map<string, any[]>();
    for (const log of allLogs) {
      if (!logsByDate.has(log.date)) {
        logsByDate.set(log.date, []);
      }
      logsByDate.get(log.date)!.push(log);
    }

    const list: CompareDay[] = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const dayLogs = logsByDate.get(dateStr) || [];

      // Calculate minutes per category on this day
      const catMinutesMap = new Map<number, number>();
      let totalDayMinutes = 0;

      for (const log of dayLogs) {
        const catId = (log as any).ProductivityCategoryId || log.CategoryId || log.ProductivityCategory?.id;
        const dur = log.durationMinutes || 0;
        totalDayMinutes += dur;
        if (catId) {
          catMinutesMap.set(Number(catId), (catMinutesMap.get(Number(catId)) || 0) + dur);
        }
      }

      const totalLoggedHours = Math.round((totalDayMinutes / 60) * 10) / 10;
      const unallocatedMin = Math.max(0, 1440 - totalDayMinutes);
      const unallocatedHours = Math.round((unallocatedMin / 60) * 10) / 10;

      // Build parallel category slots in the exact same top-to-bottom order as the Target Goal bar
      const totalBudget = this.totalCategoryBudget || 24;
      const segments: CompareCategorySegment[] = this.categories.map(cat => {
        const loggedMin = cat.id ? (catMinutesMap.get(Number(cat.id)) || 0) : 0;
        const loggedHours = Math.round((loggedMin / 60) * 10) / 10;
        const targetHours = Number(cat.targetHours) || 0;
        const slotHeightPct = totalBudget > 0 ? (targetHours / totalBudget) * 100 : 0;
        const fillPct = targetHours > 0 ? Math.min(100, Math.round((loggedHours / targetHours) * 100)) : 0;
        const isOverTarget = loggedHours > targetHours;
        const overflowHours = isOverTarget ? Math.round((loggedHours - targetHours) * 10) / 10 : 0;

        return {
          categoryId: cat.id,
          name: cat.name,
          emoji: cat.emoji,
          color: cat.color,
          loggedMinutes: loggedMin,
          loggedHours,
          targetHours,
          slotHeightPct,
          fillPct,
          isOverTarget,
          overflowHours
        };
      });

      const isToday = dateStr === todayStr;
      const dayLabel = isToday ? 'Today' : `${dayNames[d.getDay()]} ${d.getDate()}`;
      const monthName = d.toLocaleString('default', { month: 'short' });

      list.push({
        date: dateStr,
        formattedDate: `${dayNames[d.getDay()]}, ${monthName} ${d.getDate()}`,
        shortDate: `${monthName} ${d.getDate()}`,
        dayLabel,
        shortDay: dayNames[d.getDay()],
        isToday,
        totalLoggedMinutes: totalDayMinutes,
        totalLoggedHours,
        unallocatedMinutes: unallocatedMin,
        unallocatedHours,
        segments
      });
    }

    this.compareDays = list;
    this.scrollCompareToEnd();
  }

  toggleLargeView() {
    this.isLargeView = !this.isLargeView;
    this.scrollCompareToEnd();
  }

  private scrollCompareToEnd() {
    setTimeout(() => {
      const container = document.querySelector('.compare-scroll-area');
      if (container) {
        container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      }
    }, 60);
  }

  get totalCategoryBudget(): number {
    if (!this.categories || this.categories.length === 0) return 24;
    const sum = this.categories.reduce((acc, c) => acc + (Number(c.targetHours) || 0), 0);
    return Math.round(sum * 10) / 10 || 24;
  }

  getGoalSegmentHeight(cat: ProductivityCategory): number {
    const hours = Number(cat.targetHours) || 0;
    const total = this.totalCategoryBudget || 24;
    return (hours / total) * 100;
  }

  openCategoryModal() {
    this.isOnboarding = false;
    this.editingCategories = this.categories.map(c => ({ ...c }));
    if (this.editingCategories.length === 0) {
      this.editingCategories = JSON.parse(JSON.stringify(this.default24hTemplate));
    }
    this.showCategoryModal = true;
  }

  closeCategoryModal() {
    if (this.categories.length === 0) {
      this.modalService.alert(
        'Category Setup Required',
        'Please define your 24-hour daily goal distribution before proceeding.'
      );
      return;
    }
    this.showCategoryModal = false;
  }

  addCategoryRow() {
    const defaultEmojis = ['🎯', '💡', '📖', '🚴', '🎨', '🧹', '🌿'];
    const emoji = defaultEmojis[this.editingCategories.length % defaultEmojis.length];
    const color = this.availableColors[this.editingCategories.length % this.availableColors.length];

    this.editingCategories.push({
      name: '',
      targetHours: 1.0,
      emoji,
      color
    });
  }

  removeCategoryRow(index: number) {
    if (this.editingCategories.length <= 1) {
      this.modalService.alert('Minimum Limit', 'You must have at least one category.');
      return;
    }
    this.editingCategories.splice(index, 1);
  }

  loadDefaultTemplate() {
    this.editingCategories = JSON.parse(JSON.stringify(this.default24hTemplate));
  }

  saveCategories() {
    if (!this.isModalHoursValid) {
      this.modalService.alert(
        '24-Hour Allocation Mismatch',
        `Your category targets currently sum to ${this.modalTotalHours} hrs. The total daily allocation must equal exactly 24.0 hours.`
      );
      return;
    }

    for (const cat of this.editingCategories) {
      if (!cat.name || cat.name.trim().length === 0) {
        this.modalService.alert('Missing Name', 'Please ensure all categories have a valid name.');
        return;
      }
    }

    this.isSavingCategories = true;
    this.tracker.saveProductivityCategories(this.editingCategories).subscribe({
      next: (res: any) => {
        this.isSavingCategories = false;
        this.categories = res.categories || [];
        if (!this.logCategoryId && this.categories.length > 0) {
          this.logCategoryId = this.categories[0].id || null;
        }
        this.showCategoryModal = false;
        this.isOnboarding = false;
        this.modalService.alert('Goals Saved! 🎯', 'Your 24-hour daily productivity goals have been updated successfully.');
        this.loadLogs();
      },
      error: (err: any) => {
        this.isSavingCategories = false;
        this.modalService.alert('Error', err?.error?.error || 'Failed to save categories. Please try again.');
      }
    });
  }

  // --- TIME OVERLAP & ACTIVITY LOGGING ---

  addActivityLog() {
    const title = this.logTitle.trim();
    if (!title) {
      this.modalService.alert('Missing Title', 'Please enter a description or title for your activity.');
      return;
    }

    const startMin = this.timeToMinutes(this.logStartTime);
    const endMin = this.timeToMinutes(this.logEndTime);

    if (startMin === -1 || endMin === -1) {
      this.modalService.alert('Invalid Time', 'Please select valid start and end times (HH:MM).');
      return;
    }

    if (endMin <= startMin) {
      this.modalService.alert('Invalid Duration', 'End time must be later than start time.');
      return;
    }

    // STRICT NON-OVERLAPPING CHECK
    for (const existing of this.logs) {
      const exStart = this.timeToMinutes(existing.startTime);
      const exEnd = this.timeToMinutes(existing.endTime);

      if (startMin < exEnd && endMin > exStart) {
        this.modalService.alert(
          '⚠️ Time Conflict Detected',
          `The slot ${this.logStartTime} - ${this.logEndTime} overlaps with your existing log: '${existing.title}' (${existing.startTime} - ${existing.endTime}). Please choose a non-overlapping time window.`
        );
        return;
      }
    }

    this.isSavingLog = true;
    const payload = {
      title,
      date: this.selectedDate,
      startTime: this.logStartTime,
      endTime: this.logEndTime,
      categoryId: this.logCategoryId ? Number(this.logCategoryId) : null
    };

    this.tracker.addActivityLog(payload).subscribe({
      next: (res: any) => {
        this.isSavingLog = false;
        if (res.log) {
          if (!res.log.ProductivityCategory && this.logCategoryId) {
            res.log.ProductivityCategory = this.categories.find(c => c.id === Number(this.logCategoryId));
          }
          this.logs.push(res.log);
          // Sort logs chronologically
          this.logs.sort((a, b) => a.startTime.localeCompare(b.startTime));
        }
        this.logTitle = '';
        // Auto-advance next start time to current end time
        this.logStartTime = this.logEndTime;
        const [h, m] = this.logEndTime.split(':').map(Number);
        const nextH = String((h + 1) % 24).padStart(2, '0');
        this.logEndTime = `${nextH}:${String(m).padStart(2, '0')}`;
      },
      error: (err: any) => {
        this.isSavingLog = false;
        this.modalService.alert('Failed to Add Log', err?.error?.error || 'Could not save activity log.');
      }
    });
  }

  async deleteLog(log: ActivityLog) {
    const confirmed = await this.modalService.confirm(
      'Delete Time Log 🗑️',
      `Are you sure you want to delete the time block '${log.title}' (${log.startTime} - ${log.endTime})?`,
      'Delete',
      true
    );

    if (confirmed) {
      this.tracker.deleteActivityLog(log.id).subscribe({
        next: () => {
          this.logs = this.logs.filter(l => l.id !== log.id);
        },
        error: (err: any) => {
          this.modalService.alert('Error', err?.error?.error || 'Failed to delete time log.');
        }
      });
    }
  }

  formatDuration(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  private timeToMinutes(timeStr: string): number {
    if (!timeStr) return -1;
    const parts = timeStr.trim().split(':');
    if (parts.length !== 2) return -1;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return -1;
    return h * 60 + m;
  }

  getLogCategory(log: ActivityLog): ProductivityCategory | undefined {
    if (log.ProductivityCategory) return log.ProductivityCategory;
    const catId = (log as any).ProductivityCategoryId || log.CategoryId;
    if (catId) {
      return this.categories.find(c => c.id === Number(catId));
    }
    return undefined;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

