export interface ComprobanteLinea {
  productoId: number;
  codigo: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface ComprobanteVenta {
  idVenta: number;
  tipo: 'BOLETA';
  serie: string;
  correlativo: string;
  emitidoEn: string;

  nombreNegocio: string;
  ruc: string;
  telefono: string;
  direccion: string;

  clienteNombre: string;
  vendedor: string;
  metodoPago: string;

  subtotal: number;
  descuento: number;
  total: number;
  igvPorcentaje: number;
  igvMonto: number;

  observacion: string;
  moneda: string;
  simboloMoneda: string;

  mensajeTicket: string;
  pieTicket: string;

  lineas: ComprobanteLinea[];
  qrPayload: string;
}