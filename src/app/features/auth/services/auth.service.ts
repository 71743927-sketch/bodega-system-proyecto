import { Injectable, signal } from '@angular/core';

export interface LoginResult {
  success: boolean;
  message: string;
}

export interface SesionCompat {
  username: string;
  nombre: string;
  rol: any;
  loginAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

class AuthRoleResolver {
  resolve(username: string | null | undefined): string | null {
    const value = (username ?? '').trim().toLowerCase();
    if (!value) return null;

    // Mapeo a los roles que espera la UI
    if (value.includes('admin') || value.includes('super') || value.includes('gerente')) return 'DUENO';
    if (value.includes('caja')) return 'CAJERO';
    if (value.includes('oper') || value.includes('almacen') || value.includes('almacenero')) return 'ALMACENERO';
    if (value.includes('sup') || value.includes('supervisor')) return 'SUPERVISOR';

    // Si no calza, devolver null para que la UI trate como no autenticado/Invitado
    return null;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'app_auth_session';
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

  // IMPORTANTE:
  // - sesion debe ser un objeto (no boolean) porque varias pantallas usan sesion().username, sesion().rol, etc.
  // - rolActual se deja como any para no chocar con tipos RolUsuario del proyecto actual.
  sesion = signal<SesionCompat | null>(null);
  nombreActual = signal<string>('');
  rolActual = signal<any>(null);

  constructor() {
    this.cargarDesdeStorage();
    this.validarSesion();
  }

  private cargarDesdeStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data) return;

      const sesionRecuperada: SesionCompat = {
        username: data?.username ?? '',
        nombre: data?.nombre ?? data?.username ?? '',
        // Si el rol guardado es uno de los roles esperados lo usamos,
        // en caso contrario intentamos resolverlo desde el username.
        rol: (function(r: any, username: any) {
          const allowed = ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'];
          if (typeof r === 'string' && allowed.includes(String(r).toUpperCase())) return String(r).toUpperCase();
          return (new AuthRoleResolver()).resolve(username);
        })(data?.rol, data?.username),
        loginAt: Number(data?.loginAt ?? Date.now()),
        lastActivityAt: Number(data?.lastActivityAt ?? Date.now()),
        expiresAt: Number(data?.expiresAt ?? (Date.now() + this.SESSION_TIMEOUT_MS))
      };

      this.sesion.set(sesionRecuperada);
      this.nombreActual.set(sesionRecuperada.nombre);
      this.rolActual.set(sesionRecuperada.rol);
    } catch {
      this.limpiarSesion();
    }
  }

  private guardarEnStorage(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sesion()));
  }

  private limpiarSesion(): void {
    this.sesion.set(null);
    this.nombreActual.set('');
    this.rolActual.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private resolverRol(username: string): any {
    return new AuthRoleResolver().resolve(username);
  }

  login(username: string, password?: string): LoginResult {
    const user = (username ?? '').trim();

    if (!user) {
      return {
        success: false,
        message: 'Ingrese un usuario válido'
      };
    }

    void password;

    const ahora = Date.now();
    const rol = this.resolverRol(user);

    const nuevaSesion: SesionCompat = {
      username: user,
      nombre: user,
      rol,
      loginAt: ahora,
      lastActivityAt: ahora,
      expiresAt: ahora + this.SESSION_TIMEOUT_MS
    };

    this.sesion.set(nuevaSesion);
    this.nombreActual.set(nuevaSesion.nombre);
    this.rolActual.set(nuevaSesion.rol);
    this.guardarEnStorage();

    return {
      success: true,
      message: `Bienvenido ${user}`
    };
  }

  logout(): void {
    this.limpiarSesion();
  }

  autenticado(): boolean {
    return this.validarSesion();
  }

  validarSesion(): boolean {
    const actual = this.sesion();
    if (!actual) return false;

    if (actual.expiresAt <= Date.now()) {
      this.limpiarSesion();
      return false;
    }

    return true;
  }

  tieneRol(rolesPermitidos: string[] = []): boolean {
    if (!this.validarSesion()) return false;
    if (!rolesPermitidos || rolesPermitidos.length === 0) return true;

    const rol = String(this.rolActual() ?? '').toLowerCase();
    return rolesPermitidos.some(r => String(r ?? '').toLowerCase() === rol);
  }

  renovarActividad(): void {
    const actual = this.sesion();
    if (!actual) return;

    const renovada: SesionCompat = {
      ...actual,
      lastActivityAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_TIMEOUT_MS
    };

    this.sesion.set(renovada);
    this.nombreActual.set(renovada.nombre);
    this.rolActual.set(renovada.rol);
    this.guardarEnStorage();
  }

  renovarSesionManual(): boolean {
    if (!this.validarSesion()) return false;
    this.renovarActividad();
    return true;
  }

  tiempoRestanteMs(): number {
    const actual = this.sesion();
    if (!actual) return 0;
    return Math.max(0, actual.expiresAt - Date.now());
  }

  usernameActual(): string {
    return this.sesion()?.username ?? '';
  }

  getCurrentUser(): { uid: string; displayName: string; email: string | null } | null {
    const actual = this.sesion();
    if (!actual || !this.validarSesion()) return null;

    return {
      uid: actual.username,
      displayName: actual.nombre,
      email: null
    };
  }

  getCurrentUid(): string | null {
    return this.validarSesion() ? (this.sesion()?.username ?? null) : null;
  }

  isAuthenticated(): boolean {
    return this.validarSesion();
  }
}
