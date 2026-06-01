$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " FIX DEBUG FRONTEND -> BACKEND" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/" -ForegroundColor Red
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

$BackendAuth = @'
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap, throwError } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { AuthService } from '../../features/auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class BackendAuthService {

  private readonly apiUrl = API_CONFIG.baseUrl;

  private http = inject(HttpClient);
  private authService = inject(AuthService);

  getFirebaseIdToken(): Observable<string> {
    return from(this.authService.getIdToken()).pipe(
      switchMap((token) => {
        if (!token) {
          return throwError(() => new Error('No hay token Firebase. Inicia sesión nuevamente.'));
        }

        console.log('🔐 Firebase ID Token obtenido. Longitud:', token.length);
        return from([token]);
      })
    );
  }

  authHeaders(): Observable<HttpHeaders> {
    return this.getFirebaseIdToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`
        });

        return from([headers]);
      })
    );
  }

  me(): Observable<any> {
    return this.authHeaders().pipe(
      switchMap((headers) => {
        console.log('🚀 Llamando a backend auth/me:', `${this.apiUrl}/auth/me`);
        return this.http.get(`${this.apiUrl}/auth/me`, { headers });
      })
    );
  }
}
'@

$BackendTestTs = @'
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { BackendHealthService } from '../../../../core/services/backend-health';
import { BackendAuthService } from '../../../../core/services/backend-auth';
import { ProductosBackendService, ProductoCrearBackend } from '../../../productos/services/productos-backend.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-backend-test-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './backend-test-page.component.html',
  styleUrl: './backend-test-page.component.css'
})
export class BackendTestPageComponent {

  private backendHealth = inject(BackendHealthService);
  private backendAuth = inject(BackendAuthService);
  private productosBackend = inject(ProductosBackendService);
  private authService = inject(AuthService);

  cargando = signal(false);
  resultado = signal<any>(null);
  error = signal<any>(null);

  probarHealth() {
    this.ejecutar('GET /api/health', () => this.backendHealth.health());
  }

  probarUsuarioActual() {
    console.log('👤 Usuario frontend actual:', this.authService.getCurrentUser());
    console.log('👤 Sesión frontend actual:', this.authService.sesion());

    this.ejecutar('GET /api/auth/me', () => this.backendAuth.me());
  }

  listarProductos() {
    this.ejecutar('GET /api/productos/', () => this.productosBackend.listar());
  }

  crearProductoDemo() {
    const now = Date.now();

    const producto: ProductoCrearBackend = {
      codigo: `DEMO-${now}`,
      nombre: `Producto Demo ${now}`,
      descripcion: 'Producto creado desde Angular usando FastAPI',
      precio_compra: 5,
      precio_venta: 10,
      stock: 20,
      stock_minimo: 3,
      activo: true
    };

    this.ejecutar('POST /api/productos/', () => this.productosBackend.crear(producto));
  }

  private ejecutar(nombre: string, callback: () => any) {
    this.cargando.set(true);
    this.resultado.set(null);
    this.error.set(null);

    console.log(`🚀 Ejecutando prueba: ${nombre}`);

    callback().subscribe({
      next: (res: any) => {
        console.log(`✅ ${nombre}`, res);

        this.resultado.set({
          prueba: nombre,
          respuesta: res
        });

        this.cargando.set(false);
      },
      error: (err: any) => {
        const normalizado = this.normalizarError(err);

        console.error(`❌ ${nombre}`, err);
        console.error('❌ Error normalizado:', normalizado);

        this.error.set({
          prueba: nombre,
          error: normalizado
        });

        this.cargando.set(false);
      }
    });
  }

  private normalizarError(err: any) {
    if (err instanceof HttpErrorResponse) {
      return {
        tipo: 'HttpErrorResponse',
        status: err.status,
        statusText: err.statusText,
        url: err.url,
        message: err.message,
        error: err.error,
        name: err.name,
        ok: err.ok
      };
    }

    return {
      tipo: typeof err,
      message: err?.message ?? String(err),
      raw: err
    };
  }
}
'@

$BackendTestHtml = @'
<section class="backend-test-page">
  <div class="card">
    <h1>Pruebas Frontend → Backend</h1>
    <p>
      Esta pantalla permite validar la comunicación entre Angular, FastAPI y Firebase.
    </p>

    <div class="actions">
      <button type="button" (click)="probarHealth()" [disabled]="cargando()">
        Probar /api/health
      </button>

      <button type="button" (click)="probarUsuarioActual()" [disabled]="cargando()">
        Probar /api/auth/me
      </button>

      <button type="button" (click)="listarProductos()" [disabled]="cargando()">
        Listar productos
      </button>

      <button type="button" (click)="crearProductoDemo()" [disabled]="cargando()">
        Crear producto demo
      </button>
    </div>

    @if (cargando()) {
      <p class="loading">Ejecutando prueba...</p>
    }

    @if (resultado()) {
      <div class="result success">
        <h2>Resultado OK</h2>
        <pre>{{ resultado() | json }}</pre>
      </div>
    }

    @if (error()) {
      <div class="result error">
        <h2>Error detallado</h2>
        <pre>{{ error() | json }}</pre>
      </div>
    }
  </div>
</section>
'@

$BackendAuthPath = Join-Path $Frontend "src/app/core/services/backend-auth.ts"
$BackendTestTsPath = Join-Path $Frontend "src/app/features/backend-test/pages/backend-test-page/backend-test-page.component.ts"
$BackendTestHtmlPath = Join-Path $Frontend "src/app/features/backend-test/pages/backend-test-page/backend-test-page.component.html"

Write-FileSafe $BackendAuthPath $BackendAuth
Write-FileSafe $BackendTestTsPath $BackendTestTs
Write-FileSafe $BackendTestHtmlPath $BackendTestHtml

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " FIX COMPLETADO" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora reinicia frontend:"
Write-Host "cd frontend"
Write-Host "ng serve -o"
Write-Host ""
Write-Host "Luego prueba:"
Write-Host "http://localhost:4200/backend-test"