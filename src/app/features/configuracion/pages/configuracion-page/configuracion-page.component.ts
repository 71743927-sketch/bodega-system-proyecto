import { Component, computed, inject, signal } from '@angular/core';
import { ConfiguracionGeneral, MonedaSistema } from '../../models/configuracion-general';
import { ConfiguracionService } from '../../services/configuracion.service';

type ConfigForm = ConfiguracionGeneral;

@Component({
  selector: 'app-configuracion-page',
  standalone: true,
  imports: [],
  templateUrl: './configuracion-page.component.html',
  styleUrl: './configuracion-page.component.css'
})
export class ConfiguracionPageComponent {

  private configuracionService = inject(ConfiguracionService);

  configuracion = this.configuracionService.configuracionLectura;
  monedas: MonedaSistema[] = ['PEN', 'USD'];

  enviado = signal(false);
  mensaje = signal('');

  formulario = signal<ConfigForm>({
    ...this.configuracion()
  });

  resumenMoneda = computed(() => `${this.formulario().simboloMoneda} · ${this.formulario().moneda}`);
  resumenNegocio = computed(() => `${this.formulario().nombreNegocio} · ${this.formulario().telefono}`);

  formularioValido = computed(() => {
    const f = this.formulario();

    return (
      f.nombreNegocio.trim().length > 0 &&
      f.telefono.trim().length > 0 &&
      f.direccion.trim().length > 0 &&
      f.simboloMoneda.trim().length > 0 &&
      f.zonaHoraria.trim().length > 0 &&
      f.igvPorcentaje >= 0 &&
      f.igvPorcentaje <= 100 &&
      f.diasAlertaCompra >= 0 &&
      f.sesionMinutos >= 5
    );
  });

  actualizarTexto(
    campo:
      | 'nombreNegocio'
      | 'ruc'
      | 'telefono'
      | 'direccion'
      | 'simboloMoneda'
      | 'mensajeTicket'
      | 'pieTicket'
      | 'zonaHoraria',
    valor: string
  ) {
    this.formulario.update(actual => ({
      ...actual,
      [campo]: valor
    }));
  }

  actualizarNumero(campo: 'igvPorcentaje' | 'diasAlertaCompra' | 'sesionMinutos', valor: string) {
    const numero = Number(valor);
    this.formulario.update(actual => ({
      ...actual,
      [campo]: Number.isNaN(numero) ? 0 : numero
    }));
  }

  actualizarMoneda(valor: MonedaSistema) {
    this.formulario.update(actual => ({
      ...actual,
      moneda: valor,
      simboloMoneda: valor === 'USD' ? '$' : 'S/'
    }));
  }

  actualizarBooleano(
    campo: 'permitirStockNegativo' | 'mostrarAlertasDashboard' | 'mostrarModuloAuditoria',
    valor: boolean
  ) {
    this.formulario.update(actual => ({
      ...actual,
      [campo]: valor
    }));
  }

  guardar(event?: Event) {
    event?.preventDefault();
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Revisa los campos obligatorios y los valores numéricos.');
      return;
    }

    this.configuracionService.actualizarConfiguracion(this.formulario());
    this.mensaje.set('Configuración guardada correctamente.');
    this.enviado.set(false);
  }

  restablecer() {
    const defaults = this.configuracionService.obtenerConfiguracionPorDefecto();
    this.formulario.set(defaults);
    this.mensaje.set('Se cargaron los valores por defecto. Guarda para aplicarlos.');
    this.enviado.set(false);
  }

  recargarDesdePersistencia() {
    this.formulario.set({ ...this.configuracion() });
    this.mensaje.set('Se recargó la configuración actualmente aplicada.');
    this.enviado.set(false);
  }

  aplicarRestablecerDirecto() {
    this.configuracionService.restablecerConfiguracion();
    this.formulario.set({ ...this.configuracionService.configuracionLectura() });
    this.mensaje.set('La configuración fue restablecida y aplicada.');
    this.enviado.set(false);
  }
}
