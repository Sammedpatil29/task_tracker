import { TestBed } from '@angular/core/testing';

import { TaskTrackerService } from './task-tracker.service';

describe('TaskTrackerService', () => {
  let service: TaskTrackerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TaskTrackerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
