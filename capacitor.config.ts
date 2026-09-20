import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.discipline.tasktracker',
  appName: 'Discipline Tracker',
  webDir: 'dist/task_tracker/browser',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    OtaKit: {
      appId: 'com.discipline.tasktracker',
      cdnUrl: 'https://discipline-tracker-backend-xckgge-ddd24d-203-57-85-153.sslip.io/ota',
      allowInsecureUrls: true,
      appReadyTimeout: 30000,
      autoDeleteFailedBundles: true
    }
  }
};

export default config;

