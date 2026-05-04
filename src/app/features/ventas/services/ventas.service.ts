import { Injectable, signal } from '@angular/core';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  doc
} from 'firebase/firestore';
import { firestoreDb } from '../../../core/firebase/firebase.config';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { Venta, VentaDetalle } from '../models/venta';

const STORAGE_KEY = 'bodega-ventas';

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  private readonly auditoriaService = new AuditoriaService();
  private readonly _ventas = signal<Venta[]>([]);
  ventasLectura = this._ventas.asReadonly();

  private migrationTried = false;

  constructor() {
    const ventasRef = collection(firestoreDb, 'ventas');
    const ventasQuery = query(ventasRef, orderBy('fecha', 'desc'));

    onSnapshot(ventasQuery, {
      next: snapshot => {
        const saneadas = snapshot.docs.map(docSnap => {
          const item = docSnap.data() as Venta;
          return {
            ...item,
            clienteNombre: item.clienteNombre ?? '',
            observacion: item.observacion ?? '',
            vendedor: item.vendedor ?? 'Sistema',
            detalles: Array.isArray(item.detalles)
              ? item.detalles.map(det => this.sanearDetalle(det))
              : []
          };
        });
        this._ventas.set(saneadas);
        this.intentarMigracionInicial(saneadas);
      },
      error: () => {
        const local = this.cargarDesdeStorage();
        this._ventas.set(local);
      }
    });
  }

  obtenerSiguienteId(): number {
    const lista = this._ventas();
    return lista.length === 0 ? 1 : Math.max(...lista.map(item => item.id)) + 1;
  }

  registrarVenta(venta: Venta) {
    const payload: Venta = {
      ...venta,
      clienteNombre: venta.clienteNombre ?? '',
      observacion: venta.observacion ?? '',
      vendedor: venta.vendedor ?? 'Sistema',
      detalles: venta.detalles.map(det => ({ ...det }))
    };

    setDoc(doc(firestoreDb, 'ventas', String(payload.id)), payload)
      .then(() => {
        this.auditoriaService.registrar(
          'VENTAS',
          'REGISTRAR',
          `Venta registrada #${payload.id}`,
          'SUCCESS',
          `Total: S/ ${payload.total.toFixed(2)} · Método: ${payload.metodoPago}`,
          payload.vendedor || 'Sistema'
        );
      })
      .catch(() => {
        const nueva = [{ ...payload }, ...this._ventas()];
        this._ventas.set(nueva);
        this.guardarEnStorage(nueva);
      });
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

    saneadas.forEach(item => {
      setDoc(doc(firestoreDb, 'ventas', String(item.id)), item).catch(() => {});
    });

    this._ventas.set(saneadas);
    this.guardarEnStorage(saneadas);
  }

  private intentarMigracionInicial(actual: Venta[]) {
    if (this.migrationTried) {
      return;
    }
    this.migrationTried = true;

    if (actual.length > 0) {
      return;
    }

    const local = this.cargarDesdeStorage();
    if (local.length > 0) {
      this.reemplazarVentas(local);
    }
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
      // ignorar
    }
  }
}
