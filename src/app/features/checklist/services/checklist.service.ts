import { Injectable, inject } from '@angular/core';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';
import { ChecklistDiario, ChecklistItem, BloqueChecklist } from '../models/checklist-diario';

const STORAGE_PREFIX = 'bodega-checklist-diario-';

@Injectable({
  providedIn: 'root'
})
export class ChecklistService {

  private readonly auditoriaService = inject(AuditoriaService);

  obtenerChecklistDelDia(responsable: string): ChecklistDiario {
    const key = this.obtenerStorageKey();

    try {
      if (typeof localStorage === 'undefined') {
        return this.crearChecklistBase(responsable);
      }

      const raw = localStorage.getItem(key);
      if (!raw) {
        const nuevo = this.crearChecklistBase(responsable);
        this.guardarChecklist(nuevo);
        return nuevo;
      }

      const parsed = JSON.parse(raw) as ChecklistDiario;
      if (!Array.isArray(parsed.items)) {
        const nuevo = this.crearChecklistBase(responsable);
        this.guardarChecklist(nuevo);
        return nuevo;
      }

      return {
        ...parsed,
        responsable: parsed.responsable?.trim() || responsable,
        items: parsed.items.map(item => ({
          ...item,
          observacion: item.observacion ?? '',
          completado: Boolean(item.completado)
        }))
      };
    } catch {
      return this.crearChecklistBase(responsable);
    }
  }

  guardarChecklist(checklist: ChecklistDiario) {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(this.obtenerStorageKey(), JSON.stringify(checklist));
    } catch {
      // Ignorar errores de persistencia local
    }
  }

  alternarItem(checklist: ChecklistDiario, itemId: string): ChecklistDiario {
    const actualizado: ChecklistDiario = {
      ...checklist,
      updatedAt: new Date().toISOString(),
      items: checklist.items.map(item =>
        item.id === itemId
          ? { ...item, completado: !item.completado }
          : item
      )
    };

    const item = actualizado.items.find(x => x.id === itemId);
    if (item) {
      this.auditoriaService.registrar(
        'SISTEMA',
        'CHECKLIST_ITEM',
        `Checklist diario: ${item.titulo}`,
        item.completado ? 'SUCCESS' : 'INFO',
        `${item.bloque} · ${item.completado ? 'Completado' : 'Pendiente'}`,
        checklist.responsable
      );
    }

    this.guardarChecklist(actualizado);
    return actualizado;
  }

  actualizarObservacion(checklist: ChecklistDiario, itemId: string, observacion: string): ChecklistDiario {
    const actualizado: ChecklistDiario = {
      ...checklist,
      updatedAt: new Date().toISOString(),
      items: checklist.items.map(item =>
        item.id === itemId
          ? { ...item, observacion }
          : item
      )
    };

    this.guardarChecklist(actualizado);
    return actualizado;
  }

  completarBloque(checklist: ChecklistDiario, bloque: BloqueChecklist): ChecklistDiario {
    const actualizado: ChecklistDiario = {
      ...checklist,
      updatedAt: new Date().toISOString(),
      items: checklist.items.map(item =>
        item.bloque === bloque
          ? { ...item, completado: true }
          : item
      )
    };

    this.auditoriaService.registrar(
      'SISTEMA',
      'CHECKLIST_BLOQUE',
      `Se completó el bloque ${bloque} del checklist diario.`,
      'SUCCESS',
      `Fecha: ${actualizado.fecha}`,
      checklist.responsable
    );

    this.guardarChecklist(actualizado);
    return actualizado;
  }

  reiniciarChecklist(responsable: string): ChecklistDiario {
    const nuevo = this.crearChecklistBase(responsable);
    this.guardarChecklist(nuevo);
    this.auditoriaService.registrar(
      'SISTEMA',
      'CHECKLIST_REINICIAR',
      'Se reinició el checklist diario al estado base.',
      'WARNING',
      `Fecha: ${nuevo.fecha}`,
      responsable
    );
    return nuevo;
  }

  exportarChecklist(fileName: string, content: string) {
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

  private crearChecklistBase(responsable: string): ChecklistDiario {
    return {
      fecha: this.obtenerFechaLocal(),
      responsable,
      updatedAt: new Date().toISOString(),
      items: this.plantillaBase()
    };
  }

  private plantillaBase(): ChecklistItem[] {
    return [
      {
        id: 'apertura-1',
        bloque: 'APERTURA',
        orden: 1,
        titulo: 'Revisar salud general del sistema',
        detalle: 'Validar alertas críticas, eventos recientes y accesos del personal antes de iniciar operaciones.',
        referencia: 'Alertas / Seguridad / Auditoría',
        criticidad: 'ALTA',
        completado: false,
        observacion: ''
      },
      {
        id: 'apertura-2',
        bloque: 'APERTURA',
        orden: 2,
        titulo: 'Verificar caja activa o apertura pendiente',
        detalle: 'Confirmar que exista caja abierta y que el responsable del turno esté identificado.',
        referencia: 'Caja',
        criticidad: 'ALTA',
        completado: false,
        observacion: ''
      },
      {
        id: 'apertura-3',
        bloque: 'APERTURA',
        orden: 3,
        titulo: 'Revisar productos con stock crítico',
        detalle: 'Consultar si existen productos por debajo del mínimo y priorizar reposición.',
        referencia: 'Inventario / Productos',
        criticidad: 'MEDIA',
        completado: false,
        observacion: ''
      },
      {
        id: 'operacion-1',
        bloque: 'OPERACION',
        orden: 4,
        titulo: 'Registrar ventas del turno sin omisiones',
        detalle: 'Asegurar que todas las ventas sean registradas y que el método de pago sea correcto.',
        referencia: 'Ventas / Caja',
        criticidad: 'ALTA',
        completado: false,
        observacion: ''
      },
      {
        id: 'operacion-2',
        bloque: 'OPERACION',
        orden: 5,
        titulo: 'Controlar movimientos manuales de caja',
        detalle: 'Validar ingresos y egresos manuales para evitar diferencias al cierre.',
        referencia: 'Caja',
        criticidad: 'MEDIA',
        completado: false,
        observacion: ''
      },
      {
        id: 'operacion-3',
        bloque: 'OPERACION',
        orden: 6,
        titulo: 'Registrar compras o abastecimiento relevante',
        detalle: 'Documentar ingresos de mercadería, proveedor y observaciones importantes.',
        referencia: 'Compras / Proveedores',
        criticidad: 'MEDIA',
        completado: false,
        observacion: ''
      },
      {
        id: 'operacion-4',
        bloque: 'OPERACION',
        orden: 7,
        titulo: 'Monitorear inconsistencias del día',
        detalle: 'Revisar si hay warnings o hallazgos técnicos antes de que escalen.',
        referencia: 'Calidad / Auditoría',
        criticidad: 'MEDIA',
        completado: false,
        observacion: ''
      },
      {
        id: 'cierre-1',
        bloque: 'CIERRE',
        orden: 8,
        titulo: 'Validar cierre de caja y diferencia',
        detalle: 'Comparar efectivo contado con saldo esperado y registrar observaciones.',
        referencia: 'Caja',
        criticidad: 'ALTA',
        completado: false,
        observacion: ''
      },
      {
        id: 'cierre-2',
        bloque: 'CIERRE',
        orden: 9,
        titulo: 'Exportar o respaldar información del día',
        detalle: 'Generar respaldo o exportación si hubo operaciones relevantes o antes de mantenimiento.',
        referencia: 'Exportación / Respaldo',
        criticidad: 'MEDIA',
        completado: false,
        observacion: ''
      },
      {
        id: 'cierre-3',
        bloque: 'CIERRE',
        orden: 10,
        titulo: 'Registrar incidencias y pendientes',
        detalle: 'Dejar observaciones del turno para el siguiente responsable o supervisor.',
        referencia: 'Checklist / Auditoría',
        criticidad: 'BAJA',
        completado: false,
        observacion: ''
      }
    ];
  }

  private obtenerStorageKey(): string {
    return `${STORAGE_PREFIX}${this.obtenerFechaLocal()}`;
  }

  private obtenerFechaLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
