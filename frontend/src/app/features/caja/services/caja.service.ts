import { Injectable, signal } from '@angular/core';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../../../core/firebase/firebase.config';

const STORAGE_KEY = 'bodega-caja-compatible';

@Injectable({
  providedIn: 'root'
})
export class CajaService {
  readonly cajaActiva = signal<any | null>(null);
  readonly cierres = signal<any[]>([]);

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const activaRef = doc(firestoreDb, 'caja', 'activa');
    const cierresRef = doc(firestoreDb, 'caja', 'cierres');

    onSnapshot(
      activaRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data() as { value?: unknown };
          this.cajaActiva.set(data?.value ? this.sanearCajaActiva(data.value) : null);
        } else {
          this.cajaActiva.set(null);
        }
      },
      () => {
        const local = this.cargarDesdeStorage();
        this.cajaActiva.set(local.cajaActiva);
      }
    );

    onSnapshot(
      cierresRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data() as { items?: unknown[] };
          const items = Array.isArray(data?.items)
            ? data.items.map(item => this.sanearCierre(item))
            : [];
          this.cierres.set(this.ordenarCierres(items));
        } else {
          this.cierres.set([]);
        }
      },
      () => {
        const local = this.cargarDesdeStorage();
        this.cierres.set(this.ordenarCierres(local.cierres));
      }
    );
  }

  abrirCaja(montoInicial: number, usuarioApertura: string) {
    const nuevaCaja = {
      id: Date.now(),
      fechaApertura: new Date().toISOString(),
      usuarioApertura: usuarioApertura?.trim() || 'Sistema',
      montoInicial: Number(montoInicial) || 0,
      movimientos: [],
      estado: 'ABIERTA'
    };

    this.cajaActiva.set(nuevaCaja);
    this.persistirCajaActiva(nuevaCaja);
  }

  registrarMovimiento(tipo: string, concepto: string, monto: number) {
    const actual = this.cajaActiva();
    if (!actual) {
      return;
    }

    const movimiento = {
      id: Date.now(),
      fecha: new Date().toISOString(),
      tipo: String(tipo || '').toUpperCase() === 'EGRESO' ? 'EGRESO' : 'INGRESO',
      concepto: concepto?.trim() || 'Sin concepto',
      monto: Number(monto) || 0
    };

    const actualizada = {
      ...actual,
      movimientos: [...(Array.isArray(actual.movimientos) ? actual.movimientos : []), movimiento]
    };

    this.cajaActiva.set(actualizada);
    this.persistirCajaActiva(actualizada);
  }

  cerrarCaja(payload: {
    ventasEfectivo?: number;
    ingresosManual?: number;
    egresosManual?: number;
    efectivoContado?: number;
    montoReal?: number;
    montoFisico?: number;
    observacion?: string;
    usuarioCierre?: string;
  }) {
    const actual = this.cajaActiva();
    if (!actual) {
      return;
    }

    const movimientos = Array.isArray(actual.movimientos) ? actual.movimientos : [];

    const ingresosMov = movimientos
      .filter((m: any) => String(m?.tipo || '').toUpperCase() === 'INGRESO')
      .reduce((sum: number, m: any) => sum + (Number(m?.monto) || 0), 0);

    const egresosMov = movimientos
      .filter((m: any) => String(m?.tipo || '').toUpperCase() === 'EGRESO')
      .reduce((sum: number, m: any) => sum + (Number(m?.monto) || 0), 0);

    const ventasEfectivo = Number(payload?.ventasEfectivo) || 0;
    const ingresosManual = Number(payload?.ingresosManual) || 0;
    const egresosManual = Number(payload?.egresosManual) || 0;

    const totalIngresos = ingresosMov + ventasEfectivo + ingresosManual;
    const totalEgresos = egresosMov + egresosManual;

    const saldoEsperado = (Number(actual.montoInicial) || 0) + totalIngresos - totalEgresos;

    const efectivoContado =
      Number(payload?.efectivoContado ?? payload?.montoReal ?? payload?.montoFisico ?? saldoEsperado) || 0;

    const cierre = {
      id: Date.now(),
      fechaApertura: actual.fechaApertura,
      fechaCierre: new Date().toISOString(),
      usuarioApertura: actual.usuarioApertura,
      usuarioCierre: payload?.usuarioCierre?.trim() || 'Sistema',
      montoInicial: Number(actual.montoInicial) || 0,
      ventasEfectivo,
      ingresosManual,
      egresosManual,
      totalIngresos,
      totalEgresos,
      saldoEsperado,
      efectivoContado,
      diferencia: efectivoContado - saldoEsperado,
      observacion: payload?.observacion?.trim() || ''
    };

    const nuevosCierres = this.ordenarCierres([cierre, ...this.cierres()]);

    this.cierres.set(nuevosCierres);
    this.cajaActiva.set(null);

    this.persistirCajaActiva(null);
    this.persistirCierres(nuevosCierres);
  }

  obtenerSaldoActual(): number {
    const actual = this.cajaActiva();
    if (!actual) {
      return 0;
    }

    const movimientos = Array.isArray(actual.movimientos) ? actual.movimientos : [];

    const ingresos = movimientos
      .filter((m: any) => String(m?.tipo || '').toUpperCase() === 'INGRESO')
      .reduce((sum: number, m: any) => sum + (Number(m?.monto) || 0), 0);

    const egresos = movimientos
      .filter((m: any) => String(m?.tipo || '').toUpperCase() === 'EGRESO')
      .reduce((sum: number, m: any) => sum + (Number(m?.monto) || 0), 0);

    return (Number(actual.montoInicial) || 0) + ingresos - egresos;
  }

  private persistirCajaActiva(caja: any | null) {
    try {
      setDoc(doc(firestoreDb, 'caja', 'activa'), { value: caja }, { merge: false }).catch(() => {});
      this.guardarEnStorage();
    } catch {
      this.guardarEnStorage();
    }
  }

  private persistirCierres(cierres: any[]) {
    try {
      setDoc(doc(firestoreDb, 'caja', 'cierres'), { items: cierres }, { merge: false }).catch(() => {});
      this.guardarEnStorage();
    } catch {
      this.guardarEnStorage();
    }
  }

  private guardarEnStorage() {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const payload = {
        cajaActiva: this.cajaActiva(),
        cierres: this.cierres()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignorar
    }
  }

  private cargarDesdeStorage(): { cajaActiva: any | null; cierres: any[] } {
    try {
      if (typeof localStorage === 'undefined') {
        return { cajaActiva: null, cierres: [] };
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { cajaActiva: null, cierres: [] };
      }

      const parsed = JSON.parse(raw) as {
        cajaActiva?: unknown;
        cierres?: unknown[];
      };

      return {
        cajaActiva: parsed.cajaActiva ? this.sanearCajaActiva(parsed.cajaActiva) : null,
        cierres: Array.isArray(parsed.cierres) ? parsed.cierres.map(item => this.sanearCierre(item)) : []
      };
    } catch {
      return { cajaActiva: null, cierres: [] };
    }
  }

  private sanearCajaActiva(data: unknown): any {
    const raw = this.asRecord(data);
    const movimientos = Array.isArray(raw['movimientos'])
      ? (raw['movimientos'] as unknown[]).map(item => this.sanearMovimiento(item))
      : [];

    return {
      id: Number(raw['id']) || Date.now(),
      fechaApertura: raw['fechaApertura'] ? String(raw['fechaApertura']) : new Date().toISOString(),
      usuarioApertura: raw['usuarioApertura'] ? String(raw['usuarioApertura']) : 'Sistema',
      montoInicial: Number(raw['montoInicial']) || 0,
      movimientos,
      estado: 'ABIERTA'
    };
  }

  private sanearMovimiento(data: unknown): any {
    const raw = this.asRecord(data);

    return {
      id: Number(raw['id']) || Date.now(),
      fecha: raw['fecha'] ? String(raw['fecha']) : new Date().toISOString(),
      tipo: String(raw['tipo'] || '').toUpperCase() === 'EGRESO' ? 'EGRESO' : 'INGRESO',
      concepto: raw['concepto'] ? String(raw['concepto']) : 'Sin concepto',
      monto: Number(raw['monto']) || 0
    };
  }

  private sanearCierre(data: unknown): any {
    const raw = this.asRecord(data);

    return {
      id: Number(raw['id']) || Date.now(),
      fechaApertura: raw['fechaApertura'] ? String(raw['fechaApertura']) : new Date().toISOString(),
      fechaCierre: raw['fechaCierre'] ? String(raw['fechaCierre']) : new Date().toISOString(),
      usuarioApertura: raw['usuarioApertura'] ? String(raw['usuarioApertura']) : 'Sistema',
      usuarioCierre: raw['usuarioCierre'] ? String(raw['usuarioCierre']) : 'Sistema',
      montoInicial: Number(raw['montoInicial']) || 0,
      ventasEfectivo: Number(raw['ventasEfectivo']) || 0,
      ingresosManual: Number(raw['ingresosManual']) || 0,
      egresosManual: Number(raw['egresosManual']) || 0,
      totalIngresos: Number(raw['totalIngresos']) || 0,
      totalEgresos: Number(raw['totalEgresos']) || 0,
      saldoEsperado: Number(raw['saldoEsperado']) || 0,
      efectivoContado: Number(raw['efectivoContado']) || 0,
      diferencia: Number(raw['diferencia']) || 0,
      observacion: raw['observacion'] ? String(raw['observacion']) : ''
    };
  }

  private ordenarCierres(items: any[]): any[] {
    return [...items].sort(
      (a, b) => new Date(String(b?.fechaCierre || '')).getTime() - new Date(String(a?.fechaCierre || '')).getTime()
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? { ...(value as Record<string, unknown>) }
      : {};
  }
}
