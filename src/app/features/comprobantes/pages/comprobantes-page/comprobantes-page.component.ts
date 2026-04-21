import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ComprobanteVenta } from '../../models/comprobante-venta';
import { ComprobantesService } from '../../services/comprobantes.service';

@Component({
  selector: 'app-comprobantes-page',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './comprobantes-page.component.html',
  styleUrl: './comprobantes-page.component.css'
})
export class ComprobantesPageComponent {

  private readonly service = inject(ComprobantesService);

  ventas = this.service.ventas;
  busqueda = signal('');
  soloHoy = signal(false);
  ventaSeleccionadaId = signal<number | null>(null);
  numeroWhatsapp = signal('');
  mensaje = signal('');

  ventasFiltradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const hoy = this.obtenerFechaLocal();

    return this.ventas()
      .filter(item => {
        const coincideTexto =
          q === '' ||
          String(item.id).includes(q) ||
          (item.clienteNombre ?? '').toLowerCase().includes(q) ||
          item.metodoPago.toLowerCase().includes(q) ||
          item.vendedor.toLowerCase().includes(q) ||
          item.detalles.some(det =>
            det.nombre.toLowerCase().includes(q) ||
            det.codigo.toLowerCase().includes(q) ||
            det.categoria.toLowerCase().includes(q)
          );

        const coincideFecha = !this.soloHoy() || this.normalizarFecha(item.fecha) === hoy;
        return coincideTexto && coincideFecha;
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  });

  ventaSeleccionada = computed(() => {
    const id = this.ventaSeleccionadaId();
    const lista = this.ventasFiltradas();

    if (lista.length === 0) {
      return null;
    }

    if (id === null) {
      return lista[0];
    }

    return lista.find(item => item.id === id) ?? lista[0];
  });

  comprobanteActual = computed<ComprobanteVenta | null>(() => {
    const venta = this.ventaSeleccionada();
    return venta ? this.service.construirComprobante(venta) : null;
  });

  cantidadVentas = computed(() => this.ventasFiltradas().length);
  totalVentas = computed(() => this.ventasFiltradas().reduce((sum, item) => sum + item.total, 0));
  ticketPromedio = computed(() => {
    const lista = this.ventasFiltradas();
    return lista.length === 0 ? 0 : this.totalVentas() / lista.length;
  });

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  actualizarSoloHoy(valor: boolean) {
    this.soloHoy.set(valor);
  }

  actualizarNumeroWhatsapp(valor: string) {
    this.numeroWhatsapp.set(valor);
  }

  seleccionarVenta(id: number) {
    this.ventaSeleccionadaId.set(id);
    this.mensaje.set(`Venta #${id} seleccionada.`);
  }

  limpiarSeleccion() {
    this.ventaSeleccionadaId.set(null);
    this.mensaje.set('Selección limpiada.');
  }

  trackVenta(_: number, item: { id: number }) {
    return item.id;
  }

  exportarTxt() {
    const c = this.comprobanteActual();
    if (!c) {
      this.mensaje.set('No hay comprobante seleccionado para exportar.');
      return;
    }

    const fileName = `ticket_${c.serie}_${c.correlativo}.txt`;
    this.service.exportarTxt(fileName, this.service.generarTextoPlano(c));
    this.mensaje.set(`Se exportó el comprobante como ${fileName}.`);
  }

  exportarPdf() {
    const c = this.comprobanteActual();
    if (!c) {
      this.mensaje.set('No hay comprobante seleccionado para exportar en PDF.');
      return;
    }

    const fileName = `ticket_${c.serie}_${c.correlativo}.pdf`;
    this.service.exportarPdf(fileName, c);
    this.mensaje.set(`Se exportó el comprobante como ${fileName}.`);
  }

  enviarTextoPorWhatsapp() {
    const c = this.comprobanteActual();
    if (!c) {
      this.mensaje.set('No hay comprobante seleccionado para enviar por WhatsApp.');
      return;
    }

    const telefono = this.numeroWhatsapp().trim();
    if (telefono === '') {
      this.mensaje.set('Ingresa el número WhatsApp del cliente.');
      return;
    }

    const ok = this.service.abrirWhatsApp(telefono, this.service.construirMensajeWhatsApp(c));
    this.mensaje.set(ok
      ? 'Se abrió WhatsApp con el comprobante en texto.'
      : 'No se pudo abrir WhatsApp. Verifica el número del cliente.'
    );
  }

  async enviarImagenPorWhatsapp() {
    const c = this.comprobanteActual();
    if (!c) {
      this.mensaje.set('No hay comprobante seleccionado para compartir como imagen.');
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.mensaje.set('La función solo está disponible en el navegador.');
      return;
    }

    const ticketElement = document.getElementById('ticket-captura');
    if (!ticketElement) {
      this.mensaje.set('No se encontró la vista del ticket para convertirla en imagen.');
      return;
    }

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ticketElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        this.mensaje.set('No se pudo generar la imagen del ticket.');
        return;
      }

      const file = new File([blob], `ticket_${c.serie}_${c.correlativo}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Ticket ${c.serie}-${c.correlativo}`,
          text: `Comprobante de venta para ${c.clienteNombre}`
        });
        this.mensaje.set('Se abrió el panel de compartir para enviar el ticket como imagen.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(url);
      this.mensaje.set('Tu navegador no soporta compartir archivos. Se descargó la imagen del ticket.');
    } catch (error) {
      console.error(error);
      this.mensaje.set('No se pudo compartir la imagen del ticket desde este navegador o dispositivo.');
    }
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
