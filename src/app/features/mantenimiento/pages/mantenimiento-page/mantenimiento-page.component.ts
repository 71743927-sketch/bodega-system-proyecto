import { CurrencyPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../../auditoria/services/auditoria.service';
import { CajaService } from '../../../caja/services/caja.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { ConfiguracionService } from '../../../configuracion/services/configuracion.service';
import { InventarioService } from '../../../inventario/services/inventario.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { ProveedoresService } from '../../../proveedores/services/proveedores.service';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { VentasService } from '../../../ventas/services/ventas.service';
import { DiagnosticoSistema } from '../../models/diagnostico-sistema';
import { MantenimientoService } from '../../services/mantenimiento.service';

@Component({
  selector: 'app-mantenimiento-page',
  standalone: true,
  imports: [CurrencyPipe, JsonPipe],
  templateUrl: './mantenimiento-page.component.html',
  styleUrl: './mantenimiento-page.component.css'
})
export class MantenimientoPageComponent {

  private readonly mantenimientoService = inject(MantenimientoService);
  private readonly ventasService = inject(VentasService);
  private readonly comprasService = inject(ComprasService);
  private readonly productosService = inject(ProductosService);
  private readonly usuariosService = inject(UsuariosService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly inventarioService = inject(InventarioService);
  private readonly cajaService = inject(CajaService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly configuracionService = inject(ConfiguracionService);

  mensaje = signal('');

  ventas = this.ventasService.ventasLectura;
  compras = this.comprasService.comprasLectura;
  productos = this.productosService.productosLectura;
  usuarios = this.usuariosService.usuariosLectura;
  proveedores = this.proveedoresService.proveedoresLectura;
  movimientosInventario = this.inventarioService.movimientosLectura;
  cierresCaja = this.cajaService.cierres;
  cajaActiva = this.cajaService.cajaActiva;
  eventosAuditoria = this.auditoriaService.eventosLectura;
  configuracion = this.configuracionService.configuracionLectura;

  resumen = computed(() => ({
    productos: this.productos().length,
    ventas: this.ventas().length,
    compras: this.compras().length,
    usuarios: this.usuarios().length,
    proveedores: this.proveedores().length,
    movimientosInventario: this.movimientosInventario().length,
    cierresCaja: this.cierresCaja().length,
    auditoria: this.eventosAuditoria().length,
    stockCritico: this.productos().filter(item => item.stockActual <= item.stockMinimo).length,
    utilidadEstimada:
      this.ventas().reduce((sum, item) => sum + item.total, 0) -
      this.compras().reduce((sum, item) => sum + item.total, 0)
  }));

  diagnosticos = computed<DiagnosticoSistema[]>(() => {
    const diagnos: DiagnosticoSistema[] = [];

    const productos = this.productos();
    const ventas = this.ventas();
    const compras = this.compras();
    const usuarios = this.usuarios();
    const proveedores = this.proveedores();
    const cierres = this.cierresCaja();
    const auditoria = this.eventosAuditoria();
    const config = this.configuracion();

    const stockNegativo = productos.filter(item => item.stockActual < 0).length;
    if (stockNegativo > 0) {
      diagnos.push({
        id: 'stock-negativo',
        titulo: 'Productos con stock negativo',
        detalle: `Se detectaron ${stockNegativo} productos con stock por debajo de cero.`,
        nivel: 'ERROR',
        referencia: 'Inventario / Productos'
      });
    }

    const stockCero = productos.filter(item => item.stockActual === 0).length;
    if (stockCero > 0) {
      diagnos.push({
        id: 'stock-cero',
        titulo: 'Productos agotados',
        detalle: `Hay ${stockCero} productos sin stock disponible.`,
        nivel: 'WARNING',
        referencia: 'Inventario'
      });
    }

    const codigosDuplicados = this.contarDuplicados(productos.map(item => item.codigo));
    if (codigosDuplicados > 0) {
      diagnos.push({
        id: 'codigos-duplicados',
        titulo: 'Códigos de producto duplicados',
        detalle: `Se detectaron ${codigosDuplicados} códigos repetidos en el catálogo.`,
        nivel: 'ERROR',
        referencia: 'Productos'
      });
    }

    const usernamesDuplicados = this.contarDuplicados(usuarios.map(item => item.username));
    if (usernamesDuplicados > 0) {
      diagnos.push({
        id: 'usuarios-duplicados',
        titulo: 'Usernames duplicados',
        detalle: `Se detectaron ${usernamesDuplicados} usernames repetidos.`,
        nivel: 'ERROR',
        referencia: 'Usuarios'
      });
    }

    const proveedoresDuplicados = this.contarDuplicados(proveedores.map(item => item.nombre));
    if (proveedoresDuplicados > 0) {
      diagnos.push({
        id: 'proveedores-duplicados',
        titulo: 'Proveedores con nombre duplicado',
        detalle: `Se detectaron ${proveedoresDuplicados} nombres de proveedor repetidos.`,
        nivel: 'WARNING',
        referencia: 'Proveedores'
      });
    }

    const ventasSinDetalle = ventas.filter(item => item.detalles.length === 0).length;
    if (ventasSinDetalle > 0) {
      diagnos.push({
        id: 'ventas-sin-detalle',
        titulo: 'Ventas sin detalle',
        detalle: `Hay ${ventasSinDetalle} ventas registradas sin ítems asociados.`,
        nivel: 'ERROR',
        referencia: 'Ventas'
      });
    }

    const comprasSinDetalle = compras.filter(item => item.detalles.length === 0).length;
    if (comprasSinDetalle > 0) {
      diagnos.push({
        id: 'compras-sin-detalle',
        titulo: 'Compras sin detalle',
        detalle: `Hay ${comprasSinDetalle} compras registradas sin ítems asociados.`,
        nivel: 'ERROR',
        referencia: 'Compras'
      });
    }

    const cierresConDiferencia = cierres.filter(item => item.diferencia !== 0).length;
    if (cierresConDiferencia > 0) {
      diagnos.push({
        id: 'cierres-diferencia',
        titulo: 'Cierres de caja con diferencia',
        detalle: `Se detectaron ${cierresConDiferencia} cierres con diferencia respecto al saldo esperado.`,
        nivel: 'WARNING',
        referencia: 'Caja'
      });
    }

    const eventosCriticos = auditoria.filter(item => item.nivel === 'DANGER').length;
    if (eventosCriticos > 0) {
      diagnos.push({
        id: 'auditoria-critica',
        titulo: 'Eventos críticos en auditoría',
        detalle: `La bitácora contiene ${eventosCriticos} eventos marcados como críticos.`,
        nivel: 'ERROR',
        referencia: 'Auditoría'
      });
    }

    const usuariosInactivos = usuarios.filter(item => !item.activo).length;
    if (usuariosInactivos > 0) {
      diagnos.push({
        id: 'usuarios-inactivos',
        titulo: 'Usuarios inactivos presentes',
        detalle: `Hay ${usuariosInactivos} usuarios inactivos en el sistema.`,
        nivel: 'INFO',
        referencia: 'Usuarios'
      });
    }

    const proveedoresInactivos = proveedores.filter(item => !item.activo).length;
    if (proveedoresInactivos > 0) {
      diagnos.push({
        id: 'proveedores-inactivos',
        titulo: 'Proveedores inactivos registrados',
        detalle: `Hay ${proveedoresInactivos} proveedores en estado inactivo.`,
        nivel: 'INFO',
        referencia: 'Proveedores'
      });
    }

    if (Number(config.sesionMinutos) < 15) {
      diagnos.push({
        id: 'sesion-corta',
        titulo: 'Sesión configurada con duración baja',
        detalle: `La sesión actual está configurada en ${config.sesionMinutos} minutos.`,
        nivel: 'WARNING',
        referencia: 'Configuración'
      });
    }

    if (diagnos.length === 0) {
      diagnos.push({
        id: 'sin-hallazgos',
        titulo: 'Sin hallazgos críticos',
        detalle: 'No se detectan inconsistencias relevantes con las reglas básicas de mantenimiento.',
        nivel: 'INFO',
        referencia: 'Sistema'
      });
    }

    return diagnos;
  });

  reporteJson = computed(() => JSON.stringify({
    fecha: new Date().toISOString(),
    resumen: this.resumen(),
    diagnosticos: this.diagnosticos(),
    configuracion: this.configuracion()
  }, null, 2));

  limpiarOperaciones() {
    if (!this.confirmar('Se limpiarán ventas, compras, caja e inventario persistidos.')) {
      return;
    }

    this.mantenimientoService.limpiarOperaciones();
    this.mensaje.set('Operaciones persistidas limpiadas. La página se recargará para rehidratar los servicios.');
    this.recargar();
  }

  restablecerCatalogos() {
    if (!this.confirmar('Se restablecerán productos, usuarios y proveedores a sus valores base.')) {
      return;
    }

    this.mantenimientoService.restablecerCatalogosBase();
    this.mensaje.set('Catálogos base restablecidos. La página se recargará para aplicar el cambio.');
    this.recargar();
  }

  limpiarTrazabilidad() {
    if (!this.confirmar('Se limpiará la auditoría, los descartes de alertas y el respaldo cacheado.')) {
      return;
    }

    this.mantenimientoService.limpiarAuditoriaYAlertas();
    this.mensaje.set('Trazabilidad limpiada. La página se recargará para aplicar el cambio.');
    this.recargar();
  }

  reinicioControlado() {
    if (!this.confirmar('Se reiniciará el sistema manteniendo la configuración general persistida.')) {
      return;
    }

    this.mantenimientoService.reiniciarSistemaManteniendoConfiguracion();
    this.mensaje.set('Reinicio controlado ejecutado. La página se recargará para aplicar el cambio.');
    this.recargar();
  }

  reinicioTotal() {
    if (!this.confirmar('Se eliminarán todos los datos persistidos incluyendo configuración. Esta acción es agresiva.')) {
      return;
    }

    this.mantenimientoService.reiniciarTodoSistema();
    this.mensaje.set('Reinicio total ejecutado. La página se recargará para aplicar el cambio.');
    this.recargar();
  }

  exportarDiagnostico() {
    const fileName = `bodega_diagnostico_${new Date().toISOString().slice(0, 10)}.json`;
    this.mantenimientoService.exportarDiagnostico(fileName, this.reporteJson());
    this.mensaje.set(`Se exportó el diagnóstico como ${fileName}.`);
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

  private confirmar(mensaje: string): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.confirm(mensaje);
  }

  private recargar() {
    if (typeof window !== 'undefined') {
      window.setTimeout(() => window.location.reload(), 1200);
    }
  }
}
