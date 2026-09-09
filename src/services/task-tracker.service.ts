import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
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
    const token = sessionStorage.getItem('trackJwt'); 
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get(this.url + 'api/dashboard', { headers });
  }

  updateProfile(data: { name?: string; emoji?: string }) {
    const token = sessionStorage.getItem('trackJwt'); 
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.put(this.url + 'api/user/profile', data, { headers });
  }

  updateHydrationSettings(data: { enabled?: boolean; soundEnabled?: boolean; intervalMinutes?: number }) {
    const token = sessionStorage.getItem('trackJwt'); 
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.put(this.url + 'api/user/hydration', data, { headers });
  }

  addTask(data: any) {
    const token = sessionStorage.getItem('trackJwt'); 
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post(this.url + 'api/tasks', data, { headers });
  }

  toggleTaskStatus(taskId: number) {
    const token = sessionStorage.getItem('trackJwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.patch(this.url + `api/tasks/${taskId}/toggle`, {}, { headers });
  }

  deleteTask(taskId: number) {
    const token = sessionStorage.getItem('trackJwt');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.delete(this.url + `api/tasks/${taskId}`, { headers });
  }

  completions(data: any) {
    const token = sessionStorage.getItem('trackJwt'); 
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.post(this.url + 'api/completions', data, { headers });
  }
}
