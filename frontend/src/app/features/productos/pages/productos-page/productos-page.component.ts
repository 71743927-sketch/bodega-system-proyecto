import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { Producto } from '../../models/producto';
import { ProductosService } from '../../services/productos.service';

interface ProductoSignalFormModel {
  codigo: string;
  nombre: string;
  categoria: string;
  precioCompra: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  observacion: string;
}

interface ProductosFiltroSignalModel {
  busqueda: string;
  categoria: string;
  soloActivos: boolean;
  soloCriticos: boolean;
}

@Component({
  selector: 'app-productos-page',
  standalone: true,
  imports: [FormField],
  templateUrl: './productos-page.component.html',
  styleUrl: './productos-page.component.css'
})
export class ProductosPageComponent {

  private readonly productosService = inject(ProductosService);

  readonly productos = this.productosService.productosLectura;

  readonly editandoId = signal<number | null>(null);
  readonly enviado = signal(false);
  readonly mensaje = signal('');

  readonly productoModel = signal<ProductoSignalFormModel>(this.obtenerFormularioBase());
  readonly productoForm = form(this.productoModel);

  readonly filtrosModel = signal<ProductosFiltroSignalModel>({
    busqueda: '',
    categoria: '',
    soloActivos: true,
    soloCriticos: false
  });

  readonly filtrosForm = form(this.filtrosModel);

  readonly codigoAutomatico = computed(() => {
    if (this.editandoId() !== null) {
      return this.productoModel().codigo;
    }

    return this.productosService.obtenerSiguienteCodigo();
  });

  readonly categorias = computed(() => this.productosService.obtenerCategorias());

  readonly productosFiltrados = computed(() => {
    const filtros = this.filtrosModel();
    const texto = filtros.busqueda.trim().toLowerCase();

    return this.productos().filter((producto: Producto) => {
      const coincideTexto =
        !texto ||
        producto.codigo.toLowerCase().includes(texto) ||
        producto.nombre.toLowerCase().includes(texto) ||
        producto.categoria.toLowerCase().includes(texto);

      const coincideCategoria =
        !filtros.categoria || producto.categoria === filtros.categoria;

      const coincideActivo =
        !filtros.soloActivos || producto.activo;

      const coincideCritico =
        !filtros.soloCriticos || producto.stockActual <= producto.stockMinimo;

      return coincideTexto && coincideCategoria && coincideActivo && coincideCritico;
    });
  });

  readonly resumen = computed(() => {
    const lista = this.productos();

    const activos = lista.filter((item: Producto) => item.activo).length;
    const criticos = lista.filter((item: Producto) => item.stockActual <= item.stockMinimo).length;
    const valorizado = lista.reduce(
      (sum: number, item: Producto) => sum + item.stockActual * item.precioCompra,
      0
    );

    const margenPromedio = lista.length === 0
      ? 0
      : lista.reduce((sum: number, item: Producto) => {
          const margen = item.precioVenta - item.precioCompra;
          return sum + margen;
        }, 0) / lista.length;

    return {
      total: lista.length,
      activos,
      criticos,
      valorizado,
      margenPromedio
    };
  });

  readonly formularioValido = computed(() => {
    const model = this.productoModel();

    return (
      this.codigoAutomatico().trim().length > 0 &&
      model.nombre.trim().length > 0 &&
      model.categoria.trim().length > 0 &&
      Number(model.precioCompra) >= 0 &&
      Number(model.precioVenta) >= 0 &&
      Number(model.stockActual) >= 0 &&
      Number(model.stockMinimo) >= 0 &&
      Number(model.precioVenta) >= Number(model.precioCompra)
    );
  });

  readonly modoEdicion = computed(() => this.editandoId() !== null);

  guardar(): void {
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Completa correctamente los datos del producto.');
      return;
    }

    const model = this.productoModel();
    const codigoFinal = this.editandoId() === null
      ? this.productosService.obtenerSiguienteCodigo()
      : model.codigo.trim();

    const duplicado = this.productos().find((item: Producto) =>
      item.codigo.trim().toLowerCase() === codigoFinal.trim().toLowerCase() &&
      item.id !== this.editandoId()
    );

    if (duplicado) {
      this.mensaje.set('Ya existe un producto con ese codigo.');
      return;
    }

    const payload: Producto = {
      id: this.editandoId() ?? this.productosService.obtenerSiguienteId(),
      codigo: codigoFinal,
      nombre: model.nombre.trim(),
      categoria: model.categoria.trim(),
      precioCompra: Number(model.precioCompra),
      precioVenta: Number(model.precioVenta),
      stockActual: Number(model.stockActual),
      stockMinimo: Number(model.stockMinimo),
      activo: Boolean(model.activo),
      observacion: model.observacion.trim()
    };

    if (this.modoEdicion()) {
      this.productosService.actualizarProducto(payload);
      this.mensaje.set('Producto actualizado correctamente.');
    } else {
      this.productosService.agregarProducto(payload);
      this.mensaje.set('Producto agregado correctamente.');
    }

    this.cancelarEdicion();
  }

  editar(producto: Producto): void {
    this.editandoId.set(producto.id);

    this.productoModel.set({
      codigo: producto.codigo,
      nombre: producto.nombre,
      categoria: producto.categoria,
      precioCompra: producto.precioCompra,
      precioVenta: producto.precioVenta,
      stockActual: producto.stockActual,
      stockMinimo: producto.stockMinimo,
      activo: producto.activo,
      observacion: producto.observacion ?? ''
    });

    this.enviado.set(false);
    this.mensaje.set('');
  }

  eliminar(producto: Producto): void {
    const confirmar = confirm(`Â¿Eliminar producto ${producto.nombre}?`);

    if (!confirmar) {
      return;
    }

    this.productosService.eliminarProducto(producto.id);
    this.mensaje.set('Producto eliminado correctamente.');
  }

  alternarEstado(producto: Producto): void {
    this.productosService.alternarEstado(producto.id);
  }

  cancelarEdicion(): void {
    this.editandoId.set(null);
    this.productoModel.set(this.obtenerFormularioBase());
    this.enviado.set(false);
  }

  restablecerBase(): void {
    this.productosService.restablecerBase();
    this.mensaje.set('Productos recargados desde backend.');
  }

  limpiarFiltros(): void {
    this.filtrosModel.set({
      busqueda: '',
      categoria: '',
      soloActivos: true,
      soloCriticos: false
    });
  }

  private obtenerFormularioBase(): ProductoSignalFormModel {
    return {
      codigo: this.productosService.obtenerSiguienteCodigo(),
      nombre: '',
      categoria: 'General',
      precioCompra: 0,
      precioVenta: 0,
      stockActual: 0,
      stockMinimo: 0,
      activo: true,
      observacion: ''
    };
  }
}
