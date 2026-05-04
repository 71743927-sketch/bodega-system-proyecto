import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { CajaService } from '../../../caja/services/caja.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { InventarioService } from '../../../inventario/services/inventario.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { VentasService } from '../../../ventas/services/ventas.service';

@Component({
  selector: 'app-reportes-page',
  standalone: true,
  imports: [DatePipe, CurrencyPipe],
  templateUrl: './reportes-page.component.html',
  styleUrl: './reportes-page.component.css'
})
export class ReportesPageComponent {

  private ventasService = inject(VentasService);
  private comprasService = inject(ComprasService);
  private cajaService = inject(CajaService);
  private inventarioService = inject(InventarioService);
  private productosService = inject(ProductosService);
  private usuariosService = inject(UsuariosService);

  ventas = this.ventasService.ventasLectura;
  compras = this.comprasService.comprasLectura;
  cierresCaja = this.cajaService.cierres;
  movimientos = this.inventarioService.movimientosLectura;
  productos = this.productosService.productosLectura;
  usuarios = this.usuariosService.usuariosLectura;

  fechaInicio = signal('');
  fechaFin = signal('');

  private normalizarInicio(fecha: string): number | null {
    if (fecha.trim() === '') {
      return null;
    }

    const d = new Date(fecha + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  private normalizarFin(fecha: string): number | null {
    if (fecha.trim() === '') {
      return null;
    }

    const d = new Date(fecha + 'T23:59:59');
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  private estaEnRango(fechaIso: string): boolean {
    const fechaMs = new Date(fechaIso).getTime();
    const inicio = this.normalizarInicio(this.fechaInicio());
    const fin = this.normalizarFin(this.fechaFin());

    if (inicio !== null && fechaMs < inicio) {
      return false;
    }

    if (fin !== null && fechaMs > fin) {
      return false;
    }

    return true;
  }

  ventasFiltradas = computed(() =>
    this.ventas().filter(venta => this.estaEnRango(venta.fecha))
  );

  comprasFiltradas = computed(() =>
    this.compras().filter(compra => this.estaEnRango(compra.fecha))
  );

  cierresFiltrados = computed(() =>
    this.cierresCaja().filter(cierre => this.estaEnRango(cierre.fechaCierre))
  );

  movimientosFiltrados = computed(() =>
    this.movimientos().filter(mov => this.estaEnRango(mov.fecha))
  );

  totalVentas = computed(() =>
    this.ventasFiltradas().reduce((sum, venta) => sum + venta.total, 0)
  );

  totalCompras = computed(() =>
    this.comprasFiltradas().reduce((sum, compra) => sum + compra.total, 0)
  );

  utilidadAproximada = computed(() => this.totalVentas() - this.totalCompras());

  ticketPromedio = computed(() => {
    const ventas = this.ventasFiltradas();
    if (ventas.length === 0) {
      return 0;
    }
    return this.totalVentas() / ventas.length;
  });

  totalCierres = computed(() => this.cierresFiltrados().length);
  totalMovimientosInventario = computed(() => this.movimientosFiltrados().length);

  stockCritico = computed(() =>
    this.productos().filter(producto => producto.stockActual <= producto.stockMinimo)
  );

  topProductosVendidos = computed(() => {
    const mapa = new Map<number, { nombre: string; cantidad: number }>();

    this.ventasFiltradas().forEach(venta => {
      venta.detalles.forEach(detalle => {
        const actual = mapa.get(detalle.productoId);
        if (actual) {
          actual.cantidad += detalle.cantidad;
        } else {
          mapa.set(detalle.productoId, {
            nombre: detalle.nombre,
            cantidad: detalle.cantidad
          });
        }
      });
    });

    return Array.from(mapa.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);
  });

  ventasPorMetodo = computed(() => {
    const resumen = { EFECTIVO: 0, YAPE: 0, PLIN: 0, TARJETA: 0 };

    this.ventasFiltradas().forEach(venta => {
      resumen[venta.metodoPago] += venta.total;
    });

    return resumen;
  });

  resumenRoles = computed(() => {
    const conteo = {
      DUENO: 0,
      CAJERO: 0,
      ALMACENERO: 0,
      SUPERVISOR: 0
    };

    this.usuarios().forEach(usuario => {
      const rol = String(usuario.rol || '').toUpperCase() as keyof typeof conteo;
      if (rol in conteo) {
        conteo[rol] += 1;
      }
    });

    return conteo;
  });

  actualizarFechaInicio(valor: string) {
    this.fechaInicio.set(valor);
  }

  actualizarFechaFin(valor: string) {
    this.fechaFin.set(valor);
  }

  limpiarFiltros() {
    this.fechaInicio.set('');
    this.fechaFin.set('');
  }

  etiquetaTipoMovimiento(tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE'): string {
    switch (tipo) {
      case 'ENTRADA':
        return 'Entrada';
      case 'SALIDA':
        return 'Salida';
      case 'AJUSTE':
        return 'Ajuste';
      default:
        return tipo;
    }
  }
}


