import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { LoaderComponent } from '../loader/loader.component';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';

export interface TrendDay {
  date: string;
  label: string;
  dayName: string;
  shortDay: string;
  completedCount: number;
  totalActiveTasks: number;
  percentage: number;
  heightPct: number;
  isToday: boolean;
}

export interface HeatmapCell {
  date: string;
  dayName: string;
  formattedDate: string;
  count: number;
  intensity: number; // 0 to 4
  isToday: boolean;
}

export interface HabitStat {
  id: number;
  name: string;
  emoji: string;
  weeklyTarget: number;
  enabled: boolean;
  periodCompletions: number;
  targetExpected: number;
  completionRate: number;
  streak: number;
  status: 'target_met' | 'on_track' | 'behind';
}

export interface Milestone {
  id: string;
  icon: string;
  title: string;
  description: string;
  category: string;
  progressText: string;
  unlocked: boolean;
  unlockedAt?: string;
  badgeKey?: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, LoaderComponent, RouterModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit {
  isLoading: boolean = true;
  timeRange: '7d' | '30d' | 'all' = '7d';

  // Raw Data
  tasks: any[] = [];
  completions: any[] = [];
  achievements: any[] = [];
  private achievementsMap = new Map<string, string>(); // badgeKey -> unlockedAt

  // Computed KPIs
  disciplineScore: number = 0;
  overallScore: number = 0;
  activeStreak: number = 0;
  currentStreak: number = 0;
  bestStreak: number = 0;
  longestStreak: number = 0;
  totalWins: number = 0;
  targetAdherence: number = 0;
  targetAdherencePct: number = 0;

  // Chart Data
  trendDays: TrendDay[] = [];
  heatmapCells: HeatmapCell[] = [];
  habitStats: HabitStat[] = [];
  
  // Behavioral Insights
  bestDay: { name: string; rate: number } = { name: 'Monday', rate: 0 };
  challengingDay: { name: string; rate: number } = { name: 'Sunday', rate: 0 };
  insightMessage: string = '';

  // Gamification Milestones
  milestones: Milestone[] = [];

  // Productivity Comparison Graph & Insights
  productivityCategories: any[] = [];
  compareDays: any[] = [];
  prodRange: '7d' | '14d' | '30d' = '7d';
  isProdLoading: boolean = false;
  prodAvgDailyHours: number = 0;
  prodCoveragePct: number = 0;
  prodFocusDailyHours: number = 0;
  prodSleepDailyHours: number = 0;
  prodAdherencePct: number = 0;
  prodPeakDay: { name: string; hours: number } = { name: 'Midweek', hours: 0 };
  prodTopCategory: { name: string; emoji: string; totalHours: number } = { name: '', emoji: '', totalHours: 0 };
  prodTimeLeakDailyHours: number = 0;
  prodCategoryStats: any[] = [];

  // Diet / Calories Track Card
  dietGoal: any = null;
  dietDays: any[] = [];
  dietRange: '7d' | '14d' | '30d' = '7d';
  isDietLoading: boolean = false;
  todayCalories: number = 0;
  todayDietSummary = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  avgDailyCalories: number = 0;
  dietAdherencePct: number = 0;
  maxCalorieInChart: number = 2500;

  // Active Feature Tab
  activeTab: 'discipline' | 'productivity' | 'diet' = 'discipline';

  setActiveTab(tab: 'discipline' | 'productivity' | 'diet') {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
    if (tab === 'productivity') {
      this.scrollProdToEnd();
    } else if (tab === 'diet') {
      this.scrollDietToEnd();
    } else if (tab === 'discipline') {
      this.scrollChartToEnd();
    }
  }

  constructor(
    public tracker: TaskTrackerService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] && ['discipline', 'productivity', 'diet'].includes(params['tab'])) {
        this.activeTab = params['tab'] as any;
      }
    });
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.tracker.getDashboard().subscribe({
      next: (res: any) => {
        this.tasks = res.tasks || [];
        this.completions = res.completions || [];
        this.achievements = res.achievements || [];
        
        this.achievementsMap.clear();
        for (const a of this.achievements) {
          this.achievementsMap.set(a.badgeKey, a.unlockedAt);
        }

        this.calculateAllAnalytics();
        this.isLoading = false;
        this.scrollChartToEnd();
        this.loadProductivityComparison();
        this.loadDietAnalytics();
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // --- PRODUCTIVITY COMPARISON GRAPH ENGINE ---

  loadProductivityComparison() {
    this.isProdLoading = true;
    const daysCount = this.prodRange === '7d' ? 7 : this.prodRange === '14d' ? 14 : 30;
    const today = new Date();
    const startD = new Date();
    startD.setDate(startD.getDate() - (daysCount - 1));

    const startDateStr = this.formatDate(startD);
    const endDateStr = this.formatDate(today);

    this.tracker.getProductivityCategories().subscribe({
      next: (cats: any) => {
        this.productivityCategories = cats || [];
        if (this.productivityCategories.length > 0) {
          this.tracker.getActivityLogs({ startDate: startDateStr, endDate: endDateStr }).subscribe({
            next: (logs: any) => {
              this.processProductivityDays(daysCount, logs || []);
              this.isProdLoading = false;
              this.scrollProdToEnd();
            },
            error: () => { this.isProdLoading = false; }
          });
        } else {
          this.isProdLoading = false;
        }
      },
      error: () => { this.isProdLoading = false; }
    });
  }

  setProdRange(range: '7d' | '14d' | '30d') {
    this.prodRange = range;
    this.loadProductivityComparison();
  }

  get totalTargetHours(): number {
    if (!this.productivityCategories || this.productivityCategories.length === 0) return 24;
    const sum = this.productivityCategories.reduce((acc: number, c: any) => acc + (Number(c.targetHours) || 0), 0);
    return Math.round(sum * 10) / 10 || 24;
  }

  getGoalSegmentHeight(cat: any): number {
    const hours = Number(cat.targetHours) || 0;
    const total = this.totalTargetHours || 24;
    return (hours / total) * 100;
  }

  private scrollProdToEnd() {
    setTimeout(() => {
      const el = document.querySelector('.prod-compare-scroll');
      if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, 80);
  }

  private processProductivityDays(daysCount: number, allLogs: any[]) {
    const todayStr = this.formatDate(new Date());
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const logsByDate = new Map<string, any[]>();

    for (const log of allLogs) {
      if (!logsByDate.has(log.date)) logsByDate.set(log.date, []);
      logsByDate.get(log.date)!.push(log);
    }

    const totalBudget = this.totalTargetHours || 24;
    const list: any[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const dayLogs = logsByDate.get(dateStr) || [];

      const catMinutesMap = new Map<number, number>();
      let totalDayMinutes = 0;

      for (const log of dayLogs) {
        const catId = log.ProductivityCategoryId || log.CategoryId || log.ProductivityCategory?.id;
        const dur = log.durationMinutes || 0;
        totalDayMinutes += dur;
        if (catId) {
          catMinutesMap.set(Number(catId), (catMinutesMap.get(Number(catId)) || 0) + dur);
        }
      }

      const totalLoggedHours = Math.round((totalDayMinutes / 60) * 10) / 10;

      const segments = this.productivityCategories.map((cat: any) => {
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
          loggedHours,
          targetHours,
          slotHeightPct,
          fillPct,
          isOverTarget,
          overflowHours
        };
      });

      const monthName = d.toLocaleString('default', { month: 'short' });
      list.push({
        date: dateStr,
        formattedDate: `${dayNames[d.getDay()]}, ${monthName} ${d.getDate()}`,
        shortDate: `${monthName} ${d.getDate()}`,
        dayLabel: dateStr === todayStr ? 'Today' : `${dayNames[d.getDay()]} ${d.getDate()}`,
        isToday: dateStr === todayStr,
        totalLoggedHours,
        segments
      });
    }

    this.compareDays = list;

    // Compute Productivity Insights across the period
    let totalAllMinutes = 0;
    const catAllMinMap = new Map<number, number>();
    const dayProductiveMap = new Map<string, { totalMin: number; daysCount: number }>();
    let sleepTotalMin = 0;
    let focusTotalMin = 0;

    for (const day of list) {
      totalAllMinutes += (day.totalLoggedHours * 60);
      const dayName = day.dayLabel === 'Today' ? dayNames[new Date().getDay()] : day.dayLabel.split(' ')[0];

      let dayFocusMin = 0;
      for (const seg of day.segments) {
        const catId = seg.categoryId;
        if (catId) {
          catAllMinMap.set(catId, (catAllMinMap.get(catId) || 0) + (seg.loggedHours * 60));
        }

        const isSleep = /sleep|rest|bed/i.test(seg.name);
        const isFocus = /work|prod|study|code|task|job|deep/i.test(seg.name);

        if (isSleep) sleepTotalMin += (seg.loggedHours * 60);
        if (isFocus) {
          focusTotalMin += (seg.loggedHours * 60);
          dayFocusMin += (seg.loggedHours * 60);
        }
      }

      if (!dayProductiveMap.has(dayName)) {
        dayProductiveMap.set(dayName, { totalMin: 0, daysCount: 0 });
      }
      const entry = dayProductiveMap.get(dayName)!;
      entry.totalMin += dayFocusMin;
      entry.daysCount += 1;
    }

    const totalAllHours = totalAllMinutes / 60;
    this.prodAvgDailyHours = Math.round((totalAllHours / daysCount) * 10) / 10;
    this.prodCoveragePct = Math.min(100, Math.round((this.prodAvgDailyHours / totalBudget) * 100));
    this.prodFocusDailyHours = Math.round((focusTotalMin / 60 / daysCount) * 10) / 10;
    this.prodSleepDailyHours = Math.round((sleepTotalMin / 60 / daysCount) * 10) / 10;
    this.prodTimeLeakDailyHours = Math.max(0, Math.round((totalBudget - this.prodAvgDailyHours) * 10) / 10);

    let maxFocusAvg = -1;
    let peakDayName = 'Midweek';
    dayProductiveMap.forEach((val, name) => {
      const avg = val.daysCount > 0 ? val.totalMin / val.daysCount : 0;
      if (avg > maxFocusAvg) {
        maxFocusAvg = avg;
        peakDayName = name;
      }
    });
    this.prodPeakDay = {
      name: peakDayName,
      hours: Math.round((maxFocusAvg / 60) * 10) / 10
    };

    let topCatName = '';
    let topCatEmoji = '⏱️';
    let maxCatHours = -1;
    let balancedCount = 0;

    this.prodCategoryStats = this.productivityCategories.map(cat => {
      const catMin = cat.id ? (catAllMinMap.get(cat.id) || 0) : 0;
      const totalLoggedH = Math.round((catMin / 60) * 10) / 10;
      const avgDailyH = Math.round((totalLoggedH / daysCount) * 10) / 10;
      const targetH = Number(cat.targetHours) || 0;
      const adherenceRate = targetH > 0 ? Math.round((avgDailyH / targetH) * 100) : 0;
      const diffHours = Math.round((avgDailyH - targetH) * 10) / 10;

      let status = 'on_track';
      let statusLabel = '🟢 On Track';

      if (adherenceRate >= 90 && adherenceRate <= 115) {
        status = 'mastered';
        statusLabel = '🎯 Target Mastered';
        balancedCount++;
      } else if (adherenceRate > 115) {
        status = 'over';
        statusLabel = '⚠️ Over Goal';
      } else if (adherenceRate >= 65) {
        status = 'on_track';
        statusLabel = '🟢 On Track';
        balancedCount++;
      } else {
        status = 'behind';
        statusLabel = '⏳ Needs Focus';
      }

      if (totalLoggedH > maxCatHours) {
        maxCatHours = totalLoggedH;
        topCatName = cat.name;
        topCatEmoji = cat.emoji || '⏱️';
      }

      return {
        id: cat.id,
        name: cat.name,
        emoji: cat.emoji,
        color: cat.color,
        targetHours: targetH,
        totalLoggedHours: totalLoggedH,
        avgDailyHours: avgDailyH,
        adherencePct: adherenceRate,
        fillPct: Math.min(100, adherenceRate),
        diffHours,
        status,
        statusLabel
      };
    });

    this.prodTopCategory = {
      name: topCatName || 'Active Logs',
      emoji: topCatEmoji,
      totalHours: Math.max(0, maxCatHours)
    };

    this.prodAdherencePct = this.productivityCategories.length > 0
      ? Math.round((balancedCount / this.productivityCategories.length) * 100)
      : 0;
  }

  // --- DIET & CALORIES ANALYTICS ENGINE ---

  loadDietAnalytics() {
    this.isDietLoading = true;
    const daysCount = this.dietRange === '7d' ? 7 : this.dietRange === '14d' ? 14 : 30;
    const today = new Date();
    const startD = new Date();
    startD.setDate(startD.getDate() - (daysCount - 1));

    const startDateStr = this.formatDate(startD);
    const endDateStr = this.formatDate(today);

    this.tracker.getDietSummary(startDateStr, endDateStr).subscribe({
      next: (res: any) => {
        this.dietGoal = res?.goal || { dailyCalories: 2000, proteinG: 150, carbsG: 200, fatG: 65, waterMl: 2500 };
        const byDate = res?.byDate || {};
        this.processDietDays(daysCount, byDate);
        this.isDietLoading = false;
        this.scrollDietToEnd();
      },
      error: () => {
        this.isDietLoading = false;
      }
    });
  }

  setDietRange(range: '7d' | '14d' | '30d') {
    this.dietRange = range;
    this.loadDietAnalytics();
  }

  private scrollDietToEnd() {
    setTimeout(() => {
      const el = document.querySelector('.diet-chart-scroll');
      if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, 80);
  }

  private processDietDays(daysCount: number, byDate: Record<string, any[]>) {
    const todayStr = this.formatDate(new Date());
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const targetCal = this.dietGoal?.dailyCalories || 2000;

    let totalCalLogged = 0;
    let daysWithLogs = 0;
    let onTargetDays = 0;
    let peakCal = targetCal * 1.25;

    const list: any[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const dayMeals = byDate[dateStr] || [];

      let cal = 0;
      let p = 0;
      let c = 0;
      let f = 0;

      for (const m of dayMeals) {
        cal += (m.calories || 0);
        p += (m.proteinG || 0);
        c += (m.carbsG || 0);
        f += (m.fatG || 0);
      }

      cal = Math.round(cal);
      p = Math.round(p * 10) / 10;
      c = Math.round(c * 10) / 10;
      f = Math.round(f * 10) / 10;

      if (cal > peakCal) peakCal = cal * 1.1;

      if (dayMeals.length > 0) {
        totalCalLogged += cal;
        daysWithLogs++;
        if (cal <= targetCal * 1.05 && cal >= targetCal * 0.7) {
          onTargetDays++;
        }
      }

      const pctOfTarget = Math.round((cal / targetCal) * 100);
      const isOver = cal > targetCal;
      const isMet = cal >= targetCal * 0.9 && cal <= targetCal * 1.05;

      if (dateStr === todayStr) {
        this.todayCalories = cal;
        this.todayDietSummary = { calories: cal, proteinG: p, carbsG: c, fatG: f };
      }

      list.push({
        date: dateStr,
        dayLabel: dateStr === todayStr ? 'Today' : `${dayNames[d.getDay()]} ${d.getDate()}`,
        formattedDate: `${dayNames[d.getDay()]}, ${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`,
        shortDate: `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`,
        isToday: dateStr === todayStr,
        calories: cal,
        targetCalories: targetCal,
        proteinG: p,
        carbsG: c,
        fatG: f,
        mealCount: dayMeals.length,
        pctOfTarget,
        isOver,
        isMet,
        fillHeightPct: 0,
        targetLinePct: 0
      });
    }

    this.maxCalorieInChart = Math.max(targetCal * 1.25, peakCal);
    for (const item of list) {
      item.fillHeightPct = Math.min(100, Math.round((item.calories / this.maxCalorieInChart) * 100));
      item.targetLinePct = Math.round((targetCal / this.maxCalorieInChart) * 100);
    }

    this.dietDays = list;
    this.avgDailyCalories = daysWithLogs > 0 ? Math.round(totalCalLogged / daysWithLogs) : 0;
    this.dietAdherencePct = daysCount > 0 ? Math.round((onTargetDays / daysCount) * 100) : 0;
  }

  setTimeRange(range: '7d' | '30d' | 'all') {
    this.timeRange = range;
    this.calculateAllAnalytics();
    this.scrollChartToEnd();
  }

  private scrollChartToEnd() {
    setTimeout(() => {
      const container = document.querySelector('.bar-chart-container');
      if (container) {
        container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      }
    }, 60);
  }

  // --- CORE ANALYTICS CALCULATION ENGINE ---

  calculateAllAnalytics() {
    const activeTasks = this.tasks.filter((t: any) => t.enabled !== false);
    const activeTaskIds = new Set(activeTasks.map((t: any) => t.id));
    
    // Map of date string -> set of completed task IDs
    const completionsByDate = new Map<string, Set<number>>();
    // Map of taskId -> set of completed dates
    const completionsByTask = new Map<number, Set<string>>();

    for (const c of this.completions) {
      if (c.completed) {
        if (!completionsByDate.has(c.date)) {
          completionsByDate.set(c.date, new Set<number>());
        }
        completionsByDate.get(c.date)!.add(c.taskId);

        if (!completionsByTask.has(c.taskId)) {
          completionsByTask.set(c.taskId, new Set<string>());
        }
        completionsByTask.get(c.taskId)!.add(c.date);
      }
    }

    const todayStr = this.formatDate(new Date());
    const daysInRange = this.timeRange === '7d' ? 7 : this.timeRange === '30d' ? 30 : 60;

    // 1. Calculate Streaks
    const streakResult = this.computeGlobalStreak(completionsByDate);
    this.currentStreak = streakResult.currentStreak;
    this.activeStreak = streakResult.currentStreak;
    this.longestStreak = streakResult.longestStreak;
    this.bestStreak = streakResult.longestStreak;

    // 2. Trend Bar Chart (Daily Completion Velocity)
    this.trendDays = this.generateTrendDays(daysInRange, completionsByDate, activeTasks.length, todayStr);

    // 3. 35-Day Consistency Heatmap
    this.heatmapCells = this.generateHeatmap(completionsByDate, activeTasks.length, todayStr);

    // 4. Per-Habit Performance Metrics
    this.habitStats = this.generateHabitStats(activeTasks, completionsByTask, daysInRange);

    // 5. Aggregate KPIs
    const totalCompletionsInRange = this.trendDays.reduce((acc, d) => acc + d.completedCount, 0);
    this.totalWins = this.timeRange === 'all' 
      ? this.completions.filter((c: any) => c.completed).length 
      : totalCompletionsInRange;

    const totalPossibleWins = this.trendDays.reduce((acc, d) => acc + d.totalActiveTasks, 0);
    this.overallScore = totalPossibleWins > 0 
      ? Math.round((totalCompletionsInRange / totalPossibleWins) * 100) 
      : 0;
    this.disciplineScore = this.overallScore;

    const habitsOnTrack = this.habitStats.filter(h => h.status !== 'behind').length;
    this.targetAdherencePct = this.habitStats.length > 0 
      ? Math.round((habitsOnTrack / this.habitStats.length) * 100) 
      : 100;
    this.targetAdherence = this.targetAdherencePct;

    // 6. Day-of-the-Week Insights
    this.computeDayOfWeekInsights(completionsByDate, activeTasks.length);

    // 7. Milestones & Achievements
    this.evaluateMilestones(completionsByDate, activeTasks.length);
  }

  private generateTrendDays(daysCount: number, completionsByDate: Map<string, Set<number>>, activeCount: number, todayStr: string): TrendDay[] {
    const list: TrendDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const completedSet = completionsByDate.get(dateStr) || new Set();
      const completedCount = completedSet.size;
      const pct = activeCount > 0 ? Math.round((completedCount / activeCount) * 100) : 0;
      
      // Calculate height percentage (min 6% for empty bar visibility)
      const heightPct = activeCount > 0 
        ? Math.max(8, Math.round((completedCount / activeCount) * 100))
        : 8;

      list.push({
        date: dateStr,
        label: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
        dayName: dayNames[d.getDay()],
        shortDay: dayNames[d.getDay()].charAt(0),
        completedCount,
        totalActiveTasks: activeCount,
        percentage: pct,
        heightPct: completedCount === 0 ? 6 : heightPct,
        isToday: dateStr === todayStr
      });
    }

    return list;
  }

  private generateHeatmap(completionsByDate: Map<string, Set<number>>, activeCount: number, todayStr: string): HeatmapCell[] {
    const cells: HeatmapCell[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // 28 days (4 weeks)
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = this.formatDate(d);
      const count = (completionsByDate.get(dateStr) || new Set()).size;
      
      let intensity = 0;
      if (count > 0 && activeCount > 0) {
        const ratio = count / activeCount;
        if (ratio >= 0.8) intensity = 4;
        else if (ratio >= 0.5) intensity = 3;
        else if (ratio >= 0.25) intensity = 2;
        else intensity = 1;
      } else if (count > 0) {
        intensity = 2;
      }

      cells.push({
        date: dateStr,
        dayName: dayNames[d.getDay()],
        formattedDate: `${dayNames[d.getDay()]}, ${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`,
        count,
        intensity,
        isToday: dateStr === todayStr
      });
    }

    return cells;
  }

  private generateHabitStats(activeTasks: any[], completionsByTask: Map<number, Set<string>>, daysInRange: number): HabitStat[] {
    return activeTasks.map(task => {
      const completedDates = completionsByTask.get(task.id) || new Set();
      
      // Count completions in current selected range
      let periodCount = 0;
      for (let i = 0; i < daysInRange; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (completedDates.has(this.formatDate(d))) {
          periodCount++;
        }
      }

      // Target expected in this period
      const weeks = Math.max(1, daysInRange / 7);
      const targetExpected = Math.round((task.weeklyTarget || 5) * weeks);
      const rate = targetExpected > 0 ? Math.min(100, Math.round((periodCount / targetExpected) * 100)) : 0;

      // Habit specific streak
      const streak = this.computeHabitStreak(completedDates);

      let status: 'target_met' | 'on_track' | 'behind' = 'behind';
      if (rate >= 90) status = 'target_met';
      else if (rate >= 60) status = 'on_track';

      return {
        id: task.id,
        name: task.name,
        emoji: this.detectHabitEmoji(task.name),
        weeklyTarget: task.weeklyTarget || 5,
        enabled: task.enabled !== false,
        periodCompletions: periodCount,
        targetExpected,
        completionRate: rate,
        streak,
        status
      };
    });
  }

  private computeGlobalStreak(completionsByDate: Map<string, Set<number>>): { currentStreak: number; longestStreak: number } {
    const today = new Date();
    const todayStr = this.formatDate(today);
    
    // Check current streak starting from today (or yesterday if today not logged yet)
    let currentStreak = 0;
    let checkDate = new Date(today);

    // If today has 0 completions, check if yesterday was completed to keep streak alive
    const todayCount = (completionsByDate.get(todayStr) || new Set()).size;
    if (todayCount === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = this.formatDate(checkDate);
      const count = (completionsByDate.get(dStr) || new Set()).size;
      if (count > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Compute longest streak across all recorded history (up to 365 days back)
    let longestStreak = 0;
    let tempStreak = 0;
    const pastYear = new Date(today);
    pastYear.setDate(pastYear.getDate() - 180);

    for (let d = new Date(pastYear); d <= today; d.setDate(d.getDate() + 1)) {
      const dStr = this.formatDate(d);
      const count = (completionsByDate.get(dStr) || new Set()).size;
      if (count > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    return { currentStreak, longestStreak };
  }

  private computeHabitStreak(completedDates: Set<string>): number {
    let streak = 0;
    const checkDate = new Date();
    const todayStr = this.formatDate(checkDate);

    if (!completedDates.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = this.formatDate(checkDate);
      if (completedDates.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  private computeDayOfWeekInsights(completionsByDate: Map<string, Set<number>>, activeCount: number) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayOccurrences = [0, 0, 0, 0, 0, 0, 0];

    // Sample past 60 days
    for (let i = 0; i < 60; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayIdx = d.getDay();
      const count = (completionsByDate.get(this.formatDate(d)) || new Set()).size;
      dayTotals[dayIdx] += count;
      dayOccurrences[dayIdx]++;
    }

    const dayAverages = dayTotals.map((tot, idx) => ({
      name: dayNames[idx],
      rate: dayOccurrences[idx] > 0 && activeCount > 0 
        ? Math.round((tot / (dayOccurrences[idx] * activeCount)) * 100) 
        : 0
    }));

    // Sort by rate
    const sorted = [...dayAverages].sort((a, b) => b.rate - a.rate);
    this.bestDay = sorted[0] || { name: 'Monday', rate: 0 };
    this.challengingDay = sorted[sorted.length - 1] || { name: 'Sunday', rate: 0 };

    if (this.bestDay.rate > 0) {
      this.insightMessage = `You are most disciplined on **${this.bestDay.name}s** (${this.bestDay.rate}% consistency)! Protect your weekends and keep your momentum consistent on **${this.challengingDay.name}s**.`;
    } else {
      this.insightMessage = `Start logging your habits consistently to uncover your peak performance patterns and optimal discipline rhythm.`;
    }
  }

  private evaluateMilestones(completionsByDate: Map<string, Set<number>>, activeCount: number) {
    const totalWins = this.completions.filter((c: any) => c.completed).length;

    // Check if there was any day where all active habits were completed
    let hasPerfectDay = false;
    for (const [_, set] of completionsByDate.entries()) {
      if (activeCount > 0 && set.size >= activeCount) {
        hasPerfectDay = true;
        break;
      }
    }

    const formatUnlock = (badgeKey: string, conditionMet: boolean, defaultFallback: string) => {
      const storedDate = this.achievementsMap.get(badgeKey);
      if (storedDate) {
        const d = new Date(storedDate);
        return `Unlocked on ${d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })} ✨`;
      }
      if (conditionMet) {
        return 'Unlocked ✨';
      }
      return defaultFallback;
    };

    const isUnlocked = (badgeKey: string, conditionMet: boolean) => {
      return this.achievementsMap.has(badgeKey) || conditionMet;
    };

    this.milestones = [
      {
        id: 'first_win',
        icon: '🚀',
        title: 'First Step',
        description: 'Completed your very first discipline habit log.',
        unlocked: isUnlocked('first_win', totalWins >= 1),
        unlockedAt: this.achievementsMap.get('first_win'),
        progressText: formatUnlock('first_win', totalWins >= 1, `${totalWins} / 1 Wins`),
        category: 'Beginner'
      },
      {
        id: 'streak_3',
        icon: '🔥',
        title: 'Ignition Streak',
        description: 'Maintained a consecutive 3-day discipline streak.',
        unlocked: isUnlocked('streak_3', this.longestStreak >= 3),
        unlockedAt: this.achievementsMap.get('streak_3'),
        progressText: formatUnlock('streak_3', this.longestStreak >= 3, `${this.longestStreak} / 3 Days`),
        category: 'Momentum'
      },
      {
        id: 'streak_7',
        icon: '⚡',
        title: 'Discipline Warrior',
        description: 'Maintained a full 7-day unbroken habit streak.',
        unlocked: isUnlocked('streak_7', this.longestStreak >= 7),
        unlockedAt: this.achievementsMap.get('streak_7'),
        progressText: formatUnlock('streak_7', this.longestStreak >= 7, `${this.longestStreak} / 7 Days`),
        category: 'Mastery'
      },
      {
        id: 'perfect_day',
        icon: '🎯',
        title: 'Flawless Execution',
        description: 'Completed 100% of all active habits in a single day.',
        unlocked: isUnlocked('perfect_day', hasPerfectDay),
        unlockedAt: this.achievementsMap.get('perfect_day'),
        progressText: formatUnlock('perfect_day', hasPerfectDay, '0 / 1 Day'),
        category: 'Precision'
      },
      {
        id: 'centurion',
        icon: '🏆',
        title: 'Century Club',
        description: 'Logged 50 or more lifetime discipline completions.',
        unlocked: isUnlocked('centurion', totalWins >= 50),
        unlockedAt: this.achievementsMap.get('centurion'),
        progressText: formatUnlock('centurion', totalWins >= 50, `${totalWins} / 50 Wins`),
        category: 'Milestone'
      }
    ];
  }

  detectHabitEmoji(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('gym') || n.includes('workout') || n.includes('fitness') || n.includes('exercise')) return '🏋️‍♂️';
    if (n.includes('code') || n.includes('dev') || n.includes('program') || n.includes('software')) return '💻';
    if (n.includes('read') || n.includes('book') || n.includes('study') || n.includes('learn')) return '📚';
    if (n.includes('water') || n.includes('hydrate') || n.includes('drink')) return '💧';
    if (n.includes('meditat') || n.includes('mindful') || n.includes('breath') || n.includes('yoga')) return '🧘';
    if (n.includes('run') || n.includes('walk') || n.includes('jog') || n.includes('cardio')) return '🏃';
    if (n.includes('sleep') || n.includes('rest') || n.includes('bed')) return '😴';
    if (n.includes('diet') || n.includes('eat') || n.includes('meal') || n.includes('food')) return '🥗';
    if (n.includes('journal') || n.includes('write') || n.includes('diary')) return '✍️';
    if (n.includes('clean') || n.includes('tidy') || n.includes('chore')) return '🧹';
    return '🎯';
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
