export type TipoMovimientoInventario = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface MovimientoInventario {
  id: number;
  fecha: string;
  productoId: number;
  productoNombre: string;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  usuario: string;
  observacion: string;
}
