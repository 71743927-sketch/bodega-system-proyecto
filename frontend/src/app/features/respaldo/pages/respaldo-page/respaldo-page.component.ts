import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { RespaldoSistema } from '../../models/respaldo-sistema';
import { RespaldoService } from '../../services/respaldo.service';

@Component({
  selector: 'app-respaldo-page',
  standalone: true,
  imports: [DatePipe, JsonPipe],
  templateUrl: './respaldo-page.component.html',
  styleUrl: './respaldo-page.component.css'
})
export class RespaldoPageComponent {

  private respaldoService = inject(RespaldoService);
  private authService = inject(AuthService);

  notas = signal('Respaldo manual generado desde el módulo de respaldo.');
  mensaje = signal('');
  ultimoArchivo = signal('');
  respaldoImportado = signal<RespaldoSistema | null>(this.respaldoService.cargarUltimoRespaldo());

  resumenActual = computed(() => {
    const snap = this.respaldoService.generarRespaldo(this.authService.usernameActual() || 'Sistema', this.notas());
    return {
      productos: snap.productos.length,
      ventas: snap.ventas.length,
      compras: snap.compras.length,
      proveedores: snap.proveedores.length,
      usuarios: snap.usuarios.length,
      movimientos: snap.movimientosInventario.length,
      cierresCaja: snap.cierresCaja.length,
      auditoria: snap.auditoria.length,
      alertasDescartadas: snap.alertasDescartadas.length
    };
  });

  resumenImportado = computed(() => {
    const snap = this.respaldoImportado();
    if (!snap) {
      return null;
    }

    return {
      productos: snap.productos.length,
      ventas: snap.ventas.length,
      compras: snap.compras.length,
      proveedores: snap.proveedores.length,
      usuarios: snap.usuarios.length,
      movimientos: snap.movimientosInventario.length,
      cierresCaja: snap.cierresCaja.length,
      auditoria: snap.auditoria.length,
      alertasDescartadas: snap.alertasDescartadas.length
    };
  });

  actualizarNotas(valor: string) {
    this.notas.set(valor);
  }

  exportarRespaldo() {
    const respaldo = this.respaldoService.generarRespaldo(this.authService.usernameActual() || 'Sistema', this.notas());
    const fileName = `bodega_respaldo_${new Date().toISOString().slice(0, 10)}.json`;
    const content = this.respaldoService.serializar(respaldo);

    this.respaldoService.descargar(fileName, content);
    this.respaldoService.guardarUltimoRespaldo(respaldo);
    this.respaldoImportado.set(respaldo);
    this.ultimoArchivo.set(fileName);
    this.mensaje.set(`Se generó el respaldo ${fileName}.`);
  }

  async importarArchivo(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = this.respaldoService.parsear(text);
      this.respaldoImportado.set(parsed);
      this.ultimoArchivo.set(file.name);
      this.mensaje.set(`Archivo cargado correctamente: ${file.name}.`);
    } catch {
      this.mensaje.set('No se pudo leer el archivo de respaldo. Verifica que sea JSON válido.');
    }
  }

  aplicarRespaldo() {
    const snap = this.respaldoImportado();
    if (!snap) {
      this.mensaje.set('No hay respaldo cargado para aplicar.');
      return;
    }

    this.respaldoService.aplicarRespaldo(snap);
    this.mensaje.set('El respaldo fue aplicado. Algunos cambios podrían requerir navegación o recarga de módulos para reflejarse por completo.');
  }

  limpiarImportado() {
    this.respaldoImportado.set(null);
    this.ultimoArchivo.set('');
    this.mensaje.set('Se limpió la vista previa del respaldo importado.');
  }
}
