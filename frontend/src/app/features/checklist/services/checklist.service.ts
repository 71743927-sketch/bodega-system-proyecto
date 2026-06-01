import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { getApp } from 'firebase/app';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { BloqueChecklist, ChecklistDiario, ChecklistItem } from '../models/checklist-diario';

@Injectable({
  providedIn: 'root'
})
export class ChecklistService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'app_checklists_v5';
  private readonly collectionName = 'checklists';

  private readonly checklistsSubject = new BehaviorSubject<ChecklistDiario[]>([]);
  readonly checklists$ = this.checklistsSubject.asObservable();

  private db: Firestore | null = null;
  private unsubscribeRealtime: (() => void) | null = null;
  private initialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const local = this.readLocal();
    this.checklistsSubject.next(this.sortChecklists(local));

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
          return this.mapRawToChecklist(docSnap.id, raw);
        });
        const sorted = this.sortChecklists(data);
        this.checklistsSubject.next(sorted);
        this.writeLocal(sorted);
      }, () => {
        // Mantener último estado local.
      });
    } catch {
      // No romper UI.
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private now(): number {
    return Date.now();
  }

  private generateId(prefix: string = 'chk'): string {
    return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  }

  private sanitizeText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeCriticidad(value: unknown): 'BAJA' | 'MEDIA' | 'ALTA' {
    const v = this.sanitizeText(value).toLowerCase();
    if (v === 'alta' || v === 'high' || v === 'critica' || v === 'crítica') return 'ALTA';
    if (v === 'baja' || v === 'low') return 'BAJA';
    return 'MEDIA';
  }

  private normalizeBloque(value: unknown): BloqueChecklist {
    const v = this.sanitizeText(value).toUpperCase();
    if (v === 'CIERRE') return 'CIERRE';
    if (v === 'OPERACION') return 'OPERACION';
    return 'APERTURA';
  }

  private defaultItems(now: number): ChecklistItem[] {
    return [
      {
        id: this.generateId('item'),
        titulo: 'Verificar apertura de caja',
        detalle: 'Confirmar fondo inicial y documentos de caja',
        descripcion: 'Confirmar fondo inicial y documentos de caja',
        categoria: 'APERTURA',
        bloque: 'APERTURA',
        referencia: 'CHK-AP-001',
        criticidad: 'ALTA',
        orden: 1,
        completado: false,
        updatedAt: now
      },
      {
        id: this.generateId('item'),
        titulo: 'Revisar limpieza del área',
        detalle: 'Validar orden y limpieza de la zona operativa',
        descripcion: 'Validar orden y limpieza de la zona operativa',
        categoria: 'OPERACION',
        bloque: 'OPERACION',
        referencia: 'CHK-OP-002',
        criticidad: 'MEDIA',
        orden: 2,
        completado: false,
        updatedAt: now
      },
      {
        id: this.generateId('item'),
        titulo: 'Validar stock crítico',
        detalle: 'Confirmar existencias mínimas de productos sensibles',
        descripcion: 'Confirmar existencias mínimas de productos sensibles',
        categoria: 'OPERACION',
        bloque: 'OPERACION',
        referencia: 'CHK-INV-003',
        criticidad: 'ALTA',
        orden: 3,
        completado: false,
        updatedAt: now
      },
      {
        id: this.generateId('item'),
        titulo: 'Confirmar equipos operativos',
        detalle: 'Probar equipos y periféricos antes de iniciar turno',
        descripcion: 'Probar equipos y periféricos antes de iniciar turno',
        categoria: 'OPERACION',
        bloque: 'OPERACION',
        referencia: 'CHK-EQ-004',
        criticidad: 'MEDIA',
        orden: 4,
        completado: false,
        updatedAt: now
      },
      {
        id: this.generateId('item'),
        titulo: 'Registrar observaciones del turno',
        detalle: 'Anotar incidencias o novedades relevantes',
        descripcion: 'Anotar incidencias o novedades relevantes',
        categoria: 'CIERRE',
        bloque: 'CIERRE',
        referencia: 'CHK-CTR-005',
        criticidad: 'BAJA',
        orden: 5,
        completado: false,
        updatedAt: now
      }
    ];
  }

  private normalizeItem(raw: any, now: number, index: number = 0): ChecklistItem {
    const detalle = raw?.detalle ?? raw?.descripcion ?? '';
    return {
      id: String(raw?.id ?? this.generateId('item')),
      titulo: String(raw?.titulo ?? 'Tarea'),
      detalle: String(detalle ?? ''),
      descripcion: String(raw?.descripcion ?? detalle ?? ''),
      categoria: String(raw?.categoria ?? raw?.bloque ?? 'APERTURA'),
      bloque: this.normalizeBloque(raw?.bloque ?? raw?.categoria ?? 'APERTURA'),
      referencia: String(raw?.referencia ?? ('CHK-REF-' + String(index + 1).padStart(3, '0'))),
      criticidad: this.normalizeCriticidad(raw?.criticidad),
      orden: Number(raw?.orden ?? (index + 1)),
      completado: !!raw?.completado,
      observado: !!raw?.observado,
      observacion: raw?.observacion ?? '',
      completadoAt: raw?.completadoAt != null ? Number(raw.completadoAt) : null,
      completadoPor: raw?.completadoPor ?? null,
      updatedAt: Number(raw?.updatedAt ?? now)
    };
  }

  private mapRawToChecklist(id: string, raw: any): ChecklistDiario {
    const now = this.now();
    const items = Array.isArray(raw?.items)
      ? raw.items.map((x: any, idx: number) => this.normalizeItem(x, now, idx))
      : this.defaultItems(now);

    const usuario = String(raw?.usuario ?? raw?.responsable ?? 'Sistema');

    return {
      id: String(id ?? this.generateId('chk')),
      fecha: String(raw?.fecha ?? this.today()),
      usuario,
      responsable: String(raw?.responsable ?? usuario ?? 'Sistema'),
      estado: (raw?.estado ?? 'pendiente') as any,
      items,
      iniciadoAt: Number(raw?.iniciadoAt ?? raw?.createdAt ?? now),
      finalizadoAt: raw?.finalizadoAt != null ? Number(raw.finalizadoAt) : null,
      createdAt: Number(raw?.createdAt ?? now),
      updatedAt: Number(raw?.updatedAt ?? now)
    };
  }

  private sortChecklists(items: ChecklistDiario[]): ChecklistDiario[] {
    return [...items].sort((a, b) => {
      const byDate = String(b.fecha).localeCompare(String(a.fecha));
      if (byDate !== 0) return byDate;
      return Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0);
    });
  }

  private readLocal(): ChecklistDiario[] {
    if (!this.isBrowser()) return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return this.sortChecklists(parsed.map((x: any) => this.mapRawToChecklist(String(x?.id ?? this.generateId()), x)));
    } catch {
      return [];
    }
  }

  private writeLocal(items: ChecklistDiario[]): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch {}
  }

  private patch(items: ChecklistDiario[]): void {
    const sorted = this.sortChecklists(items);
    this.checklistsSubject.next(sorted);
    this.writeLocal(sorted);
  }

  private persistAsync(item: ChecklistDiario): void {
    if (!this.db || !this.isBrowser()) return;
    setDoc(doc(this.db, this.collectionName, item.id), { ...item }, { merge: true }).catch(() => {});
  }

  private removeRemoteAsync(id: string): void {
    if (!this.db || !this.isBrowser()) return;
    deleteDoc(doc(this.db, this.collectionName, id)).catch(() => {});
  }

  private getAll(): ChecklistDiario[] {
    return this.checklistsSubject.value;
  }

  private ensureChecklist(usuario: string = 'Sistema', fecha?: string): ChecklistDiario {
    const targetDate = fecha ?? this.today();
    const existing = this.getAll().find(x => x.fecha === targetDate && x.usuario === usuario)
      ?? this.getAll().find(x => x.fecha === targetDate);

    if (existing) {
      const normalizado = this.mapRawToChecklist(existing.id, existing);
      if (JSON.stringify(normalizado) !== JSON.stringify(existing)) {
        return this.replaceOne(normalizado);
      }
      return existing;
    }

    const now = this.now();
    const nuevo: ChecklistDiario = {
      id: this.generateId('chk'),
      fecha: targetDate,
      usuario,
      responsable: usuario,
      estado: 'en-proceso',
      items: this.defaultItems(now),
      iniciadoAt: now,
      finalizadoAt: null,
      createdAt: now,
      updatedAt: now
    };

    this.patch([nuevo, ...this.getAll()]);
    this.persistAsync(nuevo);
    return nuevo;
  }

  private replaceOne(updated: ChecklistDiario): ChecklistDiario {
    const next = this.getAll().map(x => x.id === updated.id ? updated : x);
    this.patch(next);
    this.persistAsync(updated);
    return updated;
  }

  listarChecklists$(): Observable<ChecklistDiario[]> {
    return this.checklists$;
  }

  obtenerChecklists$(): Observable<ChecklistDiario[]> {
    return this.checklists$;
  }

  listarHistorial$(): Observable<ChecklistDiario[]> {
    return this.checklists$;
  }

  listarChecklists(): ChecklistDiario[] {
    return this.getAll();
  }

  obtenerChecklists(): ChecklistDiario[] {
    return this.getAll();
  }

  listarHistorial(): ChecklistDiario[] {
    return this.getAll();
  }

  obtenerChecklistPorFecha(fecha: string): ChecklistDiario | null {
    return this.getAll().find(x => x.fecha === fecha) ?? null;
  }

  obtenerChecklistDelDia(usuario: string = 'Sistema'): ChecklistDiario {
    return this.ensureChecklist(usuario, this.today());
  }

  iniciarChecklist(usuario: string = 'Sistema'): ChecklistDiario {
    return this.ensureChecklist(usuario, this.today());
  }

  reiniciarChecklist(usuario: string = 'Sistema'): ChecklistDiario {
    const fecha = this.today();
    const existente = this.getAll().find(x => x.fecha === fecha && x.usuario === usuario)
      ?? this.getAll().find(x => x.fecha === fecha);

    const now = this.now();
    const nuevo: ChecklistDiario = {
      id: existente?.id ?? this.generateId('chk'),
      fecha,
      usuario,
      responsable: usuario,
      estado: 'en-proceso',
      items: this.defaultItems(now),
      iniciadoAt: now,
      finalizadoAt: null,
      createdAt: existente?.createdAt ?? now,
      updatedAt: now
    };

    if (existente) {
      return this.replaceOne(nuevo);
    }

    this.patch([nuevo, ...this.getAll()]);
    this.persistAsync(nuevo);
    return nuevo;
  }

  alternarItem(checklist: ChecklistDiario, itemId: string): ChecklistDiario {
    const actual = this.ensureChecklist(checklist?.usuario ?? checklist?.responsable ?? 'Sistema', checklist?.fecha ?? this.today());
    const now = this.now();

    const items = actual.items.map(item => {
      if (item.id !== itemId) return item;
      const nuevoEstado = !item.completado;
      return {
        ...item,
        completado: nuevoEstado,
        completadoAt: nuevoEstado ? now : null,
        completadoPor: nuevoEstado ? (actual.responsable || actual.usuario || 'Sistema') : null,
        updatedAt: now
      } as ChecklistItem;
    });

    const actualizado: ChecklistDiario = {
      ...actual,
      items,
      estado: items.every(x => x.completado) ? 'completado' : 'en-proceso',
      updatedAt: now
    };

    return this.replaceOne(actualizado);
  }

  actualizarObservacion(checklist: ChecklistDiario, itemId: string, observacion: string): ChecklistDiario {
    const actual = this.ensureChecklist(checklist?.usuario ?? checklist?.responsable ?? 'Sistema', checklist?.fecha ?? this.today());
    const now = this.now();

    const items = actual.items.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        observacion,
        observado: !!this.sanitizeText(observacion),
        updatedAt: now
      } as ChecklistItem;
    });

    const actualizado: ChecklistDiario = {
      ...actual,
      items,
      updatedAt: now
    };

    return this.replaceOne(actualizado);
  }

  completarBloque(checklist: ChecklistDiario, bloque: BloqueChecklist | string): ChecklistDiario {
    const actual = this.ensureChecklist(checklist?.usuario ?? checklist?.responsable ?? 'Sistema', checklist?.fecha ?? this.today());
    const key = this.normalizeBloque(bloque);
    const now = this.now();

    const items = actual.items.map(item => {
      if (item.bloque !== key) return item;
      return {
        ...item,
        completado: true,
        completadoAt: now,
        completadoPor: actual.responsable || actual.usuario || 'Sistema',
        updatedAt: now
      } as ChecklistItem;
    });

    const actualizado: ChecklistDiario = {
      ...actual,
      items,
      estado: items.every(x => x.completado) ? 'completado' : 'en-proceso',
      updatedAt: now
    };

    return this.replaceOne(actualizado);
  }

  actualizarChecklist(id: string, changes: Partial<ChecklistDiario>): ChecklistDiario | null {
    const checklist = this.getAll().find(x => x.id === id);
    if (!checklist) return null;

    const actualizado: ChecklistDiario = {
      ...checklist,
      ...changes,
      responsable: String(changes.responsable ?? changes.usuario ?? checklist.responsable ?? checklist.usuario ?? 'Sistema'),
      usuario: String(changes.usuario ?? checklist.usuario ?? checklist.responsable ?? 'Sistema'),
      updatedAt: this.now()
    };

    return this.replaceOne(actualizado);
  }

  finalizarChecklist(id: string, usuario: string = 'Sistema'): ChecklistDiario | null {
    return this.actualizarChecklist(id, {
      usuario,
      responsable: usuario,
      estado: 'cerrado',
      finalizadoAt: this.now()
    });
  }

  cerrarChecklist(id: string, usuario: string = 'Sistema'): ChecklistDiario | null {
    return this.finalizarChecklist(id, usuario);
  }

  reemplazarDesdeRespaldo(items: ChecklistDiario[] | null | undefined): void {
    const normalizados = Array.isArray(items)
      ? items.map(x => this.mapRawToChecklist(String(x?.id ?? this.generateId('chk')), x))
      : [];
    this.patch(normalizados);
    normalizados.forEach(x => this.persistAsync(x));
  }

  eliminarChecklist(id: string): void {
    const next = this.getAll().filter(x => x.id !== id);
    this.patch(next);
    this.removeRemoteAsync(id);
  }

  exportarChecklist(fileName: string, content: string): void {
    if (!this.isBrowser()) return;
    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'checklist.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Ignorar si no se puede descargar.
    }
  }

  sincronizarLocalAFirestore(): number {
    const local = this.readLocal();
    if (local.length === 0) return 0;
    local.forEach(x => this.persistAsync(x));
    return local.length;
  }

  cerrarRealtime(): void {
    if (this.unsubscribeRealtime) {
      try { this.unsubscribeRealtime(); } catch {}
      this.unsubscribeRealtime = null;
    }
  }
}
