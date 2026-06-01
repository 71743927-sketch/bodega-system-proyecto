$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " SETUP FIREBASE AUTH REAL - ANGULAR" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $Frontend "angular.json"))) {
    Write-Host "[ERROR] No se encontro frontend/angular.json" -ForegroundColor Red
    exit 1
}

function Write-FileSafe {
    param(
        [string]$Path,
        [string]$Content
    )

    $Dir = Split-Path $Path -Parent

    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }

    if (Test-Path $Path) {
        Copy-Item $Path "$Path.bak" -Force
        Write-Host "[BACKUP] $Path -> $Path.bak" -ForegroundColor Yellow
    }

    Set-Content -Path $Path -Value $Content -Encoding UTF8
    Write-Host "[OK] Escrito: $Path" -ForegroundColor Green
}

$AuthService = @'
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
        message: 'Ingrese una contraseña'
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
'@

$LoginComponent = @'
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { BackendAuthService } from '../../../../core/services/backend-auth';
import { BackendHealthService } from '../../../../core/services/backend-health';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent {

  readonly authService = inject(AuthService);
  private router = inject(Router);
  private backendAuth = inject(BackendAuthService);
  private backendHealth = inject(BackendHealthService);

  email = signal('');
  password = signal('');
  mensaje = signal('');
  enviado = signal(false);
  cargando = signal(false);

  formularioValido = computed(() =>
    this.email().trim().length > 0 && this.password().trim().length > 0
  );

  constructor() {
    console.log('Login Firebase real cargado');

    this.backendHealth.health().subscribe({
      next: (res) => console.log('Backend OK:', res),
      error: (err) => console.error('Error health backend:', err)
    });

    if (this.authService.autenticado()) {
      this.router.navigateByUrl('/dashboard');
    }
  }

  actualizarEmail(valor: string) {
    this.email.set(valor);
  }

  actualizarPassword(valor: string) {
    this.password.set(valor);
  }

  async login(event?: Event) {
    event?.preventDefault();
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Ingresa correo y contraseña.');
      return;
    }

    this.cargando.set(true);

    const result = await this.authService.login(
      this.email().trim(),
      this.password().trim()
    );

    this.cargando.set(false);
    this.mensaje.set(result.message);

    if (result.success) {
      this.backendAuth.me().subscribe({
        next: (res) => {
          console.log('Usuario validado por backend:', res);
          this.router.navigateByUrl('/dashboard');
        },
        error: (err) => {
          console.error('Error validando usuario en backend:', err);
          this.router.navigateByUrl('/dashboard');
        }
      });
    }
  }
}
'@

$LoginHtml = @'
<section class="login-page">
  <div class="login-card">
    <h1>BodegaSys</h1>
    <p class="subtitle">Inicio de sesión con Firebase</p>

    <form (submit)="login($event)">
      <label for="email">Correo</label>
      <input
        id="email"
        type="email"
        placeholder="admin@bodega.com"
        [value]="email()"
        (input)="actualizarEmail($any($event.target).value)"
        autocomplete="email"
      />

      <label for="password">Contraseña</label>
      <input
        id="password"
        type="password"
        placeholder="Ingrese su contraseña"
        [value]="password()"
        (input)="actualizarPassword($any($event.target).value)"
        autocomplete="current-password"
      />

      @if (mensaje()) {
        <p class="message">{{ mensaje() }}</p>
      }

      <button type="submit" [disabled]="cargando()">
        {{ cargando() ? 'Ingresando...' : 'Ingresar' }}
      </button>
    </form>
  </div>
</section>
'@

$LoginCss = @'
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0f172a;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.subtitle {
  margin: 0 0 24px;
  color: #64748b;
}

form {
  display: grid;
  gap: 14px;
}

label {
  font-weight: 600;
}

input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 15px;
}

button {
  margin-top: 10px;
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  background: #2563eb;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.message {
  color: #dc2626;
  font-weight: 600;
}
'@

$AuthServicePath = Join-Path $Frontend "src/app/features/auth/services/auth.service.ts"
$LoginComponentPath = Join-Path $Frontend "src/app/features/auth/pages/login-page/login-page.component.ts"
$LoginHtmlPath = Join-Path $Frontend "src/app/features/auth/pages/login-page/login-page.component.html"
$LoginCssPath = Join-Path $Frontend "src/app/features/auth/pages/login-page/login-page.component.css"

Write-FileSafe $AuthServicePath $AuthService
Write-FileSafe $LoginComponentPath $LoginComponent
Write-FileSafe $LoginHtmlPath $LoginHtml
Write-FileSafe $LoginCssPath $LoginCss

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " FIREBASE AUTH REAL CONFIGURADO" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora:"
Write-Host "1. Activa Email/Password en Firebase Authentication."
Write-Host "2. Crea usuario en Firebase Authentication."
Write-Host "3. Reinicia frontend: cd frontend ; ng serve -o"
Write-Host "4. Reinicia backend: cd backend ; python -m uvicorn src.main:app --reload"
Write-Host "5. Inicia sesion con correo y contraseña reales."