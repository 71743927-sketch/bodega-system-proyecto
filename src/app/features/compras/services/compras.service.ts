import { Injectable, signal, inject } from '@angular/core';
import { Compra } from '../models/compra';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';

@Injectable({
  providedIn: 'root'
})
export class ComprasService {

  private readonly auditoriaService = inject(AuditoriaService);
  private readonly _compras = signal<Compra[]>([]);

  comprasLectura = this._compras.asReadonly();

  obtenerSiguienteId(): number {
    const lista = this._compras();
    return lista.length === 0 ? 1 : Math.max(...lista.map(c => c.id)) + 1;
  }

  registrarCompra(compra: Compra) {
    this._compras.update(lista => [compra, ...lista]);
    this.auditoriaService.registrar('COMPRAS', 'REGISTRAR', `Compra registrada #${compra.id}`, 'SUCCESS', `Proveedor: ${compra.proveedorNombre} · Total: S/ ${compra.total.toFixed(2)}`);
  }
}
