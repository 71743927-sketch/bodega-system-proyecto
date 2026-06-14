import { Component, computed, inject, signal } from '@angular/core';
import { Proveedor } from '../../models/proveedor';
import { ProveedoresService } from '../../services/proveedores.service';

type ProveedorForm = {
  nombre: string;
  telefono: string;
  direccion: string;
  activo: boolean;
};

@Component({
  selector: 'app-proveedores-page',
  standalone: true,
  imports: [],
  templateUrl: './proveedores-page.component.html',
  styleUrl: './proveedores-page.component.css'
})
export class ProveedoresPageComponent {

  private proveedoresService = inject(ProveedoresService);

  proveedores = this.proveedoresService.proveedoresLectura;

  editandoId = signal<number | null>(null);
  enviado = signal(false);
  busqueda = signal('');
  filtroEstado = signal<'TODOS' | 'ACTIVOS' | 'INACTIVOS'>('TODOS');

  formulario = signal<ProveedorForm>({
    nombre: '',
    telefono: '',
    direccion: '',
    activo: true
  });

  totalProveedores = computed(() => this.proveedores().length);
  activos = computed(() => this.proveedores().filter(p => p.activo).length);
  inactivos = computed(() => this.proveedores().filter(p => !p.activo).length);

  proveedoresFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.filtroEstado();

    return this.proveedores().filter(proveedor => {
      const coincideTexto =
        texto === '' ||
        proveedor.nombre.toLowerCase().includes(texto) ||
        proveedor.telefono.toLowerCase().includes(texto) ||
        proveedor.direccion.toLowerCase().includes(texto);

      const coincideEstado =
        estado === 'TODOS' ||
        (estado === 'ACTIVOS' && proveedor.activo) ||
        (estado === 'INACTIVOS' && !proveedor.activo);

      return coincideTexto && coincideEstado;
    });
  });

  nombreDuplicado = computed(() => {
    const nombre = this.formulario().nombre.trim().toLowerCase();
    const editandoId = this.editandoId();

    if (nombre === '') {
      return false;
    }

    return this.proveedores().some(proveedor =>
      proveedor.nombre.trim().toLowerCase() === nombre &&
      proveedor.id !== editandoId
    );
  });

  formularioValido = computed(() => {
    const f = this.formulario();

    return (
      f.nombre.trim().length > 0 &&
      f.telefono.trim().length > 0 &&
      f.direccion.trim().length > 0 &&
      !this.nombreDuplicado()
    );
  });

  actualizarTexto(campo: 'nombre' | 'telefono' | 'direccion', valor: string) {
    this.formulario.update(actual => ({
      ...actual,
      [campo]: valor
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

  actualizarFiltroEstado(valor: 'TODOS' | 'ACTIVOS' | 'INACTIVOS') {
    this.filtroEstado.set(valor);
  }

  guardarProveedor(event?: Event) {
    event?.preventDefault();
    this.enviado.set(true);

    if (!this.formularioValido()) {
      return;
    }

    const data = this.formulario();

    if (this.editandoId() === null) {
      const nuevoProveedor: Proveedor = {
        id: this.proveedoresService.obtenerSiguienteId(),
        nombre: data.nombre.trim(),
        telefono: data.telefono.trim(),
        direccion: data.direccion.trim(),
        activo: data.activo
      };

      this.proveedoresService.agregarProveedor(nuevoProveedor);
    } else {
      const proveedorActualizado: Proveedor = {
        id: this.editandoId()!,
        nombre: data.nombre.trim(),
        telefono: data.telefono.trim(),
        direccion: data.direccion.trim(),
        activo: data.activo
      };

      this.proveedoresService.actualizarProveedor(proveedorActualizado);
    }

    this.limpiarFormulario();
  }

  editarProveedor(proveedor: Proveedor) {
    this.editandoId.set(proveedor.id);
    this.enviado.set(false);

    this.formulario.set({
      nombre: proveedor.nombre,
      telefono: proveedor.telefono,
      direccion: proveedor.direccion,
      activo: proveedor.activo
    });
  }

  eliminarProveedor(proveedor: Proveedor) {
    this.proveedoresService.eliminarProveedor(proveedor.id);

    if (this.editandoId() === proveedor.id) {
      this.limpiarFormulario();
    }
  }

  alternarEstado(proveedor: Proveedor) {
    this.proveedoresService.alternarEstado(proveedor.id);

    if (this.editandoId() === proveedor.id) {
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
      telefono: '',
      direccion: '',
      activo: true
    });
  }
}
