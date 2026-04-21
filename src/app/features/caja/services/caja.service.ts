import { Injectable, signal, inject } from '@angular/core';
import { CajaActiva, CierreCaja, MovimientoCaja } from '../models/caja';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';

@Injectable({
  providedIn: 'root'
})
export class CajaService {

  private readonly auditoriaService = inject(AuditoriaService);
  private readonly _cajaActiva = signal<CajaActiva | null>(null);
  private readonly _cierres = signal<CierreCaja[]>([]);

  cajaActiva = this._cajaActiva.asReadonly();
  cierres = this._cierres.asReadonly();

  obtenerSiguienteIdCaja(): number {
    const activa = this._cajaActiva();
    const cierres = this._cierres();
    const ids = [
      ...(activa ? [activa.id] : []),
      ...cierres.map(c => c.id)
    ];

    return ids.length === 0 ? 1 : Math.max(...ids) + 1;
  }

  obtenerSiguienteIdMovimiento(): number {
    const activa = this._cajaActiva();
    if (!activa || activa.movimientos.length === 0) {
      return 1;
    }

    return Math.max(...activa.movimientos.map(m => m.id)) + 1;
  }

  abrirCaja(montoInicial: number, usuarioApertura: string) {
    if (this._cajaActiva()) {
      return;
    }

    this._cajaActiva.set({
      id: this.obtenerSiguienteIdCaja(),
      fechaApertura: new Date().toISOString(),
      usuarioApertura,
      montoInicial,
      movimientos: []
    });

    this.auditoriaService.registrar('CAJA', 'APERTURA', `Caja abierta por ${usuarioApertura}`, 'SUCCESS', `Monto inicial: S/ ${montoInicial.toFixed(2)}`);
  }

  registrarMovimiento(tipo: 'INGRESO' | 'EGRESO', concepto: string, monto: number) {
    const activa = this._cajaActiva();
    if (!activa) {
      return;
    }

    const movimiento: MovimientoCaja = {
      id: this.obtenerSiguienteIdMovimiento(),
      fecha: new Date().toISOString(),
      tipo,
      concepto,
      monto
    };

    this._cajaActiva.set({
      ...activa,
      movimientos: [...activa.movimientos, movimiento]
    });

    this.auditoriaService.registrar('CAJA', 'MOVIMIENTO', `${tipo} manual registrado`, tipo === 'INGRESO' ? 'INFO' : 'WARNING', `${concepto} · S/ ${monto.toFixed(2)}`);
  }

  cerrarCaja(params: {
    usuarioCierre: string;
    ventasEfectivo: number;
    efectivoContado: number;
    observacion: string;
  }) {
    const activa = this._cajaActiva();
    if (!activa) {
      return;
    }

    const ingresosManual = activa.movimientos
      .filter(m => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + m.monto, 0);

    const egresosManual = activa.movimientos
      .filter(m => m.tipo === 'EGRESO')
      .reduce((sum, m) => sum + m.monto, 0);

    const saldoEsperado =
      activa.montoInicial +
      params.ventasEfectivo +
      ingresosManual -
      egresosManual;

    const cierre: CierreCaja = {
      id: activa.id,
      fechaApertura: activa.fechaApertura,
      fechaCierre: new Date().toISOString(),
      usuarioApertura: activa.usuarioApertura,
      usuarioCierre: params.usuarioCierre,
      montoInicial: activa.montoInicial,
      ventasEfectivo: params.ventasEfectivo,
      ingresosManual,
      egresosManual,
      saldoEsperado,
      efectivoContado: params.efectivoContado,
      diferencia: params.efectivoContado - saldoEsperado,
      observacion: params.observacion.trim()
    };

    this._cierres.update(lista => [cierre, ...lista]);
    this._cajaActiva.set(null);

    const nivel = cierre.diferencia === 0 ? 'SUCCESS' : (cierre.diferencia > 0 ? 'INFO' : 'WARNING');
    this.auditoriaService.registrar('CAJA', 'CIERRE', `Caja cerrada por ${params.usuarioCierre}`, nivel, `Diferencia: S/ ${cierre.diferencia.toFixed(2)}`);
  }
}
