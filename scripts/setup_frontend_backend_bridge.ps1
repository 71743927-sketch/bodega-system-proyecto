$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"
$Backend = Join-Path $Root "backend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " CONFIGURANDO FRONTEND -> BACKEND" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host "Backend: $Backend"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe la carpeta frontend." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Backend)) {
    Write-Host "[ERROR] No existe la carpeta backend." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $Frontend "angular.json"))) {
    Write-Host "[ERROR] No se encontro frontend/angular.json." -ForegroundColor Red
    exit 1
}

function Write-FileSafe {
    param(
        [string]$RelativePath,
        [string]$Content
    )

    $Target = Join-Path $Frontend $RelativePath
    $TargetDir = Split-Path $Target -Parent

    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    if (Test-Path $Target) {
        $Backup = "$Target.bak"
        Copy-Item $Target $Backup -Force
        Write-Host "[BACKUP] $RelativePath -> $Backup" -ForegroundColor Yellow
    }

    Set-Content -Path $Target -Value $Content -Encoding UTF8
    Write-Host "[OK] Escrito: frontend/$RelativePath" -ForegroundColor Green
}

$ApiConfig = @'
export const API_CONFIG = {
  baseUrl: 'http://127.0.0.1:8000/api'
};
'@

$BackendHealth = @'
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class BackendHealthService {

  private readonly apiUrl = API_CONFIG.baseUrl;

  constructor(private http: HttpClient) {
    console.log('🔥 BackendHealthService creado');
  }

  health(): Observable<any> {
    const url = `${this.apiUrl}/health`;
    console.log('🚀 Llamando a backend:', url);
    return this.http.get(url);
  }
}
'@

$BackendAuth = @'
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { getAuth } from 'firebase/auth';

import { API_CONFIG } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class BackendAuthService {

  private readonly apiUrl = API_CONFIG.baseUrl;

  constructor(private http: HttpClient) {}

  getFirebaseIdToken(): Observable<string> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return throwError(() => new Error('No hay usuario Firebase autenticado.'));
    }

    return from(user.getIdToken());
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
        return this.http.get(`${this.apiUrl}/auth/me`, { headers });
      })
    );
  }
}
'@

$ProductosBackend = @'
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api.config';
import { BackendAuthService } from '../../../core/services/backend-auth';

export interface ProductoCrearBackend {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precio_compra: number;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  activo: boolean;
}

export interface ProductoActualizarBackend {
  codigo?: string;
  nombre?: string;
  descripcion?: string | null;
  precio_compra?: number;
  precio_venta?: number;
  stock?: number;
  stock_minimo?: number;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ProductosBackendService {

  private readonly apiUrl = `${API_CONFIG.baseUrl}/productos`;

  constructor(
    private http: HttpClient,
    private backendAuth: BackendAuthService
  ) {}

  listar(): Observable<any[]> {
    return this.withAuthHeaders((headers) => {
      return this.http.get<any[]>(`${this.apiUrl}/`, { headers });
    });
  }

  obtenerPorId(productoId: string): Observable<any> {
    return this.withAuthHeaders((headers) => {
      return this.http.get<any>(`${this.apiUrl}/${productoId}`, { headers });
    });
  }

  crear(producto: ProductoCrearBackend): Observable<any> {
    return this.withAuthHeaders((headers) => {
      return this.http.post<any>(`${this.apiUrl}/`, producto, { headers });
    });
  }

  actualizar(productoId: string, producto: ProductoActualizarBackend): Observable<any> {
    return this.withAuthHeaders((headers) => {
      return this.http.put<any>(`${this.apiUrl}/${productoId}`, producto, { headers });
    });
  }

  eliminar(productoId: string): Observable<any> {
    return this.withAuthHeaders((headers) => {
      return this.http.delete<any>(`${this.apiUrl}/${productoId}`, { headers });
    });
  }

  private withAuthHeaders<T>(callback: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    return this.backendAuth.authHeaders().pipe(
      switchMap((headers) => callback(headers))
    );
  }
}
'@

Write-FileSafe "src/app/core/config/api.config.ts" $ApiConfig
Write-FileSafe "src/app/core/services/backend-health.ts" $BackendHealth
Write-FileSafe "src/app/core/services/backend-auth.ts" $BackendAuth
Write-FileSafe "src/app/features/productos/services/productos-backend.service.ts" $ProductosBackend

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " CONFIGURACION COMPLETADA" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Archivos creados:"
Write-Host " - frontend/src/app/core/config/api.config.ts"
Write-Host " - frontend/src/app/core/services/backend-health.ts"
Write-Host " - frontend/src/app/core/services/backend-auth.ts"
Write-Host " - frontend/src/app/features/productos/services/productos-backend.service.ts"
Write-Host ""
Write-Host "Siguiente paso:"
Write-Host "1. Ejecuta backend desde backend/"
Write-Host "2. Ejecuta frontend desde frontend/"
Write-Host "3. Prueba BackendHealthService"