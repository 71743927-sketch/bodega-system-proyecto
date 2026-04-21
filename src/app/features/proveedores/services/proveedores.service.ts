import { Injectable, inject, signal } from '@angular/core';
import { Proveedor } from '../models/proveedor';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {

  private readonly auditoriaService = inject(AuditoriaService);

  private readonly _proveedores = signal<Proveedor[]>([
    {
      id: 1,
      nombre: 'Distribuidora Central SAC',
      telefono: '964123456',
      direccion: 'Av. Ferrocarril 1200',
      activo: true
    },
    {
      id: 2,
      nombre: 'Mayorista Los Andes',
      telefono: '971555333',
      direccion: 'Jr. Real 458',
      activo: true
    },
    {
      id: 3,
      nombre: 'Comercial Huanca',
      telefono: '987222111',
      direccion: 'Av. Huancavelica 845',
      activo: false
    }
  ]);

  proveedoresLectura = this._proveedores.asReadonly();

  obtenerSiguienteId(): number {
    const lista = this._proveedores();
    return lista.length === 0 ? 1 : Math.max(...lista.map(p => p.id)) + 1;
  }

  agregarProveedor(proveedor: Proveedor) {
    this._proveedores.update(lista => [...lista, proveedor]);
    this.auditoriaService.registrar(
      'SISTEMA',
      'PROVEEDOR_CREAR',
      `Proveedor creado: ${proveedor.nombre}`,
      'SUCCESS',
      `Teléfono: ${proveedor.telefono}`
    );
  }

  actualizarProveedor(proveedorActualizado: Proveedor) {
    const anterior = this._proveedores().find(p => p.id === proveedorActualizado.id);

    this._proveedores.update(lista =>
      lista.map(proveedor =>
        proveedor.id === proveedorActualizado.id ? proveedorActualizado : proveedor
      )
    );

    const metadata = anterior
      ? `Anterior: ${anterior.nombre} | Nuevo: ${proveedorActualizado.nombre}`
      : `Actualizado: ${proveedorActualizado.nombre}`;

    this.auditoriaService.registrar(
      'SISTEMA',
      'PROVEEDOR_ACTUALIZAR',
      `Proveedor actualizado: ${proveedorActualizado.nombre}`,
      'INFO',
      metadata
    );
  }

  eliminarProveedor(id: number) {
    const proveedor = this._proveedores().find(p => p.id === id);

    this._proveedores.update(lista => lista.filter(proveedor => proveedor.id !== id));

    if (proveedor) {
      this.auditoriaService.registrar(
        'SISTEMA',
        'PROVEEDOR_ELIMINAR',
        `Proveedor eliminado: ${proveedor.nombre}`,
        'DANGER',
        `ID: ${proveedor.id}`
      );
    }
  }

  alternarEstado(id: number) {
    const proveedorActual = this._proveedores().find(p => p.id === id);
    if (!proveedorActual) {
      return;
    }

    const proveedorActualizado: Proveedor = {
      ...proveedorActual,
      activo: !proveedorActual.activo
    };

    this._proveedores.update(lista =>
      lista.map(proveedor =>
        proveedor.id === id ? proveedorActualizado : proveedor
      )
    );

    this.auditoriaService.registrar(
      'SISTEMA',
      'PROVEEDOR_ESTADO',
      `Estado actualizado: ${proveedorActualizado.nombre}`,
      proveedorActualizado.activo ? 'SUCCESS' : 'WARNING',
      proveedorActualizado.activo ? 'Activo' : 'Inactivo'
    );
  }
}
