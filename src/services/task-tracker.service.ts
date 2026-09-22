import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class TaskTrackerService {

  tasks = [
    { id: 1, name: 'Gym', weeklyTarget: 5, enabled: true },
    { id: 2, name: 'Coding', weeklyTarget: 2, enabled: true },
    { id: 3, name: 'Reading', weeklyTarget: 3, enabled: true }
  ];

  url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ===================== TOKEN MANAGEMENT (LOCALSTORAGE) ===================== //

  getToken(): string | null {
    const token = localStorage.getItem('trackJwt') || sessionStorage.getItem('trackJwt');
    if (token && !localStorage.getItem('trackJwt')) {
      localStorage.setItem('trackJwt', token);
    }
    return token;
  }

  setToken(token: string): void {
    if (token) {
      localStorage.setItem('trackJwt', token);
      sessionStorage.setItem('trackJwt', token);
    }
  }

  removeToken(): void {
    localStorage.removeItem('trackJwt');
    sessionStorage.removeItem('trackJwt');
    sessionStorage.removeItem('justLoggedIn');
  }

  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token || token.trim() === '') return false;
    const parts = token.split('.');
    if (parts.length !== 3) {
      this.removeToken();
      return false;
    }
    try {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp * 1000 <= Date.now()) {
        this.removeToken();
        return false;
      }
      return true;
    } catch {
      this.removeToken();
      return false;
    }
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken() || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // key = taskId_date
  store = new Map<string, boolean>();

  today() {
    return new Date();
  }

  isLocked(date: Date) {
    const diff = (this.today().getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 2;
  }

  key(taskId: number, date: string) {
    return `${taskId}_${date}`;
  }

  isCompleted(taskId: number, date: string) {
    return this.store.get(this.key(taskId, date)) ?? false;
  }

  setCompletion(taskId: number, date: string, completed: boolean) {
    this.store.set(this.key(taskId, date), completed);
  }

  clearStore() {
    this.store.clear();
  }

  toggle(taskId: number, date: string) {
    const k = this.key(taskId, date);
    this.store.set(k, !this.store.get(k));
  }

  sendOtp(data: { name: string; email: string; password?: string }) {
    return this.http.post(this.url + 'auth/send-otp', data);
  }

  resendOtp(data: { name?: string; email: string }) {
    return this.http.post(this.url + 'auth/resend-otp', data);
  }

  registerUser(data: { name: string; email: string; password: string; emoji: string; otp: string }) {
    return this.http.post(this.url + 'auth/register', data);
  }

  loginUser(data: any) {
    return this.http.post(this.url + 'auth/login', data);
  }

  forgotPassword(email: string) {
    return this.http.post(this.url + 'auth/forgot-password', { email });
  }

  resetPassword(data: { email: string; otp: string; newPassword: string }) {
    return this.http.post(this.url + 'auth/reset-password', data);
  }

  getDashboard() {
    const headers = this.getAuthHeaders();
    return this.http.get(this.url + 'api/dashboard', { headers });
  }

  updateProfile(data: { name?: string; emoji?: string }) {
    const headers = this.getAuthHeaders();
    return this.http.put(this.url + 'api/user/profile', data, { headers });
  }

  updateHydrationSettings(data: { enabled?: boolean; soundEnabled?: boolean; intervalMinutes?: number }) {
    const headers = this.getAuthHeaders();
    return this.http.put(this.url + 'api/user/hydration', data, { headers });
  }

  addTask(data: any) {
    const headers = this.getAuthHeaders();
    return this.http.post(this.url + 'api/tasks', data, { headers });
  }

  toggleTaskStatus(taskId: number) {
    const headers = this.getAuthHeaders();
    return this.http.patch(this.url + `api/tasks/${taskId}/toggle`, {}, { headers });
  }

  deleteTask(taskId: number) {
    const headers = this.getAuthHeaders();
    return this.http.delete(this.url + `api/tasks/${taskId}`, { headers });
  }

  completions(data: any) {
    const headers = this.getAuthHeaders();
    return this.http.post(this.url + 'api/completions', data, { headers });
  }

  // ===================== PRODUCTIVITY TRACKER ===================== //

  getProductivityCategories() {
    const headers = this.getAuthHeaders();
    return this.http.get(this.url + 'api/productivity/categories', { headers });
  }

  saveProductivityCategories(categories: any[]) {
    const headers = this.getAuthHeaders();
    return this.http.post(this.url + 'api/productivity/categories/bulk', { categories }, { headers });
  }

  getActivityLogs(params: string | { startDate: string; endDate: string }) {
    const headers = this.getAuthHeaders();
    const query = typeof params === 'string'
      ? `date=${params}`
      : `startDate=${params.startDate}&endDate=${params.endDate}`;
    return this.http.get(this.url + `api/productivity/logs?${query}`, { headers });
  }

  addActivityLog(data: { title: string; date: string; startTime: string; endTime: string; categoryId: number | null }) {
    const headers = this.getAuthHeaders();
    return this.http.post(this.url + 'api/productivity/logs', data, { headers });
  }

  deleteActivityLog(id: number) {
    const headers = this.getAuthHeaders();
    return this.http.delete(this.url + `api/productivity/logs/${id}`, { headers });
  }

  // ===================== DIET TRACKER ===================== //

  getDietGoal() {
    const headers = this.getAuthHeaders();
    return this.http.get(this.url + 'api/diet/goal', { headers });
  }

  saveDietGoal(goal: {
    dailyCalories: number; proteinG: number; carbsG: number;
    fatG: number; fiberG: number; waterMl: number;
  }) {
    if (goal.waterMl) this.waterGoal$.next(goal.waterMl);
    const headers = this.getAuthHeaders();
    return this.http.post(this.url + 'api/diet/goal', goal, { headers });
  }

  getMealLogs(params: string | { startDate: string; endDate: string }) {
    const headers = this.getAuthHeaders();
    const query = typeof params === 'string'
      ? `date=${params}`
      : `startDate=${params.startDate}&endDate=${params.endDate}`;
    return this.http.get<any[]>(this.url + `api/diet/logs?${query}`, { headers });
  }

  addMealLog(data: {
    name: string; date: string; mealType: string;
    calories: number; proteinG?: number; carbsG?: number;
    fatG?: number; fiberG?: number; notes?: string;
  }) {
    const headers = this.getAuthHeaders();
    return this.http.post(this.url + 'api/diet/logs', data, { headers });
  }

  updateMealLog(id: number, data: any) {
    const headers = this.getAuthHeaders();
    return this.http.put(this.url + `api/diet/logs/${id}`, data, { headers });
  }

  deleteMealLog(id: number) {
    const headers = this.getAuthHeaders();
    return this.http.delete(this.url + `api/diet/logs/${id}`, { headers });
  }

  getDietSummary(startDate: string, endDate: string) {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(this.url + `api/diet/summary?startDate=${startDate}&endDate=${endDate}`, { headers });
  }

  // --- Water Tracking Shared State (Top Bar & Diet Tracker) ---
  todayWater$ = new BehaviorSubject<number>(0);
  waterGoal$ = new BehaviorSubject<number>(2500);
  isWaterUpdating$ = new BehaviorSubject<boolean>(false);

  getTodayDateStr(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  loadTodayWater() {
    const token = this.getToken();
    if (!token) return;
    const today = this.getTodayDateStr();
    this.getWaterLog(today).subscribe({
      next: (res) => this.todayWater$.next(res?.amountMl || 0),
      error: () => {}
    });
    this.getDietGoal().subscribe({
      next: (g: any) => {
        if (g?.waterMl) this.waterGoal$.next(g.waterMl);
      },
      error: () => {}
    });
  }

  quickAddTodayWater(delta: number) {
    if (this.isWaterUpdating$.value) return;
    this.isWaterUpdating$.next(true);
    const today = this.getTodayDateStr();
    const current = this.todayWater$.value;
    const nextVal = Math.max(0, current + delta);
    this.todayWater$.next(nextVal);
    this.updateWaterLog({ date: today, delta }).subscribe({
      next: (res) => {
        if (res && res.amountMl !== undefined) {
          this.todayWater$.next(res.amountMl);
        }
        this.isWaterUpdating$.next(false);
      },
      error: () => {
        this.todayWater$.next(current);
        this.isWaterUpdating$.next(false);
      }
    });
  }

  getWaterLog(date: string) {
    const headers = this.getAuthHeaders();
    return this.http.get<{ date: string; amountMl: number }>(this.url + `api/diet/water?date=${date}`, { headers });
  }

  updateWaterLog(payload: { date: string; delta?: number; amountMl?: number }) {
    const headers = this.getAuthHeaders();
    return this.http.post<{ date: string; amountMl: number }>(this.url + 'api/diet/water', payload, { headers })
      .pipe(
        tap((res) => {
          if (payload.date === this.getTodayDateStr() && res && res.amountMl !== undefined) {
            this.todayWater$.next(res.amountMl);
          }
        })
      );
  }

  // ===================== AI NUTRITION ESTIMATION ===================== //

  getAiNutritionEstimate(foodQuery: string, notes?: string) {
    const headers = this.getAuthHeaders();
    return this.http.post<{
      success: boolean;
      foodName: string;
      portion: string;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      fiberG: number;
      confidence?: string;
      summary?: string;
    }>(this.url + 'api/diet/ai-nutrition', { foodQuery, notes }, { headers });
  }
}

