export type OrigenAlerta = 'STOCK' | 'CAJA' | 'AUDITORIA' | 'USUARIOS' | 'VENTAS' | 'COMPRAS' | 'SISTEMA';
export type SeveridadAlerta = 'INFO' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface AlertaSistema {
  id: string;
  fecha: string;
  origen: OrigenAlerta;
  severidad: SeveridadAlerta;
  titulo: string;
  descripcion: string;
  accionSugerida: string;
  referencia: string;
  descartada: boolean;
}
