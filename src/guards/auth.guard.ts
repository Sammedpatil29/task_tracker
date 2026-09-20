import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

function isJwtValid(token: string | null): boolean {
  if (!token || token.trim() === '') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function clearAuthTokens() {
  localStorage.removeItem('trackJwt');
  sessionStorage.removeItem('trackJwt');
  sessionStorage.removeItem('justLoggedIn');
}

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('trackJwt') || sessionStorage.getItem('trackJwt');

  if (isJwtValid(token)) {
    // Ensure migrated to localStorage
    if (token && !localStorage.getItem('trackJwt')) {
      localStorage.setItem('trackJwt', token);
    }
    return true;
  }

  clearAuthTokens();
  router.navigate(['/login']);
  return false;
};

export const loginGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('trackJwt') || sessionStorage.getItem('trackJwt');

  if (isJwtValid(token)) {
    // Token is valid: immediately let user in without showing login screen
    if (token && !localStorage.getItem('trackJwt')) {
      localStorage.setItem('trackJwt', token);
    }
    router.navigate(['/analytics']);
    return false;
  }

  // Token is invalid/expired/missing: clean up and show login screen
  clearAuthTokens();
  return true;
};

