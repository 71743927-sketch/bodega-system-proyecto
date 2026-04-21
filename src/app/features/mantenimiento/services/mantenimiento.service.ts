import { Injectable, inject } from '@angular/core';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { ConfiguracionService } from '../../configuracion/services/configuracion.service';

const STORAGE_KEYS = {
  productos: 'bodega-productos',
  ventas: 'bodega-ventas',
  compras: 'bodega-compras',
  cajaActiva: 'bodega-caja-activa',
  cierresCaja: 'bodega-caja-cierres',
  inventario: 'bodega-inventario',
  usuarios: 'bodega-usuarios',
  proveedores: 'bodega-proveedores',
  configuracion: 'bodega-config-general',
  auditoria: 'bodega-auditoria',
  alertasDescartadas: 'bodega-alertas-descartadas',
  respaldoUltimo: 'bodega-respaldo-ultimo'
} as const;

@Injectable({
  providedIn: 'root'
})
export class MantenimientoService {

  private readonly auditoriaService = inject(AuditoriaService);
  private readonly configuracionService = inject(ConfiguracionService);

  obtenerGrupos() {
    return {
      operaciones: [
        STORAGE_KEYS.ventas,
        STORAGE_KEYS.compras,
        STORAGE_KEYS.cajaActiva,
        STORAGE_KEYS.cierresCaja,
        STORAGE_KEYS.inventario
      ],
      catalogos: [
        STORAGE_KEYS.productos,
        STORAGE_KEYS.usuarios,
        STORAGE_KEYS.proveedores
      ],
      trazabilidad: [
        STORAGE_KEYS.auditoria,
        STORAGE_KEYS.alertasDescartadas,
        STORAGE_KEYS.respaldoUltimo
      ],
      totalSinConfig: [
        STORAGE_KEYS.productos,
        STORAGE_KEYS.ventas,
        STORAGE_KEYS.compras,
        STORAGE_KEYS.cajaActiva,
        STORAGE_KEYS.cierresCaja,
        STORAGE_KEYS.inventario,
        STORAGE_KEYS.usuarios,
        STORAGE_KEYS.proveedores,
        STORAGE_KEYS.auditoria,
        STORAGE_KEYS.alertasDescartadas,
        STORAGE_KEYS.respaldoUltimo
      ],
      totalConConfig: [
        STORAGE_KEYS.productos,
        STORAGE_KEYS.ventas,
        STORAGE_KEYS.compras,
        STORAGE_KEYS.cajaActiva,
        STORAGE_KEYS.cierresCaja,
        STORAGE_KEYS.inventario,
        STORAGE_KEYS.usuarios,
        STORAGE_KEYS.proveedores,
        STORAGE_KEYS.auditoria,
        STORAGE_KEYS.alertasDescartadas,
        STORAGE_KEYS.respaldoUltimo,
        STORAGE_KEYS.configuracion
      ]
    };
  }

  limpiarOperaciones() {
    this.removerClaves(this.obtenerGrupos().operaciones);
    this.auditoriaService.registrar(
      'SISTEMA',
      'MANTENIMIENTO_LIMPIAR_OPERACIONES',
      'Se limpiaron ventas, compras, caja e inventario persistidos.',
      'WARNING'
    );
  }

  restablecerCatalogosBase() {
    this.removerClaves(this.obtenerGrupos().catalogos);
    this.auditoriaService.registrar(
      'SISTEMA',
      'MANTENIMIENTO_RESTABLECER_CATALOGOS',
      'Se restablecieron los catálogos base persistidos.',
      'WARNING'
    );
  }

  limpiarAuditoriaYAlertas() {
    this.removerClaves(this.obtenerGrupos().trazabilidad);
    this.auditoriaService.registrar(
      'SISTEMA',
      'MANTENIMIENTO_LIMPIAR_TRAZABILIDAD',
      'Se limpió auditoría, descartes de alertas y cache de respaldo.',
      'WARNING'
    );
  }

  reiniciarSistemaManteniendoConfiguracion() {
    this.removerClaves(this.obtenerGrupos().totalSinConfig);
    this.auditoriaService.registrar(
      'SISTEMA',
      'MANTENIMIENTO_REINICIO_CONTROLADO',
      'Se reinició el sistema manteniendo configuración general.',
      'WARNING',
      `Zona horaria: ${this.configuracionService.configuracionLectura().zonaHoraria}`
    );
  }

  reiniciarTodoSistema() {
    this.removerClaves(this.obtenerGrupos().totalConConfig);
    this.auditoriaService.registrar(
      'SISTEMA',
      'MANTENIMIENTO_REINICIO_TOTAL',
      'Se reinició el sistema y se eliminó la configuración persistida.',
      'DANGER'
    );
  }

  exportarDiagnostico(fileName: string, content: string) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      return;
    }

    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  private removerClaves(keys: string[]) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      keys.forEach(key => localStorage.removeItem(key));
    } catch {
      // Ignorar errores de persistencia local
    }
  }
}
