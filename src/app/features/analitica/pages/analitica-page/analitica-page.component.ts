import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../../auditoria/services/auditoria.service';
import { CajaService } from '../../../caja/services/caja.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { VentasService } from '../../../ventas/services/ventas.service';

type MetodoPagoResumen = {
  nombre: string;
  total: number;
  porcentaje: number;
};

type SerieTemporal = {
  fecha: string;
  ventas: number;
  compras: number;
  balance: number;
};

type TopProducto = {
  nombre: string;
  unidades: number;
  ingreso: number;
};

type CategoriaCritica = {
  categoria: string;
  cantidad: number;
  porcentaje: number;
};

type RolResumen = {
  rol: string;
  cantidad: number;
};

@Component({
  selector: 'app-analitica-page',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, DecimalPipe],
  templateUrl: './analitica-page.component.html',
  styleUrl: './analitica-page.component.css'
})
export class AnaliticaPageComponent {

  private readonly ventasService = inject(VentasService);
  private readonly comprasService = inject(ComprasService);
  private readonly productosService = inject(ProductosService);
  private readonly cajaService = inject(CajaService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly usuariosService = inject(UsuariosService);

  ventas = this.ventasService.ventasLectura;
  compras = this.comprasService.comprasLectura;
  productos = this.productosService.productosLectura;
  cierresCaja = this.cajaService.cierres;
  eventosAuditoria = this.auditoriaService.eventosLectura;
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
    this.ventas().filter(item => this.estaEnRango(item.fecha))
  );

  comprasFiltradas = computed(() =>
    this.compras().filter(item => this.estaEnRango(item.fecha))
  );

  cierresFiltrados = computed(() =>
    this.cierresCaja().filter(item => this.estaEnRango(item.fechaCierre))
  );

  eventosFiltrados = computed(() =>
    this.eventosAuditoria().filter(item => this.estaEnRango(item.fecha))
  );

  ingresosVentas = computed(() =>
    this.ventasFiltradas().reduce((sum, item) => sum + item.total, 0)
  );

  egresosCompras = computed(() =>
    this.comprasFiltradas().reduce((sum, item) => sum + item.total, 0)
  );

  utilidadEstimada = computed(() => this.ingresosVentas() - this.egresosCompras());

  ticketPromedio = computed(() => {
    const ventas = this.ventasFiltradas();
    return ventas.length === 0 ? 0 : this.ingresosVentas() / ventas.length;
  });

  unidadesVendidas = computed(() =>
    this.ventasFiltradas().reduce(
      (sum, venta) => sum + venta.detalles.reduce((sub, detalle) => sub + detalle.cantidad, 0),
      0
    )
  );

  rotacionSimple = computed(() => {
    const productosActivos = this.productos().filter(item => item.activo).length;
    return productosActivos === 0 ? 0 : this.unidadesVendidas() / productosActivos;
  });

  margenEstimadoPorcentaje = computed(() => {
    const ventas = this.ingresosVentas();
    return ventas === 0 ? 0 : (this.utilidadEstimada() / ventas) * 100;
  });

  usuariosActivos = computed(() => this.usuarios().filter(item => item.activo).length);
  usuariosInactivos = computed(() => this.usuarios().filter(item => !item.activo).length);

  eventosCriticos = computed(() =>
    this.eventosFiltrados().filter(item => item.nivel === 'DANGER').length
  );

  warningsAuditoria = computed(() =>
    this.eventosFiltrados().filter(item => item.nivel === 'WARNING').length
  );

  promedioDiferenciaCaja = computed(() => {
    const cierres = this.cierresFiltrados();
    if (cierres.length === 0) {
      return 0;
    }

    const total = cierres.reduce((sum, item) => sum + item.diferencia, 0);
    return total / cierres.length;
  });

  resumenMetodosPago = computed<MetodoPagoResumen[]>(() => {
    const total = this.ingresosVentas();
    const mapa = new Map<string, number>();

    this.ventasFiltradas().forEach(venta => {
      mapa.set(venta.metodoPago, (mapa.get(venta.metodoPago) ?? 0) + venta.total);
    });

    return Array.from(mapa.entries())
      .map(([nombre, monto]) => ({
        nombre,
        total: monto,
        porcentaje: total === 0 ? 0 : (monto / total) * 100
      }))
      .sort((a, b) => b.total - a.total);
  });

  serieTemporal = computed<SerieTemporal[]>(() => {
    const mapa = new Map<string, SerieTemporal>();

    this.ventasFiltradas().forEach(item => {
      const fecha = item.fecha.slice(0, 10);
      const actual = mapa.get(fecha) ?? { fecha, ventas: 0, compras: 0, balance: 0 };
      actual.ventas += item.total;
      actual.balance += item.total;
      mapa.set(fecha, actual);
    });

    this.comprasFiltradas().forEach(item => {
      const fecha = item.fecha.slice(0, 10);
      const actual = mapa.get(fecha) ?? { fecha, ventas: 0, compras: 0, balance: 0 };
      actual.compras += item.total;
      actual.balance -= item.total;
      mapa.set(fecha, actual);
    });

    return Array.from(mapa.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-12);
  });

  topProductos = computed<TopProducto[]>(() => {
    const mapa = new Map<string, TopProducto>();

    this.ventasFiltradas().forEach(venta => {
      venta.detalles.forEach(detalle => {
        const actual = mapa.get(detalle.nombre) ?? {
          nombre: detalle.nombre,
          unidades: 0,
          ingreso: 0
        };

        actual.unidades += detalle.cantidad;
        actual.ingreso += detalle.subtotal;
        mapa.set(detalle.nombre, actual);
      });
    });

    return Array.from(mapa.values())
      .sort((a, b) => b.ingreso - a.ingreso)
      .slice(0, 8);
  });

  categoriasCriticas = computed<CategoriaCritica[]>(() => {
    const criticos = this.productos().filter(item => item.stockActual <= item.stockMinimo);
    const total = criticos.length;
    const mapa = new Map<string, number>();

    criticos.forEach(item => {
      mapa.set(item.categoria, (mapa.get(item.categoria) ?? 0) + 1);
    });

    return Array.from(mapa.entries())
      .map(([categoria, cantidad]) => ({
        categoria,
        cantidad,
        porcentaje: total === 0 ? 0 : (cantidad / total) * 100
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  });

  resumenRoles = computed<RolResumen[]>(() => {
    const mapa = new Map<string, number>();

    this.usuarios().forEach(item => {
      mapa.set(item.rol, (mapa.get(item.rol) ?? 0) + 1);
    });

    return Array.from(mapa.entries()).map(([rol, cantidad]) => ({ rol, cantidad }));
  });

  saludOperacion = computed(() => {
    const criticos = this.eventosCriticos();
    const warnings = this.warningsAuditoria();
    const stockCritico = this.productos().filter(item => item.stockActual <= item.stockMinimo).length;

    if (criticos > 0 || stockCritico >= 3) {
      return {
        estado: 'Riesgo alto',
        descripcion: 'Existen señales operativas que requieren intervención inmediata.'
      };
    }

    if (warnings > 0 || stockCritico > 0) {
      return {
        estado: 'Monitoreo',
        descripcion: 'El negocio está operando, pero conviene revisar alertas y reposición.'
      };
    }

    return {
      estado: 'Estable',
      descripcion: 'No se detectan anomalías relevantes en el periodo analizado.'
    };
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
}
