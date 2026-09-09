import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = sessionStorage.getItem('trackJwt');

  if (!token || token.trim() === '') {
    router.navigate(['/login']);
    return false;
  }

  // Basic JWT structure validation (header.payload.signature)
  const parts = token.split('.');
  if (parts.length !== 3) {
    sessionStorage.removeItem('trackJwt');
    router.navigate(['/login']);
    return false;
  }

  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem('trackJwt');
      router.navigate(['/login']);
      return false;
    }
  } catch {
    // Malformed token
    sessionStorage.removeItem('trackJwt');
    router.navigate(['/login']);
    return false;
  }

  return true;
};

export const loginGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = sessionStorage.getItem('trackJwt');

  if (token && token.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp || payload.exp * 1000 > Date.now()) {
        router.navigate(['/analytics']);
        return false;
      }
    } catch {
      // ignore
    }
  }

  return true;
};

