import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required } from '@angular/forms/signals';

interface ProveedorFormModel {
  ruc: string;
  razonSocial: string;
  telefono: string;
  categoria: string;
  activo: boolean;
}

interface ProveedorItem extends ProveedorFormModel {
  id: number;
}

@Component({
  selector: 'app-proveedores-page',
  imports: [FormField],
  templateUrl: './proveedores-page.component.html',
  styleUrl: './proveedores-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProveedoresPageComponent {
  protected readonly proveedorModel = signal<ProveedorFormModel>({
    ruc: '',
    razonSocial: '',
    telefono: '',
    categoria: 'Abarrotes',
    activo: true
  });

  protected readonly proveedorForm = form(this.proveedorModel, (path) => {
    required(path.ruc, { message: 'El RUC es obligatorio.' });
    minLength(path.ruc, 8, { message: 'El RUC debe tener mínimo 8 caracteres.' });
    maxLength(path.ruc, 11, { message: 'El RUC debe tener máximo 11 caracteres.' });

    required(path.razonSocial, { message: 'La razón social es obligatoria.' });
    minLength(path.razonSocial, 3, { message: 'La razón social debe tener mínimo 3 caracteres.' });

    required(path.categoria, { message: 'La categoría es obligatoria.' });
  });

  protected readonly proveedores = signal<ProveedorItem[]>([
    { id: 1, ruc: '20123456789', razonSocial: 'Distribuidora Central', telefono: '999888777', categoria: 'Abarrotes', activo: true },
    { id: 2, ruc: '20456789123', razonSocial: 'Bebidas del Valle', telefono: '988777666', categoria: 'Bebidas', activo: true }
  ]);

  protected readonly totalProveedores = computed(() => this.proveedores().length);
  protected readonly proveedoresActivos = computed(() => this.proveedores().filter((proveedor) => proveedor.activo).length);
  protected readonly puedeGuardar = computed(() => {
    const proveedor = this.proveedorModel();

    return (
      proveedor.ruc.trim().length >= 8 &&
      proveedor.razonSocial.trim().length >= 3 &&
      proveedor.categoria.trim().length > 0
    );
  });

  protected guardar(): void {
    if (!this.puedeGuardar()) {
      return;
    }

    const proveedor = this.proveedorModel();

    this.proveedores.update((proveedores) => [
      {
        id: Date.now(),
        ruc: proveedor.ruc.trim(),
        razonSocial: proveedor.razonSocial.trim(),
        telefono: proveedor.telefono.trim(),
        categoria: proveedor.categoria,
        activo: proveedor.activo
      },
      ...proveedores
    ]);

    this.limpiar();
  }

  protected limpiar(): void {
    this.proveedorModel.set({
      ruc: '',
      razonSocial: '',
      telefono: '',
      categoria: 'Abarrotes',
      activo: true
    });
  }

  protected alternarEstado(proveedorId: number): void {
    this.proveedores.update((proveedores) =>
      proveedores.map((proveedor) =>
        proveedor.id === proveedorId ? { ...proveedor, activo: !proveedor.activo } : proveedor
      )
    );
  }
}