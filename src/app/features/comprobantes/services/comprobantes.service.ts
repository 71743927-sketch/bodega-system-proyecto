import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Venta } from '../../ventas/models/venta';
import { VentasService } from '../../ventas/services/ventas.service';
import { ComprobanteLinea, ComprobanteVenta } from '../models/comprobante-venta';

@Injectable({
  providedIn: 'root'
})
export class ComprobantesService {

  private readonly ventasService = inject(VentasService);

  ventas = this.ventasService.ventasLectura;

  obtenerVentaPorId(idVenta: number): Venta | null {
    return this.ventas().find(item => item.id === idVenta) ?? null;
  }

  construirComprobante(venta: Venta): ComprobanteVenta {
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

    const qrPayload = [
      'RUC:00000000000',
      `TIPO:BOLETA`,
      `SERIE:${serie}`,
      `CORRELATIVO:${correlativo}`,
      `TOTAL:${venta.total.toFixed(2)}`,
      `FECHA:${venta.fecha}`
    ].join('|');

    return {
      idVenta: venta.id,
      tipo: 'BOLETA',
      serie,
      correlativo,
      emitidoEn: venta.fecha,
      clienteNombre: venta.clienteNombre !== '' ? venta.clienteNombre : 'Público general',
      vendedor: venta.vendedor,
      metodoPago: venta.metodoPago,
      subtotal: venta.subtotal,
      descuento: venta.descuento,
      total: venta.total,
      observacion: venta.observacion,
      moneda: 'PEN',
      simboloMoneda: 'S/',
      lineas,
      qrPayload
    };
  }

  generarTextoPlano(comprobante: ComprobanteVenta): string {
    const lineas = [
      '========================================',
      '              BODEGA APP                ',
      '          COMPROBANTE DE VENTA          ',
      '========================================',
      `Tipo       : ${comprobante.tipo}`,
      `Serie      : ${comprobante.serie}`,
      `Correlativo: ${comprobante.correlativo}`,
      `Emitido en : ${comprobante.emitidoEn}`,
      `Cliente    : ${comprobante.clienteNombre}`,
      `Vendedor   : ${comprobante.vendedor}`,
      `Pago       : ${comprobante.metodoPago}`,
      '----------------------------------------',
      'DETALLE',
      '----------------------------------------'
    ];

    comprobante.lineas.forEach(item => {
      lineas.push(`${item.nombre}`);
      lineas.push(`  ${item.cantidad} x ${comprobante.simboloMoneda} ${item.precioUnitario.toFixed(2)} = ${comprobante.simboloMoneda} ${item.subtotal.toFixed(2)}`);
    });

    lineas.push('----------------------------------------');
    lineas.push(`Subtotal   : ${comprobante.simboloMoneda} ${comprobante.subtotal.toFixed(2)}`);
    lineas.push(`Descuento  : ${comprobante.simboloMoneda} ${comprobante.descuento.toFixed(2)}`);
    lineas.push(`TOTAL      : ${comprobante.simboloMoneda} ${comprobante.total.toFixed(2)}`);

    if (comprobante.observacion !== '') {
      lineas.push('----------------------------------------');
      lineas.push(`Obs        : ${comprobante.observacion}`);
    }

    lineas.push('----------------------------------------');
    lineas.push(`QR Payload : ${comprobante.qrPayload}`);
    lineas.push('========================================');
    lineas.push('Gracias por su compra');
    lineas.push('========================================');

    return lineas.join('\n');
  }

  exportarTxt(fileName: string, content: string) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  exportarPdf(fileName: string, comprobante: ComprobanteVenta) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    let currentY = 40;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('BODEGA APP', marginX, currentY);
    currentY += 18;

    doc.setFontSize(12);
    doc.text('COMPROBANTE DE VENTA', marginX, currentY);
    currentY += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Tipo: ${comprobante.tipo}`, marginX, currentY); currentY += 14;
    doc.text(`Serie: ${comprobante.serie}`, marginX, currentY); currentY += 14;
    doc.text(`Correlativo: ${comprobante.correlativo}`, marginX, currentY); currentY += 14;
    doc.text(`Emitido en: ${comprobante.emitidoEn}`, marginX, currentY); currentY += 14;
    doc.text(`Cliente: ${comprobante.clienteNombre}`, marginX, currentY); currentY += 14;
    doc.text(`Vendedor: ${comprobante.vendedor}`, marginX, currentY); currentY += 14;
    doc.text(`Método de pago: ${comprobante.metodoPago}`, marginX, currentY); currentY += 20;

    autoTable(doc, {
      startY: currentY,
      head: [['Producto', 'Cant.', 'P. Unit.', 'Subtotal']],
      body: comprobante.lineas.map(item => [
        `${item.nombre}\n${item.codigo} · ${item.categoria}`,
        String(item.cantidad),
        `${comprobante.simboloMoneda} ${item.precioUnitario.toFixed(2)}`,
        `${comprobante.simboloMoneda} ${item.subtotal.toFixed(2)}`
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 6,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [37, 99, 235]
      },
      margin: { left: marginX, right: marginX }
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY + 20;
    let resumenY = finalY + 18;

    doc.setFont('helvetica', 'bold');
    doc.text(`Subtotal: ${comprobante.simboloMoneda} ${comprobante.subtotal.toFixed(2)}`, marginX, resumenY); resumenY += 16;
    doc.text(`Descuento: ${comprobante.simboloMoneda} ${comprobante.descuento.toFixed(2)}`, marginX, resumenY); resumenY += 16;
    doc.text(`TOTAL: ${comprobante.simboloMoneda} ${comprobante.total.toFixed(2)}`, marginX, resumenY); resumenY += 22;

    doc.setFont('helvetica', 'normal');
    if (comprobante.observacion !== '') {
      doc.text(`Observación: ${comprobante.observacion}`, marginX, resumenY, { maxWidth: 500 });
      resumenY += 28;
    }

    doc.text(`QR Payload: ${comprobante.qrPayload}`, marginX, resumenY, { maxWidth: 500 });
    resumenY += 22;
    doc.text('Gracias por su compra', marginX, resumenY);

    doc.save(fileName);
  }
}
