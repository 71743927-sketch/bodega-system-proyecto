import { Injectable, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { Venta, VentaDetalle } from '../models/venta';

const STORAGE_KEY = 'bodega-ventas';

@Injectable({
  providedIn: 'root'
})
export class VentasService {

  private readonly auditoriaService = inject(AuditoriaService);
  private readonly _ventas = signal<Venta[]>(this.cargarDesdeStorage());

  ventasLectura = this._ventas.asReadonly();

  obtenerSiguienteId(): number {
    const lista = this._ventas();
    return lista.length === 0 ? 1 : Math.max(...lista.map(item => item.id)) + 1;
  }

  registrarVenta(venta: Venta) {
    this._ventas.update(lista => {
      const nueva = [{
        ...venta,
        detalles: venta.detalles.map(det => ({ ...det }))
      }, ...lista];
      this.guardarEnStorage(nueva);
      return nueva;
    });

    this.auditoriaService.registrar(
      'VENTAS',
      'REGISTRAR',
      `Venta registrada #${venta.id}`,
      'SUCCESS',
      `Total: S/ ${venta.total.toFixed(2)} · Método: ${venta.metodoPago}`,
      venta.vendedor || 'Sistema'
    );
  }

  reemplazarVentas(items: Venta[]) {
    const saneadas = items.map(item => ({
      ...item,
      clienteNombre: item.clienteNombre ?? '',
      observacion: item.observacion ?? '',
      vendedor: item.vendedor ?? 'Sistema',
      detalles: Array.isArray(item.detalles)
        ? item.detalles.map(det => this.sanearDetalle(det))
        : []
    }));

    this._ventas.set(saneadas);
    this.guardarEnStorage(saneadas);
  }

  private cargarDesdeStorage(): Venta[] {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(item => ({
        ...item,
        clienteNombre: item.clienteNombre ?? '',
        observacion: item.observacion ?? '',
        vendedor: item.vendedor ?? 'Sistema',
        detalles: Array.isArray(item.detalles)
          ? item.detalles.map((det: unknown) => this.sanearDetalle(det))
          : []
      }));
    } catch {
      return [];
    }
  }

  private sanearDetalle(det: unknown): VentaDetalle {
    const item = (det ?? {}) as Record<string, unknown>;
    return {
      productoId: Number(item['productoId'] ?? 0),
      codigo: String(item['codigo'] ?? ''),
      nombre: String(item['nombre'] ?? ''),
      categoria: String(item['categoria'] ?? ''),
      cantidad: Number(item['cantidad'] ?? 0),
      precioUnitario: Number(item['precioUnitario'] ?? item['precio'] ?? 0),
      subtotal: Number(item['subtotal'] ?? 0)
    };
  }

  private guardarEnStorage(lista: Venta[]) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch {
      // Ignorar errores de persistencia local
    }
  }
}
