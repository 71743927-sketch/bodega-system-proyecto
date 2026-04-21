export type ModuloAuditoria = 'AUTH' | 'PRODUCTOS' | 'VENTAS' | 'COMPRAS' | 'CAJA' | 'INVENTARIO' | 'USUARIOS' | 'SISTEMA';
export type NivelAuditoria = 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';

export interface EventoAuditoria {
  id: number;
  fecha: string;
  modulo: ModuloAuditoria;
  accion: string;
  detalle: string;
  usuario: string;
  nivel: NivelAuditoria;
  metadata: string;
}
