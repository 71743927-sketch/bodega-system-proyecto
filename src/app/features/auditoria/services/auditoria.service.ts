import { Injectable, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { firestoreDb } from '../../../core/firebase/firebase.config';

const STORAGE_KEY = 'bodega-auditoria';

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {
  readonly auditorias = signal<any[]>([]);
  readonly auditoriasLectura = this.auditorias.asReadonly();

  // Aliases por compatibilidad amplia
  readonly eventos = this.auditorias.asReadonly();
  readonly eventosLectura = this.auditorias.asReadonly();
  readonly registros = this.auditorias.asReadonly();
  readonly registrosLectura = this.auditorias.asReadonly();

  private migrationTried = false;

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const ref = collection(firestoreDb, 'auditoria');

    onSnapshot(ref, {
      next: snapshot => {
        const items = snapshot.docs.map(docSnap => this.sanearRegistro(docSnap.data()));
        this.auditorias.set(this.ordenar(items));
        this.intentarMigracionInicial(items);
      },
      error: () => {
        const local = this.cargarDesdeStorage();
        this.auditorias.set(this.ordenar(local));
      }
    });
  }

  // ==========================================================
  // API PRINCIPAL DE REGISTRO
  // ==========================================================
  registrar(
    modulo: string,
    accion: string,
    descripcion: string,
    nivel: string = 'INFO',
    detalle: string = '',
    usuario: string = 'Sistema'
  ) {
    const payload = this.normalizarRegistro({
      modulo,
      accion,
      descripcion,
      nivel,
      detalle,
      usuario,
      fecha: new Date().toISOString()
    });

    this.registrarEvento(payload);
  }

  registrarEvento(evento: any) {
    const payload = this.normalizarRegistro(evento);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'auditoria', String(id)), payload)
      .catch(() => {
        const nueva = this.ordenar([payload, ...this.auditorias()]);
        this.auditorias.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  agregarRegistro(evento: any) { this.registrarEvento(evento); }
  crearRegistro(evento: any) { this.registrarEvento(evento); }

  actualizarRegistro(eventoActualizado: any) {
    const payload = this.normalizarRegistro(eventoActualizado);
    const id = this.extraerId(payload);

    setDoc(doc(firestoreDb, 'auditoria', String(id)), payload, { merge: true })
      .catch(() => {
        const nueva = this.ordenar(
          this.auditorias().map((item: any) => this.extraerId(item) === id ? payload : item)
        );
        this.auditorias.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  editarRegistro(eventoActualizado: any) { this.actualizarRegistro(eventoActualizado); }

  eliminarRegistro(id: number | string) {
    const idNum = Number(id);

    deleteDoc(doc(firestoreDb, 'auditoria', String(idNum)))
      .catch(() => {
        const nueva = this.auditorias().filter((item: any) => this.extraerId(item) !== idNum);
        this.auditorias.set(nueva);
        this.guardarEnStorage(nueva);
      });
  }

  borrarRegistro(id: number | string) { this.eliminarRegistro(id); }

  limpiarTodo() {
    this.auditorias.set([]);
    this.guardarEnStorage([]);
  }

  limpiarEventos() {
    this.limpiarTodo();
  }

  reemplazarRegistros(items: any[]) {
    const saneados = items.map(item => this.normalizarRegistro(item));

    saneados.forEach(item => {
      const id = this.extraerId(item);
      setDoc(doc(firestoreDb, 'auditoria', String(id)), item).catch(() => {});
    });

    this.auditorias.set(this.ordenar(saneados));
    this.guardarEnStorage(saneados);
  }

  reemplazarEventos(items: any[]) {
    this.reemplazarRegistros(items);
  }

  // ==========================================================
  // CONSULTAS / FILTROS
  // ==========================================================
  obtenerPorId(id: number | string): any | null {
    const idNum = Number(id);
    return this.auditorias().find((item: any) => this.extraerId(item) === idNum) ?? null;
  }

  obtenerRecientes(limite = 20): any[] {
    return this.ordenar(this.auditorias()).slice(0, limite);
  }

  obtenerPorModulo(modulo: string): any[] {
    const target = String(modulo || '').trim().toUpperCase();
    return this.auditorias().filter((item: any) => this.extraerModulo(item) === target);
  }

  obtenerPorNivel(nivel: string): any[] {
    const target = String(nivel || '').trim().toUpperCase();
    return this.auditorias().filter((item: any) => this.extraerNivel(item) === target);
  }

  buscarTexto(texto: string): any[] {
    const target = String(texto || '').trim().toLowerCase();
    if (!target) {
      return this.auditorias();
    }

    return this.auditorias().filter((item: any) => {
      const modulo = String(item.modulo || '').toLowerCase();
      const accion = String(item.accion || '').toLowerCase();
      const descripcion = String(item.descripcion || '').toLowerCase();
      const detalle = String(item.detalle || '').toLowerCase();
      const usuario = String(item.usuario || '').toLowerCase();
      return modulo.includes(target) || accion.includes(target) || descripcion.includes(target) || detalle.includes(target) || usuario.includes(target);
    });
  }

  contarPorNivel(nivel: string): number {
    return this.obtenerPorNivel(nivel).length;
  }

  contarPorModulo(modulo: string): number {
    return this.obtenerPorModulo(modulo).length;
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
      this.reemplazarRegistros(local);
    }
  }

  // ==========================================================
  // NORMALIZACIÓN
  // ==========================================================
  private normalizarRegistro(item: any): any {
    const raw = this.asRecord(item);

    return {
      ...(raw as Record<string, unknown>),
      id: this.extraerId(item),
      modulo: this.extraerModulo(raw),
      accion: this.extraerAccion(raw),
      descripcion: raw['descripcion'] ? String(raw['descripcion']).trim() : '',
      nivel: this.extraerNivel(raw),
      detalle: raw['detalle'] ? String(raw['detalle']).trim() : (raw['detalles'] ? String(raw['detalles']).trim() : ''),
      usuario: raw['usuario'] ? String(raw['usuario']).trim() : 'Sistema',
      fecha: raw['fecha'] ? String(raw['fecha']) : new Date().toISOString()
    };
  }

  private sanearRegistro(data: unknown): any {
    const raw = this.asRecord(data);
    return this.normalizarRegistro(raw);
  }

  private ordenar(items: any[]): any[] {
    return [...items].sort((a: any, b: any) => new Date(String(b.fecha || '')).getTime() - new Date(String(a.fecha || '')).getTime());
  }

  private extraerId(item: any): number {
    const raw = this.asRecord(item);
    const id = Number(raw['id']);
    return Number.isFinite(id) && id > 0 ? id : Date.now();
  }

  private extraerModulo(item: any): string {
    const raw = this.asRecord(item);
    return String(raw['modulo'] || 'GENERAL').trim().toUpperCase();
  }

  private extraerAccion(item: any): string {
    const raw = this.asRecord(item);
    return String(raw['accion'] || 'ACCION').trim().toUpperCase();
  }

  private extraerNivel(item: any): string {
    const raw = this.asRecord(item);
    const nivel = String(raw['nivel'] || raw['tipo'] || 'INFO').trim().toUpperCase();
    if (nivel === 'SUCCESS' || nivel === 'INFO' || nivel === 'WARNING' || nivel === 'DANGER' || nivel === 'ERROR') {
      return nivel;
    }
    return 'INFO';
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

      return parsed.map(item => this.sanearRegistro(item));
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
