export interface PendienteCierreDiario {
  id: string;
  titulo: string;
  criticidad: 'BAJA' | 'MEDIA' | 'ALTA';
  referencia?: string;
  bloque?: string;
}

export interface MetricasCierreDiario {
  totalItemsChecklist: number;
  completadosChecklist: number;
  pendientesChecklist: number;
  porcentajeChecklist: number;
  pendientesCriticos: number;
  ventasDelDia: number;
  comprasDelDia: number;
  ventasTotal: number;
  comprasTotal: number;
  productosStockCritico: number;
  eventosWarningHoy: number;
  eventosCriticosHoy: number;
  diferenciaCajaPromedioHoy: number;
  utilidadEstimada: number;
  ventasCantidad: number;
  comprasCantidad: number;
}

export interface ContextoCierreDiario {
  fecha: string;
  usuario: string;
  responsable: string;
  turno?: string;
  sede?: string;
  cajaActiva: boolean;
  calidadWarnings: number;
  calidadErrores: number;
  checklistPendientesCriticos: number;
  checklistPorcentaje: number;
}

export interface CierreDiarioReporte {
  id: string;
  version: string;
  generadoEn: string;
  contexto: ContextoCierreDiario;
  metricas: MetricasCierreDiario;
  pendientes: PendienteCierreDiario[];
  observaciones: string;
  estado: 'abierto' | 'cerrado';
  createdAt: number;
  updatedAt: number;
  cerradoAt?: number | null;
}
