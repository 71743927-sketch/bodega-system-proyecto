import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { Producto } from '../../../productos/models/producto';
import { ProductosService } from '../../../productos/services/productos.service';
import { MetodoPagoVenta, Venta, VentaDetalle } from '../../models/venta';
import { VentasService } from '../../services/ventas.service';

type CartItem = VentaDetalle & {
  stockDisponible: number;
};

@Component({
  selector: 'app-ventas-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './ventas-page.component.html',
  styleUrl: './ventas-page.component.css'
})
export class VentasPageComponent {

  private readonly ventasService = inject(VentasService);
  private readonly productosService = inject(ProductosService);
  private readonly authService = inject(AuthService);

  productos = this.productosService.productosLectura;
  ventas = this.ventasService.ventasLectura;
  categorias = computed(() => this.productosService.obtenerCategorias());

  busqueda = signal('');
  categoriaFiltro = signal('TODOS');
  soloConStock = signal(true);
  cantidades = signal<Partial<Record<number, number>>>({});
  carrito = signal<CartItem[]>([]);
  clienteNombre = signal('');
  observacion = signal('');
  metodoPago = signal<MetodoPagoVenta>('EFECTIVO');
  descuento = signal(0);
  montoRecibido = signal(0);
  mensaje = signal('');

  productosDisponibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const categoria = this.categoriaFiltro();
    const soloConStock = this.soloConStock();

    return this.productos().filter(item => {
      const coincideTexto =
        q === '' ||
        item.nombre.toLowerCase().includes(q) ||
        item.codigo.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q);

      const coincideCategoria = categoria === 'TODOS' || item.categoria === categoria;
      const coincideStock = !soloConStock || item.stockActual > 0;
      const coincideActivo = item.activo;

      return coincideTexto && coincideCategoria && coincideStock && coincideActivo;
    });
  });

  subtotal = computed(() => this.carrito().reduce((sum, item) => sum + item.subtotal, 0));
  total = computed(() => Math.max(0, this.subtotal() - this.descuento()));
  totalItems = computed(() => this.carrito().reduce((sum, item) => sum + item.cantidad, 0));
  vuelto = computed(() => this.metodoPago() === 'EFECTIVO' ? Math.max(0, this.montoRecibido() - this.total()) : 0);

  validarPago = computed(() => {
    if (this.metodoPago() !== 'EFECTIVO') {
      return true;
    }
    return this.montoRecibido() >= this.total();
  });

  resumenHoy = computed(() => {
    const hoy = this.obtenerFechaLocal();
    const ventasHoy = this.ventas().filter(item => this.normalizarFecha(item.fecha) === hoy);
    const totalHoy = ventasHoy.reduce((sum, item) => sum + item.total, 0);
    const ticketPromedio = ventasHoy.length === 0 ? 0 : totalHoy / ventasHoy.length;
    const efectivoHoy = ventasHoy
      .filter(item => item.metodoPago === 'EFECTIVO')
      .reduce((sum, item) => sum + item.total, 0);

    return {
      cantidad: ventasHoy.length,
      total: totalHoy,
      ticketPromedio,
      efectivoHoy
    };
  });

  ventasRecientes = computed(() => this.ventas().slice(0, 8));

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  actualizarCategoriaFiltro(valor: string) {
    this.categoriaFiltro.set(valor);
  }

  actualizarSoloConStock(valor: boolean) {
    this.soloConStock.set(valor);
  }

  actualizarCantidad(productoId: number, valor: string) {
    const numero = Math.max(1, Math.floor(Number(valor) || 1));
    this.cantidades.update(actual => ({ ...actual, [productoId]: numero }));
  }

  actualizarCliente(valor: string) {
    this.clienteNombre.set(valor);
  }

  actualizarObservacion(valor: string) {
    this.observacion.set(valor);
  }

  actualizarMetodoPago(valor: string) {
    this.metodoPago.set(valor as MetodoPagoVenta);
    if (valor !== 'EFECTIVO') {
      this.montoRecibido.set(0);
    }
  }

  actualizarDescuento(valor: string) {
    const numero = Math.max(0, Number(valor) || 0);
    this.descuento.set(numero);
  }

  actualizarMontoRecibido(valor: string) {
    const numero = Math.max(0, Number(valor) || 0);
    this.montoRecibido.set(numero);
  }

  agregarAlCarrito(producto: Producto) {
    const cantidad = Math.max(1, this.cantidades()[producto.id] ?? 1);

    if (producto.stockActual <= 0) {
      this.mensaje.set(`El producto ${producto.nombre} no tiene stock disponible.`);
      return;
    }

    const existente = this.carrito().find(item => item.productoId === producto.id);
    const nuevaCantidad = (existente?.cantidad ?? 0) + cantidad;

    if (nuevaCantidad > producto.stockActual) {
      this.mensaje.set(`La cantidad solicitada supera el stock disponible de ${producto.nombre}.`);
      return;
    }

    const nuevoItem: CartItem = {
      productoId: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      categoria: producto.categoria,
      cantidad: nuevaCantidad,
      precioUnitario: producto.precioVenta,
      subtotal: nuevaCantidad * producto.precioVenta,
      stockDisponible: producto.stockActual
    };

    this.carrito.update(lista => {
      const sinActual = lista.filter(item => item.productoId !== producto.id);
      return [...sinActual, nuevoItem].sort((a, b) => a.nombre.localeCompare(b.nombre));
    });

    this.cantidades.update(actual => ({ ...actual, [producto.id]: 1 }));
    this.mensaje.set(`${producto.nombre} agregado al carrito.`);
  }

  cambiarCantidadCarrito(productoId: number, valor: string) {
    const cantidad = Math.max(1, Math.floor(Number(valor) || 1));
    const producto = this.productos().find(item => item.id === productoId);
    if (!producto) {
      return;
    }

    if (cantidad > producto.stockActual) {
      this.mensaje.set(`La cantidad supera el stock disponible de ${producto.nombre}.`);
      return;
    }

    this.carrito.update(lista =>
      lista.map(item =>
        item.productoId === productoId
          ? {
              ...item,
              cantidad,
              subtotal: cantidad * item.precioUnitario,
              stockDisponible: producto.stockActual
            }
          : item
      )
    );
  }

  quitarDelCarrito(productoId: number) {
    this.carrito.update(lista => lista.filter(item => item.productoId !== productoId));
    this.mensaje.set('Producto retirado del carrito.');
  }

  vaciarCarrito() {
    if (this.carrito().length === 0) {
      return;
    }

    this.carrito.set([]);
    this.descuento.set(0);
    this.montoRecibido.set(0);
    this.observacion.set('');
    this.clienteNombre.set('');
    this.mensaje.set('Carrito vaciado.');
  }

  finalizarVenta() {
    const cart = this.carrito();

    if (cart.length === 0) {
      this.mensaje.set('Agrega al menos un producto al carrito antes de registrar la venta.');
      return;
    }

    if (this.total() <= 0) {
      this.mensaje.set('El total de la venta debe ser mayor a cero.');
      return;
    }

    if (!this.validarPago()) {
      this.mensaje.set('El monto recibido no cubre el total de la venta.');
      return;
    }

    const productosActuales = this.productos();
    const stockInconsistente = cart.find(item => {
      const producto = productosActuales.find(prod => prod.id === item.productoId);
      return !producto || producto.stockActual < item.cantidad;
    });

    if (stockInconsistente) {
      this.mensaje.set(`Stock insuficiente para ${stockInconsistente.nombre}. Actualiza el carrito e intenta nuevamente.`);
      return;
    }

    const venta: Venta = {
      id: this.ventasService.obtenerSiguienteId(),
      fecha: new Date().toISOString(),
      clienteNombre: this.clienteNombre().trim(),
      metodoPago: this.metodoPago(),
      subtotal: this.subtotal(),
      descuento: this.descuento(),
      total: this.total(),
      observacion: this.observacion().trim(),
      vendedor: this.authService.usernameActual() || 'Sistema',
      detalles: cart.map(item => ({
        productoId: item.productoId,
        codigo: item.codigo,
        nombre: item.nombre,
        categoria: item.categoria,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal
      }))
    };

    venta.detalles.forEach(detalle => {
      this.productosService.actualizarProductoStock(detalle.productoId, detalle.cantidad);
    });

    this.ventasService.registrarVenta(venta);

    this.carrito.set([]);
    this.descuento.set(0);
    this.montoRecibido.set(0);
    this.observacion.set('');
    this.clienteNombre.set('');
    this.metodoPago.set('EFECTIVO');
    this.mensaje.set(`Venta #${venta.id} registrada correctamente.`);
  }

  private obtenerFechaLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private normalizarFecha(fechaIso: string): string {
    const d = new Date(fechaIso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

