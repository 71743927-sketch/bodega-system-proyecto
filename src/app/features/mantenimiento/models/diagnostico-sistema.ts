export type NivelDiagnostico = 'INFO' | 'WARNING' | 'ERROR';

export interface DiagnosticoSistema {
  id: string;
  titulo: string;
  detalle: string;
  nivel: NivelDiagnostico;
  referencia: string;
}
