import { Injectable, computed, signal } from '@angular/core';
import { Producto } from '../models/producto';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  private productosSignal = signal<Producto[]>([]);

  productos = computed(() => this.productosSignal());
  totalProductos = computed(() => this.productosSignal().length);

  obtenerProductos(): Producto[] {
    return this.productosSignal();
  }

  agregarProducto(producto: Producto): void {
    this.productosSignal.update(productos => [...productos, producto]);
  }

  actualizarProducto(productoActualizado: Producto): void {
    this.productosSignal.update(productos =>
      productos.map(producto =>
        producto.id === productoActualizado.id ? productoActualizado : producto
      )
    );
  }

  eliminarProducto(id: number): void {
    this.productosSignal.update(productos =>
      productos.filter(producto => producto.id !== id)
    );
  }
}
