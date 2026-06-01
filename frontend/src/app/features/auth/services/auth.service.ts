import { Injectable, signal } from '@angular/core';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';

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
  uid?: string;
  email?: string | null;
}

class AuthRoleResolver {
  resolve(emailOrName: string | null | undefined): string | null {
    const value = (emailOrName ?? '').trim().toLowerCase();
    if (!value) return null;

    if (value.includes('admin') || value.includes('super') || value.includes('gerente')) return 'DUENO';
    if (value.includes('caja')) return 'CAJERO';
    if (value.includes('oper') || value.includes('almacen') || value.includes('almacenero')) return 'ALMACENERO';
    if (value.includes('sup') || value.includes('supervisor')) return 'SUPERVISOR';

    return 'DUENO';
  }
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'app_auth_session';
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000;

  private auth = getAuth();

  sesion = signal<SesionCompat | null>(null);
  nombreActual = signal<string>('');
  rolActual = signal<any>(null);
  firebaseUser = signal<User | null>(null);
  authReady = signal<boolean>(false);

  constructor() {
    this.cargarDesdeStorage();

    onAuthStateChanged(this.auth, (user) => {
      this.firebaseUser.set(user);
      this.authReady.set(true);

      if (user) {
        this.crearSesionDesdeFirebaseUser(user);
      } else {
        this.limpiarSesion();
      }
    });
  }

  private crearSesionDesdeFirebaseUser(user: User): void {
    const ahora = Date.now();
    const email = user.email ?? '';
    const nombre = user.displayName || email || user.uid;
    const rol = new AuthRoleResolver().resolve(email || nombre);

    const nuevaSesion: SesionCompat = {
      uid: user.uid,
      email: user.email,
      username: email || user.uid,
      nombre,
      rol,
      loginAt: ahora,
      lastActivityAt: ahora,
      expiresAt: ahora + this.SESSION_TIMEOUT_MS
    };

    this.sesion.set(nuevaSesion);
    this.nombreActual.set(nuevaSesion.nombre);
    this.rolActual.set(nuevaSesion.rol);
    this.guardarEnStorage();
  }

  private cargarDesdeStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data) return;

      const sesionRecuperada: SesionCompat = {
        uid: data?.uid,
        email: data?.email ?? null,
        username: data?.username ?? '',
        nombre: data?.nombre ?? data?.username ?? '',
        rol: data?.rol ?? null,
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

  async login(email: string, password?: string): Promise<LoginResult> {
    const correo = (email ?? '').trim();
    const clave = (password ?? '').trim();

    if (!correo) {
      return {
        success: false,
        message: 'Ingrese un correo valido'
      };
    }

    if (!clave) {
      return {
        success: false,
        message: 'Ingrese una contraseÃ±a'
      };
    }

    try {
      const credential = await signInWithEmailAndPassword(this.auth, correo, clave);
      this.crearSesionDesdeFirebaseUser(credential.user);

      return {
        success: true,
        message: `Bienvenido ${credential.user.email ?? correo}`
      };
    } catch (error: any) {
      console.error('Error Firebase Auth:', error);

      return {
        success: false,
        message: this.mapFirebaseAuthError(error?.code)
      };
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
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
    const user = this.firebaseUser();

    if (user) {
      return {
        uid: user.uid,
        displayName: user.displayName || user.email || user.uid,
        email: user.email
      };
    }

    const actual = this.sesion();
    if (!actual || !this.validarSesion()) return null;

    return {
      uid: actual.uid ?? actual.username,
      displayName: actual.nombre,
      email: actual.email ?? null
    };
  }

  getCurrentUid(): string | null {
    const user = this.firebaseUser();
    if (user) return user.uid;

    return this.validarSesion() ? (this.sesion()?.uid ?? this.sesion()?.username ?? null) : null;
  }

  isAuthenticated(): boolean {
    return this.validarSesion();
  }

  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  }

  private mapFirebaseAuthError(code: string | undefined): string {
    switch (code) {
      case 'auth/invalid-email':
        return 'El correo no es valido.';
      case 'auth/user-disabled':
        return 'El usuario esta deshabilitado.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Credenciales incorrectas.';
      case 'auth/network-request-failed':
        return 'Error de red. Verifica tu conexion.';
      default:
        return 'No se pudo iniciar sesion con Firebase.';
    }
  }
}
