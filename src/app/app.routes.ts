import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  
  {
    path: 'login',
    loadComponent: () => import('../componets/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('../componets/home/home.component').then(m => m.HomeComponent)
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];