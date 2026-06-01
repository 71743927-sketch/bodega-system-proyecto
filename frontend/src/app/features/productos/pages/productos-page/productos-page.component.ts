import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Producto } from '../../models/producto';
import { ProductosService } from '../../services/productos.service';

type ProductoForm = {
  id: number | null;
  codigo: string;
  nombre: string;
  categoria: string;
  precioCompra: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  observacion: string;
};

@Component({
  selector: 'app-productos-page',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './productos-page.component.html',
  styleUrl: './productos-page.component.css'
})
export class ProductosPageComponent {

  private readonly productosService = inject(ProductosService);

  productos = this.productosService.productosLectura;
  categorias = computed(() => this.productosService.obtenerCategorias());

  busqueda = signal('');
  categoriaFiltro = signal('TODOS');
  soloActivos = signal(true);
  soloCriticos = signal(false);
  enviado = signal(false);
  mensaje = signal('');
  modoEdicion = signal(false);

  formulario = signal<ProductoForm>(this.obtenerFormularioBase());

  productosFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const categoria = this.categoriaFiltro();
    const soloActivos = this.soloActivos();
    const soloCriticos = this.soloCriticos();

    return this.productos().filter(item => {
      const coincideTexto =
        q === '' ||
        item.nombre.toLowerCase().includes(q) ||
        item.codigo.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q);

      const coincideCategoria = categoria === 'TODOS' || item.categoria === categoria;
      const coincideActivo = !soloActivos || item.activo;
      const coincideCritico = !soloCriticos || item.stockActual <= item.stockMinimo;

      return coincideTexto && coincideCategoria && coincideActivo && coincideCritico;
    });
  });

  resumen = computed(() => {
    const lista = this.productos();
    const activos = lista.filter(item => item.activo).length;
    const criticos = lista.filter(item => item.stockActual <= item.stockMinimo).length;
    const valorizado = lista.reduce((sum, item) => sum + item.stockActual * item.precioCompra, 0);
    const margenPromedio = lista.length === 0
      ? 0
      : lista.reduce((sum, item) => {
          const venta = item.precioVenta;
          const compra = item.precioCompra;
          const margen = venta <= 0 ? 0 : ((venta - compra) / venta) * 100;
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

  formularioValido = computed(() => {
    const f = this.formulario();
    return (
      f.codigo.trim() !== '' &&
      f.nombre.trim() !== '' &&
      f.categoria.trim() !== '' &&
      f.precioCompra >= 0 &&
      f.precioVenta > 0 &&
      f.stockMinimo >= 0 &&
      f.stockActual >= 0
    );
  });

  actualizarTexto(campo: 'codigo' | 'nombre' | 'categoria' | 'observacion', valor: string) {
    this.formulario.update(actual => ({ ...actual, [campo]: valor }));
  }

  actualizarNumero(campo: 'precioCompra' | 'precioVenta' | 'stockActual' | 'stockMinimo', valor: string) {
    const numero = Number(valor);
    this.formulario.update(actual => ({
      ...actual,
      [campo]: Number.isNaN(numero) ? 0 : numero
    }));
  }

  actualizarBooleano(valor: boolean) {
    this.formulario.update(actual => ({ ...actual, activo: valor }));
  }

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  actualizarCategoriaFiltro(valor: string) {
    this.categoriaFiltro.set(valor);
  }

  actualizarSoloActivos(valor: boolean) {
    this.soloActivos.set(valor);
  }

  actualizarSoloCriticos(valor: boolean) {
    this.soloCriticos.set(valor);
  }

  guardar(event?: Event) {
    event?.preventDefault();
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Revisa los campos obligatorios y los valores numéricos del producto.');
      return;
    }

    const f = this.formulario();
    const codigoNormalizado = f.codigo.trim().toLowerCase();
    const duplicado = this.productos().find(item =>
      item.codigo.trim().toLowerCase() === codigoNormalizado && item.id !== (f.id ?? -1)
    );

    if (duplicado) {
      this.mensaje.set('Ya existe un producto con ese código.');
      return;
    }

    const payload: Producto = {
      id: f.id ?? this.productosService.obtenerSiguienteId(),
      codigo: f.codigo.trim(),
      nombre: f.nombre.trim(),
      categoria: f.categoria.trim(),
      precioCompra: f.precioCompra,
      precioVenta: f.precioVenta,
      stockActual: f.stockActual,
      stockMinimo: f.stockMinimo,
      activo: f.activo,
      observacion: f.observacion.trim()
    };

    if (f.id === null) {
      this.productosService.agregarProducto(payload);
      this.mensaje.set('Producto creado correctamente.');
    } else {
      this.productosService.actualizarProducto(payload);
      this.mensaje.set('Producto actualizado correctamente.');
    }

    this.formulario.set(this.obtenerFormularioBase());
    this.modoEdicion.set(false);
    this.enviado.set(false);
  }

  editar(producto: Producto) {
    this.formulario.set({
      id: producto.id,
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
    this.modoEdicion.set(true);
    this.enviado.set(false);
    this.mensaje.set(`Editando producto ${producto.nombre}.`);
  }

  eliminar(id: number) {
    if (typeof window !== 'undefined' && !window.confirm('Se eliminará el producto seleccionado. ¿Deseas continuar?')) {
      return;
    }

    this.productosService.eliminarProducto(id);
    this.mensaje.set('Producto eliminado correctamente.');
    if (this.formulario().id === id) {
      this.formulario.set(this.obtenerFormularioBase());
      this.modoEdicion.set(false);
    }
  }

  alternarEstado(id: number) {
    this.productosService.alternarEstado(id);
    this.mensaje.set('Estado del producto actualizado.');
  }

  cancelarEdicion() {
    this.formulario.set(this.obtenerFormularioBase());
    this.modoEdicion.set(false);
    this.enviado.set(false);
    this.mensaje.set('Edición cancelada.');
  }

  restablecerBase() {
    if (typeof window !== 'undefined' && !window.confirm('Se restablecerá el catálogo base de productos. ¿Deseas continuar?')) {
      return;
    }

    this.productosService.restablecerBase();
    this.formulario.set(this.obtenerFormularioBase());
    this.modoEdicion.set(false);
    this.mensaje.set('Catálogo base restablecido correctamente.');
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.categoriaFiltro.set('TODOS');
    this.soloActivos.set(true);
    this.soloCriticos.set(false);
  }

  private obtenerFormularioBase(): ProductoForm {
    return {
      id: null,
      codigo: '',
      nombre: '',
      categoria: '',
      precioCompra: 0,
      precioVenta: 0,
      stockActual: 0,
      stockMinimo: 0,
      activo: true,
      observacion: ''
    };
  }
}
