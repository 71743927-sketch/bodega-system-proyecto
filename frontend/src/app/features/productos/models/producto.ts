export interface Producto {
  id: number;
  backendId?: string;
  codigo: string;
  nombre: string;
  categoria: string;
  precioCompra: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  observacion?: string;
}
