import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form, maxLength, min, minLength, required } from '@angular/forms/signals';

interface VentaFormModel {
  producto: string;
  cliente: string;
  cantidad: number;
  precioUnitario: number;
  metodoPago: string;
  observacion: string;
}

interface VentaItem extends VentaFormModel {
  id: number;
  total: number;
  fecha: string;
}

@Component({
  selector: 'app-ventas-page',
  imports: [FormField],
  templateUrl: './ventas-page.component.html',
  styleUrl: './ventas-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VentasPageComponent {
  protected readonly ventaModel = signal<VentaFormModel>({
    producto: '',
    cliente: '',
    cantidad: 1,
    precioUnitario: 0,
    metodoPago: 'Efectivo',
    observacion: ''
  });

  protected readonly ventaForm = form(this.ventaModel, (path) => {
    required(path.producto, { message: 'El producto es obligatorio.' });
    minLength(path.producto, 3, { message: 'El producto debe tener mínimo 3 caracteres.' });

    required(path.cliente, { message: 'El cliente es obligatorio.' });
    minLength(path.cliente, 3, { message: 'El cliente debe tener mínimo 3 caracteres.' });

    min(path.cantidad, 1, { message: 'La cantidad debe ser mayor o igual a 1.' });
    min(path.precioUnitario, 0.1, { message: 'El precio debe ser mayor a 0.' });

    required(path.metodoPago, { message: 'El método de pago es obligatorio.' });
    maxLength(path.observacion, 160, { message: 'La observación debe tener máximo 160 caracteres.' });
  });

  protected readonly ventas = signal<VentaItem[]>([
    { id: 1, producto: 'Arroz Costeño 5kg', cliente: 'Cliente general', cantidad: 1, precioUnitario: 28.5, metodoPago: 'Efectivo', observacion: '', total: 28.5, fecha: this.obtenerFechaLocal() }
  ]);

  protected readonly totalVentaActual = computed(() => {
    const venta = this.ventaModel();
    return Number((venta.cantidad * venta.precioUnitario).toFixed(2));
  });

  protected readonly totalVentas = computed(() => {
    return Number(this.ventas().reduce((total, venta) => total + venta.total, 0).toFixed(2));
  });

  protected readonly puedeGuardar = computed(() => {
    const venta = this.ventaModel();

    return (
      venta.producto.trim().length >= 3 &&
      venta.cliente.trim().length >= 3 &&
      venta.cantidad >= 1 &&
      venta.precioUnitario > 0 &&
      venta.metodoPago.trim().length > 0
    );
  });

  protected guardar(): void {
    if (!this.puedeGuardar()) {
      return;
    }

    const venta = this.ventaModel();

    this.ventas.update((ventas) => [
      {
        id: Date.now(),
        producto: venta.producto.trim(),
        cliente: venta.cliente.trim(),
        cantidad: venta.cantidad,
        precioUnitario: venta.precioUnitario,
        metodoPago: venta.metodoPago,
        observacion: venta.observacion.trim(),
        total: this.totalVentaActual(),
        fecha: this.obtenerFechaLocal()
      },
      ...ventas
    ]);

    this.limpiar();
  }

  protected limpiar(): void {
    this.ventaModel.set({
      producto: '',
      cliente: '',
      cantidad: 1,
      precioUnitario: 0,
      metodoPago: 'Efectivo',
      observacion: ''
    });
  }

  protected obtenerFechaLocal(): string {
    return new Date().toLocaleDateString('es-PE');
  }

  protected normalizarFecha(fecha: string): string {
    return fecha;
  }
}