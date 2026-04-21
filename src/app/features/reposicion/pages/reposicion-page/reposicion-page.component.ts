import { CurrencyPipe, DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ResumenReposicion, SugerenciaReposicion } from '../../models/sugerencia-reposicion';
import { ReposicionService } from '../../services/reposicion.service';

@Component({
  selector: 'app-reposicion-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, JsonPipe],
  templateUrl: './reposicion-page.component.html',
  styleUrl: './reposicion-page.component.css'
})
export class ReposicionPageComponent {

  private readonly reposicionService = inject(ReposicionService);

  mensaje = signal('');
  filtroPrioridad = signal<'TODOS' | SugerenciaReposicion['prioridad']>('TODOS');
  filtroEstado = signal<'TODOS' | SugerenciaReposicion['estado']>('TODOS');
  busqueda = signal('');

  sugerenciasBase = computed(() => this.reposicionService.generarSugerencias());

  sugerencias = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const prioridad = this.filtroPrioridad();
    const estado = this.filtroEstado();

    return this.sugerenciasBase().filter(item => {
      const okTexto = texto === '' ||
        item.nombre.toLowerCase().includes(texto) ||
        item.codigo.toLowerCase().includes(texto) ||
        item.categoria.toLowerCase().includes(texto) ||
        item.motivo.toLowerCase().includes(texto);

      const okPrioridad = prioridad === 'TODOS' || item.prioridad === prioridad;
      const okEstado = estado === 'TODOS' || item.estado === estado;

      return okTexto && okPrioridad && okEstado;
    });
  });

  resumen = computed<ResumenReposicion>(() => this.reposicionService.calcularResumen(this.sugerenciasBase()));

  reporteJson = computed(() => JSON.stringify({
    fecha: new Date().toISOString(),
    resumen: this.resumen(),
    sugerencias: this.sugerencias()
  }, null, 2));

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  actualizarPrioridad(valor: 'TODOS' | SugerenciaReposicion['prioridad']) {
    this.filtroPrioridad.set(valor);
  }

  actualizarEstadoFiltro(valor: 'TODOS' | SugerenciaReposicion['estado']) {
    this.filtroEstado.set(valor);
  }

  actualizarEstado(id: string, estado: SugerenciaReposicion['estado']) {
    this.reposicionService.actualizarEstado(id, estado);
    this.mensaje.set(`Estado actualizado para ${id}: ${estado}.`);
  }

  actualizarObservacion(id: string, observacion: string) {
    this.reposicionService.actualizarObservacion(id, observacion);
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.filtroPrioridad.set('TODOS');
    this.filtroEstado.set('TODOS');
  }

  exportar() {
    const fileName = `bodega_reposicion_${new Date().toISOString().slice(0, 10)}.json`;
    this.reposicionService.exportar(fileName, this.reporteJson());
    this.mensaje.set(`Se exportó el plan de reposición como ${fileName}.`);
  }
}
