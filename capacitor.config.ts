import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.discipline.tasktracker',
  appName: 'Discipline Tracker',
  webDir: 'dist/task_tracker/browser',
  server: {
    androidScheme: 'https'
  }
};

export default config;

