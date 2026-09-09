import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskTrackerService } from '../../services/task-tracker.service';
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-analytics',
  imports: [CommonModule, LoaderComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit {
  isLoading: boolean = true;
  tasks: any[] = [];
  completions: any[] = [];
  totalCompletions: number = 0;

  constructor(public tracker: TaskTrackerService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.tracker.getDashboard().subscribe({
      next: (res: any) => {
        this.tasks = res.tasks || [];
        this.completions = res.completions || [];
        this.totalCompletions = this.completions.filter((c: any) => c.completed).length;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }
}

