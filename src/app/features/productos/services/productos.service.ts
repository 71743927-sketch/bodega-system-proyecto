import { Injectable, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { Producto } from '../models/producto';

const STORAGE_KEY = 'bodega-productos';

const DEFAULT_PRODUCTOS: Producto[] = [
  {
    id: 1,
    codigo: 'P-001',
    nombre: 'Arroz Costeño 5kg',
    categoria: 'Abarrotes',
    precioCompra: 18.50,
    precioVenta: 22.00,
    stockActual: 20,
    stockMinimo: 5,
    activo: true,
    observacion: 'Producto de alta rotación.'
  },
  {
    id: 2,
    codigo: 'P-002',
    nombre: 'Aceite Vegetal 1L',
    categoria: 'Abarrotes',
    precioCompra: 8.20,
    precioVenta: 10.50,
    stockActual: 3,
    stockMinimo: 4,
    activo: true,
    observacion: 'Conviene reponer semanalmente.'
  },
  {
    id: 3,
    codigo: 'P-003',
    nombre: 'Leche Gloria 400g',
    categoria: 'Lácteos',
    precioCompra: 3.20,
    precioVenta: 4.00,
    stockActual: 12,
    stockMinimo: 6,
    activo: true,
    observacion: 'Producto sensible a quiebres de stock.'
  },
  {
    id: 4,
    codigo: 'P-004',
    nombre: 'Galleta Soda Field',
    categoria: 'Snacks',
    precioCompra: 1.10,
    precioVenta: 1.60,
    stockActual: 18,
    stockMinimo: 8,
    activo: true,
    observacion: 'Venta unitaria constante.'
  }
];

@Injectable({
  providedIn: 'root'
})
export class ProductosService {

  private readonly auditoriaService = inject(AuditoriaService);
  private readonly _productos = signal<Producto[]>(this.cargarDesdeStorage());

  productosLectura = this._productos.asReadonly();

  obtenerSiguienteId(): number {
    const lista = this._productos();
    return lista.length === 0 ? 1 : Math.max(...lista.map(item => item.id)) + 1;
  }

  obtenerCategorias(): string[] {
    return Array.from(new Set(this._productos().map(item => item.categoria.trim()).filter(item => item !== '')))
      .sort((a, b) => a.localeCompare(b));
  }

  agregarProducto(producto: Producto) {
    this._productos.update(lista => {
      const nueva = [...lista, { ...producto }].sort((a, b) => a.nombre.localeCompare(b.nombre));
      this.guardarEnStorage(nueva);
      return nueva;
    });

    this.auditoriaService.registrar(
      'PRODUCTOS',
      'CREAR',
      `Producto creado: ${producto.nombre}`,
      'SUCCESS',
      `Código: ${producto.codigo}`
    );
  }

  actualizarProducto(productoActualizado: Producto) {
    const anterior = this._productos().find(item => item.id === productoActualizado.id);

    this._productos.update(lista => {
      const nueva = lista
        .map(item => item.id === productoActualizado.id ? { ...productoActualizado } : item)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      this.guardarEnStorage(nueva);
      return nueva;
    });

    this.auditoriaService.registrar(
      'PRODUCTOS',
      'ACTUALIZAR',
      `Producto actualizado: ${productoActualizado.nombre}`,
      'INFO',
      anterior ? `Stock ${anterior.stockActual} → ${productoActualizado.stockActual}` : productoActualizado.codigo
    );
  }

  eliminarProducto(id: number) {
    const producto = this._productos().find(item => item.id === id);

    this._productos.update(lista => {
      const nueva = lista.filter(item => item.id !== id);
      this.guardarEnStorage(nueva);
      return nueva;
    });

    if (producto) {
      this.auditoriaService.registrar(
        'PRODUCTOS',
        'ELIMINAR',
        `Producto eliminado: ${producto.nombre}`,
        'DANGER',
        `Código: ${producto.codigo}`
      );
    }
  }

  alternarEstado(id: number) {
    const actual = this._productos().find(item => item.id === id);
    if (!actual) {
      return;
    }

    const actualizado: Producto = {
      ...actual,
      activo: !actual.activo
    };

    this.actualizarProducto(actualizado);
    this.auditoriaService.registrar(
      'PRODUCTOS',
      'ESTADO',
      `Estado actualizado: ${actualizado.nombre}`,
      actualizado.activo ? 'SUCCESS' : 'WARNING',
      actualizado.activo ? 'Activo' : 'Inactivo'
    );
  }

  actualizarProductoStock(productoId: number, cantidadVendida: number) {
    this._productos.update(lista => {
      const nueva = lista.map(producto => {
        if (producto.id !== productoId) {
          return producto;
        }

        return {
          ...producto,
          stockActual: producto.stockActual - cantidadVendida
        };
      });

      this.guardarEnStorage(nueva);
      return nueva;
    });
  }

  actualizarStockPorReposicion(productoId: number, cantidad: number) {
    this._productos.update(lista => {
      const nueva = lista.map(producto => {
        if (producto.id !== productoId) {
          return producto;
        }

        return {
          ...producto,
          stockActual: producto.stockActual + cantidad
        };
      });

      this.guardarEnStorage(nueva);
      return nueva;
    });
  }

  reemplazarProductos(items: Producto[]) {
    const saneados = items.map(item => ({
      ...item,
      observacion: item.observacion ?? ''
    }));

    this._productos.set(saneados);
    this.guardarEnStorage(saneados);
  }

  restablecerBase() {
    const defaults = DEFAULT_PRODUCTOS.map(item => ({ ...item }));
    this._productos.set(defaults);
    this.guardarEnStorage(defaults);

    this.auditoriaService.registrar(
      'PRODUCTOS',
      'RESTABLECER',
      'Se restableció el catálogo base de productos.',
      'WARNING'
    );
  }

  private cargarDesdeStorage(): Producto[] {
    try {
      if (typeof localStorage === 'undefined') {
        return DEFAULT_PRODUCTOS.map(item => ({ ...item }));
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return DEFAULT_PRODUCTOS.map(item => ({ ...item }));
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map(item => ({ ...item, observacion: item.observacion ?? '' }))
        : DEFAULT_PRODUCTOS.map(item => ({ ...item }));
    } catch {
      return DEFAULT_PRODUCTOS.map(item => ({ ...item }));
    }
  }

  private guardarEnStorage(lista: Producto[]) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
    } catch {
      // Ignorar errores de persistencia local
    }
  }
}
