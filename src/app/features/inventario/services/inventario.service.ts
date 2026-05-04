import { Injectable, computed, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { firestoreDb } from '../../../core/firebase/firebase.config';

const STORAGE_KEY = 'bodega-inventario';

const MOVIMIENTOS_SEED = [
  {
    id: 1,
    productoId: 1,
    codigo: 'P-001',
    nombreProducto: 'Arroz Costeño 5kg',
    categoria: 'Abarrotes',
    tipo: 'ENTRADA',
    cantidad: 20,
    stockMinimo: 5,
    ubicacion: 'A-01',
    observacion: 'Carga inicial',
    activo: true,
    fecha: new Date().toISOString()
  },
  {
    id: 2,
    productoId: 2,
    codigo: 'P-002',
    nombreProducto: 'Aceite Vegetal 1L',
    categoria: 'Abarrotes',
    tipo: 'ENTRADA',
    cantidad: 3,
    stockMinimo: 4,
    ubicacion: 'A-02',
    observacion: 'Carga inicial',
    activo: true,
    fecha: new Date().toISOString()
  }
];

@Injectable({
  providedIn: 'root'
})
export class InventarioService {
  readonly movimientos = signal<any[]>([]);
  readonly movimientosLectura = this.movimientos.asReadonly();

  readonly inventario = computed<any[]>(() => this.resumenInventario(this.movimientos()));
  readonly inventarioLectura = this.inventario;

  // Alias por compatibilidad
  readonly items = this.inventario;

  private migrationTried = false;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const inventarioRef = collection(firestoreDb, 'inventario');

    onSnapshot(inventarioRef, {
      next: snapshot => {
        const items = snapshot.docs.map(docSnap => this.sanearMovimiento(docSnap.data()));
        this.movimientos.set(this.ordenarMovimientos(items));
        this.intentarMigracionInicial(items);
      },
      error: () => {
        const local = this.cargarDesdeStorage();
        this.movimientos.set(this.ordenarMovimientos(local));
      }
    });
  }

  // ==========================================================
  // CRUD PRINCIPAL SOBRE MOVIMIENTOS
  // ==========================================================
  obtenerSiguienteId(): number {
    const ids = this.movimientos()
      .map((mov: any) => this.extraerId(mov))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    return ids.length === 0 ? 1 : Math.max(...ids) + 1;
  }

  registrarMovimiento(movimiento: any) {
    const payload = this.normalizarMovimiento(movimiento);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'inventario', String(id)), payload)
      .catch(() => {
        const nueva = this.ordenarMovimientos([payload, ...this.movimientos()]);
        this.movimientos.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  agregarMovimiento(movimiento: any) {
    this.registrarMovimiento(movimiento);
  }

  crearMovimiento(movimiento: any) {
    this.registrarMovimiento(movimiento);
  }

  actualizarMovimiento(movimientoActualizado: any) {
    const payload = this.normalizarMovimiento(movimientoActualizado);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'inventario', String(id)), payload, { merge: true })
      .catch(() => {
        const nueva = this.ordenarMovimientos(
          this.movimientos().map((item: any) => this.extraerId(item) === id ? payload : item)
        );
        this.movimientos.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  editarMovimiento(movimientoActualizado: any) {
    this.actualizarMovimiento(movimientoActualizado);
  }

  eliminarMovimiento(id: number | string) {
    const idNum = Number(id);

    deleteDoc(doc(firestoreDb, 'inventario', String(idNum)))
      .catch(() => {
        const nueva = this.movimientos().filter((item: any) => this.extraerId(item) !== idNum);
        this.movimientos.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  borrarMovimiento(id: number | string) {
    this.eliminarMovimiento(id);
  }

  reemplazarMovimientos(items: any[]) {
    const saneados = items.map(item => this.normalizarMovimiento(item));

    saneados.forEach(item => {
      const id = this.extraerId(item);
      setDoc(doc(firestoreDb, 'inventario', String(id)), item).catch(() => {});
    });

    this.movimientos.set(this.ordenarMovimientos(saneados));
    this.guardarEnStorage(saneados);
  }

  // ==========================================================
  // ALIAS CRUD (compatibilidad amplia)
  // ==========================================================
  registrarItem(item: any) { this.registrarMovimiento(item); }
  agregarItem(item: any) { this.registrarMovimiento(item); }
  crearItem(item: any) { this.registrarMovimiento(item); }
  actualizarItem(item: any) { this.actualizarMovimiento(item); }
  editarItem(item: any) { this.actualizarMovimiento(item); }
  eliminarItem(id: number | string) { this.eliminarMovimiento(id); }
  borrarItem(id: number | string) { this.eliminarMovimiento(id); }
  reemplazarInventario(items: any[]) { this.reemplazarMovimientos(items); }

  // ==========================================================
  // MOVIMIENTOS DE STOCK
  // ==========================================================
  registrarEntrada(payload: any) {
    this.registrarMovimiento({
      ...payload,
      tipo: 'ENTRADA',
      fecha: payload?.fecha || new Date().toISOString()
    });
  }

  registrarSalida(payload: any) {
    this.registrarMovimiento({
      ...payload,
      tipo: 'SALIDA',
      fecha: payload?.fecha || new Date().toISOString()
    });
  }

  actualizarStock(ref: number | string | any, nuevoStock: number) {
    const item = this.buscarInterno(ref);
    if (!item) {
      return;
    }

    const actual = this.extraerStockActual(item);
    const objetivo = Number(nuevoStock) || 0;
    const diferencia = objetivo - actual;

    if (diferencia === 0) {
      return;
    }

    this.registrarMovimiento({
      productoId: item.productoId,
      codigo: item.codigo,
      nombreProducto: item.nombreProducto,
      categoria: item.categoria,
      stockMinimo: item.stockMinimo,
      ubicacion: item.ubicacion,
      tipo: diferencia > 0 ? 'ENTRADA' : 'SALIDA',
      cantidad: Math.abs(diferencia),
      observacion: 'Ajuste de stock',
      fecha: new Date().toISOString(),
      activo: item.activo
    });
  }

  incrementarStock(ref: number | string | any, cantidad: number) {
    const item = this.buscarInterno(ref);
    if (!item) {
      return;
    }

    this.registrarEntrada({
      productoId: item.productoId,
      codigo: item.codigo,
      nombreProducto: item.nombreProducto,
      categoria: item.categoria,
      stockMinimo: item.stockMinimo,
      ubicacion: item.ubicacion,
      cantidad: Number(cantidad) || 0,
      observacion: 'Incremento de stock',
      activo: item.activo
    });
  }

  descontarStock(ref: number | string | any, cantidad: number) {
    const item = this.buscarInterno(ref);
    if (!item) {
      return;
    }

    this.registrarSalida({
      productoId: item.productoId,
      codigo: item.codigo,
      nombreProducto: item.nombreProducto,
      categoria: item.categoria,
      stockMinimo: item.stockMinimo,
      ubicacion: item.ubicacion,
      cantidad: Number(cantidad) || 0,
      observacion: 'Descuento de stock',
      activo: item.activo
    });
  }

  // ==========================================================
  // CONSULTAS SOBRE RESUMEN DE INVENTARIO
  // ==========================================================
  obtenerPorId(id: number | string): any | null {
    const idNum = Number(id);
    return this.inventario().find((item: any) => Number(item.id) === idNum) ?? null;
  }

  obtenerPorProductoId(productoId: number | string): any | null {
    const idNum = Number(productoId);
    return this.inventario().find((item: any) => Number(item.productoId) === idNum) ?? null;
  }

  buscarPorCodigo(codigo: string): any | null {
    const target = String(codigo || '').trim().toUpperCase();
    return this.inventario().find((item: any) => String(item.codigo || '').trim().toUpperCase() === target) ?? null;
  }

  buscarPorNombre(nombre: string): any[] {
    const target = String(nombre || '').trim().toLowerCase();
    if (!target) {
      return this.inventario();
    }

    return this.inventario().filter((item: any) =>
      this.extraerNombre(item).includes(target) || this.extraerCategoria(item).includes(target)
    );
  }

  obtenerBajoStock(): any[] {
    return this.inventario().filter((item: any) => this.extraerStockActual(item) <= this.extraerStockMinimo(item));
  }

  obtenerActivos(): any[] {
    return this.inventario().filter((item: any) => this.extraerActivo(item));
  }

  obtenerInactivos(): any[] {
    return this.inventario().filter((item: any) => !this.extraerActivo(item));
  }

  // ==========================================================
  // MIGRACIÓN INICIAL
  // ==========================================================
  private intentarMigracionInicial(actual: any[]) {
    if (this.migrationTried) {
      return;
    }
    this.migrationTried = true;

    if (actual.length > 0) {
      return;
    }

    const local = this.cargarDesdeStorage();
    if (local.length > 0) {
      this.reemplazarMovimientos(local);
      return;
    }

    this.reemplazarMovimientos(MOVIMIENTOS_SEED);
  }

  // ==========================================================
  // NORMALIZACIÓN
  // ==========================================================
  private normalizarMovimiento(item: any): any {
    const raw = this.asRecord(item);

    return {
      ...(raw as Record<string, unknown>),
      id: this.extraerId(item),
      productoId: this.extraerProductoId(item),
      codigo: this.extraerCodigo(raw),
      nombreProducto: this.extraerNombre(raw) || 'Producto',
      categoria: raw['categoria'] ? String(raw['categoria']).trim() : '',
      tipo: this.extraerTipoMovimiento(raw),
      cantidad: this.extraerCantidad(raw),
      stockMinimo: this.extraerStockMinimo(raw),
      ubicacion: raw['ubicacion'] ? String(raw['ubicacion']).trim() : '',
      observacion: raw['observacion'] ? String(raw['observacion']).trim() : '',
      activo: this.extraerActivo(raw),
      fecha: raw['fecha'] ? String(raw['fecha']) : new Date().toISOString()
    };
  }

  private sanearMovimiento(data: unknown): any {
    const raw = this.asRecord(data);

    return {
      ...raw,
      id: raw['id'] ? Number(raw['id']) : Date.now(),
      productoId: this.extraerProductoId(raw),
      codigo: this.extraerCodigo(raw),
      nombreProducto: this.extraerNombre(raw) || 'Producto',
      categoria: raw['categoria'] ? String(raw['categoria']).trim() : '',
      tipo: this.extraerTipoMovimiento(raw),
      cantidad: this.extraerCantidad(raw),
      stockMinimo: this.extraerStockMinimo(raw),
      ubicacion: raw['ubicacion'] ? String(raw['ubicacion']).trim() : '',
      observacion: raw['observacion'] ? String(raw['observacion']).trim() : '',
      activo: this.extraerActivo(raw),
      fecha: raw['fecha'] ? String(raw['fecha']) : new Date().toISOString()
    };
  }

  private ordenarMovimientos(items: any[]): any[] {
    return [...items].sort((a: any, b: any) => new Date(String(b.fecha || '')).getTime() - new Date(String(a.fecha || '')).getTime());
  }

  private resumenInventario(movimientos: any[]): any[] {
    const mapa = new Map<string, any>();

    for (const mov of movimientos) {
      const productoId = this.extraerProductoId(mov);
      const codigo = this.extraerCodigo(mov);
      const key = productoId > 0 ? `ID:${productoId}` : `COD:${codigo}`;

      const actual = mapa.get(key) ?? {
        id: productoId > 0 ? productoId : this.extraerId(mov),
        productoId,
        codigo,
        nombreProducto: mov.nombreProducto || mov.nombre || 'Producto',
        categoria: mov.categoria || '',
        stockActual: 0,
        stockMinimo: Number(mov.stockMinimo) || 0,
        ubicacion: mov.ubicacion || '',
        activo: this.extraerActivo(mov),
        fechaRegistro: mov.fecha || new Date().toISOString(),
        ultimaActualizacion: mov.fecha || new Date().toISOString()
      };

      const tipo = this.extraerTipoMovimiento(mov);
      const cantidad = this.extraerCantidad(mov);

      if (tipo === 'SALIDA' || tipo === 'EGRESO') {
        actual.stockActual -= cantidad;
      } else {
        actual.stockActual += cantidad;
      }

      if (!actual.codigo && codigo) {
        actual.codigo = codigo;
      }
      if (!actual.nombreProducto && mov.nombreProducto) {
        actual.nombreProducto = mov.nombreProducto;
      }
      if (!actual.categoria && mov.categoria) {
        actual.categoria = mov.categoria;
      }
      if (!actual.ubicacion && mov.ubicacion) {
        actual.ubicacion = mov.ubicacion;
      }
      if (!actual.stockMinimo && Number(mov.stockMinimo)) {
        actual.stockMinimo = Number(mov.stockMinimo);
      }

      actual.ultimaActualizacion = mov.fecha || actual.ultimaActualizacion;
      mapa.set(key, actual);
    }

    return [...mapa.values()].sort((a: any, b: any) => this.extraerNombre(a).localeCompare(this.extraerNombre(b), 'es', { sensitivity: 'base' }));
  }

  private buscarInterno(ref: any): any | null {
    if (typeof ref === 'number' || typeof ref === 'string') {
      const byProductoId = this.obtenerPorProductoId(ref);
      if (byProductoId) {
        return byProductoId;
      }
      return this.buscarPorCodigo(String(ref));
    }

    const productoId = this.extraerProductoId(ref);
    if (productoId > 0) {
      const byProductoId = this.obtenerPorProductoId(productoId);
      if (byProductoId) {
        return byProductoId;
      }
    }

    const codigo = this.extraerCodigo(ref);
    if (codigo) {
      return this.buscarPorCodigo(codigo);
    }

    return null;
  }

  private extraerId(item: any): number {
    const raw = this.asRecord(item);
    const id = Number(raw['id']);
    return Number.isFinite(id) && id > 0 ? id : Date.now();
  }

  private extraerProductoId(item: any): number {
    const raw = this.asRecord(item);
    const id = Number(raw['productoId'] ?? raw['idProducto'] ?? raw['producto_id']);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  private extraerCodigo(item: any): string {
    const raw = this.asRecord(item);
    return raw['codigo'] ? String(raw['codigo']).trim().toUpperCase() : '';
  }

  private extraerNombre(item: any): string {
    const raw = this.asRecord(item);
    if (raw['nombreProducto']) {
      return String(raw['nombreProducto']).trim().toLowerCase();
    }
    if (raw['nombre']) {
      return String(raw['nombre']).trim().toLowerCase();
    }
    return '';
  }

  private extraerCategoria(item: any): string {
    const raw = this.asRecord(item);
    return raw['categoria'] ? String(raw['categoria']).trim().toLowerCase() : '';
  }

  private extraerStockActual(item: any): number {
    const raw = this.asRecord(item);
    const posibles = [raw['stockActual'], raw['stock'], raw['cantidad'], raw['existencia']];
    for (const valor of posibles) {
      const n = Number(valor);
      if (Number.isFinite(n)) {
        return n;
      }
    }
    return 0;
  }

  private extraerStockMinimo(item: any): number {
    const raw = this.asRecord(item);
    const posibles = [raw['stockMinimo'], raw['minimo'], raw['stockMin']];
    for (const valor of posibles) {
      const n = Number(valor);
      if (Number.isFinite(n)) {
        return n;
      }
    }
    return 0;
  }

  private extraerCantidad(item: any): number {
    const raw = this.asRecord(item);
    const posibles = [raw['cantidad'], raw['monto'], raw['stockActual'], raw['stock']];
    for (const valor of posibles) {
      const n = Number(valor);
      if (Number.isFinite(n)) {
        return Math.abs(n);
      }
    }
    return 0;
  }

  private extraerTipoMovimiento(item: any): string {
    const raw = this.asRecord(item);
    const posibles = [raw['tipo'], raw['tipoMovimiento'], raw['movimiento'], raw['naturaleza']];
    for (const valor of posibles) {
      if (valor !== undefined && valor !== null) {
        const tipo = String(valor).trim().toUpperCase();
        if (tipo === 'EGRESO') {
          return 'SALIDA';
        }
        if (tipo === 'INGRESO') {
          return 'ENTRADA';
        }
        return tipo || 'ENTRADA';
      }
    }
    return 'ENTRADA';
  }

  private extraerActivo(item: any): boolean {
    const raw = this.asRecord(item);
    if (typeof raw['activo'] === 'boolean') {
      return raw['activo'] as boolean;
    }
    if (typeof raw['estado'] === 'string') {
      return String(raw['estado']).toUpperCase() !== 'INACTIVO';
    }
    return true;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  // ==========================================================
  // LOCALSTORAGE FALLBACK
  // ==========================================================
  private cargarDesdeStorage(): any[] {
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

      return parsed.map(item => this.sanearMovimiento(item));
    } catch {
      return [];
    }
  }

  private guardarEnStorage(lista: any[]) {
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
