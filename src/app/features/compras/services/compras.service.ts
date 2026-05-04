import { Injectable, inject, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { firestoreDb } from '../../../core/firebase/firebase.config';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { Compra } from '../models/compra';

const STORAGE_KEY = 'bodega-compras';

@Injectable({
  providedIn: 'root'
})
export class ComprasService {
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly _compras = signal<Compra[]>([]);
  comprasLectura = this._compras.asReadonly();

  private migrationTried = false;

  constructor() {
    const comprasRef = collection(firestoreDb, 'compras');

    onSnapshot(comprasRef, {
      next: snapshot => {
        const items = snapshot.docs.map(docSnap => this.sanearCompra(docSnap.data()));
        this._compras.set(this.ordenarCompras(items));
        this.intentarMigracionInicial(items);
      },
      error: () => {
        const local = this.cargarDesdeStorage();
        this._compras.set(this.ordenarCompras(local));
      }
    });
  }

  obtenerSiguienteId(): number {
    const lista = this._compras();
    const ids = lista
      .map(item => this.extraerId(item))
      .filter(id => Number.isFinite(id) && id > 0);

    return ids.length === 0 ? 1 : Math.max(...ids) + 1;
  }

  registrarCompra(compra: Compra) {
    const payload = this.normalizarCompra(compra);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'compras', String(id)), payload)
      .then(() => {
        this.auditoriaService.registrar(
          'COMPRAS',
          'REGISTRAR',
          `Compra registrada #${id}`,
          'SUCCESS',
          `Total: S/ ${this.extraerTotal(payload).toFixed(2)}`
        );
      })
      .catch(() => {
        const nueva = this.ordenarCompras([payload, ...this._compras()]);
        this._compras.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  actualizarCompra(compraActualizada: Compra) {
    const payload = this.normalizarCompra(compraActualizada);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'compras', String(id)), payload, { merge: true })
      .then(() => {
        this.auditoriaService.registrar(
          'COMPRAS',
          'ACTUALIZAR',
          `Compra actualizada #${id}`,
          'INFO',
          `Total: S/ ${this.extraerTotal(payload).toFixed(2)}`
        );
      })
      .catch(() => {
        const nueva = this.ordenarCompras(
          this._compras().map(item => this.extraerId(item) === id ? payload : item)
        );
        this._compras.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  eliminarCompra(id: number | string) {
    const idNum = Number(id);

    deleteDoc(doc(firestoreDb, 'compras', String(idNum)))
      .then(() => {
        this.auditoriaService.registrar(
          'COMPRAS',
          'ELIMINAR',
          `Compra eliminada #${idNum}`,
          'DANGER'
        );
      })
      .catch(() => {
        const nueva = this._compras().filter(item => this.extraerId(item) !== idNum);
        this._compras.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  reemplazarCompras(items: Compra[]) {
    const saneadas = items.map(item => this.normalizarCompra(item));

    saneadas.forEach(item => {
      const id = this.extraerId(item);
      setDoc(doc(firestoreDb, 'compras', String(id)), item).catch(() => {});
    });

    this._compras.set(this.ordenarCompras(saneadas));
    this.guardarEnStorage(saneadas);
  }

  obtenerComprasRecientes(limite = 5): Compra[] {
    return this.ordenarCompras(this._compras()).slice(0, limite);
  }

  obtenerTotalCompras(): number {
    return this._compras().reduce((acc, item) => acc + this.extraerTotal(item), 0);
  }

  private intentarMigracionInicial(actual: Compra[]) {
    if (this.migrationTried) {
      return;
    }
    this.migrationTried = true;

    if (actual.length > 0) {
      return;
    }

    const local = this.cargarDesdeStorage();
    if (local.length > 0) {
      this.reemplazarCompras(local);
    }
  }

  private normalizarCompra(compra: Compra): Compra {
    const raw = this.asRecord(compra);

    const payload = {
      ...(raw as Partial<Compra>),
      id: this.extraerId(compra),
      fecha: raw['fecha'] ? String(raw['fecha']) : new Date().toISOString()
    };

    return payload as unknown as Compra;
  }

  private sanearCompra(data: unknown): Compra {
    const raw = this.asRecord(data);

    const payload = {
      ...(raw as Partial<Compra>),
      id: raw['id'] ? Number(raw['id']) : Date.now(),
      fecha: raw['fecha'] ? String(raw['fecha']) : new Date().toISOString()
    };

    return payload as unknown as Compra;
  }

  private ordenarCompras(items: Compra[]): Compra[] {
    return [...items].sort((a, b) => this.extraerOrden(b) - this.extraerOrden(a));
  }

  private extraerOrden(compra: Compra): number {
    const raw = this.asRecord(compra);

    if (raw['fecha']) {
      const t = new Date(String(raw['fecha'])).getTime();
      if (!Number.isNaN(t)) {
        return t;
      }
    }

    return this.extraerId(compra);
  }

  private extraerId(compra: Compra): number {
    const raw = this.asRecord(compra);
    const id = Number(raw['id']);
    return Number.isFinite(id) && id > 0 ? id : Date.now();
  }

  private extraerTotal(compra: Compra): number {
    const raw = this.asRecord(compra);

    const posibles = [
      raw['total'],
      raw['montoTotal'],
      raw['importeTotal'],
      raw['subtotal']
    ];

    for (const valor of posibles) {
      const n = Number(valor);
      if (Number.isFinite(n)) {
        return n;
      }
    }

    return 0;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  private cargarDesdeStorage(): Compra[] {
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

      return parsed.map(item => this.sanearCompra(item));
    } catch {
      return [];
    }
  }

  private guardarEnStorage(lista: Compra[]) {
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
