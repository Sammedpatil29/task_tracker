import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TaskTrackerService {

  tasks = [
    { id: 1, name: 'Gym', weeklyTarget: 5, enabled: true },
    { id: 2, name: 'Coding', weeklyTarget: 2, enabled: true },
    { id: 3, name: 'Reading', weeklyTarget: 3, enabled: true }
  ];

  url = 'https://task-tracker-backend-gb0d.onrender.com/';

  constructor(private http: HttpClient) {}

  // key = taskId_date
  private store = new Map<string, boolean>();

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

  toggle(taskId: number, date: string) {
    const k = this.key(taskId, date);
    this.store.set(k, !this.store.get(k));
  }

  registerUser(data: any) {
    return this.http.post(this.url + 'auth/register', data);
  }

  loginUser(data: any) {
    return this.http.post(this.url + 'auth/login', data);
  }

  getDashboard() {
  // Get the token from wherever you stored it (usually localStorage)
  const token = sessionStorage.getItem('trackJwt'); 

  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`
  });

  return this.http.get(this.url + 'api/dashboard', { headers });
}

addTask(data:any){
  const token = sessionStorage.getItem('trackJwt'); 
console.log(token)
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`
  });

  return this.http.post(this.url + 'api/tasks', data, { headers },);
}

completions(data:any){
  const token = sessionStorage.getItem('trackJwt'); 
console.log(token)
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`
  });

  return this.http.post(this.url + 'api/completions', data, { headers },);
}
}
