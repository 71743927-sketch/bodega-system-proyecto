export interface MetaRespaldoSistema {
  source?: string;
  capturedAt?: number;
  generadoEn?: string;
  generadoPor?: string;
  notas?: string;
  appKeys?: string[];
  rawLocalStorage?: Record<string, any>;
  [key: string]: any;
}

export interface RespaldoPayload {
  auth?: any;
  checklist?: any;
  cierreDiario?: any;
  alertas?: any;
  inventario?: any;
  productos?: any[];
  ventas?: any[];
  compras?: any[];
  proveedores?: any[];
  usuarios?: any[];
  movimientosInventario?: any[];
  cierresCaja?: any[];
  auditoria?: any[];
  alertasDescartadas?: any[];
  configuracion?: any[];
  meta?: MetaRespaldoSistema;
  [key: string]: any;
}

export interface RespaldoSistema {
  id: string;
  nombre: string;
  descripcion: string;
  usuario: string;
  origen: 'manual' | 'auto';
  modulo: string;
  meta: MetaRespaldoSistema;
  configuracion: any[];
  productos: any[];
  ventas: any[];
  compras: any[];
  proveedores: any[];
  usuarios: any[];
  movimientosInventario: any[];
  cierresCaja: any[];
  auditoria: any[];
  alertasDescartadas: any[];
  checklist: any[];
  cierreDiario: any[];
  payload: RespaldoPayload;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
}

export interface RespaldoData extends RespaldoSistema {}
