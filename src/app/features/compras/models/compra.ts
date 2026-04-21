export interface CompraDetalle {
  productoId: number;
  productoNombre: string;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

export interface Compra {
  id: number;
  fecha: string;
  proveedorId: number;
  proveedorNombre: string;
  usuario: string;
  observacion: string;
  total: number;
  detalles: CompraDetalle[];
}
