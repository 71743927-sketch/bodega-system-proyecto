import { Injectable, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { ConfiguracionGeneral } from '../models/configuracion-general';

const STORAGE_KEY = 'bodega-config-general';

const DEFAULT_CONFIG: ConfiguracionGeneral = {
  nombreNegocio: 'BodegaSys Demo',
  ruc: '00000000000',
  telefono: '999999999',
  direccion: 'Huancayo - Perú',
  moneda: 'PEN',
  simboloMoneda: 'S/',
  igvPorcentaje: 18,
  diasAlertaCompra: 15,
  permitirStockNegativo: false,
  mostrarAlertasDashboard: true,
  mostrarModuloAuditoria: true,
  mensajeTicket: 'Gracias por su compra. Vuelva pronto.',
  pieTicket: 'Documento interno generado por el sistema.',
  sesionMinutos: 120,
  zonaHoraria: 'America/Lima'
};

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {

  private readonly auditoriaService = inject(AuditoriaService);
  private readonly _configuracion = signal<ConfiguracionGeneral>(this.cargarDesdeStorage());

  configuracionLectura = this._configuracion.asReadonly();

  obtenerConfiguracionPorDefecto(): ConfiguracionGeneral {
    return { ...DEFAULT_CONFIG };
  }

  actualizarConfiguracion(configuracion: ConfiguracionGeneral) {
    const saneada: ConfiguracionGeneral = {
      ...configuracion,
      nombreNegocio: configuracion.nombreNegocio.trim(),
      ruc: configuracion.ruc.trim(),
      telefono: configuracion.telefono.trim(),
      direccion: configuracion.direccion.trim(),
      simboloMoneda: configuracion.simboloMoneda.trim(),
      mensajeTicket: configuracion.mensajeTicket.trim(),
      pieTicket: configuracion.pieTicket.trim(),
      zonaHoraria: configuracion.zonaHoraria.trim()
    };

    this._configuracion.set(saneada);
    this.guardarEnStorage(saneada);

    this.auditoriaService.registrar(
      'SISTEMA',
      'CONFIGURACION_ACTUALIZAR',
      `Configuración actualizada para ${saneada.nombreNegocio}`,
      'SUCCESS',
      `Moneda: ${saneada.moneda} · IGV: ${saneada.igvPorcentaje}%`
    );
  }

  restablecerConfiguracion() {
    const defaults = { ...DEFAULT_CONFIG };
    this._configuracion.set(defaults);
    this.guardarEnStorage(defaults);

    this.auditoriaService.registrar(
      'SISTEMA',
      'CONFIGURACION_RESTABLECER',
      'La configuración general fue restablecida a valores por defecto.',
      'WARNING'
    );
  }

  private cargarDesdeStorage(): ConfiguracionGeneral {
    try {
      if (typeof localStorage === 'undefined') {
        return { ...DEFAULT_CONFIG };
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_CONFIG };
      }

      const parsed = JSON.parse(raw) as Partial<ConfiguracionGeneral>;

      return {
        ...DEFAULT_CONFIG,
        ...parsed
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  private guardarEnStorage(configuracion: ConfiguracionGeneral) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(configuracion));
    } catch {
      // Ignorar errores de persistencia local
    }
  }
}
