import { Injectable, signal, inject } from '@angular/core';
import { Usuario } from '../models/usuario';
import { AuditoriaService } from '../../auditoria/services/auditoria.service';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {

  private readonly auditoriaService = inject(AuditoriaService);

  private readonly _usuarios = signal<Usuario[]>([
    {
      id: 1,
      nombre: 'Clinton Janampa Navarro',
      username: 'clinton',
      rol: 'DUENO',
      telefono: '999999999',
      activo: true,
      observacion: 'Cuenta principal del dueño del negocio.'
    },
    {
      id: 2,
      nombre: 'María Pérez',
      username: 'maria',
      rol: 'CAJERO',
      telefono: '988111222',
      activo: true,
      observacion: 'Encargada del turno mañana.'
    },
    {
      id: 3,
      nombre: 'José Huamán',
      username: 'jose',
      rol: 'ALMACENERO',
      telefono: '977333444',
      activo: true,
      observacion: 'Control de reposición y mercadería.'
    },
    {
      id: 4,
      nombre: 'Rosa Quispe',
      username: 'rosa',
      rol: 'SUPERVISOR',
      telefono: '966555666',
      activo: false,
      observacion: 'Supervisión eventual de caja y atención.'
    }
  ]);

  usuariosLectura = this._usuarios.asReadonly();

  obtenerSiguienteId(): number {
    const lista = this._usuarios();
    return lista.length === 0 ? 1 : Math.max(...lista.map(usuario => usuario.id)) + 1;
  }

  agregarUsuario(usuario: Usuario) {
    this._usuarios.update(lista => [...lista, usuario]);

    this.auditoriaService.registrar(
      'USUARIOS',
      'CREAR',
      `Usuario creado: ${usuario.username}`,
      'SUCCESS',
      `Rol: ${usuario.rol}`
    );
  }

  actualizarUsuario(usuarioActualizado: Usuario) {
    this._usuarios.update(lista =>
      lista.map(usuario =>
        usuario.id === usuarioActualizado.id ? usuarioActualizado : usuario
      )
    );

    this.auditoriaService.registrar(
      'USUARIOS',
      'ACTUALIZAR',
      `Usuario actualizado: ${usuarioActualizado.username}`,
      'INFO',
      `Rol: ${usuarioActualizado.rol}`
    );
  }

  eliminarUsuario(id: number) {
    const usuario = this._usuarios().find(u => u.id === id);

    this._usuarios.update(lista => lista.filter(usuario => usuario.id !== id));

    if (usuario) {
      this.auditoriaService.registrar(
        'USUARIOS',
        'ELIMINAR',
        `Usuario eliminado: ${usuario.username}`,
        'DANGER',
        `Rol: ${usuario.rol}`
      );
    }
  }

  alternarEstado(id: number) {
    const usuarioActual = this._usuarios().find(u => u.id === id);

    if (!usuarioActual) {
      return;
    }

    const usuarioActualizado: Usuario = {
      ...usuarioActual,
      activo: !usuarioActual.activo
    };

    this._usuarios.update(lista =>
      lista.map(usuario =>
        usuario.id === id ? usuarioActualizado : usuario
      )
    );

    this.auditoriaService.registrar(
      'USUARIOS',
      'ESTADO',
      `Estado actualizado: ${usuarioActualizado.username}`,
      usuarioActualizado.activo ? 'SUCCESS' : 'WARNING',
      usuarioActualizado.activo ? 'Activo' : 'Inactivo'
    );
  }
}
