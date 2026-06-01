import { BackendTestPageComponent } from './features/backend-test/pages/backend-test-page/backend-test-page.component';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { MainLayoutComponent } from './core/layouts/main-layout/main-layout.component';
import { AlertasPageComponent } from './features/alertas/pages/alertas-page/alertas-page.component';
import { AnaliticaPageComponent } from './features/analitica/pages/analitica-page/analitica-page.component';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { AuditoriaPageComponent } from './features/auditoria/pages/auditoria-page/auditoria-page.component';
import { CajaPageComponent } from './features/caja/pages/caja-page/caja-page.component';
import { CalidadPageComponent } from './features/calidad/pages/calidad-page/calidad-page.component';
import { ChecklistPageComponent } from './features/checklist/pages/checklist-page/checklist-page.component';
import { CierreDiarioPageComponent } from './features/cierre-diario/pages/cierre-diario-page/cierre-diario-page.component';
import { ComprobantesPageComponent } from './features/comprobantes/pages/comprobantes-page/comprobantes-page.component';
import { ComprasPageComponent } from './features/compras/pages/compras-page/compras-page.component';
import { ConfiguracionPageComponent } from './features/configuracion/pages/configuracion-page/configuracion-page.component';
import { DashboardPageComponent } from './features/dashboard/pages/dashboard-page/dashboard-page.component';
import { ExportacionesPageComponent } from './features/exportaciones/pages/exportaciones-page/exportaciones-page.component';
import { InventarioPageComponent } from './features/inventario/pages/inventario-page/inventario-page.component';
import { MantenimientoPageComponent } from './features/mantenimiento/pages/mantenimiento-page/mantenimiento-page.component';
import { ProductosPageComponent } from './features/productos/pages/productos-page/productos-page.component';
import { ProveedoresPageComponent } from './features/proveedores/pages/proveedores-page/proveedores-page.component';
import { ReposicionPageComponent } from './features/reposicion/pages/reposicion-page/reposicion-page.component';
import { ReportesPageComponent } from './features/reportes/pages/reportes-page/reportes-page.component';
import { RespaldoPageComponent } from './features/respaldo/pages/respaldo-page/respaldo-page.component';
import { SeguridadPageComponent } from './features/seguridad/pages/seguridad-page/seguridad-page.component';
import { UsuariosPageComponent } from './features/usuarios/pages/usuarios-page/usuarios-page.component';
import { VentasPageComponent } from './features/ventas/pages/ventas-page/ventas-page.component';

export const routes: Routes = [
  { path: 'backend-test', component: BackendTestPageComponent },
  {
    path: 'login',
    component: LoginPageComponent
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardPageComponent },
      {
        path: 'checklist',
        component: ChecklistPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'] }
      },
      {
        path: 'cierre-diario',
        component: CierreDiarioPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'CAJERO', 'SUPERVISOR'] }
      },
      {
        path: 'reposicion',
        component: ReposicionPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] }
      },
      {
        path: 'alertas',
        component: AlertasPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'] }
      },
      {
        path: 'seguridad',
        component: SeguridadPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'SUPERVISOR'] }
      },
      {
        path: 'analitica',
        component: AnaliticaPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'SUPERVISOR'] }
      },
      {
        path: 'calidad',
        component: CalidadPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'SUPERVISOR'] }
      },
      {
        path: 'mantenimiento',
        component: MantenimientoPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO'] }
      },
      {
        path: 'productos',
        component: ProductosPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] }
      },
      {
        path: 'inventario',
        component: InventarioPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] }
      },
      {
        path: 'ventas',
        component: VentasPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'CAJERO', 'SUPERVISOR'] }
      },
      {
        path: 'compras',
        component: ComprasPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] }
      },
      {
        path: 'caja',
        component: CajaPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'CAJERO', 'SUPERVISOR'] }
      },
      {
        path: 'proveedores',
        component: ProveedoresPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'ALMACENERO', 'SUPERVISOR'] }
      },
      {
        path: 'comprobantes',
        component: ComprobantesPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'] }
      },
      {
        path: 'exportaciones',
        component: ExportacionesPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'SUPERVISOR'] }
      },
      {
        path: 'respaldo',
        component: RespaldoPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO'] }
      },
      {
        path: 'configuracion',
        component: ConfiguracionPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO'] }
      },
      {
        path: 'usuarios',
        component: UsuariosPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO'] }
      },
      {
        path: 'reportes',
        component: ReportesPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'SUPERVISOR'] }
      },
      {
        path: 'auditoria',
        component: AuditoriaPageComponent,
        canActivate: [roleGuard],
        data: { roles: ['DUENO', 'SUPERVISOR'] }
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];

