import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, email, form, maxLength, minLength, required } from '@angular/forms/signals';

interface UsuarioFormModel {
  nombre: string;
  correo: string;
  rol: string;
  activo: boolean;
}

interface UsuarioItem extends UsuarioFormModel {
  id: number;
}

@Component({
  selector: 'app-usuarios-page',
  imports: [FormField],
  templateUrl: './usuarios-page.component.html',
  styleUrl: './usuarios-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsuariosPageComponent {
  protected readonly usuarioModel = signal<UsuarioFormModel>({
    nombre: '',
    correo: '',
    rol: 'Cajero',
    activo: true
  });

  protected readonly usuarioForm = form(this.usuarioModel, (path) => {
    required(path.nombre, { message: 'El nombre es obligatorio.' });
    minLength(path.nombre, 3, { message: 'El nombre debe tener mínimo 3 caracteres.' });
    maxLength(path.nombre, 80, { message: 'El nombre debe tener máximo 80 caracteres.' });

    required(path.correo, { message: 'El correo es obligatorio.' });
    email(path.correo, { message: 'Debe ingresar un correo válido.' });

    required(path.rol, { message: 'El rol es obligatorio.' });
  });

  protected readonly usuarios = signal<UsuarioItem[]>([
    { id: 1, nombre: 'Administrador General', correo: 'admin@bodegasys.com', rol: 'Administrador', activo: true },
    { id: 2, nombre: 'Cajero Principal', correo: 'cajero@bodegasys.com', rol: 'Cajero', activo: true }
  ]);

  protected readonly totalUsuarios = computed(() => this.usuarios().length);
  protected readonly usuariosActivos = computed(() => this.usuarios().filter((usuario) => usuario.activo).length);
  protected readonly puedeGuardar = computed(() => {
    const usuario = this.usuarioModel();

    return (
      usuario.nombre.trim().length >= 3 &&
      usuario.correo.includes('@') &&
      usuario.rol.trim().length > 0
    );
  });

  protected guardar(): void {
    if (!this.puedeGuardar()) {
      return;
    }

    const usuario = this.usuarioModel();
    const nuevoUsuario: UsuarioItem = {
      id: Date.now(),
      nombre: usuario.nombre.trim(),
      correo: usuario.correo.trim(),
      rol: usuario.rol,
      activo: usuario.activo
    };

    this.usuarios.update((usuarios) => [nuevoUsuario, ...usuarios]);
    this.limpiar();
  }

  protected limpiar(): void {
    this.usuarioModel.set({
      nombre: '',
      correo: '',
      rol: 'Cajero',
      activo: true
    });
  }

  protected alternarEstado(usuarioId: number): void {
    this.usuarios.update((usuarios) =>
      usuarios.map((usuario) =>
        usuario.id === usuarioId ? { ...usuario, activo: !usuario.activo } : usuario
      )
    );
  }

  protected etiquetaRol(rol: string): string {
    return rol;
  }
}