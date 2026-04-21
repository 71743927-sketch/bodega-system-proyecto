export type NivelCalidad = 'OK' | 'INFO' | 'WARNING' | 'ERROR';

export interface HallazgoCalidad {
  id: string;
  nivel: NivelCalidad;
  categoria: string;
  titulo: string;
  detalle: string;
  referencia: string;
  sugerencia: string;
}
