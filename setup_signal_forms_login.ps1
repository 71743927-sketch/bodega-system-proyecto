$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " MIGRAR LOGIN A SIGNAL FORMS" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/. Ejecuta desde la raiz del proyecto." -ForegroundColor Red
    exit 1
}

$LoginTs = Join-Path $Frontend "src/app/features/auth/pages/login-page/login-page.component.ts"
$LoginHtml = Join-Path $Frontend "src/app/features/auth/pages/login-page/login-page.component.html"
$LoginCss = Join-Path $Frontend "src/app/features/auth/pages/login-page/login-page.component.css"

if (-not (Test-Path $LoginTs)) {
    Write-Host "[ERROR] No existe login-page.component.ts" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $LoginHtml)) {
    Write-Host "[ERROR] No existe login-page.component.html" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $LoginCss)) {
    Write-Host "[ERROR] No existe login-page.component.css" -ForegroundColor Red
    exit 1
}

function Backup-File {
    param(
        [string]$Path
    )

    $Backup = "$Path.signal.bak"
    Copy-Item $Path $Backup -Force
    Write-Host "[BACKUP] $Path -> $Backup" -ForegroundColor Yellow
}

function Write-FileSafe {
    param(
        [string]$Path,
        [string]$Content
    )

    Backup-File $Path
    Set-Content -Path $Path -Value $Content -Encoding UTF8
    Write-Host "[OK] Escrito: $Path" -ForegroundColor Green
}

$LoginTsContent = @'
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';

import { AuthService } from '../../services/auth.service';
import { BackendAuthService } from '../../../../core/services/backend-auth';
import { BackendHealthService } from '../../../../core/services/backend-health';

interface LoginSignalFormModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormField],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent {

  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly backendAuth = inject(BackendAuthService);
  private readonly backendHealth = inject(BackendHealthService);

  readonly loginModel = signal<LoginSignalFormModel>({
    email: '',
    password: ''
  });

  readonly loginForm = form(this.loginModel);

  readonly enviado = signal(false);
  readonly cargando = signal(false);
  readonly mensaje = signal('');

  readonly emailValue = computed(() => this.loginModel().email.trim());
  readonly passwordValue = computed(() => this.loginModel().password.trim());

  readonly emailRequerido = computed(() => this.emailValue().length === 0);
  readonly emailFormatoInvalido = computed(() => {
    const value = this.emailValue();
    if (!value) return false;
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  });

  readonly passwordRequerido = computed(() => this.passwordValue().length === 0);
  readonly passwordCorto = computed(() => {
    const value = this.passwordValue();
    if (!value) return false;
    return value.length < 6;
  });

  readonly formularioValido = computed(() =>
    !this.emailRequerido() &&
    !this.emailFormatoInvalido() &&
    !this.passwordRequerido() &&
    !this.passwordCorto()
  );

  constructor() {
    console.log('Login con Signal Forms cargado');

    this.backendHealth.health().subscribe({
      next: (res) => console.log('Backend OK:', res),
      error: (err) => console.error('Error health backend:', err)
    });

    if (this.authService.autenticado()) {
      this.router.navigateByUrl('/dashboard');
    }
  }

  async login() {
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Ingresa un correo valido y una contraseña de minimo 6 caracteres.');
      return;
    }

    this.cargando.set(true);

    const result = await this.authService.login(
      this.emailValue(),
      this.passwordValue()
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

$LoginHtmlContent = @'
<section class="login-page">
  <div class="login-card">
    <h1>BodegaSys</h1>
    <p class="subtitle">Inicio de sesión con Firebase</p>

    <form (ngSubmit)="login()" novalidate>
      <div class="field">
        <label for="email">Correo</label>
        <input
          id="email"
          type="email"
          [formField]="loginForm.email"
          placeholder="admin@bodega.com"
          autocomplete="email"
        />

        @if (enviado() && emailRequerido()) {
          <small class="error-text">El correo es obligatorio.</small>
        }

        @if (enviado() && emailFormatoInvalido()) {
          <small class="error-text">Ingresa un correo valido.</small>
        }
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input
          id="password"
          type="password"
          [formField]="loginForm.password"
          placeholder="Ingrese su contraseña"
          autocomplete="current-password"
        />

        @if (enviado() && passwordRequerido()) {
          <small class="error-text">La contraseña es obligatoria.</small>
        }

        @if (enviado() && passwordCorto()) {
          <small class="error-text">La contraseña debe tener minimo 6 caracteres.</small>
        }
      </div>

      @if (mensaje()) {
        <p class="message">{{ mensaje() }}</p>
      }

      <button type="submit" [disabled]="cargando()">
        {{ cargando() ? 'Ingresando...' : 'Ingresar' }}
      </button>

      <pre class="debug-form">
{{ loginModel() | json }}
      </pre>
    </form>
  </div>
</section>
'@

$LoginCssContent = @'
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
  gap: 16px;
}

.field {
  display: grid;
  gap: 6px;
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

.error-text {
  color: #dc2626;
  font-size: 13px;
}

.debug-form {
  margin-top: 12px;
  padding: 12px;
  background: #f1f5f9;
  color: #334155;
  border-radius: 10px;
  font-size: 12px;
  white-space: pre-wrap;
}
'@

Write-FileSafe $LoginTs $LoginTsContent
Write-FileSafe $LoginHtml $LoginHtmlContent
Write-FileSafe $LoginCss $LoginCssContent

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " LOGIN MIGRADO A SIGNAL FORMS" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "cd frontend"
Write-Host "ng serve -o"
Write-Host ""
Write-Host "Luego prueba:"
Write-Host "http://localhost:4200/login"