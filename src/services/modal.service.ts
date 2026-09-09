import { Injectable } from '@angular/core';

export interface ModalConfig {
  type: 'alert' | 'confirm' | 'add-task';
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  taskName?: string;
  taskTarget?: number;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  isOpen: boolean = false;
  config: ModalConfig = {
    type: 'alert',
    title: ''
  };

  private resolveCallback: ((result: any) => void) | null = null;

  alert(title: string, message: string): Promise<void> {
    return new Promise((resolve) => {
      this.config = {
        type: 'alert',
        title,
        message,
        confirmText: 'Got it'
      };
      this.isOpen = true;
      this.resolveCallback = () => resolve();
    });
  }

  confirm(title: string, message: string, confirmText = 'Confirm', isDestructive = false): Promise<boolean> {
    return new Promise((resolve) => {
      this.config = {
        type: 'confirm',
        title,
        message,
        confirmText,
        cancelText: 'Cancel',
        isDestructive
      };
      this.isOpen = true;
      this.resolveCallback = (val: boolean) => resolve(val);
    });
  }

  openAddTask(): Promise<{ name: string; weeklyTarget: number } | null> {
    return new Promise((resolve) => {
      this.config = {
        type: 'add-task',
        title: '➕ Add New Habit',
        message: 'Create a habit and commit to your weekly target.',
        taskName: '',
        taskTarget: 3,
        confirmText: 'Create Habit',
        cancelText: 'Cancel'
      };
      this.isOpen = true;
      this.resolveCallback = (val: any) => resolve(val);
    });
  }

  handleConfirm() {
    if (this.config.type === 'add-task') {
      if (!this.config.taskName || !this.config.taskName.trim()) {
        return;
      }
      const data = {
        name: this.config.taskName.trim(),
        weeklyTarget: Number(this.config.taskTarget) || 3
      };
      this.close(data);
    } else {
      this.close(true);
    }
  }

  handleCancel() {
    this.close(false);
  }

  private close(result: any) {
    this.isOpen = false;
    if (this.resolveCallback) {
      this.resolveCallback(result);
      this.resolveCallback = null;
    }
  }
}

