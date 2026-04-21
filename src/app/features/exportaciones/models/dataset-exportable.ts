export type DatasetExportable =
  | 'RESUMEN'
  | 'VENTAS'
  | 'COMPRAS'
  | 'PRODUCTOS'
  | 'USUARIOS'
  | 'CIERRES_CAJA'
  | 'AUDITORIA';

export interface OpcionExportacion {
  key: DatasetExportable;
  titulo: string;
  descripcion: string;
}
