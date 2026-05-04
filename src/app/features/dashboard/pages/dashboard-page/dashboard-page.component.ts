import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { CajaService } from '../../../caja/services/caja.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { InventarioService } from '../../../inventario/services/inventario.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { VentasService } from '../../../ventas/services/ventas.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [DatePipe, CurrencyPipe],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css'
})
export class DashboardPageComponent {

  private productosService = inject(ProductosService);
  private ventasService = inject(VentasService);
  private cajaService = inject(CajaService);
  private inventarioService = inject(InventarioService);
  private comprasService = inject(ComprasService);
  private usuariosService = inject(UsuariosService);

  productos = this.productosService.productosLectura;
  ventas = this.ventasService.ventasLectura;
  cajaActiva = this.cajaService.cajaActiva;
  cierresCaja = this.cajaService.cierres;
  movimientosInventario = this.inventarioService.movimientosLectura;
  compras = this.comprasService.comprasLectura;
  usuarios = this.usuariosService.usuariosLectura;

  productosActivos = computed(() => this.productos().filter(p => p.activo));
  productosStockBajo = computed(() => this.productos().filter(p => p.stockActual > 0 && p.stockActual <= p.stockMinimo));
  productosAgotados = computed(() => this.productos().filter(p => p.stockActual === 0));
  usuariosActivos = computed(() => this.usuarios().filter(u => u.activo));

  ventasHoy = computed(() => {
    const hoy = new Date();
    return this.ventas().filter(venta => {
      const fecha = new Date(venta.fecha);
      return (
        fecha.getFullYear() === hoy.getFullYear() &&
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getDate() === hoy.getDate()
      );
    });
  });

  comprasHoy = computed(() => {
    const hoy = new Date();
    return this.compras().filter(compra => {
      const fecha = new Date(compra.fecha);
      return (
        fecha.getFullYear() === hoy.getFullYear() &&
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getDate() === hoy.getDate()
      );
    });
  });

  totalVentasHoy = computed(() => this.ventasHoy().reduce((sum, venta) => sum + venta.total, 0));
  totalComprasHoy = computed(() => this.comprasHoy().reduce((sum, compra) => sum + compra.total, 0));
  totalVentasGeneral = computed(() => this.ventas().reduce((sum, venta) => sum + venta.total, 0));
  totalComprasGeneral = computed(() => this.compras().reduce((sum, compra) => sum + compra.total, 0));

  utilidadBrutaAprox = computed(() => this.totalVentasGeneral() - this.totalComprasGeneral());

  ticketPromedioHoy = computed(() => {
    const ventasHoy = this.ventasHoy();
    if (ventasHoy.length === 0) {
      return 0;
    }
    return this.totalVentasHoy() / ventasHoy.length;
  });

  cajaResumen = computed(() => {
    const activa = this.cajaActiva();

    if (!activa) {
      return {
        abierta: false,
        montoInicial: 0,
        saldoEsperado: 0,
        ingresosManual: 0,
        egresosManual: 0,
        ventasEfectivo: 0
      };
    }

    const aperturaMs = new Date(activa.fechaApertura).getTime();
    const ventasEfectivo = this.ventas()
      .filter(venta => venta.metodoPago === 'EFECTIVO' && new Date(venta.fecha).getTime() >= aperturaMs)
      .reduce((sum, venta) => sum + venta.total, 0);

    const ingresosManual = activa.movimientos
      .filter((mov: any) => mov.tipo === 'INGRESO')
      .reduce((sum: number, mov: any) => sum + mov.monto, 0);

    const egresosManual = activa.movimientos
      .filter((mov: any) => mov.tipo === 'EGRESO')
      .reduce((sum: number, mov: any) => sum + mov.monto, 0);

    return {
      abierta: true,
      montoInicial: activa.montoInicial,
      saldoEsperado: activa.montoInicial + ventasEfectivo + ingresosManual - egresosManual,
      ingresosManual,
      egresosManual,
      ventasEfectivo
    };
  });

  ultimasVentas = computed(() => this.ventas().slice(0, 5));
  ultimasCompras = computed(() => this.compras().slice(0, 5));
  ultimosMovimientos = computed(() => this.movimientosInventario().slice(0, 6));
  ultimosCierres = computed(() => this.cierresCaja().slice(0, 4));

  topProductosVendidos = computed(() => {
    const mapa = new Map<number, { nombre: string; cantidad: number }>();

    this.ventas().forEach(venta => {
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
      .slice(0, 5);
  });

  conteoPorRol = computed(() => {
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

  etiquetaRol(rol: 'DUENO' | 'CAJERO' | 'ALMACENERO' | 'SUPERVISOR'): string {
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
        return rol;
    }
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



