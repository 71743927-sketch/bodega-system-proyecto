$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"
$Backend = Join-Path $Root "backend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " MIGRACION PRODUCTOS -> BACKEND FASTAPI" -ForegroundColor Cyan
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

$ProductoModel = @'
export interface Producto {
  id: number;
  backendId?: string;
  codigo: string;
  nombre: string;
  categoria: string;
  precioCompra: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  observacion?: string;
}
'@

$ProductosBackendService = @'
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api.config';
import { BackendAuthService } from '../../../core/services/backend-auth';

export interface ProductoCrearBackend {
  codigo: string;
  nombre: string;
  categoria?: string;
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
  categoria?: string;
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

$ProductosServiceAdapter = @'
import { Injectable, computed, inject, signal } from '@angular/core';

import { Producto } from '../models/producto';
import {
  ProductosBackendService,
  ProductoActualizarBackend,
  ProductoCrearBackend
} from './productos-backend.service';

@Injectable({
  providedIn: 'root'
})
export class ProductosService {

  private backend = inject(ProductosBackendService);

  productos = signal<Producto[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  productosActivos = computed(() => this.productos().filter(p => p.activo));
  productosCriticos = computed(() =>
    this.productos().filter(p => p.stockActual <= p.stockMinimo)
  );

  categorias = computed(() => this.obtenerCategorias());

  constructor() {
    this.cargarDesdeBackend();
  }

  private cargarDesdeBackend(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.backend.listar().subscribe({
      next: (items) => {
        const productos = items.map((item, index) => this.mapDesdeBackend(item, index));
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando productos desde backend:', err);
        this.error.set('No se pudieron cargar productos desde el backend.');
        this.cargando.set(false);
      }
    });
  }

  obtenerSiguienteId(): number {
    const ids = this.productos().map(p => Number(p.id) || 0);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  obtenerCategorias(): string[] {
    const categorias = this.productos()
      .map(p => p.categoria || 'General')
      .filter(Boolean);

    return Array.from(new Set(categorias)).sort();
  }

  agregarProducto(producto: Producto): void {
    const payload = this.mapCrearBackend(producto);

    this.backend.crear(payload).subscribe({
      next: (creado) => {
        const nuevo = this.mapDesdeBackend(creado, this.productos().length);
        this.productos.update(lista => [...lista, nuevo]);
      },
      error: (err) => {
        console.error('Error agregando producto en backend:', err);
        this.error.set('No se pudo agregar el producto.');
      }
    });
  }

  actualizarProducto(id: number, cambios: Partial<Producto>): void {
    const actual = this.productos().find(p => p.id === id);

    if (!actual) {
      this.error.set('Producto no encontrado.');
      return;
    }

    const backendId = actual.backendId ?? String(actual.id);
    const payload = this.mapActualizarBackend(cambios);

    this.backend.actualizar(backendId, payload).subscribe({
      next: (actualizado) => {
        const productoActualizado = this.mapDesdeBackend(actualizado, id - 1, id);
        this.productos.update(lista =>
          lista.map(p => p.id === id ? { ...p, ...productoActualizado, id } : p)
        );
      },
      error: (err) => {
        console.error('Error actualizando producto en backend:', err);
        this.error.set('No se pudo actualizar el producto.');
      }
    });
  }

  eliminarProducto(id: number): void {
    const actual = this.productos().find(p => p.id === id);

    if (!actual) {
      this.error.set('Producto no encontrado.');
      return;
    }

    const backendId = actual.backendId ?? String(actual.id);

    this.backend.eliminar(backendId).subscribe({
      next: () => {
        this.productos.update(lista => lista.filter(p => p.id !== id));
      },
      error: (err) => {
        console.error('Error eliminando producto en backend:', err);
        this.error.set('No se pudo eliminar el producto.');
      }
    });
  }

  alternarEstado(id: number): void {
    const actual = this.productos().find(p => p.id === id);

    if (!actual) {
      this.error.set('Producto no encontrado.');
      return;
    }

    this.actualizarProducto(id, {
      activo: !actual.activo
    });
  }

  actualizarProductoStock(id: number, nuevoStock: number): void {
    this.actualizarProducto(id, {
      stockActual: nuevoStock
    });
  }

  actualizarStockPorReposicion(id: number, cantidad: number): void {
    const actual = this.productos().find(p => p.id === id);

    if (!actual) {
      this.error.set('Producto no encontrado.');
      return;
    }

    this.actualizarProducto(id, {
      stockActual: actual.stockActual + cantidad
    });
  }

  reemplazarProductos(productos: Producto[]): void {
    productos.forEach(producto => {
      if (producto.backendId) {
        this.actualizarProducto(producto.id, producto);
      } else {
        this.agregarProducto(producto);
      }
    });
  }

  restablecerBase(): void {
    this.cargarDesdeBackend();
  }

  cargarDesdeStorage(): void {
    this.cargarDesdeBackend();
  }

  guardarEnStorage(): void {
    // Ya no se usa localStorage/Firebase directo desde Angular.
    // La persistencia ahora la maneja FastAPI + Firestore.
  }

  private mapDesdeBackend(item: any, index: number, idForzado?: number): Producto {
    return {
      id: idForzado ?? this.normalizarId(item?.id, index),
      backendId: item?.id ? String(item.id) : undefined,
      codigo: item?.codigo ?? '',
      nombre: item?.nombre ?? '',
      categoria: item?.categoria ?? 'General',
      precioCompra: Number(item?.precio_compra ?? item?.precioCompra ?? 0),
      precioVenta: Number(item?.precio_venta ?? item?.precioVenta ?? 0),
      stockActual: Number(item?.stock ?? item?.stockActual ?? 0),
      stockMinimo: Number(item?.stock_minimo ?? item?.stockMinimo ?? 0),
      activo: Boolean(item?.activo ?? true),
      observacion: item?.descripcion ?? item?.observacion ?? ''
    };
  }

  private mapCrearBackend(producto: Producto): ProductoCrearBackend {
    return {
      codigo: producto.codigo,
      nombre: producto.nombre,
      categoria: producto.categoria || 'General',
      descripcion: producto.observacion ?? null,
      precio_compra: Number(producto.precioCompra ?? 0),
      precio_venta: Number(producto.precioVenta ?? 0),
      stock: Number(producto.stockActual ?? 0),
      stock_minimo: Number(producto.stockMinimo ?? 0),
      activo: Boolean(producto.activo)
    };
  }

  private mapActualizarBackend(producto: Partial<Producto>): ProductoActualizarBackend {
    const payload: ProductoActualizarBackend = {};

    if (producto.codigo !== undefined) payload.codigo = producto.codigo;
    if (producto.nombre !== undefined) payload.nombre = producto.nombre;
    if (producto.categoria !== undefined) payload.categoria = producto.categoria;
    if (producto.observacion !== undefined) payload.descripcion = producto.observacion ?? null;
    if (producto.precioCompra !== undefined) payload.precio_compra = Number(producto.precioCompra);
    if (producto.precioVenta !== undefined) payload.precio_venta = Number(producto.precioVenta);
    if (producto.stockActual !== undefined) payload.stock = Number(producto.stockActual);
    if (producto.stockMinimo !== undefined) payload.stock_minimo = Number(producto.stockMinimo);
    if (producto.activo !== undefined) payload.activo = Boolean(producto.activo);

    return payload;
  }

  private normalizarId(rawId: any, index: number): number {
    const numeric = Number(rawId);

    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }

    return index + 1;
  }
}
'@

$BackendProductoSchema = @'
from pydantic import BaseModel, Field
from typing import Optional


class ProductoCrear(BaseModel):
    codigo: str = Field(..., min_length=1, max_length=50)
    nombre: str = Field(..., min_length=1, max_length=150)
    categoria: str = "General"
    descripcion: Optional[str] = None
    precio_compra: float = Field(default=0, ge=0)
    precio_venta: float = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
    stock_minimo: int = Field(default=0, ge=0)
    activo: bool = True


class ProductoActualizar(BaseModel):
    codigo: Optional[str] = Field(default=None, min_length=1, max_length=50)
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    precio_compra: Optional[float] = Field(default=None, ge=0)
    precio_venta: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    stock_minimo: Optional[int] = Field(default=None, ge=0)
    activo: Optional[bool] = None


class ProductoRespuesta(BaseModel):
    id: str
    codigo: str
    nombre: str
    categoria: str = "General"
    descripcion: Optional[str] = None
    precio_compra: float = 0
    precio_venta: float = 0
    stock: int = 0
    stock_minimo: int = 0
    activo: bool = True
'@

$ProductoModelPath = Join-Path $Frontend "src/app/features/productos/models/producto.ts"
$ProductosBackendPath = Join-Path $Frontend "src/app/features/productos/services/productos-backend.service.ts"
$ProductosServicePath = Join-Path $Frontend "src/app/features/productos/services/productos.service.ts"
$BackendSchemaPath = Join-Path $Backend "src/schema/producto_schema.py"

Write-FileSafe $ProductoModelPath $ProductoModel
Write-FileSafe $ProductosBackendPath $ProductosBackendService
Write-FileSafe $ProductosServicePath $ProductosServiceAdapter
Write-FileSafe $BackendSchemaPath $BackendProductoSchema

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " MIGRACION PRODUCTOS CONFIGURADA" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora:"
Write-Host "1. Reinicia backend."
Write-Host "2. Reinicia frontend."
Write-Host "3. Inicia sesion con Firebase."
Write-Host "4. Abre /backend-test."
Write-Host "5. Crea producto demo."
Write-Host "6. Abre /productos y verifica que carga desde backend."