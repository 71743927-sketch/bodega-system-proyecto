import { Injectable, inject, PLATFORM_ID, signal, WritableSignal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { getApp } from 'firebase/app';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { Alerta, ActualizarAlertaInput, CrearAlertaInput } from '../models/alerta.model';

@Injectable({
  providedIn: 'root'
})
export class AlertasService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'app_alertas';
  private readonly descartadasKey = 'app_alertas_descartadas';
  private readonly collectionName = 'alertas';

  private readonly alertasSubject = new BehaviorSubject<Alerta[]>([]);
  readonly alertas$ = this.alertasSubject.asObservable();

  // Compatibilidad con páginas/servicios existentes
  descartadas: WritableSignal<string[]> = signal<string[]>([]);

  private db: Firestore | null = null;
  private unsubscribeRealtime: (() => void) | null = null;
  private initialized = false;

  constructor() {
    this.init();
  }

  // ============================================================
  // INICIALIZACIÓN
  // ============================================================
  private init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.descartadas.set(this.readDescartadasLocal());

    const initial = this.readLocal();
    this.alertasSubject.next(this.sortAlertas(initial));

    if (!this.isBrowser()) return;

    this.db = this.tryResolveFirestore();
    if (this.db) {
      this.startRealtimeSync();
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private tryResolveFirestore(): Firestore | null {
    try {
      const app = getApp();
      return getFirestore(app);
    } catch {
      return null;
    }
  }

  private startRealtimeSync(): void {
    if (!this.db || !this.isBrowser()) return;

    try {
      const ref = collection(this.db, this.collectionName);
      this.unsubscribeRealtime = onSnapshot(ref, snapshot => {
        const data = snapshot.docs.map(docSnap => {
          const raw = docSnap.data() as any;
          return this.mapDocToAlerta(docSnap.id, raw);
        });

        const sorted = this.sortAlertas(data);
        this.alertasSubject.next(sorted);
        this.writeLocal(sorted);
      }, () => {
        // Mantener fallback local si Firestore falla.
      });
    } catch {
      // No romper UI.
    }
  }

  private mapDocToAlerta(id: string, raw: any): Alerta {
    const createdAt = this.toMillis(raw?.createdAt) ?? Date.now();
    const updatedAt = this.toMillis(raw?.updatedAt) ?? createdAt;
    const leidaAt = this.toMillis(raw?.leidaAt);

    return {
      id,
      titulo: String(raw?.titulo ?? 'Alerta'),
      mensaje: String(raw?.mensaje ?? ''),
      prioridad: (raw?.prioridad ?? 'media') as any,
      estado: (raw?.estado ?? 'pendiente') as any,
      tipo: raw?.tipo ?? 'general',
      categoria: raw?.categoria ?? 'general',
      modulo: raw?.modulo ?? 'alertas',
      usuario: raw?.usuario ?? '',
      usuarioId: raw?.usuarioId ?? '',
      leidaPor: raw?.leidaPor ?? null,
      origen: raw?.origen ?? 'sistema',
      metadata: raw?.metadata ?? {},
      createdAt,
      updatedAt,
      leidaAt: leidaAt ?? null
    };
  }

  private toMillis(value: any): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return Math.trunc(value.seconds * 1000);
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? null : parsed;
  }

  private sortAlertas(items: Alerta[]): Alerta[] {
    return [...items].sort((a, b) => {
      const diff = (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (diff !== 0) return diff;
      return String(a.titulo).localeCompare(String(b.titulo));
    });
  }

  private readLocal(): Alerta[] {
    if (!this.isBrowser()) return [];

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return this.sortAlertas(parsed.map((x: any) => this.mapLocalToAlerta(x)));
    } catch {
      return [];
    }
  }

  private mapLocalToAlerta(raw: any): Alerta {
    const now = Date.now();
    return {
      id: String(raw?.id ?? this.generateId()),
      titulo: String(raw?.titulo ?? 'Alerta'),
      mensaje: String(raw?.mensaje ?? ''),
      prioridad: (raw?.prioridad ?? 'media') as any,
      estado: (raw?.estado ?? 'pendiente') as any,
      tipo: raw?.tipo ?? 'general',
      categoria: raw?.categoria ?? 'general',
      modulo: raw?.modulo ?? 'alertas',
      usuario: raw?.usuario ?? '',
      usuarioId: raw?.usuarioId ?? '',
      leidaPor: raw?.leidaPor ?? null,
      origen: raw?.origen ?? 'local',
      metadata: raw?.metadata ?? {},
      createdAt: Number(raw?.createdAt ?? now),
      updatedAt: Number(raw?.updatedAt ?? now),
      leidaAt: raw?.leidaAt != null ? Number(raw.leidaAt) : null
    };
  }

  private writeLocal(items: Alerta[]): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch {}
  }

  private readDescartadasLocal(): string[] {
    if (!this.isBrowser()) return [];
    try {
      const raw = localStorage.getItem(this.descartadasKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x: any) => String(x)) : [];
    } catch {
      return [];
    }
  }

  private writeDescartadasLocal(items: string[]): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(this.descartadasKey, JSON.stringify(items));
    } catch {}
  }

  private generateId(): string {
    return 'alt_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  }

  private toCreatePayload(input: CrearAlertaInput): Omit<Alerta, 'id'> {
    const now = Date.now();
    return {
      titulo: String(input.titulo ?? 'Alerta'),
      mensaje: String(input.mensaje ?? ''),
      prioridad: (input.prioridad ?? 'media') as any,
      estado: (input.estado ?? 'pendiente') as any,
      tipo: input.tipo ?? 'general',
      categoria: input.categoria ?? 'general',
      modulo: input.modulo ?? 'alertas',
      usuario: input.usuario ?? '',
      usuarioId: input.usuarioId ?? '',
      leidaPor: null,
      origen: input.origen ?? 'sistema',
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      leidaAt: null
    };
  }

  private patchCollection(items: Alerta[]): void {
    const sorted = this.sortAlertas(items);
    this.alertasSubject.next(sorted);
    this.writeLocal(sorted);
  }

  private async upsertFirestoreItem(alerta: Alerta): Promise<void> {
    if (!this.db) return;
    await setDoc(doc(this.db, this.collectionName, alerta.id), { ...alerta }, { merge: true });
  }

  // ============================================================
  // COMPATIBILIDAD: DESCARTES
  // ============================================================
  estaDescartada(id: string): boolean {
    const key = String(id ?? '');
    if (!key) return false;
    return this.descartadas().includes(key);
  }

  descartarAlerta(id: string): void {
    const key = String(id ?? '');
    if (!key) return;
    if (this.estaDescartada(key)) return;
    const next = [...this.descartadas(), key];
    this.descartadas.set(next);
    this.writeDescartadasLocal(next);
  }

  restaurarAlerta(id: string): void {
    const key = String(id ?? '');
    if (!key) return;
    const next = this.descartadas().filter(x => x !== key);
    this.descartadas.set(next);
    this.writeDescartadasLocal(next);
  }

  limpiarDescartes(): void {
    this.descartadas.set([]);
    this.writeDescartadasLocal([]);
  }

  reemplazarDescartadas(items: string[] | null | undefined): void {
    const normalizadas = Array.isArray(items) ? items.map(x => String(x)) : [];
    const unicas = Array.from(new Set(normalizadas));
    this.descartadas.set(unicas);
    this.writeDescartadasLocal(unicas);
  }

  // ============================================================
  // CONSULTAS PRINCIPALES
  // ============================================================
  listarAlertas(): Observable<Alerta[]> {
    return this.alertas$;
  }

  obtenerAlertas(): Observable<Alerta[]> {
    return this.alertas$;
  }

  getAlertas(): Observable<Alerta[]> {
    return this.alertas$;
  }

  listar(): Observable<Alerta[]> {
    return this.alertas$;
  }

  obtenerTodas(): Observable<Alerta[]> {
    return this.alertas$;
  }

  obtenerPendientes(): Observable<Alerta[]> {
    return this.alertas$.pipe(map(items => items.filter(x => x.estado === 'pendiente')));
  }

  obtenerLeidas(): Observable<Alerta[]> {
    return this.alertas$.pipe(map(items => items.filter(x => x.estado === 'leida')));
  }

  contarPendientes(): Observable<number> {
    return this.alertas$.pipe(map(items => items.filter(x => x.estado === 'pendiente').length));
  }

  obtenerPorId(id: string): Observable<Alerta | undefined> {
    return this.alertas$.pipe(map(items => items.find(x => x.id === id)));
  }

  // ============================================================
  // CRUD PRINCIPAL
  // ============================================================
  async crearAlerta(input: CrearAlertaInput): Promise<Alerta> {
    const payload = this.toCreatePayload(input);

    if (this.db && this.isBrowser()) {
      try {
        const ref = await addDoc(collection(this.db, this.collectionName), payload as any);
        const created: Alerta = { id: ref.id, ...payload };
        const next = [created, ...this.alertasSubject.value.filter(x => x.id !== created.id)];
        this.patchCollection(next);
        return created;
      } catch {
        // fallback local
      }
    }

    const localItem: Alerta = { id: this.generateId(), ...payload };
    const next = [localItem, ...this.alertasSubject.value.filter(x => x.id !== localItem.id)];
    this.patchCollection(next);
    return localItem;
  }

  async registrarAlerta(input: CrearAlertaInput): Promise<Alerta> {
    return this.crearAlerta(input);
  }

  async agregarAlerta(input: CrearAlertaInput): Promise<Alerta> {
    return this.crearAlerta(input);
  }

  async agregar(input: CrearAlertaInput): Promise<Alerta> {
    return this.crearAlerta(input);
  }

  async actualizarAlerta(id: string, changes: ActualizarAlertaInput): Promise<void> {
    const current = this.alertasSubject.value.find(x => x.id === id);
    if (!current) return;

    const updated: Alerta = {
      ...current,
      ...changes,
      updatedAt: Date.now()
    };

    if (this.db && this.isBrowser()) {
      try {
        await updateDoc(doc(this.db, this.collectionName, id), {
          ...changes,
          updatedAt: Date.now()
        } as any);
      } catch {}
    }

    const next = this.alertasSubject.value.map(x => x.id === id ? updated : x);
    this.patchCollection(next);
  }

  async actualizar(id: string, changes: ActualizarAlertaInput): Promise<void> {
    return this.actualizarAlerta(id, changes);
  }

  async marcarComoLeida(id: string, usuario: string = 'Sistema'): Promise<void> {
    await this.actualizarAlerta(id, {
      estado: 'leida',
      leidaPor: usuario,
      leidaAt: Date.now()
    });
  }

  async marcarLeida(id: string, usuario: string = 'Sistema'): Promise<void> {
    return this.marcarComoLeida(id, usuario);
  }

  async archivarAlerta(id: string): Promise<void> {
    await this.actualizarAlerta(id, { estado: 'archivada' });
  }

  async eliminarAlerta(id: string): Promise<void> {
    if (this.db && this.isBrowser()) {
      try {
        await deleteDoc(doc(this.db, this.collectionName, id));
      } catch {}
    }

    const next = this.alertasSubject.value.filter(x => x.id !== id);
    this.patchCollection(next);
  }

  async eliminar(id: string): Promise<void> {
    return this.eliminarAlerta(id);
  }

  async borrarAlerta(id: string): Promise<void> {
    return this.eliminarAlerta(id);
  }

  async limpiarTodas(): Promise<void> {
    const items = this.alertasSubject.value;

    if (this.db && this.isBrowser()) {
      try {
        const snapshot = await getDocs(collection(this.db, this.collectionName));
        await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
      } catch {}
    }

    if (items.length > 0) {
      this.patchCollection([]);
    }
  }

  // ============================================================
  // UTILIDADES / MIGRACIÓN
  // ============================================================
  async sincronizarLocalAFirestore(): Promise<number> {
    if (!this.db || !this.isBrowser()) return 0;

    const local = this.readLocal();
    if (local.length === 0) return 0;

    let count = 0;
    for (const item of local) {
      try {
        await this.upsertFirestoreItem(item);
        count++;
      } catch {}
    }
    return count;
  }

  cerrarRealtime(): void {
    if (this.unsubscribeRealtime) {
      try { this.unsubscribeRealtime(); } catch {}
      this.unsubscribeRealtime = null;
    }
  }
}
