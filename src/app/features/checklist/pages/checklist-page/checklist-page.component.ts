import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { AlertasService } from '../../../alertas/services/alertas.service';
import { AuditoriaService } from '../../../auditoria/services/auditoria.service';
import { CajaService } from '../../../caja/services/caja.service';
import { ComprasService } from '../../../compras/services/compras.service';
import { ConfiguracionService } from '../../../configuracion/services/configuracion.service';
import { ProductosService } from '../../../productos/services/productos.service';
import { VentasService } from '../../../ventas/services/ventas.service';
import { BloqueChecklist, ChecklistDiario } from '../../models/checklist-diario';
import { ChecklistService } from '../../services/checklist.service';

@Component({
  selector: 'app-checklist-page',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './checklist-page.component.html',
  styleUrl: './checklist-page.component.css'
})
export class ChecklistPageComponent {

  private readonly checklistService = inject(ChecklistService);
  private readonly authService = inject(AuthService);
  private readonly ventasService = inject(VentasService);
  private readonly comprasService = inject(ComprasService);
  private readonly productosService = inject(ProductosService);
  private readonly cajaService = inject(CajaService);
  private readonly auditoriaService = inject(AuditoriaService);
  private readonly configuracionService = inject(ConfiguracionService);
  private readonly alertasService = inject(AlertasService);

  mensaje = signal('');
  checklist = signal<ChecklistDiario>(
    this.checklistService.obtenerChecklistDelDia(this.authService.usernameActual() || 'Sistema')
  );

  ventas = this.ventasService.ventasLectura;
  compras = this.comprasService.comprasLectura;
  productos = this.productosService.productosLectura;
  cajaActiva = this.cajaService.cajaActiva;
  cierresCaja = this.cajaService.cierres;
  eventosAuditoria = this.auditoriaService.eventosLectura;
  configuracion = this.configuracionService.configuracionLectura;
  alertasDescartadas = this.alertasService.descartadas;

  aperturaItems = computed(() => this.ordenarBloque('APERTURA'));
  operacionItems = computed(() => this.ordenarBloque('OPERACION'));
  cierreItems = computed(() => this.ordenarBloque('CIERRE'));

  progresoTotal = computed(() => {
    const total = this.checklist().items.length;
    const completados = this.checklist().items.filter((item: any) => item.completado).length;
    return {
      total,
      completados,
      porcentaje: total === 0 ? 0 : (completados / total) * 100
    };
  });

  pendientesCriticos = computed(() =>
    this.checklist().items.filter((item: any) => item.criticidad === 'ALTA' && !item.completado).length
  );

  contexto = computed(() => {
    const hoy = this.obtenerFechaLocal();
    const ventasHoy = this.ventas().filter((item: any) => this.normalizarFecha(item.fecha) === hoy);
    const comprasHoy = this.compras().filter((item: any) => this.normalizarFecha(item.fecha) === hoy);
    const eventosHoy = this.eventosAuditoria().filter((item: any) => this.normalizarFecha(item.fecha) === hoy);
    const stockCritico = this.productos().filter((item: any) => item.stockActual <= item.stockMinimo);

    return {
      hoy,
      ventasHoy: ventasHoy.length,
      comprasHoy: comprasHoy.length,
      totalVentasHoy: ventasHoy.reduce((sum, item) => sum + item.total, 0),
      stockCritico: stockCritico.length,
      warningsHoy: eventosHoy.filter((item: any) => item.nivel === 'WARNING').length,
      criticosHoy: eventosHoy.filter((item: any) => item.nivel === 'DANGER').length,
      cajaActiva: this.cajaActiva() !== null,
      cierreRecienteConDiferencia: this.cierresCaja().slice(0, 1).some((item: any) => item.diferencia !== 0),
      alertasDescartadas: this.alertasDescartadas().length
    };
  });

  recomendaciones = computed(() => {
    const c = this.contexto();
    const lista: string[] = [];

    if (!c.cajaActiva) {
      lista.push('No hay caja activa: verifica apertura del turno antes de seguir operando.');
    }

    if (c.stockCritico > 0) {
      lista.push(`Existen ${c.stockCritico} productos en estado crítico: prioriza reposición o control de ventas.`);
    }

    if (c.criticosHoy > 0) {
      lista.push(`Se detectaron ${c.criticosHoy} eventos críticos hoy: revisa auditoría y calidad técnica.`);
    }

    if (c.cierreRecienteConDiferencia) {
      lista.push('El último cierre de caja tuvo diferencia: revisa movimientos manuales y efectivo contado.');
    }

    if (c.ventasHoy === 0) {
      lista.push('Aún no se registran ventas hoy: valida si el negocio ya inició operaciones o si falta captura.');
    }

    if (lista.length === 0) {
      lista.push('No hay señales operativas delicadas en este momento. Continúa con el flujo normal del checklist.');
    }

    return lista;
  });

  alternarItem(itemId: string) {
    this.checklist.set(this.checklistService.alternarItem(this.checklist(), itemId));
    this.mensaje.set('Checklist actualizado.');
  }

  actualizarObservacion(itemId: string, observacion: string) {
    this.checklist.set(this.checklistService.actualizarObservacion(this.checklist(), itemId, observacion));
  }

  completarBloque(bloque: BloqueChecklist) {
    this.checklist.set(this.checklistService.completarBloque(this.checklist(), bloque));
    this.mensaje.set(`Bloque ${bloque} completado.`);
  }

  reiniciarChecklist() {
    if (typeof window !== 'undefined' && !window.confirm('Se reiniciará el checklist del día actual. ¿Deseas continuar?')) {
      return;
    }

    this.checklist.set(this.checklistService.reiniciarChecklist(this.authService.usernameActual() || 'Sistema'));
    this.mensaje.set('Checklist diario reiniciado.');
  }

  exportarChecklist() {
    const fileName = `bodega_checklist_${this.checklist().fecha}.json`;
    this.checklistService.exportarChecklist(fileName, JSON.stringify(this.checklist(), null, 2));
    this.mensaje.set(`Se exportó el checklist como ${fileName}.`);
  }

  private ordenarBloque(bloque: BloqueChecklist) {
    return this.checklist().items
      .filter((item: any) => item.bloque === bloque)
      .sort((a, b) => a.orden - b.orden);
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



