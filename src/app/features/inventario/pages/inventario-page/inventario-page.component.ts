import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ProductosService } from '../../../productos/services/productos.service';
import { Producto } from '../../../productos/models/producto';
import { InventarioService } from '../../services/inventario.service';
import { MovimientoInventario, TipoMovimientoInventario } from '../../models/movimiento-inventario';

type InventarioForm = {
  productoId: number | null;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  usuario: string;
  observacion: string;
};

@Component({
  selector: 'app-inventario-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './inventario-page.component.html',
  styleUrl: './inventario-page.component.css'
})
export class InventarioPageComponent {

  private productosService = inject(ProductosService);
  private inventarioService = inject(InventarioService);

  productos = this.productosService.productosLectura;
  movimientos = this.inventarioService.movimientosLectura;

  enviado = signal(false);
  busqueda = signal('');
  filtroTipo = signal<'TODOS' | TipoMovimientoInventario>('TODOS');
  filtroStock = signal<'TODOS' | 'BAJO' | 'AGOTADO'>('TODOS');

  formulario = signal<InventarioForm>({
    productoId: null,
    tipo: 'ENTRADA',
    cantidad: 0,
    usuario: 'Administrador',
    observacion: ''
  });

  totalProductos = computed(() => this.productos().length);
  totalMovimientos = computed(() => this.movimientos().length);
  stockBajo = computed(() => this.productos().filter(p => p.stockActual > 0 && p.stockActual <= p.stockMinimo).length);
  agotados = computed(() => this.productos().filter(p => p.stockActual === 0).length);

  productosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtroStock = this.filtroStock();

    return this.productos().filter(producto => {
      const coincideTexto =
        texto === '' ||
        producto.nombre.toLowerCase().includes(texto) ||
        producto.codigo.toLowerCase().includes(texto) ||
        producto.categoria.toLowerCase().includes(texto);

      const coincideStock =
        filtroStock === 'TODOS' ||
        (filtroStock === 'BAJO' && producto.stockActual > 0 && producto.stockActual <= producto.stockMinimo) ||
        (filtroStock === 'AGOTADO' && producto.stockActual === 0);

      return coincideTexto && coincideStock;
    });
  });

  movimientosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const tipo = this.filtroTipo();

    return this.movimientos().filter(mov => {
      const coincideTexto =
        texto === '' ||
        mov.productoNombre.toLowerCase().includes(texto) ||
        mov.usuario.toLowerCase().includes(texto) ||
        mov.observacion.toLowerCase().includes(texto);

      const coincideTipo = tipo === 'TODOS' || mov.tipo === tipo;

      return coincideTexto && coincideTipo;
    });
  });

  productoSeleccionado = computed(() => {
    const id = this.formulario().productoId;
    if (id === null) {
      return null;
    }

    return this.productos().find(producto => producto.id === id) ?? null;
  });

  formularioValido = computed(() => {
    const form = this.formulario();
    const producto = this.productoSeleccionado();

    if (form.productoId === null || !producto) {
      return false;
    }

    if (form.usuario.trim() === '') {
      return false;
    }

    if (form.tipo === 'SALIDA') {
      return form.cantidad > 0 && form.cantidad <= producto.stockActual;
    }

    return form.cantidad >= 0;
  });

  tituloCantidad = computed(() => {
    const tipo = this.formulario().tipo;

    if (tipo === 'AJUSTE') {
      return 'Nuevo stock';
    }

    if (tipo === 'SALIDA') {
      return 'Cantidad a retirar';
    }

    return 'Cantidad a ingresar';
  });

  actualizarProducto(valor: string) {
    const numero = Number(valor);
    this.formulario.update(actual => ({
      ...actual,
      productoId: Number.isNaN(numero) ? null : numero
    }));
  }

  actualizarTipo(valor: TipoMovimientoInventario) {
    this.formulario.update(actual => ({
      ...actual,
      tipo: valor,
      cantidad: 0
    }));
  }

  actualizarCantidad(valor: string) {
    const numero = Number(valor);
    this.formulario.update(actual => ({
      ...actual,
      cantidad: Number.isNaN(numero) ? 0 : numero
    }));
  }

  actualizarTexto(campo: 'usuario' | 'observacion', valor: string) {
    this.formulario.update(actual => ({
      ...actual,
      [campo]: valor
    }));
  }

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  actualizarFiltroTipo(valor: 'TODOS' | TipoMovimientoInventario) {
    this.filtroTipo.set(valor);
  }

  actualizarFiltroStock(valor: 'TODOS' | 'BAJO' | 'AGOTADO') {
    this.filtroStock.set(valor);
  }

  registrarMovimiento(event?: Event) {
    event?.preventDefault();
    this.enviado.set(true);

    if (!this.formularioValido()) {
      return;
    }

    const form = this.formulario();
    const producto = this.productoSeleccionado();

    if (!producto) {
      return;
    }

    const stockAnterior = producto.stockActual;
    let stockNuevo = stockAnterior;
    let cantidadMovimiento = form.cantidad;

    if (form.tipo === 'ENTRADA') {
      stockNuevo = stockAnterior + form.cantidad;
    } else if (form.tipo === 'SALIDA') {
      stockNuevo = stockAnterior - form.cantidad;
    } else {
      stockNuevo = form.cantidad;
      cantidadMovimiento = Math.abs(stockNuevo - stockAnterior);
    }

    const productoActualizado: Producto = {
      ...producto,
      stockActual: stockNuevo
    };

    this.productosService.actualizarProducto(productoActualizado);

    const movimiento: MovimientoInventario = {
      id: this.inventarioService.obtenerSiguienteId(),
      fecha: new Date().toISOString(),
      productoId: producto.id,
      productoNombre: producto.nombre,
      tipo: form.tipo,
      cantidad: cantidadMovimiento,
      stockAnterior,
      stockNuevo,
      usuario: form.usuario.trim(),
      observacion: form.observacion.trim()
    };

    this.inventarioService.registrarMovimiento(movimiento);
    this.limpiarFormulario();
  }

  limpiarFormulario() {
    this.enviado.set(false);
    this.formulario.set({
      productoId: null,
      tipo: 'ENTRADA',
      cantidad: 0,
      usuario: 'Administrador',
      observacion: ''
    });
  }

  etiquetaTipo(tipo: TipoMovimientoInventario): string {
    switch (tipo) {
      case 'ENTRADA':
        return 'Entrada';
      case 'SALIDA':
        return 'Salida';
      case 'AJUSTE':
        return 'Ajuste';
      default:
        return tipo;
    }
  }
}
