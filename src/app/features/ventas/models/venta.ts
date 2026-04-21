export type MetodoPagoVenta = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA';

export interface VentaDetalle {
  productoId: number;
  codigo: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Venta {
  id: number;
  fecha: string;
  clienteNombre: string;
  metodoPago: MetodoPagoVenta;
  subtotal: number;
  descuento: number;
  total: number;
  observacion: string;
  vendedor: string;
  detalles: VentaDetalle[];
}
