import { Injectable, inject } from '@angular/core';
import { AlertasService } from '../../alertas/services/alertas.service';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { CajaService } from '../../caja/services/caja.service';
import { ComprasService } from '../../compras/services/compras.service';
import { ConfiguracionService } from '../../configuracion/services/configuracion.service';
import { InventarioService } from '../../inventario/services/inventario.service';
import { ProductosService } from '../../productos/services/productos.service';
import { ProveedoresService } from '../../proveedores/services/proveedores.service';
import { UsuariosService } from '../../usuarios/services/usuarios.service';
import { VentasService } from '../../ventas/services/ventas.service';
import { RespaldoSistema } from '../models/respaldo-sistema';

const STORAGE_KEY = 'bodega-respaldo-ultimo';

@Injectable({
  providedIn: 'root'
})
export class RespaldoService {

  private readonly productosService = inject(ProductosService);
  private readonly ventasService = inject(VentasService);
  private readonly comprasService = inject(ComprasService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly inventarioService = inject(InventarioService);
  private readonly cajaService = inject(CajaService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly configuracionService = inject(ConfiguracionService);
  private readonly alertasService = inject(AlertasService);

  generarRespaldo(usuario: string = 'Sistema', notas: string = 'Respaldo manual del sistema.'): RespaldoSistema {
    return {
      meta: {
        version: '1.0.0',
        generadoEn: new Date().toISOString(),
        generadoPor: usuario,
        aplicacion: 'BodegaSys',
        notas: notas.trim()
      },
      configuracion: this.configuracionService.configuracionLectura(),
      productos: this.productosService.productosLectura(),
      ventas: this.ventasService.ventasLectura(),
      compras: this.comprasService.comprasLectura(),
      proveedores: this.proveedoresService.proveedoresLectura(),
      usuarios: this.usuariosService.usuariosLectura(),
      movimientosInventario: this.inventarioService.movimientosLectura(),
      cajaActiva: this.cajaService.cajaActiva(),
      cierresCaja: this.cajaService.cierres(),
      auditoria: this.auditoriaService.eventosLectura(),
      alertasDescartadas: this.alertasService.descartadas()
    };
  }

  serializar(respaldo: RespaldoSistema): string {
    return JSON.stringify(respaldo, null, 2);
  }

  parsear(raw: string): RespaldoSistema {
    return JSON.parse(raw) as RespaldoSistema;
  }

  descargar(fileName: string, content: string) {
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

  guardarUltimoRespaldo(respaldo: RespaldoSistema) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, this.serializar(respaldo));
    } catch {
      // Ignorar errores de persistencia local
    }
  }

  cargarUltimoRespaldo(): RespaldoSistema | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return this.parsear(raw);
    } catch {
      return null;
    }
  }

  aplicarRespaldo(respaldo: RespaldoSistema) {
    const productosSvc = this.productosService as unknown as { reemplazarProductos?: (items: unknown[]) => void };
    const ventasSvc = this.ventasService as unknown as { reemplazarVentas?: (items: unknown[]) => void };
    const comprasSvc = this.comprasService as unknown as { reemplazarCompras?: (items: unknown[]) => void };
    const proveedoresSvc = this.proveedoresService as unknown as { reemplazarProveedores?: (items: unknown[]) => void };
    const usuariosSvc = this.usuariosService as unknown as { reemplazarUsuarios?: (items: unknown[]) => void };
    const inventarioSvc = this.inventarioService as unknown as { reemplazarMovimientos?: (items: unknown[]) => void };
    const cajaSvc = this.cajaService as unknown as { reemplazarEstado?: (activa: unknown, cierres: unknown[]) => void };

    if (typeof productosSvc.reemplazarProductos === 'function') {
      productosSvc.reemplazarProductos(respaldo.productos);
    }
    if (typeof ventasSvc.reemplazarVentas === 'function') {
      ventasSvc.reemplazarVentas(respaldo.ventas);
    }
    if (typeof comprasSvc.reemplazarCompras === 'function') {
      comprasSvc.reemplazarCompras(respaldo.compras);
    }
    if (typeof proveedoresSvc.reemplazarProveedores === 'function') {
      proveedoresSvc.reemplazarProveedores(respaldo.proveedores);
    }
    if (typeof usuariosSvc.reemplazarUsuarios === 'function') {
      usuariosSvc.reemplazarUsuarios(respaldo.usuarios);
    }
    if (typeof inventarioSvc.reemplazarMovimientos === 'function') {
      inventarioSvc.reemplazarMovimientos(respaldo.movimientosInventario);
    }
    if (typeof cajaSvc.reemplazarEstado === 'function') {
      cajaSvc.reemplazarEstado(respaldo.cajaActiva, respaldo.cierresCaja);
    }

    if (respaldo.configuracion) {
      this.configuracionService.actualizarConfiguracion(respaldo.configuracion);
    }

    this.auditoriaService.reemplazarEventos(respaldo.auditoria ?? []);
    this.alertasService.reemplazarDescartadas(respaldo.alertasDescartadas ?? []);
    this.guardarUltimoRespaldo(respaldo);

    this.auditoriaService.registrar(
      'SISTEMA',
      'RESPALDO_APLICAR',
      'Se aplicó un respaldo del sistema.',
      'SUCCESS',
      respaldo.meta?.generadoEn ?? 'sin_fecha'
    );
  }
}
