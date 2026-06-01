import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SweetAlertService } from '../../services/sweet-alert.service';

@Component({
  selector: 'app-producto-formulario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './producto-formulario.component.html',
  styleUrl: './producto-formulario.component.css'
})
export class ProductoFormularioComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sweetAlert = inject(SweetAlertService);

  enviado = signal(false);
  mensaje = signal('');

  productoForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    categoria: ['', [Validators.required]],
    marca: ['', [Validators.required, Validators.minLength(2)]],
    precioVenta: [0, [Validators.required, Validators.min(0.1)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    descripcion: ['', [Validators.required, Validators.minLength(5)]]
  });

  formularioValido = computed(() => this.productoForm.valid);
  formularioInvalido = computed(() => this.productoForm.invalid);

  guardarProducto(): void {
    this.enviado.set(true);

    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      this.mensaje.set('Complete correctamente todos los campos del producto.');
      this.sweetAlert.warning('Formulario incompleto', 'Complete correctamente todos los campos del producto.');
      return;
    }

    this.mensaje.set('Producto validado correctamente con formulario reactivo.');
    this.sweetAlert.success('Producto validado', 'El producto cumple con las validaciones del formulario.');
  }

  limpiarFormulario(): void {
    this.enviado.set(false);
    this.mensaje.set('');

    this.productoForm.reset({
      nombre: '',
      categoria: '',
      marca: '',
      precioVenta: 0,
      stock: 0,
      descripcion: ''
    });
  }

  campoInvalido(campo: string): boolean {
    const control = this.productoForm.get(campo);
    return !!(control && control.invalid && (control.touched || this.enviado()));
  }
}

