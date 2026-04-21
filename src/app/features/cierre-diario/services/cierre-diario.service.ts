import { Injectable, inject } from '@angular/core';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { CajaService } from '../../caja/services/caja.service';
import { ChecklistService } from '../../checklist/services/checklist.service';
import { ComprasService } from '../../compras/services/compras.service';
import { ConfiguracionService } from '../../configuracion/services/configuracion.service';
import { CalidadService } from '../../calidad/services/calidad.service';
import { ProductosService } from '../../productos/services/productos.service';
import { VentasService } from '../../ventas/services/ventas.service';
import { CierreDiarioReporte } from '../models/cierre-diario-report';

const STORAGE_KEY = 'bodega-cierre-diario-reportes';

@Injectable({
  providedIn: 'root'
})
export class CierreDiarioService {

  private readonly ventasService = inject(VentasService);
  private readonly comprasService = inject(ComprasService);
  private readonly productosService = inject(ProductosService);
  private readonly cajaService = inject(CajaService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly checklistService = inject(ChecklistService);
  private readonly calidadService = inject(CalidadService);
  private readonly configuracionService = inject(ConfiguracionService);

  generarReporte(responsable: string): CierreDiarioReporte {
    const fecha = this.obtenerFechaLocal();
    const ventasHoy = this.ventasService.ventasLectura().filter(item => this.normalizarFecha(item.fecha) === fecha);
    const comprasHoy = this.comprasService.comprasLectura().filter(item => this.normalizarFecha(item.fecha) === fecha);
    const cierresHoy = this.cajaService.cierres().filter(item => this.normalizarFecha(item.fechaCierre) === fecha);
    const eventosHoy = this.auditoriaService.eventosLectura().filter(item => this.normalizarFecha(item.fecha) === fecha);
    const stockCritico = this.productosService.productosLectura().filter(item => item.stockActual <= item.stockMinimo);
    const checklist = this.checklistService.obtenerChecklistDelDia(responsable);
    const completados = checklist.items.filter(item => item.completado).length;
    const porcentajeChecklist = checklist.items.length === 0 ? 0 : (completados / checklist.items.length) * 100;
    const pendientesCriticos = checklist.items.filter(item => item.criticidad === 'ALTA' && !item.completado);
    const hallazgos = this.calidadService.generarHallazgos();
    const warningsCalidad = hallazgos.filter(item => item.nivel === 'WARNING').length;
    const erroresCalidad = hallazgos.filter(item => item.nivel === 'ERROR').length;

    const observaciones: string[] = [];
    const pendientes: string[] = [];

    if (!this.cajaService.cajaActiva()) {
      observaciones.push('No existe caja activa al momento de generar el cierre diario.');
    }

    if (stockCritico.length > 0) {
      observaciones.push(`Se detectaron ${stockCritico.length} productos en stock crítico.`);
    }

    if (warningsCalidad > 0 || erroresCalidad > 0) {
      observaciones.push(`Calidad técnica reporta ${warningsCalidad} warnings y ${erroresCalidad} errores.`);
    }

    if (pendientesCriticos.length > 0) {
      pendientes.push(...pendientesCriticos.map(item => `${item.bloque}: ${item.titulo}`));
    }

    if (ventasHoy.length === 0) {
      pendientes.push('No se registraron ventas hoy; validar si hubo operaciones o si falta captura.');
    }

    if (comprasHoy.length === 0) {
      pendientes.push('No se registraron compras hoy; confirmar si no hubo abastecimiento.');
    }

    if (cierresHoy.some(item => item.diferencia !== 0)) {
      pendientes.push('Existen cierres de caja del día con diferencia respecto al saldo esperado.');
    }

    const totalVentas = ventasHoy.reduce((sum, item) => sum + item.total, 0);
    const totalCompras = comprasHoy.reduce((sum, item) => sum + item.total, 0);
    const diferenciaCajaPromedio = cierresHoy.length === 0
      ? 0
      : cierresHoy.reduce((sum, item) => sum + item.diferencia, 0) / cierresHoy.length;

    return {
      version: '1.0.0',
      generadoEn: new Date().toISOString(),
      contexto: {
        fecha,
        responsable,
        cajaActiva: this.cajaService.cajaActiva() !== null,
        checklistPorcentaje: porcentajeChecklist,
        checklistPendientesCriticos: pendientesCriticos.length,
        calidadWarnings: warningsCalidad,
        calidadErrores: erroresCalidad
      },
      metricas: {
        ventasCantidad: ventasHoy.length,
        ventasTotal: totalVentas,
        comprasCantidad: comprasHoy.length,
        comprasTotal: totalCompras,
        utilidadEstimada: totalVentas - totalCompras,
        productosStockCritico: stockCritico.length,
        eventosWarningHoy: eventosHoy.filter(item => item.nivel === 'WARNING').length,
        eventosCriticosHoy: eventosHoy.filter(item => item.nivel === 'DANGER').length,
        cierresCajaHoy: cierresHoy.length,
        diferenciaCajaPromedioHoy: diferenciaCajaPromedio
      },
      observaciones,
      pendientes
    };
  }

  guardarReporte(reporte: CierreDiarioReporte) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const lista = this.obtenerHistorial();
      const nueva = [reporte, ...lista.filter(item => item.contexto.fecha !== reporte.contexto.fecha)].slice(0, 30);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nueva));

      this.auditoriaService.registrar(
        'SISTEMA',
        'CIERRE_DIARIO_GENERAR',
        `Se generó cierre diario consolidado para ${reporte.contexto.fecha}.`,
        'SUCCESS',
        `Responsable: ${reporte.contexto.responsable}`,
        reporte.contexto.responsable
      );
    } catch {
      // Ignorar errores de persistencia local
    }
  }

  obtenerHistorial(): CierreDiarioReporte[] {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  exportarReporte(fileName: string, content: string) {
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

  private obtenerFechaLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private normalizarFecha(fechaIso: string): string {
    const d = new Date(fechaIso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
