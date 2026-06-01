export type PrioridadReposicion = 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type EstadoSugerencia = 'PENDIENTE' | 'APROBADA' | 'POSTERGADA' | 'DESCARTADA';

export interface SugerenciaReposicion {
  id: string;
  productoId: number;
  codigo: string;
  nombre: string;
  categoria: string;
  stockActual: number;
  stockMinimo: number;
  stockObjetivo: number;
  cantidadSugerida: number;
  precioCompraReferencial: number;
  costoEstimado: number;
  ultimaCompraFecha: string | null;
  ultimaCompraCantidad: number;
  frecuenciaVentas30d: number;
  diasCobertura: number;
  prioridad: PrioridadReposicion;
  estado: EstadoSugerencia;
  motivo: string;
  observacion: string;
}

export interface ResumenReposicion {
  totalSugerencias: number;
  urgentes: number;
  altas: number;
  medias: number;
  bajas: number;
  costoTotalEstimado: number;
  unidadesTotalesSugeridas: number;
}
