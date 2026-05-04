import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { SweetAlertService } from '../../services/sweet-alert.service';

@Component({
  selector: 'app-sweetalert-demo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sweetalert-demo.component.html',
  styleUrl: './sweetalert-demo.component.css'
})
export class SweetalertDemoComponent {
  private readonly sweetAlert = inject(SweetAlertService);

  mostrarExito(): void {
    this.sweetAlert.success('Operacion exitosa', 'SweetAlert2 funciona correctamente en el sistema.');
  }

  mostrarError(): void {
    this.sweetAlert.error('Error de validacion', 'Revise los datos ingresados.');
  }

  mostrarToast(): void {
    this.sweetAlert.toast('Producto registrado correctamente', 'success');
  }

  async confirmarEliminacion(): Promise<void> {
    const confirmado = await this.sweetAlert.confirmarEliminacion('el producto seleccionado');

    if (confirmado) {
      this.sweetAlert.success('Eliminado', 'El producto fue eliminado correctamente.');
    } else {
      this.sweetAlert.info('Cancelado', 'La eliminacion fue cancelada.');
    }
  }
}
