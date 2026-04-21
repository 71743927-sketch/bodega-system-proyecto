export interface MovimientoCaja {
  id: number;
  fecha: string;
  tipo: 'INGRESO' | 'EGRESO';
  concepto: string;
  monto: number;
}

export interface CajaActiva {
  id: number;
  fechaApertura: string;
  usuarioApertura: string;
  montoInicial: number;
  movimientos: MovimientoCaja[];
}

export interface CierreCaja {
  id: number;
  fechaApertura: string;
  fechaCierre: string;
  usuarioApertura: string;
  usuarioCierre: string;
  montoInicial: number;
  ventasEfectivo: number;
  ingresosManual: number;
  egresosManual: number;
  saldoEsperado: number;
  efectivoContado: number;
  diferencia: number;
  observacion: string;
}
