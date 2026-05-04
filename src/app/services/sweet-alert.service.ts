import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SweetAlertService {

  success(titulo: string, texto: string = 'Operacion realizada correctamente'): void {
    Swal.fire({
      title: titulo,
      text: texto,
      icon: 'success',
      theme: 'bootstrap-5',
      confirmButtonText: 'Aceptar'
    });
  }

  error(titulo: string, texto: string = 'Ocurrio un error inesperado'): void {
    Swal.fire({
      title: titulo,
      text: texto,
      icon: 'error',
      theme: 'bootstrap-5',
      confirmButtonText: 'Aceptar'
    });
  }

  info(titulo: string, texto: string): void {
    Swal.fire({
      title: titulo,
      text: texto,
      icon: 'info',
      theme: 'bootstrap-5',
      confirmButtonText: 'Entendido'
    });
  }

  warning(titulo: string, texto: string): void {
    Swal.fire({
      title: titulo,
      text: texto,
      icon: 'warning',
      theme: 'bootstrap-5',
      confirmButtonText: 'Aceptar'
    });
  }

  toast(titulo: string, icono: SweetAlertIcon = 'success'): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: icono,
      title: titulo,
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true,
      theme: 'bootstrap-5'
    });
  }

  async confirmarEliminacion(nombre: string = 'este registro'): Promise<boolean> {
    const resultado = await Swal.fire({
      title: '¿Estas seguro?',
      text: `Se eliminara ${nombre}. Esta accion no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      theme: 'bootstrap-5'
    });

    return resultado.isConfirmed;
  }
}
