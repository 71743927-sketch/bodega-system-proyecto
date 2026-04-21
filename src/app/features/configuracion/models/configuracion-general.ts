export type MonedaSistema = 'PEN' | 'USD';

export interface ConfiguracionGeneral {
  nombreNegocio: string;
  ruc: string;
  telefono: string;
  direccion: string;
  moneda: MonedaSistema;
  simboloMoneda: string;
  igvPorcentaje: number;
  diasAlertaCompra: number;
  permitirStockNegativo: boolean;
  mostrarAlertasDashboard: boolean;
  mostrarModuloAuditoria: boolean;
  mensajeTicket: string;
  pieTicket: string;
  sesionMinutos: number;
  zonaHoraria: string;
}
