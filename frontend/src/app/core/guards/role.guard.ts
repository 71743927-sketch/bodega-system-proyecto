import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const rolesPermitidos = (route.data?.['roles'] as string[] | undefined) ?? [];

  if (!authService.validarSesion()) {
    return router.createUrlTree(['/login']);
  }

  if (rolesPermitidos.length === 0 || authService.tieneRol(rolesPermitidos)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
