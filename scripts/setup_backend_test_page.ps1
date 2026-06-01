$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"
$Backend = Join-Path $Root "backend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " SETUP BACKEND TEST PAGE - ANGULAR" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host "Backend: $Backend"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Backend)) {
    Write-Host "[ERROR] No existe backend/" -ForegroundColor Red
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

$TestComponentTs = @'
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { BackendHealthService } from '../../../../core/services/backend-health';
import { BackendAuthService } from '../../../../core/services/backend-auth';
import { ProductosBackendService, ProductoCrearBackend } from '../../../productos/services/productos-backend.service';

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

  cargando = signal(false);
  resultado = signal<any>(null);
  error = signal<any>(null);

  probarHealth() {
    this.ejecutar('GET /api/health', () => this.backendHealth.health());
  }

  probarUsuarioActual() {
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
        console.error(`❌ ${nombre}`, err);
        this.error.set({
          prueba: nombre,
          error: err
        });
        this.cargando.set(false);
      }
    });
  }
}
'@

$TestComponentHtml = @'
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
        <h2>Error</h2>
        <pre>{{ error() | json }}</pre>
      </div>
    }
  </div>
</section>
'@

$TestComponentCss = @'
.backend-test-page {
  min-height: 100vh;
  padding: 32px;
  background: #0f172a;
  color: #0f172a;
}

.card {
  max-width: 980px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

h1 {
  margin-top: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 24px 0;
}

button {
  border: none;
  background: #2563eb;
  color: white;
  padding: 12px 16px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

button:hover {
  background: #1d4ed8;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  font-weight: 700;
  color: #2563eb;
}

.result {
  margin-top: 20px;
  border-radius: 12px;
  padding: 16px;
}

.result.success {
  background: #ecfdf5;
  border: 1px solid #10b981;
}

.result.error {
  background: #fef2f2;
  border: 1px solid #ef4444;
}

pre {
  white-space: pre-wrap;
  word-break: break-word;
  background: #020617;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 10px;
  overflow-x: auto;
}
'@

$ComponentDir = Join-Path $Frontend "src/app/features/backend-test/pages/backend-test-page"
Write-FileSafe (Join-Path $ComponentDir "backend-test-page.component.ts") $TestComponentTs
Write-FileSafe (Join-Path $ComponentDir "backend-test-page.component.html") $TestComponentHtml
Write-FileSafe (Join-Path $ComponentDir "backend-test-page.component.css") $TestComponentCss

$RoutesPath = Join-Path $Frontend "src/app/app.routes.ts"

if (-not (Test-Path $RoutesPath)) {
    Write-Host "[WARN] No se encontro app.routes.ts. Agrega la ruta manualmente." -ForegroundColor Yellow
    exit 0
}

$RoutesContent = Get-Content $RoutesPath -Raw

Copy-Item $RoutesPath "$RoutesPath.bak" -Force
Write-Host "[BACKUP] $RoutesPath -> $RoutesPath.bak" -ForegroundColor Yellow

$ImportLine = "import { BackendTestPageComponent } from './features/backend-test/pages/backend-test-page/backend-test-page.component';"

if ($RoutesContent -notmatch [regex]::Escape($ImportLine)) {
    $RoutesContent = $ImportLine + "`r`n" + $RoutesContent
}

if ($RoutesContent -notmatch "path:\s*'backend-test'") {
    $RoutesContent = $RoutesContent -replace "export const routes:\s*Routes\s*=\s*\[", "export const routes: Routes = [`r`n  { path: 'backend-test', component: BackendTestPageComponent },"
}

Set-Content -Path $RoutesPath -Value $RoutesContent -Encoding UTF8
Write-Host "[OK] Ruta agregada: /backend-test" -ForegroundColor Green

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " SETUP COMPLETADO" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "1. Backend:"
Write-Host "   cd backend"
Write-Host "   .\.venv\Scripts\activate"
Write-Host "   python -m uvicorn src.main:app --reload"
Write-Host ""
Write-Host "2. Frontend:"
Write-Host "   cd frontend"
Write-Host "   ng serve -o"
Write-Host ""
Write-Host "3. Abre:"
Write-Host "   http://localhost:4200/backend-test"