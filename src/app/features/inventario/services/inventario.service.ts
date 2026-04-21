import { Injectable, signal, inject } from '@angular/core';
import { MovimientoInventario } from '../models/movimiento-inventario';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';

@Injectable({
  providedIn: 'root'
})
export class InventarioService {

  private readonly auditoriaService = inject(AuditoriaService);
  private readonly _movimientos = signal<MovimientoInventario[]>([]);

  movimientosLectura = this._movimientos.asReadonly();

  obtenerSiguienteId(): number {
    const lista = this._movimientos();
    return lista.length === 0 ? 1 : Math.max(...lista.map(m => m.id)) + 1;
  }

  registrarMovimiento(movimiento: MovimientoInventario) {
    this._movimientos.update(lista => [movimiento, ...lista]);
    const nivel = movimiento.tipo === 'SALIDA' ? 'WARNING' : (movimiento.tipo === 'AJUSTE' ? 'INFO' : 'SUCCESS');
    this.auditoriaService.registrar('INVENTARIO', movimiento.tipo, `${movimiento.productoNombre}`, nivel, `${movimiento.stockAnterior} → ${movimiento.stockNuevo}`);
  }
}
