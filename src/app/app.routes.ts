import { Routes } from '@angular/router';
import { authGuard, loginGuard } from '../guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('../componets/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('../componets/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'analytics',
        pathMatch: 'full'
      },
      {
        path: 'home',
        loadComponent: () => import('../componets/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'analytics',
        loadComponent: () => import('../componets/analytics/analytics.component').then(m => m.AnalyticsComponent)
      },
      {
        path: 'productivity',
        loadComponent: () => import('../componets/productivity/productivity.component').then(m => m.ProductivityComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('../componets/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'diet',
        loadComponent: () => import('../componets/diet/diet.component').then(m => m.DietComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];