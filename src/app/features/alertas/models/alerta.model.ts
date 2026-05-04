export type EstadoAlerta = 'pendiente' | 'leida' | 'archivada';
export type PrioridadAlerta = 'baja' | 'media' | 'alta' | 'critica';

export interface Alerta {
  id: string;
  titulo: string;
  mensaje: string;
  prioridad: PrioridadAlerta;
  estado: EstadoAlerta;
  tipo?: string;
  categoria?: string;
  modulo?: string;
  usuario?: string;
  usuarioId?: string;
  leidaPor?: string | null;
  origen?: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  leidaAt?: number | null;
}

export interface CrearAlertaInput {
  titulo: string;
  mensaje: string;
  prioridad?: PrioridadAlerta;
  estado?: EstadoAlerta;
  tipo?: string;
  categoria?: string;
  modulo?: string;
  usuario?: string;
  usuarioId?: string;
  origen?: string;
  metadata?: Record<string, any>;
}

export interface ActualizarAlertaInput {
  titulo?: string;
  mensaje?: string;
  prioridad?: PrioridadAlerta;
  estado?: EstadoAlerta;
  tipo?: string;
  categoria?: string;
  modulo?: string;
  usuario?: string;
  usuarioId?: string;
  leidaPor?: string | null;
  origen?: string;
  metadata?: Record<string, any>;
  leidaAt?: number | null;
}
