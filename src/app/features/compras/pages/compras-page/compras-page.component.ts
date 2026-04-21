import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ProductosService } from '../../../productos/services/productos.service';
import { Producto } from '../../../productos/models/producto';
import { ProveedoresService } from '../../../proveedores/services/proveedores.service';
import { Proveedor } from '../../../proveedores/models/proveedor';
import { ComprasService } from '../../services/compras.service';
import { Compra, CompraDetalle } from '../../models/compra';
import { InventarioService } from '../../../inventario/services/inventario.service';
import { MovimientoInventario } from '../../../inventario/models/movimiento-inventario';

type CompraForm = {
  proveedorId: number | null;
  usuario: string;
  observacion: string;
};

type ItemForm = {
  productoId: number | null;
  cantidad: number;
  costoUnitario: number;
};

@Component({
  selector: 'app-compras-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './compras-page.component.html',
  styleUrl: './compras-page.component.css'
})
export class ComprasPageComponent {

  private productosService = inject(ProductosService);
  private proveedoresService = inject(ProveedoresService);
  private comprasService = inject(ComprasService);
  private inventarioService = inject(InventarioService);

  productos = this.productosService.productosLectura;
  proveedores = this.proveedoresService.proveedoresLectura;
  compras = this.comprasService.comprasLectura;

  compraForm = signal<CompraForm>({
    proveedorId: null,
    usuario: 'Administrador',
    observacion: ''
  });

  itemForm = signal<ItemForm>({
    productoId: null,
    cantidad: 0,
    costoUnitario: 0
  });

  carrito = signal<CompraDetalle[]>([]);
  enviadoCompra = signal(false);
  enviadoItem = signal(false);
  busqueda = signal('');

  totalCompras = computed(() => this.compras().length);
  montoTotalComprado = computed(() => this.compras().reduce((sum, compra) => sum + compra.total, 0));
  productosActivos = computed(() => this.productos().filter(producto => producto.activo).length);
  proveedoresActivos = computed(() => this.proveedores().filter(proveedor => proveedor.activo).length);

  proveedorSeleccionado = computed(() => {
    const id = this.compraForm().proveedorId;
    if (id === null) {
      return null;
    }

    return this.proveedores().find(proveedor => proveedor.id === id) ?? null;
  });

  productoSeleccionado = computed(() => {
    const id = this.itemForm().productoId;
    if (id === null) {
      return null;
    }

    return this.productos().find(producto => producto.id === id) ?? null;
  });

  totalCarrito = computed(() => this.carrito().reduce((sum, item) => sum + item.subtotal, 0));

  comprasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    return this.compras().filter(compra =>
      texto === '' ||
      compra.proveedorNombre.toLowerCase().includes(texto) ||
      compra.usuario.toLowerCase().includes(texto) ||
      compra.observacion.toLowerCase().includes(texto)
    );
  });

  itemValido = computed(() => {
    const form = this.itemForm();
    return form.productoId !== null && form.cantidad > 0 && form.costoUnitario > 0;
  });

  compraValida = computed(() => {
    const form = this.compraForm();
    return form.proveedorId !== null && form.usuario.trim() !== '' && this.carrito().length > 0;
  });

  actualizarCompraProveedor(valor: string) {
    const numero = Number(valor);
    this.compraForm.update(actual => ({
      ...actual,
      proveedorId: Number.isNaN(numero) ? null : numero
    }));
  }

  actualizarCompraTexto(campo: 'usuario' | 'observacion', valor: string) {
    this.compraForm.update(actual => ({
      ...actual,
      [campo]: valor
    }));
  }

  actualizarItemProducto(valor: string) {
    const numero = Number(valor);
    this.itemForm.update(actual => ({
      ...actual,
      productoId: Number.isNaN(numero) ? null : numero
    }));
  }

  actualizarItemNumero(campo: 'cantidad' | 'costoUnitario', valor: string) {
    const numero = Number(valor);
    this.itemForm.update(actual => ({
      ...actual,
      [campo]: Number.isNaN(numero) ? 0 : numero
    }));
  }

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  agregarItem(event?: Event) {
    event?.preventDefault();
    this.enviadoItem.set(true);

    if (!this.itemValido()) {
      return;
    }

    const form = this.itemForm();
    const producto = this.productoSeleccionado();

    if (!producto) {
      return;
    }

    const existente = this.carrito().find(item => item.productoId === producto.id);

    if (existente) {
      const nuevaCantidad = existente.cantidad + form.cantidad;
      const nuevoCosto = form.costoUnitario;

      this.carrito.update(lista =>
        lista.map(item =>
          item.productoId === producto.id
            ? {
                ...item,
                cantidad: nuevaCantidad,
                costoUnitario: nuevoCosto,
                subtotal: nuevaCantidad * nuevoCosto
              }
            : item
        )
      );
    } else {
      const detalle: CompraDetalle = {
        productoId: producto.id,
        productoNombre: producto.nombre,
        cantidad: form.cantidad,
        costoUnitario: form.costoUnitario,
        subtotal: form.cantidad * form.costoUnitario
      };

      this.carrito.update(lista => [...lista, detalle]);
    }

    this.itemForm.set({
      productoId: null,
      cantidad: 0,
      costoUnitario: 0
    });
    this.enviadoItem.set(false);
  }

  quitarItem(productoId: number) {
    this.carrito.update(lista => lista.filter(item => item.productoId !== productoId));
  }

  registrarCompra(event?: Event) {
    event?.preventDefault();
    this.enviadoCompra.set(true);

    if (!this.compraValida()) {
      return;
    }

    const form = this.compraForm();
    const proveedor = this.proveedorSeleccionado();

    if (!proveedor) {
      return;
    }

    const compra: Compra = {
      id: this.comprasService.obtenerSiguienteId(),
      fecha: new Date().toISOString(),
      proveedorId: proveedor.id,
      proveedorNombre: proveedor.nombre,
      usuario: form.usuario.trim(),
      observacion: form.observacion.trim(),
      total: this.totalCarrito(),
      detalles: this.carrito()
    };

    this.comprasService.registrarCompra(compra);

    compra.detalles.forEach(detalle => {
      const producto = this.productos().find(p => p.id === detalle.productoId);
      if (!producto) {
        return;
      }

      const stockAnterior = producto.stockActual;
      const stockNuevo = stockAnterior + detalle.cantidad;

      const productoActualizado: Producto = {
        ...producto,
        stockActual: stockNuevo,
        precioCompra: detalle.costoUnitario
      };

      this.productosService.actualizarProducto(productoActualizado);

      const movimiento: MovimientoInventario = {
        id: this.inventarioService.obtenerSiguienteId(),
        fecha: new Date().toISOString(),
        productoId: producto.id,
        productoNombre: producto.nombre,
        tipo: 'ENTRADA',
        cantidad: detalle.cantidad,
        stockAnterior,
        stockNuevo,
        usuario: form.usuario.trim(),
        observacion: `Compra registrada a proveedor ${proveedor.nombre}${form.observacion.trim() !== '' ? ' - ' + form.observacion.trim() : ''}`
      };

      this.inventarioService.registrarMovimiento(movimiento);
    });

    this.compraForm.set({
      proveedorId: null,
      usuario: form.usuario.trim(),
      observacion: ''
    });
    this.itemForm.set({
      productoId: null,
      cantidad: 0,
      costoUnitario: 0
    });
    this.carrito.set([]);
    this.enviadoCompra.set(false);
    this.enviadoItem.set(false);
  }
}
