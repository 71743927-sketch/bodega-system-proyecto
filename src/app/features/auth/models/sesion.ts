import { RolUsuario, Usuario } from '../../usuarios/models/usuario';

export interface SesionActiva {
  username: string;
  nombre: string;
  rol: RolUsuario;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  user: Usuario | null;
}
