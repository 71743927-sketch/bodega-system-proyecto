import { Injectable, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { firestoreDb } from '../../../core/firebase/firebase.config';

const STORAGE_KEY = 'bodega-usuarios';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {
  readonly usuarios = signal<any[]>([]);
  readonly usuariosLectura = this.usuarios.asReadonly();

  private migrationTried = false;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const usuariosRef = collection(firestoreDb, 'usuarios');

    onSnapshot(usuariosRef, {
      next: snapshot => {
        const items = snapshot.docs.map(docSnap => this.sanearUsuario(docSnap.data()));
        this.usuarios.set(this.ordenarUsuarios(items));
        this.intentarMigracionInicial(items);
      },
      error: () => {
        const local = this.cargarDesdeStorage();
        this.usuarios.set(this.ordenarUsuarios(local));
      }
    });
  }

  // ==========================================================
  // CRUD PRINCIPAL
  // ==========================================================
  obtenerSiguienteId(): number {
    const ids = this.usuarios()
      .map((u: any) => this.extraerId(u))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    return ids.length === 0 ? 1 : Math.max(...ids) + 1;
  }

  registrarUsuario(usuario: any) {
    const payload = this.normalizarUsuario(usuario);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'usuarios', String(id)), payload)
      .catch(() => {
        const nueva = this.ordenarUsuarios([payload, ...this.usuarios()]);
        this.usuarios.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  agregarUsuario(usuario: any) {
    this.registrarUsuario(usuario);
  }

  crearUsuario(usuario: any) {
    this.registrarUsuario(usuario);
  }

  actualizarUsuario(usuarioActualizado: any) {
    const payload = this.normalizarUsuario(usuarioActualizado);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'usuarios', String(id)), payload, { merge: true })
      .catch(() => {
        const nueva = this.ordenarUsuarios(
          this.usuarios().map((item: any) => this.extraerId(item) === id ? payload : item)
        );
        this.usuarios.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  editarUsuario(usuarioActualizado: any) {
    this.actualizarUsuario(usuarioActualizado);
  }

  eliminarUsuario(id: number | string) {
    const idNum = Number(id);

    deleteDoc(doc(firestoreDb, 'usuarios', String(idNum)))
      .catch(() => {
        const nueva = this.usuarios().filter((item: any) => this.extraerId(item) !== idNum);
        this.usuarios.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  borrarUsuario(id: number | string) {
    this.eliminarUsuario(id);
  }

  reemplazarUsuarios(items: any[]) {
    const saneados = items.map(item => this.normalizarUsuario(item));

    saneados.forEach(item => {
      const id = this.extraerId(item);
      setDoc(doc(firestoreDb, 'usuarios', String(id)), item).catch(() => {});
    });

    this.usuarios.set(this.ordenarUsuarios(saneados));
    this.guardarEnStorage(saneados);
  }

  // ==========================================================
  // CONSULTAS / UTILIDADES
  // ==========================================================
  obtenerUsuariosActivos(): any[] {
    return this.usuarios().filter((u: any) => this.extraerActivo(u));
  }

  obtenerUsuariosInactivos(): any[] {
    return this.usuarios().filter((u: any) => !this.extraerActivo(u));
  }

  obtenerPorId(id: number | string): any | null {
    const idNum = Number(id);
    return this.usuarios().find((u: any) => this.extraerId(u) === idNum) ?? null;
  }

  buscarPorCorreo(correo: string): any | null {
    const target = String(correo || '').trim().toLowerCase();
    return this.usuarios().find((u: any) => this.extraerCorreo(u) === target) ?? null;
  }

  buscarPorUsername(username: string): any | null {
    const target = String(username || '').trim().toLowerCase();
    return this.usuarios().find((u: any) => this.extraerUsername(u) === target) ?? null;
  }

  alternarEstado(id: number | string) {
    const actual = this.obtenerPorId(id);
    if (!actual) {
      return;
    }

    this.actualizarUsuario({
      ...actual,
      activo: !this.extraerActivo(actual)
    });
  }

  actualizarRol(id: number | string, rol: string) {
    const actual = this.obtenerPorId(id);
    if (!actual) {
      return;
    }

    this.actualizarUsuario({
      ...actual,
      rol: rol?.trim() || 'USUARIO'
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
      this.reemplazarUsuarios(local);
      return;
    }

    const seed = this.seedUsuarios();
    this.reemplazarUsuarios(seed);
  }

  private seedUsuarios(): any[] {
    return [
      {
        id: 1,
        nombres: 'Administrador',
        apellidos: 'General',
        username: 'admin',
        correo: 'admin@bodega.local',
        rol: 'ADMIN',
        activo: true,
        fechaRegistro: new Date().toISOString()
      },
      {
        id: 2,
        nombres: 'Operador',
        apellidos: 'Caja',
        username: 'caja',
        correo: 'caja@bodega.local',
        rol: 'CAJA',
        activo: true,
        fechaRegistro: new Date().toISOString()
      }
    ];
  }

  // ==========================================================
  // NORMALIZACIÓN
  // ==========================================================
  private normalizarUsuario(usuario: any): any {
    const raw = this.asRecord(usuario);

    const payload = {
      ...(raw as Record<string, unknown>),
      id: this.extraerId(usuario),
      nombres: raw['nombres'] ? String(raw['nombres']) : (raw['nombre'] ? String(raw['nombre']) : 'Usuario'),
      apellidos: raw['apellidos'] ? String(raw['apellidos']) : '',
      username: raw['username'] ? String(raw['username']).trim() : this.generarUsername(raw),
      correo: raw['correo'] ? String(raw['correo']).trim().toLowerCase() : (raw['email'] ? String(raw['email']).trim().toLowerCase() : ''),
      rol: raw['rol'] ? String(raw['rol']).trim().toUpperCase() : 'USUARIO',
      activo: this.extraerActivo(raw),
      fechaRegistro: raw['fechaRegistro'] ? String(raw['fechaRegistro']) : new Date().toISOString()
    };

    return payload;
  }

  private sanearUsuario(data: unknown): any {
    const raw = this.asRecord(data);

    return {
      ...raw,
      id: raw['id'] ? Number(raw['id']) : Date.now(),
      nombres: raw['nombres'] ? String(raw['nombres']) : (raw['nombre'] ? String(raw['nombre']) : 'Usuario'),
      apellidos: raw['apellidos'] ? String(raw['apellidos']) : '',
      username: raw['username'] ? String(raw['username']).trim() : this.generarUsername(raw),
      correo: raw['correo'] ? String(raw['correo']).trim().toLowerCase() : (raw['email'] ? String(raw['email']).trim().toLowerCase() : ''),
      rol: raw['rol'] ? String(raw['rol']).trim().toUpperCase() : 'USUARIO',
      activo: this.extraerActivo(raw),
      fechaRegistro: raw['fechaRegistro'] ? String(raw['fechaRegistro']) : new Date().toISOString()
    };
  }

  private ordenarUsuarios(items: any[]): any[] {
    return [...items].sort((a: any, b: any) => this.extraerOrden(a) - this.extraerOrden(b));
  }

  private extraerOrden(item: any): number {
    const usernameA = this.extraerUsername(item);
    return usernameA.localeCompare('', 'es', { sensitivity: 'base' }) === 0
      ? this.extraerId(item)
      : this.extraerUsername(item).charCodeAt(0) + this.extraerId(item);
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

  private extraerCorreo(item: any): string {
    const raw = this.asRecord(item);
    if (raw['correo']) {
      return String(raw['correo']).trim().toLowerCase();
    }
    if (raw['email']) {
      return String(raw['email']).trim().toLowerCase();
    }
    return '';
  }

  private extraerUsername(item: any): string {
    const raw = this.asRecord(item);
    if (raw['username']) {
      return String(raw['username']).trim().toLowerCase();
    }
    return this.generarUsername(raw).toLowerCase();
  }

  private generarUsername(raw: Record<string, unknown>): string {
    const nombres = raw['nombres'] ? String(raw['nombres']) : (raw['nombre'] ? String(raw['nombre']) : 'usuario');
    return nombres
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '') || `usuario.${Date.now()}`;
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

      return parsed.map(item => this.sanearUsuario(item));
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
