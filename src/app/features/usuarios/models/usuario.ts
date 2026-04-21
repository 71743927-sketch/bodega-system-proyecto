export type RolUsuario = 'DUENO' | 'CAJERO' | 'ALMACENERO' | 'SUPERVISOR';

export interface Usuario {
  id: number;
  nombre: string;
  username: string;
  rol: RolUsuario;
  telefono: string;
  activo: boolean;
  observacion: string;
}
