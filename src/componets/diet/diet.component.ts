import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { LoaderComponent } from '../loader/loader.component';

export interface DietGoal {
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  isDefault?: boolean;
}

export interface MealLog {
  id?: number;
  name: string;
  date: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  notes?: string;
}

export interface MacroTotal {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-diet',
  standalone: true,
  imports: [CommonModule, FormsModule, LoaderComponent, RouterModule],
  templateUrl: './diet.component.html',
  styleUrl: './diet.component.css'
})
export class DietComponent implements OnInit {
  isLoading: boolean = true;
  isSaving: boolean = false;
  isLoggingMeal: boolean = false;

  // Date navigation
  currentDate: Date = new Date();
  currentDateStr: string = '';

  // Diet goal
  goal: DietGoal = { dailyCalories: 2000, proteinG: 150, carbsG: 200, fatG: 65, fiberG: 30, waterMl: 2500 };
  goalDraft: DietGoal = { ...this.goal };
  showGoalModal: boolean = false;
  goalSaveMsg: string = '';

  // Meal logs for current date
  mealLogs: MealLog[] = [];
  totals: MacroTotal = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

  // Water intake for current date
  waterIntake: number = 0;

  get waterPct(): number {
    const target = this.goal.waterMl || 2500;
    return Math.min(100, Math.round((this.waterIntake / target) * 100));
  }

  // Add / Edit Meal form
  showMealForm: boolean = false;
  editingMealId: number | null = null;
  mealForm = {
    name: '',
    mealType: 'Meal',
    calories: null as number | null,
    proteinG: null as number | null,
    carbsG: null as number | null,
    fatG: null as number | null,
    fiberG: null as number | null,
    notes: ''
  };
  mealFormError: string = '';
  isEstimatingAi: boolean = false;
  aiPortionHint: string = '';

  readonly mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-Workout', 'Post-Workout'];
  readonly mealTypeIcons: Record<string, string> = {
    'Breakfast': '🌅', 'Lunch': '☀️', 'Dinner': '🌙',
    'Snack': '🍎', 'Pre-Workout': '💪', 'Post-Workout': '🏋️', 'Meal': '🍽️'
  };
  readonly macroColors = { calories: '#f59e0b', protein: '#10b981', carbs: '#3b82f6', fat: '#f43f5e', fiber: '#8b5cf6' };

  constructor(public tracker: TaskTrackerService) {}

  ngOnInit() {
    this.currentDate = new Date();
    this.currentDateStr = this.formatDate(this.currentDate);
    this.loadAll();

    this.tracker.todayWater$.subscribe((val) => {
      if (this.isToday()) {
        this.waterIntake = val;
      }
    });
  }

  loadAll() {
    this.isLoading = true;
    this.tracker.getDietGoal().subscribe({
      next: (g: any) => {
        this.goal = {
          dailyCalories: g.dailyCalories ?? 2000,
          proteinG: g.proteinG ?? 150,
          carbsG: g.carbsG ?? 200,
          fatG: g.fatG ?? 65,
          fiberG: g.fiberG ?? 30,
          waterMl: g.waterMl ?? 2500,
          isDefault: g.isDefault ?? false
        };
        this.goalDraft = { ...this.goal };
        this.loadDayLogs();
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadDayLogs() {
    this.loadWaterLog();
    this.tracker.getMealLogs(this.currentDateStr).subscribe({
      next: (logs: any[]) => {
        this.mealLogs = logs;
        this.recalcTotals();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  loadWaterLog() {
    this.tracker.getWaterLog(this.currentDateStr).subscribe({
      next: (res: any) => {
        this.waterIntake = res?.amountMl || 0;
        if (this.isToday()) {
          this.tracker.todayWater$.next(this.waterIntake);
        }
      },
      error: () => {
        this.waterIntake = 0;
      }
    });
  }

  addWater(delta: number) {
    if (this.tracker.isWaterUpdating$.value) return;
    this.tracker.isWaterUpdating$.next(true);

    const prev = this.waterIntake;
    this.waterIntake = Math.max(0, this.waterIntake + delta);
    if (this.isToday()) {
      this.tracker.todayWater$.next(this.waterIntake);
    }
    this.tracker.updateWaterLog({ date: this.currentDateStr, delta }).subscribe({
      next: (res: any) => {
        if (res && res.amountMl !== undefined) {
          this.waterIntake = res.amountMl;
          if (this.isToday()) {
            this.tracker.todayWater$.next(res.amountMl);
          }
        }
        this.tracker.isWaterUpdating$.next(false);
      },
      error: () => {
        this.waterIntake = prev;
        if (this.isToday()) {
          this.tracker.todayWater$.next(prev);
        }
        this.tracker.isWaterUpdating$.next(false);
      }
    });
  }

  recalcTotals() {
    this.totals = this.mealLogs.reduce((acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      proteinG: acc.proteinG + (m.proteinG || 0),
      carbsG: acc.carbsG + (m.carbsG || 0),
      fatG: acc.fatG + (m.fatG || 0),
      fiberG: acc.fiberG + (m.fiberG || 0)
    }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
  }

  // --- Date Navigation ---
  prevDay() {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() - 1);
    this.currentDate = d;
    this.currentDateStr = this.formatDate(d);
    this.isLoading = true;
    this.loadDayLogs();
  }

  nextDay() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (this.currentDate >= tomorrow) return;
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + 1);
    this.currentDate = d;
    this.currentDateStr = this.formatDate(d);
    this.isLoading = true;
    this.loadDayLogs();
  }

  isToday(): boolean {
    return this.currentDateStr === this.formatDate(new Date());
  }

  goToToday() {
    this.currentDate = new Date();
    this.currentDateStr = this.formatDate(this.currentDate);
    this.isLoading = true;
    this.loadDayLogs();
  }

  get formattedCurrentDate(): string {
    const today = this.formatDate(new Date());
    const yesterday = this.formatDate(new Date(new Date().setDate(new Date().getDate() - 1)));
    if (this.currentDateStr === today) return 'Today';
    if (this.currentDateStr === yesterday) return 'Yesterday';
    return this.currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  // --- Goal Modal ---
  openGoalModal() {
    this.goalDraft = { ...this.goal };
    this.goalSaveMsg = '';
    this.showGoalModal = true;
  }

  closeGoalModal() {
    this.showGoalModal = false;
  }

  saveGoal() {
    if (!this.goalDraft.dailyCalories || this.goalDraft.dailyCalories < 500) {
      this.goalSaveMsg = '⚠️ Calories must be at least 500';
      return;
    }
    this.isSaving = true;
    this.goalSaveMsg = '';
    this.tracker.saveDietGoal(this.goalDraft).subscribe({
      next: (saved: any) => {
        this.goal = { ...this.goalDraft, isDefault: false };
        if (this.goal.waterMl) {
          this.tracker.waterGoal$.next(this.goal.waterMl);
        }
        this.goalSaveMsg = '✅ Goals saved!';
        this.isSaving = false;
        setTimeout(() => this.showGoalModal = false, 800);
      },
      error: () => {
        this.goalSaveMsg = '❌ Failed to save. Please try again.';
        this.isSaving = false;
      }
    });
  }

  autoCalcMacros() {
    const cal = this.goalDraft.dailyCalories || 2000;
    // Standard macro split: 30% protein, 40% carbs, 30% fat
    this.goalDraft.proteinG = Math.round((cal * 0.30) / 4);
    this.goalDraft.carbsG = Math.round((cal * 0.40) / 4);
    this.goalDraft.fatG = Math.round((cal * 0.30) / 9);
    this.goalDraft.fiberG = Math.round(cal / 70); // ~14g per 1000 kcal
  }

  // --- Meal Form ---
  openAddMeal(mealType?: string) {
    this.editingMealId = null;
    this.mealForm = {
      name: '', mealType: mealType || 'Meal',
      calories: null, proteinG: null, carbsG: null, fatG: null, fiberG: null, notes: ''
    };
    this.mealFormError = '';
    this.aiPortionHint = '';
    this.showMealForm = true;
  }

  openEditMeal(meal: MealLog) {
    this.editingMealId = meal.id ?? null;
    this.mealForm = {
      name: meal.name,
      mealType: meal.mealType,
      calories: meal.calories,
      proteinG: meal.proteinG || null,
      carbsG: meal.carbsG || null,
      fatG: meal.fatG || null,
      fiberG: meal.fiberG || null,
      notes: meal.notes || ''
    };
    this.mealFormError = '';
    this.aiPortionHint = '';
    this.showMealForm = true;
  }

  closeMealForm() {
    this.showMealForm = false;
    this.isEstimatingAi = false;
    this.aiPortionHint = '';
  }

  estimateWithAi() {
    const foodQuery = this.mealForm.name?.trim();
    if (!foodQuery) {
      this.mealFormError = 'Please enter a food item or meal name first (e.g. "Chicken rice bowl", "2 eggs with toast").';
      return;
    }

    this.isEstimatingAi = true;
    this.mealFormError = '';
    this.aiPortionHint = '';

    this.tracker.getAiNutritionEstimate(foodQuery, this.mealForm.notes).subscribe({
      next: (res) => {
        this.isEstimatingAi = false;
        if (res && res.success) {
          this.mealForm.calories = res.calories;
          this.mealForm.proteinG = res.proteinG;
          this.mealForm.carbsG = res.carbsG;
          this.mealForm.fatG = res.fatG;
          this.mealForm.fiberG = res.fiberG;

          if (res.portion) {
            this.aiPortionHint = `Analyzed portion: ${res.portion}`;
            if (!this.mealForm.notes) {
              this.mealForm.notes = res.portion;
            }
          }
        }
      },
      error: (err) => {
        this.isEstimatingAi = false;
        const msg = err?.error?.error || 'Failed to estimate nutrition from AI. Please check your OpenAI API key.';
        this.mealFormError = msg;
      }
    });
  }

  saveMeal() {
    if (!this.mealForm.name.trim()) {
      this.mealFormError = 'Meal name is required';
      return;
    }
    if (this.mealForm.calories == null || this.mealForm.calories < 0) {
      this.mealFormError = 'Valid calories are required';
      return;
    }

    this.isLoggingMeal = true;
    this.mealFormError = '';

    const payload = {
      name: this.mealForm.name.trim(),
      date: this.currentDateStr,
      mealType: this.mealForm.mealType,
      calories: this.mealForm.calories!,
      proteinG: this.mealForm.proteinG ?? 0,
      carbsG: this.mealForm.carbsG ?? 0,
      fatG: this.mealForm.fatG ?? 0,
      fiberG: this.mealForm.fiberG ?? 0,
      notes: this.mealForm.notes || undefined
    };

    const obs = this.editingMealId
      ? this.tracker.updateMealLog(this.editingMealId, payload)
      : this.tracker.addMealLog(payload);

    obs.subscribe({
      next: () => {
        this.loadDayLogs();
        this.showMealForm = false;
        this.isLoggingMeal = false;
      },
      error: () => {
        this.mealFormError = 'Failed to save meal. Please try again.';
        this.isLoggingMeal = false;
      }
    });
  }

  deleteMeal(id: number) {
    this.tracker.deleteMealLog(id).subscribe({
      next: () => this.loadDayLogs(),
      error: () => {}
    });
  }

  // --- Computed helpers ---
  pct(value: number, target: number): number {
    if (!target) return 0;
    return Math.min(100, Math.round((value / target) * 100));
  }

  remainingCalories(): number {
    return Math.max(0, this.goal.dailyCalories - this.totals.calories);
  }

  overCalories(): boolean {
    return this.totals.calories > this.goal.dailyCalories;
  }

  // Circumference for SVG ring (r=42 => C = 2*PI*42 ≈ 263.9)
  ringOffset(value: number, target: number): number {
    const C = 263.9;
    const pct = Math.min(100, (value / (target || 1)) * 100);
    return C - (C * pct / 100);
  }

  getMealsByType(type: string): MealLog[] {
    return this.mealLogs.filter(m => m.mealType === type);
  }

  getUsedMealTypes(): string[] {
    const used = new Set(this.mealLogs.map(m => m.mealType));
    return this.mealTypes.filter(t => used.has(t));
  }

  getTypeCalories(type: string): number {
    return this.getMealsByType(type).reduce((s, m) => s + (m.calories || 0), 0);
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

