import { Injectable, NgZone } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

type EstadoBoton = {
  icono: SweetAlertIcon;
  titulo: string;
  texto: string;
};

@Injectable({
  providedIn: 'root'
})
export class SweetAlertGlobalButtonService {
  private iniciado = false;
  private ultimoClick = 0;

  constructor(private readonly ngZone: NgZone) {}

  iniciar(): void {
    if (this.iniciado) {
      return;
    }

    this.iniciado = true;

    if (typeof document === 'undefined') {
      return;
    }

    console.log('[SweetAlert2 Global] Listener con validaciones reales iniciado correctamente');

    this.ngZone.runOutsideAngular(() => {
      document.addEventListener(
        'click',
        (event: MouseEvent) => {
          this.manejarClick(event);
        },
        true
      );
    });
  }

  private manejarClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (!target) {
      return;
    }

    const boton = target.closest('button, a.btn, .btn, [role="button"]') as HTMLElement | null;

    if (!boton) {
      return;
    }

    if (this.debeIgnorar(boton)) {
      return;
    }

    const ahora = Date.now();

    if (ahora - this.ultimoClick < 500) {
      return;
    }

    this.ultimoClick = ahora;

    /*
      Esperamos un instante para que Angular actualice errores visuales,
      clases ng-invalid, mensajes de validacion, etc.
    */
    setTimeout(() => {
      const estado = this.determinarEstado(boton);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: estado.icono,
        title: estado.titulo,
        text: estado.texto,
        showConfirmButton: false,
        timer: estado.icono === 'error' ? 2700 : 1900,
        timerProgressBar: true,
        background: '#ffffff',
        color: '#1f2937',
        customClass: {
          popup: `swal-toast-premium swal-toast-${estado.icono}`
        }
      });
    }, 180);
  }

  private determinarEstado(boton: HTMLElement): EstadoBoton {
    const textoBoton = this.obtenerTextoBoton(boton);
    const textoNormalizado = textoBoton.toLowerCase();

    /*
      PRIORIDAD 1:
      Cancelar, limpiar, cerrar, volver NO son success.
    */
    if (
      textoNormalizado.includes('cancelar') ||
      textoNormalizado.includes('limpiar') ||
      textoNormalizado.includes('cerrar') ||
      textoNormalizado.includes('volver') ||
      textoNormalizado.includes('regresar')
    ) {
      return {
        icono: 'info',
        titulo: this.limpiarTexto(textoBoton),
        texto: 'Accion cancelada o formulario restablecido.'
      };
    }

    /*
      PRIORIDAD 2:
      Si el boton esta relacionado a guardar/registrar/actualizar/confirmar,
      primero validar formulario o contenedor cercano.
    */
    const requiereValidacion =
      textoNormalizado.includes('guardar') ||
      textoNormalizado.includes('registrar') ||
      textoNormalizado.includes('agregar') ||
      textoNormalizado.includes('actualizar') ||
      textoNormalizado.includes('confirmar') ||
      textoNormalizado.includes('crear');

    if (requiereValidacion) {
      const tieneErrores = this.hayErroresCercaDelBoton(boton, textoNormalizado);

      if (tieneErrores) {
        return {
          icono: 'error',
          titulo: 'Formulario incompleto',
          texto: 'Revise los campos obligatorios antes de guardar.'
        };
      }
    }

    /*
      PRIORIDAD 3:
      Botones peligrosos.
    */
    if (
      boton.classList.contains('btn-danger') ||
      textoNormalizado.includes('eliminar') ||
      textoNormalizado.includes('borrar') ||
      textoNormalizado.includes('anular') ||
      textoNormalizado.includes('quitar')
    ) {
      return {
        icono: 'warning',
        titulo: this.limpiarTexto(textoBoton),
        texto: 'Revise esta accion antes de continuar.'
      };
    }

    /*
      PRIORIDAD 4:
      Acciones positivas.
    */
    if (
      boton.classList.contains('btn-success') ||
      textoNormalizado.includes('guardar') ||
      textoNormalizado.includes('registrar') ||
      textoNormalizado.includes('agregar') ||
      textoNormalizado.includes('actualizar') ||
      textoNormalizado.includes('confirmar') ||
      textoNormalizado.includes('crear')
    ) {
      return {
        icono: 'success',
        titulo: this.limpiarTexto(textoBoton),
        texto: 'Operacion procesada correctamente.'
      };
    }

    /*
      PRIORIDAD 5:
      Edicion.
    */
    if (
      boton.classList.contains('btn-warning') ||
      textoNormalizado.includes('editar') ||
      textoNormalizado.includes('modificar')
    ) {
      return {
        icono: 'question',
        titulo: this.limpiarTexto(textoBoton),
        texto: 'Accion de edicion seleccionada.'
      };
    }

    /*
      PRIORIDAD 6:
      Consulta.
    */
    if (
      boton.classList.contains('btn-info') ||
      textoNormalizado.includes('ver') ||
      textoNormalizado.includes('detalle') ||
      textoNormalizado.includes('buscar') ||
      textoNormalizado.includes('consultar') ||
      textoNormalizado.includes('filtrar')
    ) {
      return {
        icono: 'info',
        titulo: this.limpiarTexto(textoBoton),
        texto: 'Consulta ejecutada en el sistema.'
      };
    }

    return {
      icono: 'info',
      titulo: this.limpiarTexto(textoBoton),
      texto: 'Accion ejecutada en el sistema.'
    };
  }

  private hayErroresCercaDelBoton(boton: HTMLElement, textoBoton: string): boolean {
    /*
      Buscar primero el formulario real.
    */
    const formulario = boton.closest('form') as HTMLFormElement | null;

    if (formulario && this.contenedorTieneErrores(formulario, textoBoton)) {
      return true;
    }

    /*
      Si no hay <form>, buscar un contenedor cercano:
      card, panel, section, div padre, etc.
      Esto sirve para formularios hechos con signals y ngModel sin etiqueta form.
    */
    const contenedor =
      boton.closest('.card') ||
      boton.closest('.modal') ||
      boton.closest('section') ||
      boton.closest('.col-12') ||
      boton.closest('.col-md-4') ||
      boton.closest('.col-lg-4') ||
      boton.closest('.col') ||
      boton.parentElement?.parentElement ||
      boton.parentElement;

    if (contenedor instanceof HTMLElement && this.contenedorTieneErrores(contenedor, textoBoton)) {
      return true;
    }

    return false;
  }

  private contenedorTieneErrores(contenedor: HTMLElement, textoBoton: string): boolean {
    /*
      1. Angular / Bootstrap invalid classes.
    */
    if (
      contenedor.classList.contains('ng-invalid') ||
      contenedor.querySelector('.ng-invalid') ||
      contenedor.querySelector('.is-invalid') ||
      contenedor.querySelector('[aria-invalid="true"]')
    ) {
      return true;
    }

    /*
      2. Mensajes de error visibles.
      En tu captura aparece: "Debes seleccionar un producto."
    */
    const textoContenedor = (contenedor.textContent || '').toLowerCase();

    const patronesError = [
      'debes seleccionar',
      'debe seleccionar',
      'seleccione un producto',
      'campo obligatorio',
      'obligatorio',
      'requerido',
      'complete correctamente',
      'debe ingresar',
      'ingrese',
      'inválido',
      'invalido',
      'error',
      'no válido',
      'no valido'
    ];

    const tieneTextoError = patronesError.some((patron) => textoContenedor.includes(patron));

    if (tieneTextoError) {
      return true;
    }

    /*
      3. HTML validation: required, min, max, pattern.
    */
    const controles = Array.from(
      contenedor.querySelectorAll('input, select, textarea')
    ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

    for (const control of controles) {
      if (control.disabled) {
        continue;
      }

      if (!control.checkValidity()) {
        return true;
      }

      if (control.hasAttribute('required') && (control.value || '').trim().length === 0) {
        return true;
      }
    }

    /*
      4. Caso especifico de movimientos de inventario:
      - Si el boton dice Guardar movimiento
      - Debe haber producto seleccionado
      - Cantidad debe ser mayor a 0
    */
    if (textoBoton.includes('guardar movimiento')) {
      const selects = Array.from(contenedor.querySelectorAll('select')) as HTMLSelectElement[];
      const inputsNumero = Array.from(contenedor.querySelectorAll('input[type="number"]')) as HTMLInputElement[];

      const productoNoSeleccionado = selects.some((select) => {
        const valor = (select.value || '').trim();
        const textoSeleccionado = select.options[select.selectedIndex]?.textContent?.toLowerCase() || '';

        return (
          valor.length === 0 ||
          textoSeleccionado.includes('seleccione') ||
          textoSeleccionado.includes('seleccionar')
        );
      });

      if (productoNoSeleccionado) {
        return true;
      }

      const cantidadInvalida = inputsNumero.some((input) => {
        const valor = Number(input.value);
        return Number.isNaN(valor) || valor <= 0;
      });

      if (cantidadInvalida) {
        return true;
      }
    }

    return false;
  }

  private debeIgnorar(elemento: HTMLElement): boolean {
    if (elemento.closest('.swal2-container')) {
      return true;
    }

    if (elemento.hasAttribute('disabled')) {
      return true;
    }

    if (elemento.hasAttribute('data-swal-ignore')) {
      return true;
    }

    if (elemento.classList.contains('swal2-confirm')) {
      return true;
    }

    if (elemento.classList.contains('swal2-cancel')) {
      return true;
    }

    if (elemento.classList.contains('swal2-close')) {
      return true;
    }

    return false;
  }

  private obtenerTextoBoton(elemento: HTMLElement): string {
    const texto = (elemento.textContent || '').replace(/\s+/g, ' ').trim();

    if (texto.length > 0) {
      return texto;
    }

    const aria = elemento.getAttribute('aria-label');

    if (aria) {
      return aria;
    }

    const title = elemento.getAttribute('title');

    if (title) {
      return title;
    }

    return 'Accion';
  }

  private limpiarTexto(texto: string): string {
    const limpio = texto.replace(/\s+/g, ' ').trim();

    if (limpio.length === 0) {
      return 'Accion seleccionada';
    }

    if (limpio.length > 34) {
      return `${limpio.substring(0, 34)}...`;
    }

    return limpio;
  }
}
