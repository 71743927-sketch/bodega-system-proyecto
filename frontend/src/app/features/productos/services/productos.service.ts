import { Injectable, computed, inject, signal } from '@angular/core';

import { Producto } from '../models/producto';
import {
  ProductoActualizarBackend,
  ProductoCrearBackend,
  ProductosBackendService
} from './productos-backend.service';

@Injectable({
  providedIn: 'root'
})
export class ProductosService {

  private backend = inject(ProductosBackendService);

  private productosSignal = signal<Producto[]>([]);

  // Compatibilidad con todo el sistema anterior
  productosLectura = computed<Producto[]>(() => this.productosSignal());

  // Alias por si alguna pantalla usa productos()
  productos = this.productosLectura;

  cargando = signal(false);
  error = signal<string | null>(null);

  productosActivos = computed<Producto[]>(() =>
    this.productosLectura().filter((p: Producto) => p.activo)
  );

  productosCriticos = computed<Producto[]>(() =>
    this.productosLectura().filter((p: Producto) => p.stockActual <= p.stockMinimo)
  );

  categorias = computed<string[]>(() => this.obtenerCategorias());

  constructor() {
    this.cargarDesdeBackend();
  }

  private cargarDesdeBackend(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.backend.listar().subscribe({
      next: (items: any[]) => {
        const productos = items.map((item: any, index: number) => this.mapDesdeBackend(item, index));
        this.productosSignal.set(productos);
        this.cargando.set(false);
      },
      error: (err: any) => {
        console.error('Error cargando productos desde backend:', err);
        this.error.set('No se pudieron cargar productos desde el backend.');
        this.cargando.set(false);
      }
    });
  }

  obtenerSiguienteId(): number {
    const ids = this.productosLectura().map((p: Producto) => Number(p.id) || 0);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  obtenerCategorias(): string[] {
    const categorias = this.productosLectura()
      .map((p: Producto) => p.categoria || 'General')
      .filter((categoria: string) => Boolean(categoria));

    return Array.from(new Set(categorias)).sort();
  }

  agregarProducto(producto: Producto): void {
    const payload = this.mapCrearBackend(producto);

    this.backend.crear(payload).subscribe({
      next: (creado: any) => {
        const nuevo = this.mapDesdeBackend(creado, this.productosLectura().length);
        this.productosSignal.update((lista: Producto[]) => [...lista, nuevo]);
      },
      error: (err: any) => {
        console.error('Error agregando producto en backend:', err);
        this.error.set('No se pudo agregar el producto.');
      }
    });
  }

  /**
   * Compatibilidad:
   * - actualizarProducto(productoCompleto)
   * - actualizarProducto(id, cambios)
   */
  actualizarProducto(producto: Producto): void;
  actualizarProducto(id: number, cambios: Partial<Producto>): void;
  actualizarProducto(productoOrId: Producto | number, cambios?: Partial<Producto>): void {
    let id: number;
    let cambiosFinales: Partial<Producto>;

    if (typeof productoOrId === 'number') {
      id = productoOrId;
      cambiosFinales = cambios ?? {};
    } else {
      id = productoOrId.id;
      cambiosFinales = productoOrId;
    }

    const actual = this.productosLectura().find((p: Producto) => p.id === id);

    if (!actual) {
      this.error.set('Producto no encontrado.');
      return;
    }

    const backendId = actual.backendId ?? String(actual.id);
    const payload = this.mapActualizarBackend(cambiosFinales);

    this.backend.actualizar(backendId, payload).subscribe({
      next: (actualizado: any) => {
        const productoActualizado = this.mapDesdeBackend(actualizado, id - 1, id);

        this.productosSignal.update((lista: Producto[]) =>
          lista.map((p: Producto) =>
            p.id === id
              ? { ...p, ...productoActualizado, id }
              : p
          )
        );
      },
      error: (err: any) => {
        console.error('Error actualizando producto en backend:', err);
        this.error.set('No se pudo actualizar el producto.');
      }
    });
  }

  eliminarProducto(id: number): void {
    const actual = this.productosLectura().find((p: Producto) => p.id === id);

    if (!actual) {
      this.error.set('Producto no encontrado.');
      return;
    }

    const backendId = actual.backendId ?? String(actual.id);

    this.backend.eliminar(backendId).subscribe({
      next: () => {
        this.productosSignal.update((lista: Producto[]) =>
          lista.filter((p: Producto) => p.id !== id)
        );
      },
      error: (err: any) => {
        console.error('Error eliminando producto en backend:', err);
        this.error.set('No se pudo eliminar el producto.');
      }
    });
  }

  alternarEstado(id: number): void {
    const actual = this.productosLectura().find((p: Producto) => p.id === id);

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
    const actual = this.productosLectura().find((p: Producto) => p.id === id);

    if (!actual) {
      this.error.set('Producto no encontrado.');
      return;
    }

    this.actualizarProducto(id, {
      stockActual: actual.stockActual + cantidad
    });
  }

  reemplazarProductos(productos: Producto[]): void {
    productos.forEach((producto: Producto) => {
      if (producto.backendId) {
        this.actualizarProducto(producto);
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
    // Compatibilidad con llamadas antiguas.
    // La persistencia ahora se realiza en FastAPI + Firestore.
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
