import { CurrencyPipe, DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { CierreDiarioReporte } from '../../models/cierre-diario-report';
import { CierreDiarioService } from '../../services/cierre-diario.service';

@Component({
  selector: 'app-cierre-diario-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, JsonPipe],
  templateUrl: './cierre-diario-page.component.html',
  styleUrl: './cierre-diario-page.component.css'
})
export class CierreDiarioPageComponent {

  private readonly cierreDiarioService = inject(CierreDiarioService);
  private readonly authService = inject(AuthService);

  mensaje = signal('');
  reporte = signal<CierreDiarioReporte>(
    this.cierreDiarioService.generarReporte(this.authService.usernameActual() || 'Sistema')
  );
  historial = signal<CierreDiarioReporte[]>(this.cierreDiarioService.obtenerHistorial());

  resumen = computed(() => ({
    ventas: this.reporte().metricas.ventasCantidad,
    compras: this.reporte().metricas.comprasCantidad,
    utilidad: this.reporte().metricas.utilidadEstimada,
    checklist: this.reporte().contexto.checklistPorcentaje,
    pendientes: this.reporte().pendientes.length,
    observaciones: this.reporte().observaciones.length
  }));

  regenerar() {
    this.reporte.set(this.cierreDiarioService.generarReporte(this.authService.usernameActual() || 'Sistema'));
    this.mensaje.set('Reporte regenerado con el estado actual del sistema.');
  }

  guardar() {
    this.cierreDiarioService.guardarReporte(this.reporte());
    this.historial.set(this.cierreDiarioService.obtenerHistorial());
    this.mensaje.set('Cierre diario consolidado guardado correctamente.');
  }

  exportar() {
    const fileName = `bodega_cierre_diario_${this.reporte().contexto.fecha}.json`;
    this.cierreDiarioService.exportarReporte(fileName, JSON.stringify(this.reporte(), null, 2));
    this.mensaje.set(`Se exportó el cierre diario como ${fileName}.`);
  }
}
