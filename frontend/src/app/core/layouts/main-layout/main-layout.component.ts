import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../features/auth/services/auth.service';
import { RolUsuario } from '../../../features/usuarios/models/usuario';

type MenuItem = {
  label: string;
  path: string;
  roles: RolUsuario[];
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent implements OnInit, OnDestroy {

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly activityHandler = () => this.authService.renovarActividad();
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private readonly activityEvents = ['click', 'keydown', 'mousemove', 'scroll'];

  sesion = this.authService.sesion;
  nombreActual = this.authService.nombreActual;
  rolActual = this.authService.rolActual;

  menuItems: MenuItem[] = [
    { label: 'Dashboard', path: '/dashboard', roles: ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Checklist', path: '/checklist', roles: ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Cierre diario', path: '/cierre-diario', roles: ['DUENO', 'CAJERO', 'SUPERVISOR'] },
    { label: 'Reposición', path: '/reposicion', roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Alertas', path: '/alertas', roles: ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Seguridad', path: '/seguridad', roles: ['DUENO', 'SUPERVISOR'] },
    { label: 'Analítica', path: '/analitica', roles: ['DUENO', 'SUPERVISOR'] },
    { label: 'Calidad', path: '/calidad', roles: ['DUENO', 'SUPERVISOR'] },
    { label: 'Mantenimiento', path: '/mantenimiento', roles: ['DUENO'] },
    { label: 'Productos', path: '/productos', roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Inventario', path: '/inventario', roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Ventas', path: '/ventas', roles: ['DUENO', 'CAJERO', 'SUPERVISOR'] },
    { label: 'Compras', path: '/compras', roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Caja', path: '/caja', roles: ['DUENO', 'CAJERO', 'SUPERVISOR'] },
    { label: 'Proveedores', path: '/proveedores', roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Comprobantes', path: '/comprobantes', roles: ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'] },
    { label: 'Exportación', path: '/exportaciones', roles: ['DUENO', 'SUPERVISOR'] },
    { label: 'Respaldo', path: '/respaldo', roles: ['DUENO'] },
    { label: 'Configuración', path: '/configuracion', roles: ['DUENO'] },
    { label: 'Usuarios', path: '/usuarios', roles: ['DUENO'] },
    { label: 'Reportes', path: '/reportes', roles: ['DUENO', 'SUPERVISOR'] },
    { label: 'Auditoría', path: '/auditoria', roles: ['DUENO', 'SUPERVISOR'] }
  ];

  menuFiltrado = computed(() => {
    const rol = this.rolActual();
    if (!rol) {
      return [];
    }

    return this.menuItems.filter(item => item.roles.includes(rol));
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.activityEvents.forEach(eventName => {
        window.addEventListener(eventName, this.activityHandler, { passive: true });
      });

      this.heartbeatId = setInterval(() => {
        if (!this.authService.validarSesion()) {
          this.router.navigateByUrl('/login');
        }
      }, 10000);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      this.activityEvents.forEach(eventName => {
        window.removeEventListener(eventName, this.activityHandler);
      });
    }

    if (this.heartbeatId) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
  }

  etiquetaRol(rol: RolUsuario | null): string {
    switch (rol) {
      case 'DUENO':
        return 'Dueño';
      case 'CAJERO':
        return 'Cajero';
      case 'ALMACENERO':
        return 'Almacenero';
      case 'SUPERVISOR':
        return 'Supervisor';
      default:
        return 'Invitado';
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
