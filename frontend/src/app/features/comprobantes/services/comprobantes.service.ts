import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ConfiguracionService } from '../../configuracion/services/configuracion.service';
import { Venta } from '../../ventas/models/venta';
import { VentasService } from '../../ventas/services/ventas.service';
import { ComprobanteLinea, ComprobanteVenta } from '../models/comprobante-venta';

@Injectable({
  providedIn: 'root'
})
export class ComprobantesService {
  private readonly ventasService = inject(VentasService);
  private readonly configuracionService = inject(ConfiguracionService);

  ventas = this.ventasService.ventasLectura;

  obtenerVentaPorId(idVenta: number): Venta | null {
    return this.ventas().find(item => item.id === idVenta) ?? null;
  }

  construirComprobante(venta: Venta): ComprobanteVenta {
    const config = this.configuracionService.configuracionLectura();

    const serie = 'B001';
    const correlativo = String(venta.id).padStart(8, '0');

    const lineas: ComprobanteLinea[] = venta.detalles.map(item => ({
      productoId: item.productoId,
      codigo: item.codigo,
      nombre: item.nombre,
      categoria: item.categoria,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.subtotal
    }));

    const igvPorcentaje = Number(config.igvPorcentaje ?? 0);
    const total = Number(venta.total ?? 0);
    const igvMonto = igvPorcentaje > 0
      ? Number((total - (total / (1 + igvPorcentaje / 100))).toFixed(2))
      : 0;

    const qrPayload = [
      `RUC:${config.ruc}`,
      `NEGOCIO:${config.nombreNegocio}`,
      `TIPO:BOLETA`,
      `SERIE:${serie}`,
      `CORRELATIVO:${correlativo}`,
      `TOTAL:${total.toFixed(2)}`,
      `MONEDA:${config.moneda}`,
      `IGV:${igvPorcentaje}`,
      `FECHA:${venta.fecha}`
    ].join('|');

    return {
      idVenta: venta.id,
      tipo: 'BOLETA',
      serie,
      correlativo,
      emitidoEn: venta.fecha,

      nombreNegocio: config.nombreNegocio,
      ruc: config.ruc,
      telefono: config.telefono,
      direccion: config.direccion,

      clienteNombre: venta.clienteNombre !== '' ? venta.clienteNombre : 'Público general',
      vendedor: venta.vendedor,
      metodoPago: venta.metodoPago,

      subtotal: venta.subtotal,
      descuento: venta.descuento,
      total,
      igvPorcentaje,
      igvMonto,

      observacion: venta.observacion,
      moneda: config.moneda,
      simboloMoneda: config.simboloMoneda,

      mensajeTicket: config.mensajeTicket,
      pieTicket: config.pieTicket,

      lineas,
      qrPayload
    };
  }

  generarTextoPlano(comprobante: ComprobanteVenta): string {
    const lineas = [
      '',
      `              ${comprobante.nombreNegocio}              `,
      '          COMPROBANTE DE VENTA          ',
      '',
      `RUC        : ${comprobante.ruc}`,
      `Teléfono   : ${comprobante.telefono}`,
      `Dirección  : ${comprobante.direccion}`,
      '',
      `Tipo       : ${comprobante.tipo}`,
      `Serie      : ${comprobante.serie}`,
      `Correlativo: ${comprobante.correlativo}`,
      `Emitido en : ${comprobante.emitidoEn}`,
      `Cliente    : ${comprobante.clienteNombre}`,
      `Vendedor   : ${comprobante.vendedor}`,
      `Pago       : ${comprobante.metodoPago}`,
      `Moneda     : ${comprobante.moneda}`,
      '----------------------------------------',
      'DETALLE',
      '----------------------------------------'
    ];

    comprobante.lineas.forEach(item => {
      lineas.push(`${item.nombre} (${item.codigo})`);
      lineas.push(`  ${item.cantidad} x ${comprobante.simboloMoneda} ${item.precioUnitario.toFixed(2)} = ${comprobante.simboloMoneda} ${item.subtotal.toFixed(2)}`);
    });

    lineas.push('----------------------------------------');
    lineas.push(`Subtotal   : ${comprobante.simboloMoneda} ${comprobante.subtotal.toFixed(2)}`);
    lineas.push(`Descuento  : ${comprobante.simboloMoneda} ${comprobante.descuento.toFixed(2)}`);
    lineas.push(`IGV (${comprobante.igvPorcentaje}%): ${comprobante.simboloMoneda} ${comprobante.igvMonto.toFixed(2)}`);
    lineas.push(`TOTAL      : ${comprobante.simboloMoneda} ${comprobante.total.toFixed(2)}`);

    if (comprobante.observacion !== '') {
      lineas.push('');
      lineas.push(`Obs        : ${comprobante.observacion}`);
    }

    lineas.push('');
    lineas.push(comprobante.mensajeTicket);
    lineas.push(comprobante.pieTicket);
    lineas.push('');
    lineas.push(`QR Payload : ${comprobante.qrPayload}`);
    lineas.push('');

    return lineas.join('\n');
  }

  exportarTxt(fileName: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  exportarPdf(fileName: string, comprobante: ComprobanteVenta) {
    const doc = new jsPDF({
      unit: 'pt',
      format: 'a4'
    });

    const marginX = 40;
    let currentY = 45;

    doc.setFontSize(16);
    doc.text(comprobante.nombreNegocio, marginX, currentY);
    currentY += 18;

    doc.setFontSize(11);
    doc.text(`RUC: ${comprobante.ruc}`, marginX, currentY);
    currentY += 14;
    doc.text(`Teléfono: ${comprobante.telefono}`, marginX, currentY);
    currentY += 14;
    doc.text(`Dirección: ${comprobante.direccion}`, marginX, currentY, { maxWidth: 500 });
    currentY += 24;

    doc.setFontSize(14);
    doc.text('COMPROBANTE DE VENTA', marginX, currentY);
    currentY += 22;

    doc.setFontSize(10);
    doc.text(`Tipo: ${comprobante.tipo}`, marginX, currentY); currentY += 14;
    doc.text(`Serie: ${comprobante.serie}`, marginX, currentY); currentY += 14;
    doc.text(`Correlativo: ${comprobante.correlativo}`, marginX, currentY); currentY += 14;
    doc.text(`Emitido en: ${comprobante.emitidoEn}`, marginX, currentY); currentY += 14;
    doc.text(`Cliente: ${comprobante.clienteNombre}`, marginX, currentY); currentY += 14;
    doc.text(`Vendedor: ${comprobante.vendedor}`, marginX, currentY); currentY += 14;
    doc.text(`Método de pago: ${comprobante.metodoPago}`, marginX, currentY); currentY += 18;

    autoTable(doc, {
      startY: currentY,
      head: [['Producto', 'Cant.', 'P. Unit.', 'Subtotal']],
      body: comprobante.lineas.map(item => [
        `${item.nombre} (${item.codigo})`,
        String(item.cantidad),
        `${comprobante.simboloMoneda} ${item.precioUnitario.toFixed(2)}`,
        `${comprobante.simboloMoneda} ${item.subtotal.toFixed(2)}`
      ]),
      styles: {
        fontSize: 9
      },
      headStyles: {
        fillColor: [37, 99, 235]
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? currentY + 90;
    let resumenY = finalY + 24;

    doc.setFontSize(10);
    doc.text(`Subtotal: ${comprobante.simboloMoneda} ${comprobante.subtotal.toFixed(2)}`, marginX, resumenY); resumenY += 16;
    doc.text(`Descuento: ${comprobante.simboloMoneda} ${comprobante.descuento.toFixed(2)}`, marginX, resumenY); resumenY += 16;
    doc.text(`IGV (${comprobante.igvPorcentaje}%): ${comprobante.simboloMoneda} ${comprobante.igvMonto.toFixed(2)}`, marginX, resumenY); resumenY += 16;
    doc.text(`TOTAL: ${comprobante.simboloMoneda} ${comprobante.total.toFixed(2)}`, marginX, resumenY); resumenY += 22;

    if (comprobante.observacion !== '') {
      doc.text(`Observación: ${comprobante.observacion}`, marginX, resumenY, { maxWidth: 500 });
      resumenY += 22;
    }

    doc.text(comprobante.mensajeTicket, marginX, resumenY, { maxWidth: 500 });
    resumenY += 18;
    doc.text(comprobante.pieTicket, marginX, resumenY, { maxWidth: 500 });
    resumenY += 24;

    doc.text(`QR Payload: ${comprobante.qrPayload}`, marginX, resumenY, { maxWidth: 500 });

    doc.save(fileName);
  }
}