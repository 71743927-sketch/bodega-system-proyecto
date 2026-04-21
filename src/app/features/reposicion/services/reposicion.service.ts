import { Injectable, inject } from '@angular/core';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { ComprasService } from '../../compras/services/compras.service';
import { ConfiguracionService } from '../../configuracion/services/configuracion.service';
import { ProductosService } from '../../productos/services/productos.service';
import { VentasService } from '../../ventas/services/ventas.service';
import { ResumenReposicion, SugerenciaReposicion } from '../models/sugerencia-reposicion';

const STORAGE_KEY = 'bodega-reposicion-sugerencias';

type PersistenciaReposicion = Record<
  string,
  {
    estado: SugerenciaReposicion['estado'];
    observacion: string;
  }
>;

@Injectable({
  providedIn: 'root'
})
export class ReposicionService {

  private readonly productosService = inject(ProductosService);
  private readonly ventasService = inject(VentasService);
  private readonly comprasService = inject(ComprasService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly configuracionService = inject(ConfiguracionService);

  generarSugerencias(): SugerenciaReposicion[] {
    const productos = this.productosService.productosLectura().filter(item => item.activo);
    const ventas = this.ventasService.ventasLectura();
    const compras = this.comprasService.comprasLectura();
    const config = this.configuracionService.configuracionLectura();
    const diasAlerta = Math.max(1, Number(config.diasAlertaCompra) || 15);
    const hoy = Date.now();
    const hace30Dias = hoy - 30 * 24 * 60 * 60 * 1000;

    const sugerencias: SugerenciaReposicion[] = [];

    for (const producto of productos) {
      const ventasProducto = ventas.flatMap(venta =>
        venta.detalles
          .filter(detalle =>
            detalle.productoId === producto.id ||
            detalle.nombre.trim().toLowerCase() === producto.nombre.trim().toLowerCase()
          )
          .map(detalle => ({ fecha: venta.fecha, cantidad: detalle.cantidad }))
      );

      const ventas30d = ventasProducto.filter(item => new Date(item.fecha).getTime() >= hace30Dias);
      const frecuenciaVentas30d = ventas30d.reduce((sum, item) => sum + item.cantidad, 0);
      const promedioDiario = frecuenciaVentas30d / 30;
      const diasCobertura = promedioDiario <= 0 ? 999 : producto.stockActual / promedioDiario;

      const comprasProducto = compras
        .flatMap(compra =>
          compra.detalles
            .filter(detalle =>
              detalle.productoId === producto.id ||
              detalle.productoNombre.trim().toLowerCase() === producto.nombre.trim().toLowerCase()
            )
            .map(detalle => ({
              fecha: compra.fecha,
              cantidad: detalle.cantidad,
              costoUnitario: detalle.costoUnitario
            }))
        )
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      const ultimaCompra = comprasProducto[0];
      const ultimaCompraFecha: string | null = ultimaCompra ? ultimaCompra.fecha : null;
      const ultimaCompraCantidad = ultimaCompra ? ultimaCompra.cantidad : 0;
      const precioCompraReferencial = ultimaCompra ? ultimaCompra.costoUnitario : producto.precioCompra;

      const demandaBase = Math.max(producto.stockMinimo * 2, Math.ceil(promedioDiario * diasAlerta));
      const stockObjetivo = Math.max(producto.stockMinimo, demandaBase);
      const cantidadSugerida = Math.max(0, stockObjetivo - producto.stockActual);
      const costoEstimado = cantidadSugerida * precioCompraReferencial;

      let prioridad: SugerenciaReposicion['prioridad'] = 'BAJA';
      let motivo = 'Reposición preventiva.';

      if (producto.stockActual <= 0) {
        prioridad = 'URGENTE';
        motivo = 'Producto agotado.';
      } else if (producto.stockActual <= producto.stockMinimo) {
        prioridad = 'ALTA';
        motivo = 'Stock por debajo del mínimo.';
      } else if (diasCobertura <= 7 && frecuenciaVentas30d > 0) {
        prioridad = 'MEDIA';
        motivo = 'Cobertura proyectada menor o igual a 7 días.';
      } else if (cantidadSugerida > 0) {
        prioridad = 'BAJA';
        motivo = 'Conviene reponer según consumo reciente.';
      }

      if (cantidadSugerida === 0 && producto.stockActual > producto.stockMinimo) {
        continue;
      }

      sugerencias.push({
        id: `repo-${producto.id}`,
        productoId: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        categoria: producto.categoria,
        stockActual: producto.stockActual,
        stockMinimo: producto.stockMinimo,
        stockObjetivo,
        cantidadSugerida,
        precioCompraReferencial,
        costoEstimado,
        ultimaCompraFecha,
        ultimaCompraCantidad,
        frecuenciaVentas30d,
        diasCobertura,
        prioridad,
        estado: this.obtenerEstadoPersistido(`repo-${producto.id}`) ?? 'PENDIENTE',
        motivo,
        observacion: this.obtenerObservacionPersistida(`repo-${producto.id}`)
      });
    }

    return sugerencias.sort(
      (a, b) =>
        this.pesoPrioridad(b.prioridad) - this.pesoPrioridad(a.prioridad) ||
        b.costoEstimado - a.costoEstimado
    );
  }

  calcularResumen(lista: SugerenciaReposicion[]): ResumenReposicion {
    return {
      totalSugerencias: lista.length,
      urgentes: lista.filter(item => item.prioridad === 'URGENTE').length,
      altas: lista.filter(item => item.prioridad === 'ALTA').length,
      medias: lista.filter(item => item.prioridad === 'MEDIA').length,
      bajas: lista.filter(item => item.prioridad === 'BAJA').length,
      costoTotalEstimado: lista.reduce((sum, item) => sum + item.costoEstimado, 0),
      unidadesTotalesSugeridas: lista.reduce((sum, item) => sum + item.cantidadSugerida, 0)
    };
  }

  actualizarEstado(sugerenciaId: string, estado: SugerenciaReposicion['estado']) {
    const persistido = this.cargarPersistencia();
    const actual = persistido[sugerenciaId] ?? { estado: 'PENDIENTE', observacion: '' };

    persistido[sugerenciaId] = {
      ...actual,
      estado
    };

    this.guardarPersistencia(persistido);
    this.auditoriaService.registrar(
      'SISTEMA',
      'REPOSICION_ESTADO',
      `Reposición ${sugerenciaId} -> ${estado}`,
      estado === 'APROBADA' ? 'SUCCESS' : 'INFO'
    );
  }

  actualizarObservacion(sugerenciaId: string, observacion: string) {
    const persistido = this.cargarPersistencia();
    const actual = persistido[sugerenciaId] ?? { estado: 'PENDIENTE', observacion: '' };

    persistido[sugerenciaId] = {
      ...actual,
      observacion
    };

    this.guardarPersistencia(persistido);
  }

  exportar(fileName: string, content: string) {
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

  private pesoPrioridad(prioridad: SugerenciaReposicion['prioridad']): number {
    switch (prioridad) {
      case 'URGENTE':
        return 4;
      case 'ALTA':
        return 3;
      case 'MEDIA':
        return 2;
      case 'BAJA':
      default:
        return 1;
    }
  }

  private obtenerEstadoPersistido(sugerenciaId: string): SugerenciaReposicion['estado'] | null {
    const persistido = this.cargarPersistencia();
    return persistido[sugerenciaId]?.estado ?? null;
  }

  private obtenerObservacionPersistida(sugerenciaId: string): string {
    const persistido = this.cargarPersistencia();
    return persistido[sugerenciaId]?.observacion ?? '';
  }

  private cargarPersistencia(): PersistenciaReposicion {
    try {
      if (typeof localStorage === 'undefined') {
        return {};
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed as PersistenciaReposicion : {};
    } catch {
      return {};
    }
  }

  private guardarPersistencia(data: PersistenciaReposicion) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignorar errores de persistencia local
    }
  }
}
