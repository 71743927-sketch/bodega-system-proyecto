import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ComprobanteVenta } from '../../models/comprobante-venta';
import { ComprobantesService } from '../../services/comprobantes.service';

@Component({
  selector: 'app-comprobantes-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './comprobantes-page.component.html',
  styleUrl: './comprobantes-page.component.css'
})
export class ComprobantesPageComponent {

  private readonly comprobantesService = inject(ComprobantesService);

  ventas = this.comprobantesService.ventas;
  busqueda = signal('');
  soloHoy = signal(false);
  ventaSeleccionadaId = signal<number | null>(null);
  mensaje = signal('');

  ventasFiltradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const hoy = this.obtenerFechaLocal();
    return this.ventas().filter(item => {
      const coincideTexto =
        q === '' ||
        String(item.id).includes(q) ||
        item.metodoPago.toLowerCase().includes(q) ||
        item.vendedor.toLowerCase().includes(q) ||
        item.clienteNombre.toLowerCase().includes(q) ||
        item.detalles.some(det => det.nombre.toLowerCase().includes(q) || det.codigo.toLowerCase().includes(q));

      const coincideFecha = !this.soloHoy() || this.normalizarFecha(item.fecha) === hoy;
      return coincideTexto && coincideFecha;
    });
  });

  ventaSeleccionada = computed(() => {
    const id = this.ventaSeleccionadaId();
    if (id === null) {
      return this.ventasFiltradas()[0] ?? null;
    }
    return this.comprobantesService.obtenerVentaPorId(id);
  });

  comprobanteActual = computed<ComprobanteVenta | null>(() => {
    const venta = this.ventaSeleccionada();
    return venta ? this.comprobantesService.construirComprobante(venta) : null;
  });

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  actualizarSoloHoy(valor: boolean) {
    this.soloHoy.set(valor);
  }

  seleccionarVenta(id: number) {
    this.ventaSeleccionadaId.set(id);
    this.mensaje.set(`Venta #${id} seleccionada.`);
  }

  exportarTxt() {
    const comprobante = this.comprobanteActual();
    if (!comprobante) {
      this.mensaje.set('No hay comprobante seleccionado para exportar.');
      return;
    }

    const fileName = `comprobante_venta_${comprobante.serie}_${comprobante.correlativo}.txt`;
    const content = this.comprobantesService.generarTextoPlano(comprobante);
    this.comprobantesService.exportarTxt(fileName, content);
    this.mensaje.set(`Se exportó el comprobante como ${fileName}.`);
  }

  exportarPdf() {
    const comprobante = this.comprobanteActual();
    if (!comprobante) {
      this.mensaje.set('No hay comprobante seleccionado para exportar en PDF.');
      return;
    }

    const fileName = `comprobante_venta_${comprobante.serie}_${comprobante.correlativo}.pdf`;
    this.comprobantesService.exportarPdf(fileName, comprobante);
    this.mensaje.set(`Se exportó el comprobante como ${fileName}.`);
  }

  private obtenerFechaLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private normalizarFecha(fechaIso: string): string {
    const d = new Date(fechaIso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
