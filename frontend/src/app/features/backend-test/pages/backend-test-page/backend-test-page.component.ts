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
    console.log('ðŸ‘¤ Usuario frontend actual:', this.authService.getCurrentUser());
    console.log('ðŸ‘¤ SesiÃ³n frontend actual:', this.authService.sesion());

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

    console.log(`ðŸš€ Ejecutando prueba: ${nombre}`);

    callback().subscribe({
      next: (res: any) => {
        console.log(`âœ… ${nombre}`, res);

        this.resultado.set({
          prueba: nombre,
          respuesta: res
        });

        this.cargando.set(false);
      },
      error: (err: any) => {
        const normalizado = this.normalizarError(err);

        console.error(`âŒ ${nombre}`, err);
        console.error('âŒ Error normalizado:', normalizado);

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
  async copiarTokenFirebase() {
    try {
      console.log('ðŸ” Solicitando token Firebase...');

      const token = await this.authService.getIdToken();

      if (!token) {
        const mensaje = 'No hay token Firebase. Inicia sesiÃ³n nuevamente en /login.';

        console.error('âŒ', mensaje);

        this.error.set({
          prueba: 'Copiar token Firebase',
          error: {
            message: mensaje
          }
        });

        return;
      }

      const bearerToken = `Bearer ${token}`;

      await navigator.clipboard.writeText(bearerToken);

      console.log('âœ… Token Firebase copiado al portapapeles.');
      console.log('ðŸ“‹ Pega este valor en Swagger authorization:', bearerToken);

      this.resultado.set({
        prueba: 'Copiar token Firebase',
        respuesta: {
          mensaje: 'Token copiado al portapapeles.',
          instrucciones: 'Ve a Swagger, abre /api/auth/me, pega el token en authorization y presiona Execute.',
          formato: 'Bearer <firebase_id_token>',
          longitudToken: token.length
        }
      });

      this.error.set(null);
    } catch (err: any) {
      console.error('âŒ Error copiando token Firebase:', err);

      this.error.set({
        prueba: 'Copiar token Firebase',
        error: {
          message: err?.message ?? String(err),
          raw: err
        }
      });
    }
  }
}
