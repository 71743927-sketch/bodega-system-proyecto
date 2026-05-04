export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  marca: string;
  descripcion: string;
  precioCompra: number;
  precioVenta: number;
  stock: number;
  stockMinimo: number;
  unidadMedida: string;
  fechaVencimiento?: string;
  activo: boolean;
}
