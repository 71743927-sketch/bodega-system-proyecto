export type BloqueChecklist = 'APERTURA' | 'OPERACION' | 'CIERRE';
export type CriticidadChecklist = 'BAJA' | 'MEDIA' | 'ALTA';

export interface ChecklistItem {
  id: string;
  bloque: BloqueChecklist;
  orden: number;
  titulo: string;
  detalle: string;
  referencia: string;
  criticidad: CriticidadChecklist;
  completado: boolean;
  observacion: string;
}

export interface ChecklistDiario {
  fecha: string;
  responsable: string;
  updatedAt: string;
  items: ChecklistItem[];
}
