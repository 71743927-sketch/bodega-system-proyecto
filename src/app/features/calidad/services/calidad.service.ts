import { Injectable, inject } from '@angular/core';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { CajaService } from '../../caja/services/caja.service';
import { ComprasService } from '../../compras/services/compras.service';
import { ConfiguracionService } from '../../configuracion/services/configuracion.service';
import { InventarioService } from '../../inventario/services/inventario.service';
import { ProductosService } from '../../productos/services/productos.service';
import { ProveedoresService } from '../../proveedores/services/proveedores.service';
import { UsuariosService } from '../../usuarios/services/usuarios.service';
import { VentasService } from '../../ventas/services/ventas.service';
import { HallazgoCalidad } from '../models/hallazgo-calidad';

@Injectable({
  providedIn: 'root'
})
export class CalidadService {

  private readonly ventasService = inject(VentasService);
  private readonly comprasService = inject(ComprasService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly inventarioService = inject(InventarioService);
  private readonly cajaService = inject(CajaService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly configuracionService = inject(ConfiguracionService);

  generarHallazgos(): HallazgoCalidad[] {
    const productos = this.productosService.productosLectura();
    const ventas = this.ventasService.ventasLectura();
    const compras = this.comprasService.comprasLectura();
    const usuarios = this.usuariosService.usuariosLectura();
    const proveedores = this.proveedoresService.proveedoresLectura();
    const movimientos = this.inventarioService.movimientosLectura();
    const cierres = this.cajaService.cierres();
    const auditoria = this.auditoriaService.eventosLectura();
    const config = this.configuracionService.configuracionLectura();

    const hallazgos: HallazgoCalidad[] = [];

    const productoIds = new Set(productos.map(item => item.id));
    const productoNombres = new Set(productos.map(item => item.nombre.trim().toLowerCase()));
    const proveedorNombres = new Set(proveedores.map(item => item.nombre.trim().toLowerCase()));

    const ahora = Date.now();

    const futuros = [
      ...ventas.filter(item => new Date(item.fecha).getTime() > ahora).map(item => `Venta #${item.id}`),
      ...compras.filter(item => new Date(item.fecha).getTime() > ahora).map(item => `Compra #${item.id}`),
      ...cierres.filter(item => new Date(item.fechaCierre).getTime() > ahora).map(item => `Cierre #${item.id}`),
      ...auditoria.filter(item => new Date(item.fecha).getTime() > ahora).map(item => `Evento #${item.id}`)
    ];

    if (futuros.length > 0) {
      hallazgos.push({
        id: 'fechas-futuras',
        nivel: 'ERROR',
        categoria: 'Temporalidad',
        titulo: 'Se detectaron registros con fecha futura',
        detalle: `Hay ${futuros.length} registros posteriores al momento actual.`,
        referencia: futuros.slice(0, 6).join(', '),
        sugerencia: 'Revisar reloj del equipo o los datos importados para evitar inconsistencias temporales.'
      });
    }

    const ventasSinDetalle = ventas.filter(item => item.detalles.length === 0);
    if (ventasSinDetalle.length > 0) {
      hallazgos.push({
        id: 'ventas-sin-detalle',
        nivel: 'ERROR',
        categoria: 'Ventas',
        titulo: 'Existen ventas sin detalle',
        detalle: `Se detectaron ${ventasSinDetalle.length} ventas sin líneas de ítems.`,
        referencia: ventasSinDetalle.map(item => `#${item.id}`).slice(0, 8).join(', '),
        sugerencia: 'Corregir registros incompletos o excluirlos de analítica y comprobantes.'
      });
    }

    const comprasSinDetalle = compras.filter(item => item.detalles.length === 0);
    if (comprasSinDetalle.length > 0) {
      hallazgos.push({
        id: 'compras-sin-detalle',
        nivel: 'ERROR',
        categoria: 'Compras',
        titulo: 'Existen compras sin detalle',
        detalle: `Se detectaron ${comprasSinDetalle.length} compras sin líneas de productos.`,
        referencia: comprasSinDetalle.map(item => `#${item.id}`).slice(0, 8).join(', '),
        sugerencia: 'Revisar la captura de compras y normalizar los registros incompletos.'
      });
    }

    const ventasReferenciasHuerfanas = ventas.flatMap(venta =>
      venta.detalles
        .filter(detalle => !productoNombres.has(detalle.nombre.trim().toLowerCase()))
        .map(detalle => `Venta #${venta.id}: ${detalle.nombre}`)
    );

    if (ventasReferenciasHuerfanas.length > 0) {
      hallazgos.push({
        id: 'ventas-huerfanas',
        nivel: 'WARNING',
        categoria: 'Integridad referencial',
        titulo: 'Ventas con productos no encontrados en catálogo',
        detalle: `Se detectaron ${ventasReferenciasHuerfanas.length} líneas de venta que no coinciden con productos actuales.`,
        referencia: ventasReferenciasHuerfanas.slice(0, 6).join(' | '),
        sugerencia: 'Evitar borrar productos ya usados o usar catálogos históricos / estado inactivo en vez de eliminación física.'
      });
    }

    const comprasReferenciasHuerfanas = compras.flatMap(compra =>
      compra.detalles
        .filter(detalle => !productoIds.has(detalle.productoId) || !productoNombres.has(detalle.productoNombre.trim().toLowerCase()))
        .map(detalle => `Compra #${compra.id}: ${detalle.productoNombre}`)
    );

    if (comprasReferenciasHuerfanas.length > 0) {
      hallazgos.push({
        id: 'compras-huerfanas',
        nivel: 'WARNING',
        categoria: 'Integridad referencial',
        titulo: 'Compras con productos inconsistentes',
        detalle: `Se detectaron ${comprasReferenciasHuerfanas.length} líneas de compra con referencias no válidas.`,
        referencia: comprasReferenciasHuerfanas.slice(0, 6).join(' | '),
        sugerencia: 'Verificar si se eliminaron productos o si hubo importaciones incompletas.'
      });
    }

    const comprasProveedorHuerfano = compras.filter(item => !proveedorNombres.has(item.proveedorNombre.trim().toLowerCase()));
    if (comprasProveedorHuerfano.length > 0) {
      hallazgos.push({
        id: 'compras-proveedor-huerfano',
        nivel: 'WARNING',
        categoria: 'Integridad referencial',
        titulo: 'Compras con proveedor no encontrado',
        detalle: `Hay ${comprasProveedorHuerfano.length} compras cuyo proveedor ya no existe en el catálogo actual.`,
        referencia: comprasProveedorHuerfano.map(item => `${item.id}:${item.proveedorNombre}`).slice(0, 6).join(', '),
        sugerencia: 'Mantener proveedores inactivos en lugar de borrarlos para preservar historial.'
      });
    }

    const movimientosHuerfanos = movimientos.filter(item => !productoIds.has(item.productoId));
    if (movimientosHuerfanos.length > 0) {
      hallazgos.push({
        id: 'movimientos-huerfanos',
        nivel: 'ERROR',
        categoria: 'Inventario',
        titulo: 'Movimientos de inventario con producto inválido',
        detalle: `Se detectaron ${movimientosHuerfanos.length} movimientos apuntando a productos inexistentes.`,
        referencia: movimientosHuerfanos.map(item => `#${item.id}/P${item.productoId}`).slice(0, 6).join(', '),
        sugerencia: 'Corregir productoId inválidos o regenerar la bitácora de inventario.'
      });
    }

    const stockNegativo = productos.filter(item => item.stockActual < 0);
    if (stockNegativo.length > 0) {
      hallazgos.push({
        id: 'stock-negativo',
        nivel: config.permitirStockNegativo ? 'WARNING' : 'ERROR',
        categoria: 'Inventario',
        titulo: 'Existen productos con stock negativo',
        detalle: `Se detectaron ${stockNegativo.length} productos con stock por debajo de cero.`,
        referencia: stockNegativo.map(item => `${item.codigo}:${item.stockActual}`).slice(0, 8).join(', '),
        sugerencia: 'Revisar ventas, ajustes y configuración de stock negativo.'
      });
    }

    const precioInvalido = productos.filter(item => item.precioVenta < item.precioCompra || item.precioVenta <= 0 || item.precioCompra < 0);
    if (precioInvalido.length > 0) {
      hallazgos.push({
        id: 'precios-invalidos',
        nivel: 'WARNING',
        categoria: 'Productos',
        titulo: 'Productos con precios potencialmente problemáticos',
        detalle: `Se detectaron ${precioInvalido.length} productos con margen negativo o precios no válidos.`,
        referencia: precioInvalido.map(item => `${item.codigo} C:${item.precioCompra} V:${item.precioVenta}`).slice(0, 8).join(' | '),
        sugerencia: 'Revisar reglas de fijación de precios y carga inicial del catálogo.'
      });
    }

    const cierresAnomalos = cierres.filter(item => Math.abs(item.diferencia) >= 20);
    if (cierresAnomalos.length > 0) {
      hallazgos.push({
        id: 'cierres-anomalos',
        nivel: 'ERROR',
        categoria: 'Caja',
        titulo: 'Cierres de caja con diferencia alta',
        detalle: `Hay ${cierresAnomalos.length} cierres con diferencia absoluta mayor o igual a S/ 20.00.`,
        referencia: cierresAnomalos.map(item => `#${item.id}: ${item.diferencia}`).slice(0, 6).join(', '),
        sugerencia: 'Auditar caja, revisar ingresos/egresos manuales y efectivo contado.'
      });
    }

    const usuariosDuplicados = this.contarDuplicados(usuarios.map(item => item.username));
    if (usuariosDuplicados > 0) {
      hallazgos.push({
        id: 'usuarios-duplicados',
        nivel: 'ERROR',
        categoria: 'Usuarios',
        titulo: 'Se detectaron usernames duplicados',
        detalle: `Hay ${usuariosDuplicados} colisiones de username en el sistema.`,
        referencia: 'Usuarios',
        sugerencia: 'Normalizar usernames únicos para evitar conflictos de autenticación.'
      });
    }

    const productosDuplicados = this.contarDuplicados(productos.map(item => item.codigo));
    if (productosDuplicados > 0) {
      hallazgos.push({
        id: 'productos-duplicados',
        nivel: 'ERROR',
        categoria: 'Productos',
        titulo: 'Se detectaron códigos de producto duplicados',
        detalle: `Hay ${productosDuplicados} colisiones de código en catálogo.`,
        referencia: 'Productos',
        sugerencia: 'Corregir códigos para mantener integridad de inventario y compras.'
      });
    }

    const warningsAuth = auditoria.filter(item => item.modulo === 'AUTH' && item.nivel === 'WARNING').length;
    if (warningsAuth > 0) {
      hallazgos.push({
        id: 'auth-warnings',
        nivel: 'INFO',
        categoria: 'Seguridad',
        titulo: 'Eventos de autenticación con advertencia',
        detalle: `La bitácora contiene ${warningsAuth} eventos AUTH con nivel WARNING.`,
        referencia: 'AUTH',
        sugerencia: 'Revisar si hubo intentos fallidos frecuentes o sesiones expiradas en exceso.'
      });
    }

    if (hallazgos.length === 0) {
      hallazgos.push({
        id: 'salud-general-ok',
        nivel: 'OK',
        categoria: 'Sistema',
        titulo: 'Sin hallazgos técnicos críticos',
        detalle: 'No se detectan inconsistencias relevantes con las reglas técnicas evaluadas.',
        referencia: 'Sistema',
        sugerencia: 'Mantener el monitoreo periódico y respaldos actualizados.'
      });
    }

    return hallazgos;
  }

  exportarDiagnostico(fileName: string, content: string) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      return;
    }

    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  private contarDuplicados(values: string[]): number {
    const mapa = new Map<string, number>();

    values
      .map(item => item.trim().toLowerCase())
      .filter(item => item !== '')
      .forEach(item => {
        mapa.set(item, (mapa.get(item) ?? 0) + 1);
      });

    return Array.from(mapa.values()).filter(count => count > 1).length;
  }
}
