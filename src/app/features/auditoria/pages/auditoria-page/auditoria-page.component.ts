import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../services/auditoria.service';
import { EventoAuditoria, ModuloAuditoria, NivelAuditoria } from '../../models/evento-auditoria';

@Component({
  selector: 'app-auditoria-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './auditoria-page.component.html',
  styleUrl: './auditoria-page.component.css'
})
export class AuditoriaPageComponent {

  private auditoriaService = inject(AuditoriaService);

  eventos = this.auditoriaService.eventosLectura;

  busqueda = signal('');
  filtroModulo = signal<'TODOS' | ModuloAuditoria>('TODOS');
  filtroNivel = signal<'TODOS' | NivelAuditoria>('TODOS');
  fechaInicio = signal('');
  fechaFin = signal('');

  modulos: ModuloAuditoria[] = ['AUTH', 'PRODUCTOS', 'VENTAS', 'COMPRAS', 'CAJA', 'INVENTARIO', 'USUARIOS', 'SISTEMA'];
  niveles: NivelAuditoria[] = ['INFO', 'SUCCESS', 'WARNING', 'DANGER'];

  totalEventos = computed(() => this.eventos().length);
  totalWarnings = computed(() => this.eventos().filter((e: any) => e.nivel === 'WARNING').length);
  totalDanger = computed(() => this.eventos().filter((e: any) => e.nivel === 'DANGER').length);
  totalAuth = computed(() => this.eventos().filter((e: any) => e.modulo === 'AUTH').length);

  private normalizarInicio(fecha: string): number | null {
    if (fecha.trim() === '') {
      return null;
    }
    const d = new Date(fecha + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  private normalizarFin(fecha: string): number | null {
    if (fecha.trim() === '') {
      return null;
    }
    const d = new Date(fecha + 'T23:59:59');
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  private estaEnRango(fechaIso: string): boolean {
    const fechaMs = new Date(fechaIso).getTime();
    const inicio = this.normalizarInicio(this.fechaInicio());
    const fin = this.normalizarFin(this.fechaFin());

    if (inicio !== null && fechaMs < inicio) {
      return false;
    }
    if (fin !== null && fechaMs > fin) {
      return false;
    }
    return true;
  }

  eventosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const modulo = this.filtroModulo();
    const nivel = this.filtroNivel();

    return this.eventos().filter((evento: any) => {
      const coincideTexto =
        texto === '' ||
        evento.accion.toLowerCase().includes(texto) ||
        evento.detalle.toLowerCase().includes(texto) ||
        evento.usuario.toLowerCase().includes(texto) ||
        evento.metadata.toLowerCase().includes(texto);

      const coincideModulo = modulo === 'TODOS' || evento.modulo === modulo;
      const coincideNivel = nivel === 'TODOS' || evento.nivel === nivel;

      return coincideTexto && coincideModulo && coincideNivel && this.estaEnRango(evento.fecha);
    });
  });

  actualizarBusqueda(valor: string) { this.busqueda.set(valor); }
  actualizarModulo(valor: 'TODOS' | ModuloAuditoria) { this.filtroModulo.set(valor); }
  actualizarNivel(valor: 'TODOS' | NivelAuditoria) { this.filtroNivel.set(valor); }
  actualizarFechaInicio(valor: string) { this.fechaInicio.set(valor); }
  actualizarFechaFin(valor: string) { this.fechaFin.set(valor); }

  limpiarFiltros() {
    this.busqueda.set('');
    this.filtroModulo.set('TODOS');
    this.filtroNivel.set('TODOS');
    this.fechaInicio.set('');
    this.fechaFin.set('');
  }

  limpiarBitacora() {
    this.auditoriaService.limpiarEventos();
  }
}

