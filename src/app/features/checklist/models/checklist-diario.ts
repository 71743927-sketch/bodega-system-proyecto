export type EstadoChecklist = 'pendiente' | 'en-proceso' | 'completado' | 'cerrado';
export type CriticidadChecklist = 'BAJA' | 'MEDIA' | 'ALTA';
export type BloqueChecklist = 'APERTURA' | 'OPERACION' | 'CIERRE';

export interface ChecklistItem {
  id: string;
  titulo: string;
  detalle?: string;
  descripcion?: string;
  categoria?: string;
  bloque: BloqueChecklist;
  referencia?: string;
  criticidad: CriticidadChecklist;
  orden: number;
  completado: boolean;
  observado?: boolean;
  observacion?: string;
  completadoAt?: number | null;
  completadoPor?: string | null;
  updatedAt: number;
}

export interface ChecklistDiario {
  id: string;
  fecha: string;
  usuario: string;
  responsable: string;
  estado: EstadoChecklist;
  items: ChecklistItem[];
  iniciadoAt?: number;
  finalizadoAt?: number | null;
  createdAt?: number;
  updatedAt: number;
}
