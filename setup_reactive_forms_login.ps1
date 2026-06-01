$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " MIGRAR LOGIN A REACTIVE FORMS REAL" -ForegroundColor Cyan
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

    $Backup = "$Path.reactive.bak"
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
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { BackendAuthService } from '../../../../core/services/backend-auth';
import { BackendHealthService } from '../../../../core/services/backend-health';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent {

  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly backendAuth = inject(BackendAuthService);
  private readonly backendHealth = inject(BackendHealthService);

  cargando = false;
  enviado = false;
  mensaje = '';

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {
    console.log('Login con Reactive Forms real cargado');

    this.backendHealth.health().subscribe({
      next: (res) => console.log('Backend OK:', res),
      error: (err) => console.error('Error health backend:', err)
    });

    if (this.authService.autenticado()) {
      this.router.navigateByUrl('/dashboard');
    }
  }

  get emailCtrl() {
    return this.loginForm.controls.email;
  }

  get passwordCtrl() {
    return this.loginForm.controls.password;
  }

  async login() {
    this.enviado = true;
    this.mensaje = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.mensaje = 'Ingresa un correo valido y una contraseña de minimo 6 caracteres.';
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    this.cargando = true;

    const result = await this.authService.login(
      email.trim(),
      password.trim()
    );

    this.cargando = false;
    this.mensaje = result.message;

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

    <form [formGroup]="loginForm" (ngSubmit)="login()" novalidate>
      <div class="field">
        <label for="email">Correo</label>
        <input
          id="email"
          type="email"
          formControlName="email"
          placeholder="admin@bodega.com"
          autocomplete="email"
        />

        @if ((emailCtrl.touched || enviado) && emailCtrl.hasError('required')) {
          <small class="error-text">El correo es obligatorio.</small>
        }

        @if ((emailCtrl.touched || enviado) && emailCtrl.hasError('email')) {
          <small class="error-text">Ingresa un correo valido.</small>
        }
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input
          id="password"
          type="password"
          formControlName="password"
          placeholder="Ingrese su contraseña"
          autocomplete="current-password"
        />

        @if ((passwordCtrl.touched || enviado) && passwordCtrl.hasError('required')) {
          <small class="error-text">La contraseña es obligatoria.</small>
        }

        @if ((passwordCtrl.touched || enviado) && passwordCtrl.hasError('minlength')) {
          <small class="error-text">La contraseña debe tener minimo 6 caracteres.</small>
        }
      </div>

      @if (mensaje) {
        <p class="message">{{ mensaje }}</p>
      }

      <button type="submit" [disabled]="cargando">
        {{ cargando ? 'Ingresando...' : 'Ingresar' }}
      </button>
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

input.ng-invalid.ng-touched {
  border-color: #dc2626;
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
'@

Write-FileSafe $LoginTs $LoginTsContent
Write-FileSafe $LoginHtml $LoginHtmlContent
Write-FileSafe $LoginCss $LoginCssContent

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " LOGIN MIGRADO A REACTIVE FORMS REAL" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora prueba:"
Write-Host "cd frontend"
Write-Host "ng serve -o"
Write-Host ""
Write-Host "Luego abre:"
Write-Host "http://localhost:4200/login"