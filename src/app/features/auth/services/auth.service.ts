import { Injectable, computed, inject, signal } from '@angular/core';
import { UsuariosService } from '../../usuarios/services/usuarios.service';
import { LoginResult, SesionActiva } from '../models/sesion';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { ConfiguracionService } from '../../configuracion/services/configuracion.service';

const SESSION_KEY = 'bodega-session';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly auditoriaService = inject(AuditoriaService);
  private readonly configuracionService = inject(ConfiguracionService);
  private readonly _sesion = signal<SesionActiva | null>(this.cargarSesion());

  sesion = this._sesion.asReadonly();
  autenticado = computed(() => this._sesion() !== null);
  rolActual = computed(() => this._sesion()?.rol ?? null);
  nombreActual = computed(() => this._sesion()?.nombre ?? 'Invitado');
  usernameActual = computed(() => this._sesion()?.username ?? '');
  expiraEn = computed(() => this.tiempoRestanteMs());

  constructor(private usuariosService: UsuariosService) {}

  login(username: string): LoginResult {
    const usuario = this.usuariosService.usuariosLectura().find(u =>
      u.username.trim().toLowerCase() === username.trim().toLowerCase()
    );

    if (!usuario) {
      this.auditoriaService.registrar('AUTH', 'LOGIN_FALLIDO', `Intento de acceso con usuario inexistente: ${username.trim()}`, 'WARNING', '', username.trim());
      return {
        success: false,
        message: 'No existe un usuario con ese nombre de usuario.',
        user: null
      };
    }

    if (!usuario.activo) {
      this.auditoriaService.registrar('AUTH', 'LOGIN_BLOQUEADO', `Intento de acceso a cuenta inactiva: ${usuario.username}`, 'WARNING', '', usuario.username);
      return {
        success: false,
        message: 'La cuenta está inactiva. Contacta al administrador.',
        user: usuario
      };
    }

    const ahora = new Date();
    const sesion = this.crearSesion(usuario.username, usuario.nombre, usuario.rol, ahora);

    this._sesion.set(sesion);
    this.guardarSesion(sesion);
    this.auditoriaService.registrar('AUTH', 'LOGIN_OK', `Inicio de sesión correcto para ${usuario.username}`, 'SUCCESS', `Rol: ${usuario.rol}`, usuario.username);

    return {
      success: true,
      message: 'Inicio de sesión correcto.',
      user: usuario
    };
  }

  logout() {
    this.logoutInterno(false);
  }

  renovarActividad() {
    const sesion = this._sesion();
    if (!sesion) {
      return;
    }

    if (this.estaSesionExpirada()) {
      this.validarSesion();
      return;
    }

    const ahora = new Date();
    const renovada: SesionActiva = {
      ...sesion,
      lastActivityAt: ahora.toISOString(),
      expiresAt: this.calcularExpiracion(ahora).toISOString()
    };

    this._sesion.set(renovada);
    this.guardarSesion(renovada);
  }

  renovarSesionManual() {
    const sesion = this._sesion();
    if (!sesion) {
      return false;
    }

    const ahora = new Date();
    const renovada: SesionActiva = {
      ...sesion,
      lastActivityAt: ahora.toISOString(),
      expiresAt: this.calcularExpiracion(ahora).toISOString()
    };

    this._sesion.set(renovada);
    this.guardarSesion(renovada);
    this.auditoriaService.registrar('AUTH', 'SESION_RENOVADA', `Sesión renovada manualmente para ${renovada.username}`, 'INFO', `Expira: ${renovada.expiresAt}`, renovada.username);
    return true;
  }

  validarSesion(): boolean {
    const sesion = this._sesion();
    if (!sesion) {
      return false;
    }

    if (this.estaSesionExpirada()) {
      const username = sesion.username;
      this.auditoriaService.registrar('AUTH', 'SESION_EXPIRADA', `La sesión expiró para ${username}`, 'WARNING', `Venció: ${sesion.expiresAt}`, username);
      this.logoutInterno(true);
      return false;
    }

    return true;
  }

  estaSesionExpirada(): boolean {
    const sesion = this._sesion();
    if (!sesion) {
      return true;
    }

    return new Date(sesion.expiresAt).getTime() <= Date.now();
  }

  tiempoRestanteMs(): number {
    const sesion = this._sesion();
    if (!sesion) {
      return 0;
    }

    return Math.max(0, new Date(sesion.expiresAt).getTime() - Date.now());
  }

  tieneRol(rolesPermitidos: string[]): boolean {
    const rol = this.rolActual();
    if (!rol) {
      return false;
    }

    return rolesPermitidos.includes(rol);
  }

  private logoutInterno(expirada: boolean) {
    const username = this.usernameActual();

    if (username !== '' && !expirada) {
      this.auditoriaService.registrar('AUTH', 'LOGOUT', `Cierre de sesión de ${username}`, 'INFO', '', username);
    }

    this._sesion.set(null);
    this.limpiarSesion();
  }

  private crearSesion(username: string, nombre: string, rol: SesionActiva['rol'], ahora: Date): SesionActiva {
    return {
      username,
      nombre,
      rol,
      loginAt: ahora.toISOString(),
      lastActivityAt: ahora.toISOString(),
      expiresAt: this.calcularExpiracion(ahora).toISOString()
    };
  }

  private calcularExpiracion(base: Date): Date {
    const config = this.configuracionService.configuracionLectura();
    const minutos = Math.max(5, Number(config.sesionMinutos) || 120);
    return new Date(base.getTime() + minutos * 60 * 1000);
  }

  private cargarSesion(): SesionActiva | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }

      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as SesionActiva;
      if (!parsed.username || !parsed.rol || !parsed.nombre || !parsed.loginAt || !parsed.lastActivityAt || !parsed.expiresAt) {
        return null;
      }

      if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private guardarSesion(sesion: SesionActiva) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
    } catch {
      // Ignorar errores de persistencia local
    }
  }

  private limpiarSesion() {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignorar errores de persistencia local
    }
  }
}
