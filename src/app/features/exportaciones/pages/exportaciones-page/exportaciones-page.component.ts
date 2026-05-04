import { CurrencyPipe, DatePipe, KeyValuePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuditoriaService } from '../../../auditoria/services/auditoria.service';
import { CajaService } from '../../../caja/services/caja.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { UsuariosService } from '../../../usuarios/services/usuarios.service';
import { VentasService } from '../../../ventas/services/ventas.service';
import { DatasetExportable, OpcionExportacion } from '../../models/dataset-exportable';
import { ExportacionesService } from '../../services/exportaciones.service';

@Component({
  selector: 'app-exportaciones-page',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './exportaciones-page.component.html',
  styleUrl: './exportaciones-page.component.css'
})
export class ExportacionesPageComponent {

  private ventasService = inject(VentasService);
  private comprasService = inject(ComprasService);
  private productosService = inject(ProductosService);
  private usuariosService = inject(UsuariosService);
  private cajaService = inject(CajaService);
  private auditoriaService = inject(AuditoriaService);
  private exportacionesService = inject(ExportacionesService);

  ventas = this.ventasService.ventasLectura;
  compras = this.comprasService.comprasLectura;
  productos = this.productosService.productosLectura;
  usuarios = this.usuariosService.usuariosLectura;
  cierresCaja = this.cajaService.cierres;
  eventosAuditoria = this.auditoriaService.eventosLectura;

  opciones: OpcionExportacion[] = [
    { key: 'RESUMEN', titulo: 'Resumen ejecutivo', descripcion: 'Indicadores consolidados del sistema.' },
    { key: 'VENTAS', titulo: 'Ventas', descripcion: 'Ventas registradas con método de pago y total.' },
    { key: 'COMPRAS', titulo: 'Compras', descripcion: 'Compras registradas con proveedor y totales.' },
    { key: 'PRODUCTOS', titulo: 'Productos', descripcion: 'Catálogo y estado actual del inventario.' },
    { key: 'USUARIOS', titulo: 'Usuarios', descripcion: 'Usuarios del sistema y sus roles.' },
    { key: 'CIERRES_CAJA', titulo: 'Cierres de caja', descripcion: 'Historial de cierres y diferencias.' },
    { key: 'AUDITORIA', titulo: 'Auditoría', descripcion: 'Bitácora de eventos relevantes del sistema.' }
  ];

  datasetSeleccionado = signal<DatasetExportable>('RESUMEN');
  fechaInicio = signal('');
  fechaFin = signal('');
  mensaje = signal('');
  ultimoArchivo = signal('');

  cantidadVentas = computed(() => this.ventas().length);
  cantidadCompras = computed(() => this.compras().length);
  cantidadProductos = computed(() => this.productos().length);
  cantidadUsuarios = computed(() => this.usuarios().length);
  totalVentas = computed(() => this.ventas().reduce((sum, item) => sum + item.total, 0));
  totalCompras = computed(() => this.compras().reduce((sum, item) => sum + item.total, 0));

  private normalizarInicio(fecha: string): number | null {
    if (fecha.trim() === '') {
      return null;
    }

    const d = new Date(fecha + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  private normalizarFin(fecha: string): number | null {
    if (fecha.trim() === '') {
      return null;
    }

    const d = new Date(fecha + 'T23:59:59');
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  private estaEnRango(fechaIso: string): boolean {
    const fechaMs = new Date(fechaIso).getTime();
    const inicio = this.normalizarInicio(this.fechaInicio());
    const fin = this.normalizarFin(this.fechaFin());

    if (inicio !== null && fechaMs < inicio) {
      return false;
    }

    if (fin !== null && fechaMs > fin) {
      return false;
    }

    return true;
  }

  datasetRows = computed<Record<string, unknown>[]>(() => {
    switch (this.datasetSeleccionado()) {
      case 'RESUMEN':
        return [
          {
            fechaGeneracion: new Date().toISOString(),
            totalVentas: this.totalVentas(),
            totalCompras: this.totalCompras(),
            utilidadAproximada: this.totalVentas() - this.totalCompras(),
            cantidadVentas: this.cantidadVentas(),
            cantidadCompras: this.cantidadCompras(),
            cantidadProductos: this.cantidadProductos(),
            cantidadUsuarios: this.cantidadUsuarios(),
            cierresCaja: this.cierresCaja().length,
            eventosAuditoria: this.eventosAuditoria().length
          }
        ];

      case 'VENTAS':
        return this.ventas()
          .filter((item: any) => this.estaEnRango(item.fecha))
          .map((item: any) => ({
            id: item.id,
            fecha: item.fecha,
            metodoPago: item.metodoPago,
            total: item.total,
            cantidadItems: item.detalles.length,
            detalleResumen: item.detalles.map((d: any) => `${d.nombre} x${d.cantidad}`).join(' | ')
          }));

      case 'COMPRAS':
        return this.compras()
          .filter((item: any) => this.estaEnRango(item.fecha))
          .map((item: any) => ({
            id: item.id,
            fecha: item.fecha,
            proveedor: item.proveedorNombre,
            usuario: item.usuario,
            total: item.total,
            cantidadItems: item.detalles.length,
            observacion: item.observacion
          }));

      case 'PRODUCTOS':
        return this.productos().map((item: any) => ({
          id: item.id,
          codigo: item.codigo,
          nombre: item.nombre,
          categoria: item.categoria,
          precioCompra: item.precioCompra,
          precioVenta: item.precioVenta,
          stockActual: item.stockActual,
          stockMinimo: item.stockMinimo,
          activo: item.activo
        }));

      case 'USUARIOS':
        return this.usuarios().map((item: any) => ({
          id: item.id,
          nombre: item.nombre,
          username: item.username,
          rol: item.rol,
          telefono: item.telefono,
          activo: item.activo,
          observacion: item.observacion
        }));

      case 'CIERRES_CAJA':
        return this.cierresCaja()
          .filter((item: any) => this.estaEnRango(item.fechaCierre))
          .map((item: any) => ({
            id: item.id,
            fechaApertura: item.fechaApertura,
            fechaCierre: item.fechaCierre,
            usuarioApertura: item.usuarioApertura,
            usuarioCierre: item.usuarioCierre,
            montoInicial: item.montoInicial,
            ventasEfectivo: item.ventasEfectivo,
            ingresosManual: item.ingresosManual,
            egresosManual: item.egresosManual,
            saldoEsperado: item.saldoEsperado,
            efectivoContado: item.efectivoContado,
            diferencia: item.diferencia,
            observacion: item.observacion
          }));

      case 'AUDITORIA':
        return this.eventosAuditoria()
          .filter((item: any) => this.estaEnRango(item.fecha))
          .map((item: any) => ({
            id: item.id,
            fecha: item.fecha,
            modulo: item.modulo,
            accion: item.accion,
            detalle: item.detalle,
            usuario: item.usuario,
            nivel: item.nivel,
            metadata: item.metadata
          }));

      default:
        return [];
    }
  });

  previewColumns = computed(() => {
    const rows = this.datasetRows();
    return rows.length === 0 ? [] : Object.keys(rows[0]);
  });

  previewRows = computed(() => this.datasetRows().slice(0, 10));

  actualizarDataset(valor: DatasetExportable) {
    this.datasetSeleccionado.set(valor);
    this.mensaje.set('');
  }

  actualizarFechaInicio(valor: string) {
    this.fechaInicio.set(valor);
  }

  actualizarFechaFin(valor: string) {
    this.fechaFin.set(valor);
  }

  limpiarFiltros() {
    this.fechaInicio.set('');
    this.fechaFin.set('');
    this.mensaje.set('Filtros limpiados.');
  }

  exportarJson() {
    const rows = this.datasetRows();
    const dataset = this.datasetSeleccionado().toLowerCase();
    const fileName = `bodega_${dataset}_${new Date().toISOString().slice(0, 10)}.json`;
    const content = this.exportacionesService.convertirJson(rows);

    this.exportacionesService.descargarArchivo(fileName, content, 'application/json;charset=utf-8');
    this.ultimoArchivo.set(fileName);
    this.mensaje.set(`Se generó el archivo ${fileName}.`);

    this.auditoriaService.registrar(
      'SISTEMA',
      'EXPORTAR_JSON',
      `Exportación JSON ejecutada para ${this.datasetSeleccionado()}`,
      'SUCCESS',
      fileName
    );
  }

  exportarCsv() {
    const rows = this.datasetRows();
    const dataset = this.datasetSeleccionado().toLowerCase();
    const fileName = `bodega_${dataset}_${new Date().toISOString().slice(0, 10)}.csv`;
    const content = this.exportacionesService.convertirCsv(rows);

    this.exportacionesService.descargarArchivo(fileName, content, 'text/csv;charset=utf-8');
    this.ultimoArchivo.set(fileName);
    this.mensaje.set(`Se generó el archivo ${fileName}.`);

    this.auditoriaService.registrar(
      'SISTEMA',
      'EXPORTAR_CSV',
      `Exportación CSV ejecutada para ${this.datasetSeleccionado()}`,
      'SUCCESS',
      fileName
    );
  }
}




