import { Injectable, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { firestoreDb } from '../../../core/firebase/firebase.config';

const STORAGE_KEY = 'bodega-proveedores';

const PROVEEDORES_SEED = [
  {
    id: 1,
    ruc: '20600011111',
    nombre: 'Distribuidora Andina SAC',
    contacto: 'Mariela Huaman',
    telefono: '964111111',
    correo: 'contacto@andina.local',
    direccion: 'Av. Real 123',
    activo: true,
    fechaRegistro: new Date().toISOString()
  },
  {
    id: 2,
    ruc: '20600022222',
    nombre: 'Comercial Valle EIRL',
    contacto: 'Jorge Rojas',
    telefono: '964222222',
    correo: 'ventas@valle.local',
    direccion: 'Jr. Lima 456',
    activo: true,
    fechaRegistro: new Date().toISOString()
  }
];

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {
  readonly proveedores = signal<any[]>([]);
  readonly proveedoresLectura = this.proveedores.asReadonly();

  private migrationTried = false;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const proveedoresRef = collection(firestoreDb, 'proveedores');

    onSnapshot(proveedoresRef, {
      next: snapshot => {
        const items = snapshot.docs.map(docSnap => this.sanearProveedor(docSnap.data()));
        this.proveedores.set(this.ordenarProveedores(items));
        this.intentarMigracionInicial(items);
      },
      error: () => {
        const local = this.cargarDesdeStorage();
        this.proveedores.set(this.ordenarProveedores(local));
      }
    });
  }

  // ==========================================================
  // CRUD PRINCIPAL
  // ==========================================================
  obtenerSiguienteId(): number {
    const ids = this.proveedores()
      .map((p: any) => this.extraerId(p))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    return ids.length === 0 ? 1 : Math.max(...ids) + 1;
  }

  registrarProveedor(proveedor: any) {
    const payload = this.normalizarProveedor(proveedor);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'proveedores', String(id)), payload)
      .catch(() => {
        const nueva = this.ordenarProveedores([payload, ...this.proveedores()]);
        this.proveedores.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  agregarProveedor(proveedor: any) {
    this.registrarProveedor(proveedor);
  }

  crearProveedor(proveedor: any) {
    this.registrarProveedor(proveedor);
  }

  actualizarProveedor(proveedorActualizado: any) {
    const payload = this.normalizarProveedor(proveedorActualizado);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'proveedores', String(id)), payload, { merge: true })
      .catch(() => {
        const nueva = this.ordenarProveedores(
          this.proveedores().map((item: any) => this.extraerId(item) === id ? payload : item)
        );
        this.proveedores.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  editarProveedor(proveedorActualizado: any) {
    this.actualizarProveedor(proveedorActualizado);
  }

  eliminarProveedor(id: number | string) {
    const idNum = Number(id);

    deleteDoc(doc(firestoreDb, 'proveedores', String(idNum)))
      .catch(() => {
        const nueva = this.proveedores().filter((item: any) => this.extraerId(item) !== idNum);
        this.proveedores.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  borrarProveedor(id: number | string) {
    this.eliminarProveedor(id);
  }

  reemplazarProveedores(items: any[]) {
    const saneados = items.map(item => this.normalizarProveedor(item));

    saneados.forEach(item => {
      const id = this.extraerId(item);
      setDoc(doc(firestoreDb, 'proveedores', String(id)), item).catch(() => {});
    });

    this.proveedores.set(this.ordenarProveedores(saneados));
    this.guardarEnStorage(saneados);
  }

  // ==========================================================
  // CONSULTAS / UTILIDADES
  // ==========================================================
  obtenerActivos(): any[] {
    return this.proveedores().filter((p: any) => this.extraerActivo(p));
  }

  obtenerInactivos(): any[] {
    return this.proveedores().filter((p: any) => !this.extraerActivo(p));
  }

  obtenerPorId(id: number | string): any | null {
    const idNum = Number(id);
    return this.proveedores().find((p: any) => this.extraerId(p) === idNum) ?? null;
  }

  buscarPorRuc(ruc: string): any | null {
    const target = String(ruc || '').trim();
    return this.proveedores().find((p: any) => this.extraerRuc(p) === target) ?? null;
  }

  buscarPorNombre(nombre: string): any[] {
    const target = String(nombre || '').trim().toLowerCase();
    if (!target) {
      return this.proveedores();
    }

    return this.proveedores().filter((p: any) =>
      this.extraerNombre(p).includes(target) || this.extraerContacto(p).includes(target)
    );
  }

  alternarEstado(id: number | string) {
    const actual = this.obtenerPorId(id);
    if (!actual) {
      return;
    }

    this.actualizarProveedor({
      ...actual,
      activo: !this.extraerActivo(actual)
    });
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
      this.reemplazarProveedores(local);
      return;
    }

    this.reemplazarProveedores(PROVEEDORES_SEED);
  }

  // ==========================================================
  // NORMALIZACIÓN
  // ==========================================================
  private normalizarProveedor(proveedor: any): any {
    const raw = this.asRecord(proveedor);

    return {
      ...(raw as Record<string, unknown>),
      id: this.extraerId(proveedor),
      ruc: raw['ruc'] ? String(raw['ruc']).trim() : '',
      nombre: raw['nombre'] ? String(raw['nombre']).trim() : 'Proveedor',
      contacto: raw['contacto'] ? String(raw['contacto']).trim() : '',
      telefono: raw['telefono'] ? String(raw['telefono']).trim() : '',
      correo: raw['correo'] ? String(raw['correo']).trim().toLowerCase() : (raw['email'] ? String(raw['email']).trim().toLowerCase() : ''),
      direccion: raw['direccion'] ? String(raw['direccion']).trim() : '',
      activo: this.extraerActivo(raw),
      fechaRegistro: raw['fechaRegistro'] ? String(raw['fechaRegistro']) : new Date().toISOString()
    };
  }

  private sanearProveedor(data: unknown): any {
    const raw = this.asRecord(data);

    return {
      ...raw,
      id: raw['id'] ? Number(raw['id']) : Date.now(),
      ruc: raw['ruc'] ? String(raw['ruc']).trim() : '',
      nombre: raw['nombre'] ? String(raw['nombre']).trim() : 'Proveedor',
      contacto: raw['contacto'] ? String(raw['contacto']).trim() : '',
      telefono: raw['telefono'] ? String(raw['telefono']).trim() : '',
      correo: raw['correo'] ? String(raw['correo']).trim().toLowerCase() : (raw['email'] ? String(raw['email']).trim().toLowerCase() : ''),
      direccion: raw['direccion'] ? String(raw['direccion']).trim() : '',
      activo: this.extraerActivo(raw),
      fechaRegistro: raw['fechaRegistro'] ? String(raw['fechaRegistro']) : new Date().toISOString()
    };
  }

  private ordenarProveedores(items: any[]): any[] {
    return [...items].sort((a: any, b: any) => this.extraerNombre(a).localeCompare(this.extraerNombre(b), 'es', { sensitivity: 'base' }));
  }

  private extraerId(item: any): number {
    const raw = this.asRecord(item);
    const id = Number(raw['id']);
    return Number.isFinite(id) && id > 0 ? id : Date.now();
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

  private extraerRuc(item: any): string {
    const raw = this.asRecord(item);
    return raw['ruc'] ? String(raw['ruc']).trim() : '';
  }

  private extraerNombre(item: any): string {
    const raw = this.asRecord(item);
    return raw['nombre'] ? String(raw['nombre']).trim().toLowerCase() : '';
  }

  private extraerContacto(item: any): string {
    const raw = this.asRecord(item);
    return raw['contacto'] ? String(raw['contacto']).trim().toLowerCase() : '';
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

      return parsed.map(item => this.sanearProveedor(item));
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
