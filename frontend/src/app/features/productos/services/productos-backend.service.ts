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
