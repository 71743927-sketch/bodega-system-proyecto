import { ChangeDetectionStrategy, Component, EventEmitter, Output, computed, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, minLength, required } from '@angular/forms/signals';

interface ProductoFormularioModel {
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

@Component({
  selector: 'app-producto-formulario',
  imports: [FormField],
  templateUrl: './producto-formulario.component.html',
  styleUrl: './producto-formulario.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductoFormularioComponent {
  @Output() guardarProducto = new EventEmitter<ProductoFormularioModel>();
  @Output() cancelarFormulario = new EventEmitter<void>();

  protected readonly productoModel = signal<ProductoFormularioModel>({
    codigo: '',
    nombre: '',
    categoria: '',
    precioCompra: 0,
    precioVenta: 0,
    stockActual: 0,
    stockMinimo: 1,
    activo: true,
    observacion: ''
  });

  protected readonly productoForm = form(this.productoModel, (path) => {
    required(path.codigo, { message: 'El código es obligatorio.' });
    minLength(path.codigo, 3, { message: 'El código debe tener mínimo 3 caracteres.' });
    maxLength(path.codigo, 20, { message: 'El código debe tener máximo 20 caracteres.' });

    required(path.nombre, { message: 'El nombre es obligatorio.' });
    minLength(path.nombre, 3, { message: 'El nombre debe tener mínimo 3 caracteres.' });
    maxLength(path.nombre, 100, { message: 'El nombre debe tener máximo 100 caracteres.' });

    required(path.categoria, { message: 'La categoría es obligatoria.' });

    min(path.precioCompra, 0, { message: 'El precio de compra no puede ser negativo.' });
    max(path.precioCompra, 99999, { message: 'El precio de compra es demasiado alto.' });

    min(path.precioVenta, 0, { message: 'El precio de venta no puede ser negativo.' });
    max(path.precioVenta, 99999, { message: 'El precio de venta es demasiado alto.' });

    min(path.stockActual, 0, { message: 'El stock actual no puede ser negativo.' });
    min(path.stockMinimo, 0, { message: 'El stock mínimo no puede ser negativo.' });

    maxLength(path.observacion, 160, { message: 'La observación debe tener máximo 160 caracteres.' });
  });

  protected readonly margenGanancia = computed(() => {
    const producto = this.productoModel();
    return Number((producto.precioVenta - producto.precioCompra).toFixed(2));
  });

  protected readonly estadoStock = computed(() => {
    const producto = this.productoModel();

    if (producto.stockActual <= 0) {
      return 'Sin stock';
    }

    if (producto.stockActual <= producto.stockMinimo) {
      return 'Stock bajo';
    }

    return 'Stock normal';
  });

  protected readonly formularioValido = computed(() => {
    const producto = this.productoModel();

    return (
      producto.codigo.trim().length >= 3 &&
      producto.nombre.trim().length >= 3 &&
      producto.categoria.trim().length > 0 &&
      producto.precioCompra >= 0 &&
      producto.precioVenta >= 0 &&
      producto.stockActual >= 0 &&
      producto.stockMinimo >= 0
    );
  });

  protected readonly formularioInvalido = computed(() => !this.formularioValido());

  protected readonly enviado = signal(false);
  protected readonly mensaje = signal('');

  protected guardar(): void {
    this.enviado.set(true);

    if (this.formularioInvalido()) {
      this.mensaje.set('Complete correctamente los campos obligatorios.');
      return;
    }

    const producto = this.productoModel();

    this.guardarProducto.emit({
      codigo: producto.codigo.trim(),
      nombre: producto.nombre.trim(),
      categoria: producto.categoria.trim(),
      precioCompra: producto.precioCompra,
      precioVenta: producto.precioVenta,
      stockActual: producto.stockActual,
      stockMinimo: producto.stockMinimo,
      activo: producto.activo,
      observacion: producto.observacion.trim()
    });

    this.mensaje.set('Producto validado correctamente con Signal Forms.');
  }

  protected limpiar(): void {
    this.productoModel.set({
      codigo: '',
      nombre: '',
      categoria: '',
      precioCompra: 0,
      precioVenta: 0,
      stockActual: 0,
      stockMinimo: 1,
      activo: true,
      observacion: ''
    });

    this.enviado.set(false);
    this.mensaje.set('');
  }

  protected cancelar(): void {
    this.cancelarFormulario.emit();
    this.limpiar();
  }
}