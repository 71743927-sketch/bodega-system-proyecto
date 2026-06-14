import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, minLength, required } from '@angular/forms/signals';

interface ProductoSignalForm {
  codigo: string;
  nombre: string;
  categoria: string;
  stock: number;
  stockMinimo: number;
  precioVenta: number;
}

@Component({
  selector: 'app-signal-forms-evidencia-page',
  imports: [FormField],
  templateUrl: './signal-forms-evidencia-page.component.html',
  styleUrl: './signal-forms-evidencia-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalFormsEvidenciaPageComponent {
  protected readonly productoModel = signal<ProductoSignalForm>({
    codigo: '',
    nombre: '',
    categoria: '',
    stock: 0,
    stockMinimo: 1,
    precioVenta: 0
  });

  protected readonly productoForm = form(this.productoModel, (path) => {
    required(path.codigo, { message: 'El cÃ³digo es obligatorio.' });
    minLength(path.codigo, 3, { message: 'El cÃ³digo debe tener mÃ­nimo 3 caracteres.' });
    maxLength(path.codigo, 20, { message: 'El cÃ³digo debe tener mÃ¡ximo 20 caracteres.' });

    required(path.nombre, { message: 'El nombre es obligatorio.' });
    minLength(path.nombre, 3, { message: 'El nombre debe tener mÃ­nimo 3 caracteres.' });

    required(path.categoria, { message: 'La categorÃ­a es obligatoria.' });

    min(path.stock, 0, { message: 'El stock no puede ser negativo.' });
    min(path.stockMinimo, 0, { message: 'El stock mÃ­nimo no puede ser negativo.' });
    min(path.precioVenta, 0, { message: 'El precio de venta no puede ser negativo.' });
    max(path.precioVenta, 99999, { message: 'El precio de venta es demasiado alto.' });
  });

  protected readonly stockEstado = computed(() => {
    const producto = this.productoModel();

    if (producto.stock <= 0) {
      return 'Sin stock';
    }

    if (producto.stock <= producto.stockMinimo) {
      return 'Stock bajo';
    }

    return 'Stock normal';
  });

  protected readonly puedeGuardar = computed(() => {
    const producto = this.productoModel();

    return (
      producto.codigo.trim().length >= 3 &&
      producto.nombre.trim().length >= 3 &&
      producto.categoria.trim().length >= 2 &&
      producto.stock >= 0 &&
      producto.stockMinimo >= 0 &&
      producto.precioVenta >= 0
    );
  });

  protected readonly resumenTexto = computed(() => {
    const producto = this.productoModel();

    return JSON.stringify(
      {
        ...producto,
        estado: this.stockEstado()
      },
      null,
      2
    );
  });

  protected readonly guardado = signal(false);

  protected registrarEvidencia(event: Event): void {
    event.preventDefault();
    this.guardado.set(true);
  }

  protected limpiar(): void {
    this.productoModel.set({
      codigo: '',
      nombre: '',
      categoria: '',
      stock: 0,
      stockMinimo: 1,
      precioVenta: 0
    });

    this.guardado.set(false);
  }
}