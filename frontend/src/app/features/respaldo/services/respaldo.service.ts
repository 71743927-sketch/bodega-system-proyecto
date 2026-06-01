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
import { MetaRespaldoSistema, RespaldoPayload, RespaldoSistema } from '../models/respaldo-sistema';

@Injectable({
  providedIn: 'root'
})
export class RespaldoService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'app_respaldos_v4';
  private readonly lastBackupKey = 'app_respaldo_last_v4';
  private readonly collectionName = 'respaldos';

  private readonly respaldosSubject = new BehaviorSubject<RespaldoSistema[]>([]);
  readonly respaldos$ = this.respaldosSubject.asObservable();

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
    this.respaldosSubject.next(this.sortRespaldos(local));

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
        const data = snapshot.docs.map(docSnap => this.mapRawToRespaldo(docSnap.id, docSnap.data() as any));
        const sorted = this.sortRespaldos(data);
        this.respaldosSubject.next(sorted);
        this.writeLocal(sorted);
      }, () => {});
    } catch {}
  }

  private now(): number { return Date.now(); }
  private nowIso(): string { return new Date().toISOString(); }
  private generateId(prefix: string = 'rsp'): string {
    return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  }
  private sanitizeText(value: unknown): string { return String(value ?? '').trim(); }
  private estimateSizeBytes(payload: unknown): number {
    try { return new Blob([JSON.stringify(payload ?? {})]).size; }
    catch { return JSON.stringify(payload ?? {}).length; }
  }
  private sortRespaldos(items: RespaldoSistema[]): RespaldoSistema[] {
    return [...items].sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
  }
  private toArray(value: any): any[] { return Array.isArray(value) ? value : []; }

  private buildMeta(raw: any, payload: RespaldoPayload, usuario: string): MetaRespaldoSistema {
    const meta = (payload?.meta ?? raw?.meta ?? {}) as MetaRespaldoSistema;
    return {
      source: String(meta?.source ?? 'browser'),
      capturedAt: Number(meta?.capturedAt ?? this.now()),
      generadoEn: String(meta?.generadoEn ?? this.nowIso()),
      generadoPor: String(meta?.generadoPor ?? usuario ?? 'Sistema'),
      notas: String(meta?.notas ?? raw?.descripcion ?? ''),
      appKeys: Array.isArray(meta?.appKeys) ? meta.appKeys : [],
      rawLocalStorage: (meta?.rawLocalStorage ?? {}) as Record<string, any>,
      ...meta
    };
  }

  private mapRawToRespaldo(id: string, raw: any): RespaldoSistema {
    const now = this.now();
    const payload = (raw?.payload ?? raw ?? {}) as RespaldoPayload;
    const usuario = String(raw?.usuario ?? 'Sistema');
    const meta = this.buildMeta(raw, payload, usuario);

    return {
      id: String(id ?? raw?.id ?? this.generateId('rsp')),
      nombre: String(raw?.nombre ?? 'Respaldo'),
      descripcion: String(raw?.descripcion ?? ''),
      usuario,
      origen: (raw?.origen ?? 'manual') as any,
      modulo: String(raw?.modulo ?? 'general'),
      meta,
      configuracion: this.toArray(raw?.configuracion ?? payload?.configuracion),
      productos: this.toArray(raw?.productos ?? payload?.productos ?? payload?.inventario),
      ventas: this.toArray(raw?.ventas ?? payload?.ventas),
      compras: this.toArray(raw?.compras ?? payload?.compras),
      proveedores: this.toArray(raw?.proveedores ?? payload?.proveedores),
      usuarios: this.toArray(raw?.usuarios ?? payload?.usuarios),
      movimientosInventario: this.toArray(raw?.movimientosInventario ?? payload?.movimientosInventario),
      cierresCaja: this.toArray(raw?.cierresCaja ?? payload?.cierresCaja ?? payload?.cierreDiario),
      auditoria: this.toArray(raw?.auditoria ?? payload?.auditoria),
      alertasDescartadas: this.toArray(raw?.alertasDescartadas ?? payload?.alertasDescartadas),
      checklist: this.toArray(raw?.checklist ?? payload?.checklist),
      cierreDiario: this.toArray(raw?.cierreDiario ?? payload?.cierreDiario),
      payload,
      sizeBytes: Number(raw?.sizeBytes ?? this.estimateSizeBytes(payload)),
      createdAt: Number(raw?.createdAt ?? now),
      updatedAt: Number(raw?.updatedAt ?? now)
    };
  }

  private readLocal(): RespaldoSistema[] {
    if (!this.isBrowser()) return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return this.sortRespaldos(parsed.map((x: any) => this.mapRawToRespaldo(String(x?.id ?? this.generateId()), x)));
    } catch { return []; }
  }

  private writeLocal(items: RespaldoSistema[]): void {
    if (!this.isBrowser()) return;
    try { localStorage.setItem(this.storageKey, JSON.stringify(items)); } catch {}
  }

  private patch(items: RespaldoSistema[]): void {
    const sorted = this.sortRespaldos(items);
    this.respaldosSubject.next(sorted);
    this.writeLocal(sorted);
  }

  private persistAsync(item: RespaldoSistema): void {
    if (!this.db || !this.isBrowser()) return;
    setDoc(doc(this.db, this.collectionName, item.id), { ...item }, { merge: true }).catch(() => {});
  }

  private removeRemoteAsync(id: string): void {
    if (!this.db || !this.isBrowser()) return;
    deleteDoc(doc(this.db, this.collectionName, id)).catch(() => {});
  }

  private getAll(): RespaldoSistema[] { return this.respaldosSubject.value; }

  private tryParse(value: string | null): any {
    if (!value) return null;
    try { return JSON.parse(value); } catch { return value; }
  }

  private collectSystemSnapshot(usuario: string = 'Sistema', notas: string = ''): RespaldoPayload {
    if (!this.isBrowser()) {
      return {
        meta: {
          source: 'server',
          capturedAt: this.now(),
          generadoEn: this.nowIso(),
          generadoPor: usuario,
          notas,
          appKeys: [],
          rawLocalStorage: {}
        }
      };
    }

    const snapshot: RespaldoPayload = {
      meta: {
        capturedAt: this.now(),
        source: 'browser',
        generadoEn: this.nowIso(),
        generadoPor: usuario,
        notas,
        appKeys: [] as string[],
        rawLocalStorage: {}
      }
    };

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      const appKeys = keys.filter(k => k.startsWith('app_'));
      snapshot.meta!.appKeys = appKeys;

      snapshot.auth = this.tryParse(localStorage.getItem('app_auth_session_v8')) ?? this.tryParse(localStorage.getItem('app_auth_session_v7')) ?? this.tryParse(localStorage.getItem('app_auth_session'));
      snapshot.checklist = this.tryParse(localStorage.getItem('app_checklists_v5')) ?? this.tryParse(localStorage.getItem('app_checklists_v4')) ?? this.tryParse(localStorage.getItem('app_checklists'));
      snapshot.cierreDiario = this.tryParse(localStorage.getItem('app_cierres_diarios_v4')) ?? this.tryParse(localStorage.getItem('app_cierres_diarios_v3')) ?? this.tryParse(localStorage.getItem('app_cierres_diarios_v2')) ?? this.tryParse(localStorage.getItem('app_cierres_diarios'));
      snapshot.alertas = this.tryParse(localStorage.getItem('app_alertas'));
      snapshot.inventario = this.tryParse(localStorage.getItem('app_inventario'));
      snapshot.ventas = this.tryParse(localStorage.getItem('app_ventas'));
      snapshot.compras = this.tryParse(localStorage.getItem('app_compras'));
      snapshot.proveedores = this.tryParse(localStorage.getItem('app_proveedores'));
      snapshot.usuarios = this.tryParse(localStorage.getItem('app_usuarios'));
      snapshot.movimientosInventario = this.tryParse(localStorage.getItem('app_movimientos_inventario'));
      snapshot.cierresCaja = this.tryParse(localStorage.getItem('app_cierres_caja'));
      snapshot.auditoria = this.tryParse(localStorage.getItem('app_auditoria'));
      snapshot.alertasDescartadas = this.tryParse(localStorage.getItem('app_alertas_descartadas'));
      snapshot.configuracion = this.tryParse(localStorage.getItem('app_configuracion'));
      snapshot.productos = this.tryParse(localStorage.getItem('app_productos')) ?? this.tryParse(localStorage.getItem('app_inventario'));

      const rawMap: Record<string, any> = {};
      for (const key of appKeys) {
        rawMap[key] = this.tryParse(localStorage.getItem(key));
      }
      snapshot.meta!.rawLocalStorage = rawMap;
    } catch {}

    return snapshot;
  }

  listarRespaldos$(): Observable<RespaldoSistema[]> { return this.respaldos$; }
  listarRespaldos(): RespaldoSistema[] { return this.getAll(); }
  obtenerRespaldos(): RespaldoSistema[] { return this.getAll(); }
  obtenerHistorial(): RespaldoSistema[] { return this.getAll(); }
  ultimoRespaldo(): RespaldoSistema | null { return this.getAll()[0] ?? null; }

  cargarUltimoRespaldo(): RespaldoSistema | null {
    if (this.isBrowser()) {
      try {
        const raw = localStorage.getItem(this.lastBackupKey);
        if (raw) return this.mapRawToRespaldo('', JSON.parse(raw));
      } catch {}
    }
    return this.ultimoRespaldo();
  }

  obtenerPorId(id: string): RespaldoSistema | null { return this.getAll().find(x => x.id === id) ?? null; }

  crearRespaldo(payload: RespaldoPayload, usuario: string = 'Sistema', nombre: string = 'Respaldo manual', descripcion: string = '', origen: 'manual' | 'auto' = 'manual', modulo: string = 'general'): RespaldoSistema {
    const now = this.now();
    const raw = {
      id: this.generateId('rsp'),
      nombre: this.sanitizeText(nombre) || 'Respaldo manual',
      descripcion: this.sanitizeText(descripcion),
      usuario: this.sanitizeText(usuario) || 'Sistema',
      origen,
      modulo: this.sanitizeText(modulo) || 'general',
      payload: payload ?? {},
      sizeBytes: this.estimateSizeBytes(payload),
      createdAt: now,
      updatedAt: now,
      meta: {
        ...(payload?.meta ?? {}),
        generadoEn: payload?.meta?.generadoEn ?? this.nowIso(),
        generadoPor: payload?.meta?.generadoPor ?? usuario,
        notas: payload?.meta?.notas ?? descripcion
      },
      configuracion: payload?.configuracion ?? [],
      productos: payload?.productos ?? payload?.inventario ?? [],
      ventas: payload?.ventas ?? [],
      compras: payload?.compras ?? [],
      proveedores: payload?.proveedores ?? [],
      usuarios: payload?.usuarios ?? [],
      movimientosInventario: payload?.movimientosInventario ?? [],
      cierresCaja: payload?.cierresCaja ?? payload?.cierreDiario ?? [],
      auditoria: payload?.auditoria ?? [],
      alertasDescartadas: payload?.alertasDescartadas ?? [],
      checklist: payload?.checklist ?? [],
      cierreDiario: payload?.cierreDiario ?? []
    };

    const respaldo = this.mapRawToRespaldo(String(raw.id), raw);
    this.patch([respaldo, ...this.getAll()]);
    this.persistAsync(respaldo);
    return respaldo;
  }

  generarRespaldo(usuario: string = 'Sistema', notas: string = ''): RespaldoSistema {
    const payload = this.collectSystemSnapshot(usuario, notas);
    return this.crearRespaldo(payload, usuario, 'Respaldo del sistema', this.sanitizeText(notas) || 'Generado automáticamente desde la pantalla de respaldo', 'manual', 'general');
  }

  guardarRespaldo(respaldo: RespaldoSistema | any): RespaldoSistema {
    const normalizado = this.mapRawToRespaldo(String(respaldo?.id ?? this.generateId('rsp')), respaldo ?? {});
    const existente = this.getAll().find(x => x.id === normalizado.id);
    if (existente) {
      const next = this.getAll().map(x => x.id === normalizado.id ? normalizado : x);
      this.patch(next);
    } else {
      this.patch([normalizado, ...this.getAll()]);
    }
    this.persistAsync(normalizado);
    return normalizado;
  }

  guardarUltimoRespaldo(respaldo: RespaldoSistema | any): RespaldoSistema {
    const normalizado = this.guardarRespaldo(respaldo);
    if (this.isBrowser()) {
      try { localStorage.setItem(this.lastBackupKey, this.serializar(normalizado)); } catch {}
    }
    return normalizado;
  }

  eliminarRespaldo(id: string): void {
    const next = this.getAll().filter(x => x.id !== id);
    this.patch(next);
    this.removeRemoteAsync(id);
  }

  restaurarRespaldo(id: string): RespaldoPayload | null {
    const respaldo = this.obtenerPorId(id);
    return respaldo?.payload ?? null;
  }

  aplicarRespaldo(snap: RespaldoSistema | RespaldoPayload | any): boolean {
    if (!this.isBrowser()) return false;
    try {
      const payload: RespaldoPayload = snap?.payload ? snap.payload : (snap ?? {});
      const tryStore = (key: string, value: any) => {
        if (value === undefined) return;
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
      };

      if (payload.auth != null) tryStore('app_auth_restore_v1', payload.auth);
      if (payload.checklist != null) tryStore('app_checklists_v5', payload.checklist);
      if (payload.cierreDiario != null) tryStore('app_cierres_diarios_v4', payload.cierreDiario);
      if (payload.alertas != null) tryStore('app_alertas', payload.alertas);
      if (payload.inventario != null) tryStore('app_inventario', payload.inventario);
      if (payload.productos != null) tryStore('app_productos', payload.productos);
      if (payload.ventas != null) tryStore('app_ventas', payload.ventas);
      if (payload.compras != null) tryStore('app_compras', payload.compras);
      if (payload.proveedores != null) tryStore('app_proveedores', payload.proveedores);
      if (payload.usuarios != null) tryStore('app_usuarios', payload.usuarios);
      if (payload.movimientosInventario != null) tryStore('app_movimientos_inventario', payload.movimientosInventario);
      if (payload.cierresCaja != null) tryStore('app_cierres_caja', payload.cierresCaja);
      if (payload.auditoria != null) tryStore('app_auditoria', payload.auditoria);
      if (payload.alertasDescartadas != null) tryStore('app_alertas_descartadas', payload.alertasDescartadas);
      if (payload.configuracion != null) tryStore('app_configuracion', payload.configuracion);

      const rawMap = payload?.meta?.rawLocalStorage;
      if (rawMap && typeof rawMap === 'object') {
        for (const [key, value] of Object.entries(rawMap)) {
          tryStore(key, value);
        }
      }

      try { localStorage.setItem('app_respaldo_aplicado_v4', JSON.stringify({ appliedAt: this.now(), payload })); } catch {}
      return true;
    } catch { return false; }
  }

  reemplazarDesdeRespaldo(items: RespaldoSistema[] | null | undefined): void {
    const normalizados = Array.isArray(items) ? items.map(x => this.mapRawToRespaldo(String(x?.id ?? this.generateId('rsp')), x)) : [];
    this.patch(normalizados);
    normalizados.forEach(x => this.persistAsync(x));
  }

  serializar(respaldo: RespaldoSistema | any): string {
    const normalizado = this.mapRawToRespaldo(String(respaldo?.id ?? this.generateId('rsp')), respaldo ?? {});
    return JSON.stringify(normalizado, null, 2);
  }

  parsear(content: string): RespaldoSistema | null {
    try {
      const parsed = JSON.parse(content ?? '{}');
      return this.mapRawToRespaldo(String(parsed?.id ?? this.generateId('rsp')), parsed);
    } catch { return null; }
  }

  exportarRespaldo(fileName: string, content: string): void {
    if (!this.isBrowser()) return;
    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'respaldo.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }

  descargar(fileName: string, content: string): void { this.exportarRespaldo(fileName, content); }

  importarRespaldo(content: string, usuario: string = 'Sistema'): RespaldoSistema | null {
    try {
      const parsed = JSON.parse(content ?? '{}');
      if (parsed?.payload || parsed?.meta || parsed?.productos || parsed?.ventas) {
        return this.guardarRespaldo({ ...parsed, usuario: parsed?.usuario ?? usuario, updatedAt: this.now(), createdAt: parsed?.createdAt ?? this.now() });
      }
      return this.crearRespaldo(parsed as RespaldoPayload, usuario, 'Respaldo importado', 'Importado desde archivo', 'manual', 'general');
    } catch { return null; }
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
