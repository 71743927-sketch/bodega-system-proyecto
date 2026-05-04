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
import { ChecklistService } from '../../checklist/services/checklist.service';
import { ChecklistDiario } from '../../checklist/models/checklist-diario';
import {
  CierreDiarioReporte,
  PendienteCierreDiario
} from '../models/cierre-diario-report';

@Injectable({
  providedIn: 'root'
})
export class CierreDiarioService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly checklistService = inject(ChecklistService);
  private readonly storageKey = 'app_cierres_diarios_v4';
  private readonly collectionName = 'cierresDiarios';
  private readonly version = '4.0';

  private readonly reportesSubject = new BehaviorSubject<CierreDiarioReporte[]>([]);
  readonly reportes$ = this.reportesSubject.asObservable();

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
    this.reportesSubject.next(this.sortReportes(local));

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
        const data = snapshot.docs.map(docSnap => this.mapRawToReporte(docSnap.id, docSnap.data() as any));
        const sorted = this.sortReportes(data);
        this.reportesSubject.next(sorted);
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

  private nowIso(): string {
    return new Date().toISOString();
  }

  private generateId(prefix: string = 'cdr'): string {
    return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  }

  private sanitizeText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeCriticidad(value: unknown): 'BAJA' | 'MEDIA' | 'ALTA' {
    const v = this.sanitizeText(value).toUpperCase();
    if (v === 'ALTA') return 'ALTA';
    if (v === 'BAJA') return 'BAJA';
    return 'MEDIA';
  }

  private sortReportes(items: CierreDiarioReporte[]): CierreDiarioReporte[] {
    return [...items].sort((a, b) => {
      const byDate = String(b.contexto?.fecha ?? '').localeCompare(String(a.contexto?.fecha ?? ''));
      if (byDate !== 0) return byDate;
      return Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0);
    });
  }

  private extractPendientes(checklist: ChecklistDiario | null | undefined): PendienteCierreDiario[] {
    const items = checklist?.items ?? [];
    return items
      .filter(item => !item.completado)
      .map(item => ({
        id: String(item.id),
        titulo: String(item.titulo ?? 'Pendiente'),
        criticidad: this.normalizeCriticidad(item.criticidad),
        referencia: item.referencia ?? '',
        bloque: item.bloque ?? item.categoria ?? ''
      }));
  }

  private buildMetricas(checklist: ChecklistDiario | null | undefined, ventasTotal: number = 0, comprasTotal: number = 0) {
    const items = checklist?.items ?? [];
    const completadosChecklist = items.filter(item => item.completado).length;
    const totalItemsChecklist = items.length;
    const pendientesChecklist = Math.max(0, totalItemsChecklist - completadosChecklist);
    const pendientesCriticos = items.filter(item => !item.completado && this.normalizeCriticidad(item.criticidad) === 'ALTA').length;
    const porcentajeChecklist = totalItemsChecklist === 0 ? 0 : Math.round((completadosChecklist / totalItemsChecklist) * 100);
    const ventas = Number(ventasTotal ?? 0);
    const compras = Number(comprasTotal ?? 0);

    return {
      totalItemsChecklist,
      completadosChecklist,
      pendientesChecklist,
      porcentajeChecklist,
      pendientesCriticos,
      ventasDelDia: ventas,
      comprasDelDia: compras,
      ventasTotal: ventas,
      comprasTotal: compras,
      productosStockCritico: pendientesCriticos,
      eventosWarningHoy: 0,
      eventosCriticosHoy: 0,
      diferenciaCajaPromedioHoy: 0,
      utilidadEstimada: ventas - compras,
      ventasCantidad: ventas,
      comprasCantidad: compras
    };
  }

  private buildContexto(fecha: string, usuario: string, metricas: any, existente?: any) {
    return {
      fecha,
      usuario,
      responsable: usuario,
      turno: String(existente?.contexto?.turno ?? ''),
      sede: String(existente?.contexto?.sede ?? ''),
      cajaActiva: Boolean(existente?.contexto?.cajaActiva ?? true),
      calidadWarnings: Number(existente?.contexto?.calidadWarnings ?? 0),
      calidadErrores: Number(existente?.contexto?.calidadErrores ?? 0),
      checklistPendientesCriticos: Number(metricas?.pendientesCriticos ?? 0),
      checklistPorcentaje: Number(metricas?.porcentajeChecklist ?? 0)
    };
  }

  private mapRawToReporte(id: string, raw: any): CierreDiarioReporte {
    const now = this.now();
    const metricas = {
      totalItemsChecklist: Number(raw?.metricas?.totalItemsChecklist ?? 0),
      completadosChecklist: Number(raw?.metricas?.completadosChecklist ?? 0),
      pendientesChecklist: Number(raw?.metricas?.pendientesChecklist ?? 0),
      porcentajeChecklist: Number(raw?.metricas?.porcentajeChecklist ?? 0),
      pendientesCriticos: Number(raw?.metricas?.pendientesCriticos ?? 0),
      ventasDelDia: Number(raw?.metricas?.ventasDelDia ?? raw?.ventasDelDia ?? 0),
      comprasDelDia: Number(raw?.metricas?.comprasDelDia ?? raw?.comprasDelDia ?? 0),
      ventasTotal: Number(raw?.metricas?.ventasTotal ?? raw?.metricas?.ventasDelDia ?? raw?.ventasDelDia ?? 0),
      comprasTotal: Number(raw?.metricas?.comprasTotal ?? raw?.metricas?.comprasDelDia ?? raw?.comprasDelDia ?? 0),
      productosStockCritico: Number(raw?.metricas?.productosStockCritico ?? raw?.metricas?.pendientesCriticos ?? 0),
      eventosWarningHoy: Number(raw?.metricas?.eventosWarningHoy ?? 0),
      eventosCriticosHoy: Number(raw?.metricas?.eventosCriticosHoy ?? 0),
      diferenciaCajaPromedioHoy: Number(raw?.metricas?.diferenciaCajaPromedioHoy ?? 0),
      utilidadEstimada: Number(raw?.metricas?.utilidadEstimada ?? ((raw?.metricas?.ventasTotal ?? raw?.ventasDelDia ?? 0) - (raw?.metricas?.comprasTotal ?? raw?.comprasDelDia ?? 0))),
      ventasCantidad: Number(raw?.metricas?.ventasCantidad ?? raw?.metricas?.ventasTotal ?? raw?.ventasDelDia ?? 0),
      comprasCantidad: Number(raw?.metricas?.comprasCantidad ?? raw?.metricas?.comprasTotal ?? raw?.comprasDelDia ?? 0)
    };

    return {
      id: String(id ?? this.generateId('cdr')),
      version: String(raw?.version ?? this.version),
      generadoEn: String(raw?.generadoEn ?? raw?.generatedAt ?? this.nowIso()),
      contexto: {
        fecha: String(raw?.contexto?.fecha ?? raw?.fecha ?? this.today()),
        usuario: String(raw?.contexto?.usuario ?? raw?.usuario ?? raw?.responsable ?? 'Sistema'),
        responsable: String(raw?.contexto?.responsable ?? raw?.responsable ?? raw?.usuario ?? 'Sistema'),
        turno: String(raw?.contexto?.turno ?? ''),
        sede: String(raw?.contexto?.sede ?? ''),
        cajaActiva: Boolean(raw?.contexto?.cajaActiva ?? true),
        calidadWarnings: Number(raw?.contexto?.calidadWarnings ?? 0),
        calidadErrores: Number(raw?.contexto?.calidadErrores ?? 0),
        checklistPendientesCriticos: Number(raw?.contexto?.checklistPendientesCriticos ?? metricas.pendientesCriticos),
        checklistPorcentaje: Number(raw?.contexto?.checklistPorcentaje ?? metricas.porcentajeChecklist)
      },
      metricas,
      pendientes: Array.isArray(raw?.pendientes)
        ? raw.pendientes.map((p: any) => ({
            id: String(p?.id ?? this.generateId('pd')),
            titulo: String(p?.titulo ?? 'Pendiente'),
            criticidad: this.normalizeCriticidad(p?.criticidad),
            referencia: String(p?.referencia ?? ''),
            bloque: String(p?.bloque ?? '')
          }))
        : [],
      observaciones: String(raw?.observaciones ?? ''),
      estado: (raw?.estado ?? 'cerrado') as any,
      createdAt: Number(raw?.createdAt ?? now),
      updatedAt: Number(raw?.updatedAt ?? now),
      cerradoAt: raw?.cerradoAt != null ? Number(raw.cerradoAt) : null
    };
  }

  private readLocal(): CierreDiarioReporte[] {
    if (!this.isBrowser()) return [];
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return this.sortReportes(parsed.map((x: any) => this.mapRawToReporte(String(x?.id ?? this.generateId()), x)));
    } catch {
      return [];
    }
  }

  private writeLocal(items: CierreDiarioReporte[]): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch {}
  }

  private patch(items: CierreDiarioReporte[]): void {
    const sorted = this.sortReportes(items);
    this.reportesSubject.next(sorted);
    this.writeLocal(sorted);
  }

  private persistAsync(item: CierreDiarioReporte): void {
    if (!this.db || !this.isBrowser()) return;
    setDoc(doc(this.db, this.collectionName, item.id), { ...item }, { merge: true }).catch(() => {});
  }

  private removeRemoteAsync(id: string): void {
    if (!this.db || !this.isBrowser()) return;
    deleteDoc(doc(this.db, this.collectionName, id)).catch(() => {});
  }

  private getAll(): CierreDiarioReporte[] {
    return this.reportesSubject.value;
  }

  listarReportes$(): Observable<CierreDiarioReporte[]> {
    return this.reportes$;
  }

  listarReportes(): CierreDiarioReporte[] {
    return this.getAll();
  }

  obtenerReportes(): CierreDiarioReporte[] {
    return this.getAll();
  }

  listarCierres(): CierreDiarioReporte[] {
    return this.getAll();
  }

  obtenerHistorial(): CierreDiarioReporte[] {
    return this.getAll();
  }

  obtenerReportePorFecha(fecha: string): CierreDiarioReporte | null {
    return this.getAll().find(x => x.contexto.fecha === fecha) ?? null;
  }

  ultimoReporte(): CierreDiarioReporte | null {
    return this.getAll()[0] ?? null;
  }

  generarReporte(usuario: string = 'Sistema'): CierreDiarioReporte {
    const fecha = this.today();
    const existente = this.getAll().find(x => x.contexto.fecha === fecha && x.contexto.usuario === usuario)
      ?? this.getAll().find(x => x.contexto.fecha === fecha);

    const checklist = this.checklistService.obtenerChecklistDelDia(usuario);
    const metricas = this.buildMetricas(checklist, existente?.metricas?.ventasTotal ?? 0, existente?.metricas?.comprasTotal ?? 0);
    const pendientes = this.extractPendientes(checklist);
    const now = this.now();

    const reporte: CierreDiarioReporte = {
      id: existente?.id ?? this.generateId('cdr'),
      version: this.version,
      generadoEn: this.nowIso(),
      contexto: this.buildContexto(fecha, usuario, metricas, existente),
      metricas,
      pendientes,
      observaciones: String(existente?.observaciones ?? ''),
      estado: 'cerrado',
      createdAt: existente?.createdAt ?? now,
      updatedAt: now,
      cerradoAt: now
    };

    if (existente) {
      const next = this.getAll().map(x => x.id === reporte.id ? reporte : x);
      this.patch(next);
    } else {
      this.patch([reporte, ...this.getAll()]);
    }

    this.persistAsync(reporte);
    return reporte;
  }

  guardarReporte(reporte: CierreDiarioReporte | any): CierreDiarioReporte {
    const normalizado = this.mapRawToReporte(String(reporte?.id ?? this.generateId('cdr')), reporte ?? {});
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

  generarCierre(usuario: string = 'Sistema'): CierreDiarioReporte {
    return this.generarReporte(usuario);
  }

  cerrarDia(usuario: string = 'Sistema'): CierreDiarioReporte {
    return this.generarReporte(usuario);
  }

  actualizarReporte(id: string, changes: Partial<CierreDiarioReporte>): CierreDiarioReporte | null {
    const reporte = this.getAll().find(x => x.id === id);
    if (!reporte) return null;

    const actualizado = this.mapRawToReporte(id, {
      ...reporte,
      ...changes,
      contexto: {
        ...reporte.contexto,
        ...(changes as any)?.contexto
      },
      metricas: {
        ...reporte.metricas,
        ...(changes as any)?.metricas
      },
      pendientes: Array.isArray((changes as any)?.pendientes) ? (changes as any).pendientes : reporte.pendientes,
      observaciones: (changes as any)?.observaciones ?? reporte.observaciones,
      updatedAt: this.now()
    });

    const next = this.getAll().map(x => x.id === id ? actualizado : x);
    this.patch(next);
    this.persistAsync(actualizado);
    return actualizado;
  }

  eliminarReporte(id: string): void {
    const next = this.getAll().filter(x => x.id !== id);
    this.patch(next);
    this.removeRemoteAsync(id);
  }

  reemplazarDesdeRespaldo(items: CierreDiarioReporte[] | null | undefined): void {
    const normalizados = Array.isArray(items)
      ? items.map(x => this.mapRawToReporte(String(x?.id ?? this.generateId('cdr')), x))
      : [];
    this.patch(normalizados);
    normalizados.forEach(x => this.persistAsync(x));
  }

  exportarReporte(fileName: string, content: string): void {
    if (!this.isBrowser()) return;
    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'cierre-diario.json';
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
