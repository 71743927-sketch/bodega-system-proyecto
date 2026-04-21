export interface CierreDiarioContexto {
  fecha: string;
  responsable: string;
  cajaActiva: boolean;
  checklistPorcentaje: number;
  checklistPendientesCriticos: number;
  calidadWarnings: number;
  calidadErrores: number;
}

export interface CierreDiarioMetricas {
  ventasCantidad: number;
  ventasTotal: number;
  comprasCantidad: number;
  comprasTotal: number;
  utilidadEstimada: number;
  productosStockCritico: number;
  eventosWarningHoy: number;
  eventosCriticosHoy: number;
  cierresCajaHoy: number;
  diferenciaCajaPromedioHoy: number;
}

export interface CierreDiarioReporte {
  version: string;
  generadoEn: string;
  contexto: CierreDiarioContexto;
  metricas: CierreDiarioMetricas;
  observaciones: string[];
  pendientes: string[];
}
