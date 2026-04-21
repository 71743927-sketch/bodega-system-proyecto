import { EventoAuditoria } from '../../auditoria/models/evento-auditoria';
import { ConfiguracionGeneral } from '../../configuracion/models/configuracion-general';
import { Compra } from '../../compras/models/compra';
import { Compra as CompraModel } from '../../compras/models/compra';
import { MovimientoInventario } from '../../inventario/models/movimiento-inventario';
import { Producto } from '../../productos/models/producto';
import { Proveedor } from '../../proveedores/models/proveedor';
import { Usuario } from '../../usuarios/models/usuario';
import { Venta } from '../../ventas/models/venta';
import { CajaActiva, CierreCaja } from '../../caja/models/caja';

export interface RespaldoMeta {
  version: string;
  generadoEn: string;
  generadoPor: string;
  aplicacion: string;
  notas: string;
}

export interface RespaldoSistema {
  meta: RespaldoMeta;
  configuracion: ConfiguracionGeneral | null;
  productos: Producto[];
  ventas: Venta[];
  compras: CompraModel[];
  proveedores: Proveedor[];
  usuarios: Usuario[];
  movimientosInventario: MovimientoInventario[];
  cajaActiva: CajaActiva | null;
  cierresCaja: CierreCaja[];
  auditoria: EventoAuditoria[];
  alertasDescartadas: string[];
}
