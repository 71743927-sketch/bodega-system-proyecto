import { Component, computed, inject, signal } from '@angular/core';
import { UsuariosService } from '../../services/usuarios.service';
import { RolUsuario, Usuario } from '../../models/usuario';

type UsuarioForm = {
  nombre: string;
  username: string;
  rol: RolUsuario;
  telefono: string;
  activo: boolean;
  observacion: string;
};

@Component({
  selector: 'app-usuarios-page',
  standalone: true,
  imports: [],
  templateUrl: './usuarios-page.component.html',
  styleUrl: './usuarios-page.component.css'
})
export class UsuariosPageComponent {

  private usuariosService = inject(UsuariosService);

  usuarios = this.usuariosService.usuariosLectura;

  editandoId = signal<number | null>(null);
  enviado = signal(false);
  busqueda = signal('');
  filtroRol = signal<'TODOS' | RolUsuario>('TODOS');

  roles: RolUsuario[] = ['DUENO', 'CAJERO', 'ALMACENERO', 'SUPERVISOR'];

  formulario = signal<UsuarioForm>({
    nombre: '',
    username: '',
    rol: 'CAJERO',
    telefono: '',
    activo: true,
    observacion: ''
  });

  totalUsuarios = computed(() => this.usuarios().length);
  totalActivos = computed(() => this.usuarios().filter(usuario => usuario.activo).length);
  totalInactivos = computed(() => this.usuarios().filter(usuario => !usuario.activo).length);
  totalCajeros = computed(() => this.usuarios().filter(usuario => usuario.rol === 'CAJERO').length);

  usuariosFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const rol = this.filtroRol();

    return this.usuarios().filter(usuario => {
      const coincideTexto =
        texto === '' ||
        usuario.nombre.toLowerCase().includes(texto) ||
        usuario.username.toLowerCase().includes(texto) ||
        usuario.telefono.toLowerCase().includes(texto);

      const coincideRol = rol === 'TODOS' || usuario.rol === rol;

      return coincideTexto && coincideRol;
    });
  });

  usernameDuplicado = computed(() => {
    const username = this.formulario().username.trim().toLowerCase();
    const editandoId = this.editandoId();

    if (username === '') {
      return false;
    }

    return this.usuarios().some(usuario =>
      usuario.username.trim().toLowerCase() === username &&
      usuario.id !== editandoId
    );
  });

  formularioValido = computed(() => {
    const f = this.formulario();

    return (
      f.nombre.trim().length > 0 &&
      f.username.trim().length > 0 &&
      f.telefono.trim().length > 0 &&
      !this.usernameDuplicado()
    );
  });

  actualizarTexto(campo: 'nombre' | 'username' | 'telefono' | 'observacion', valor: string) {
    this.formulario.update(actual => ({
      ...actual,
      [campo]: valor
    }));
  }

  actualizarRol(valor: RolUsuario) {
    this.formulario.update(actual => ({
      ...actual,
      rol: valor
    }));
  }

  actualizarActivo(valor: boolean) {
    this.formulario.update(actual => ({
      ...actual,
      activo: valor
    }));
  }

  actualizarBusqueda(valor: string) {
    this.busqueda.set(valor);
  }

  actualizarFiltroRol(valor: 'TODOS' | RolUsuario) {
    this.filtroRol.set(valor);
  }

  guardarUsuario(event?: Event) {
    event?.preventDefault();
    this.enviado.set(true);

    if (!this.formularioValido()) {
      return;
    }

    const data = this.formulario();

    if (this.editandoId() === null) {
      const nuevoUsuario: Usuario = {
        id: this.usuariosService.obtenerSiguienteId(),
        nombre: data.nombre.trim(),
        username: data.username.trim(),
        rol: data.rol,
        telefono: data.telefono.trim(),
        activo: data.activo,
        observacion: data.observacion.trim()
      };

      this.usuariosService.agregarUsuario(nuevoUsuario);
    } else {
      const usuarioActualizado: Usuario = {
        id: this.editandoId()!,
        nombre: data.nombre.trim(),
        username: data.username.trim(),
        rol: data.rol,
        telefono: data.telefono.trim(),
        activo: data.activo,
        observacion: data.observacion.trim()
      };

      this.usuariosService.actualizarUsuario(usuarioActualizado);
    }

    this.limpiarFormulario();
  }

  editarUsuario(usuario: Usuario) {
    this.editandoId.set(usuario.id);
    this.enviado.set(false);

    this.formulario.set({
      nombre: usuario.nombre,
      username: usuario.username,
      rol: usuario.rol,
      telefono: usuario.telefono,
      activo: usuario.activo,
      observacion: usuario.observacion
    });
  }

  eliminarUsuario(usuario: Usuario) {
    if (usuario.rol === 'DUENO') {
      return;
    }

    this.usuariosService.eliminarUsuario(usuario.id);

    if (this.editandoId() === usuario.id) {
      this.limpiarFormulario();
    }
  }

  alternarEstado(usuario: Usuario) {
    this.usuariosService.alternarEstado(usuario.id);

    if (this.editandoId() === usuario.id) {
      this.formulario.update(actual => ({
        ...actual,
        activo: !actual.activo
      }));
    }
  }

  limpiarFormulario() {
    this.editandoId.set(null);
    this.enviado.set(false);

    this.formulario.set({
      nombre: '',
      username: '',
      rol: 'CAJERO',
      telefono: '',
      activo: true,
      observacion: ''
    });
  }

  etiquetaRol(rol: RolUsuario): string {
    switch (rol) {
      case 'DUENO':
        return 'Dueño';
      case 'CAJERO':
        return 'Cajero';
      case 'ALMACENERO':
        return 'Almacenero';
      case 'SUPERVISOR':
        return 'Supervisor';
      default:
        return rol;
    }
  }
}
