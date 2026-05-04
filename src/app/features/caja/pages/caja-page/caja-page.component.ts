import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { CajaService } from '../../services/caja.service';
import { VentasService } from '../../../ventas/services/ventas.service';

@Component({
  selector: 'app-caja-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './caja-page.component.html',
  styleUrl: './caja-page.component.css'
})
export class CajaPageComponent {

  private cajaService = inject(CajaService);
  private ventasService = inject(VentasService);

  cajaActiva = this.cajaService.cajaActiva;
  cierres = this.cajaService.cierres;

  aperturaForm = signal({
    usuarioApertura: 'Administrador',
    montoInicial: 0
  });

  movimientoForm = signal({
    tipo: 'INGRESO' as 'INGRESO' | 'EGRESO',
    concepto: '',
    monto: 0
  });

  cierreForm = signal({
    usuarioCierre: 'Administrador',
    efectivoContado: 0,
    observacion: ''
  });

  enviadoApertura = signal(false);
  enviadoMovimiento = signal(false);
  enviadoCierre = signal(false);

  ventasEfectivo = computed(() => {
    const caja = this.cajaActiva();
    if (!caja) {
      return 0;
    }

    const aperturaMs = new Date(caja.fechaApertura).getTime();

    return this.ventasService.ventasLectura()
      .filter(venta =>
        venta.metodoPago === 'EFECTIVO' &&
        new Date(venta.fecha).getTime() >= aperturaMs
      )
      .reduce((sum, venta) => sum + venta.total, 0);
  });

  ingresosManual = computed(() => {
    const caja = this.cajaActiva();
    if (!caja) {
      return 0;
    }

    return caja.movimientos
      .filter((m: any) => m.tipo === 'INGRESO')
      .reduce((sum: number, m: any) => sum + m.monto, 0);
  });

  egresosManual = computed(() => {
    const caja = this.cajaActiva();
    if (!caja) {
      return 0;
    }

    return caja.movimientos
      .filter((m: any) => m.tipo === 'EGRESO')
      .reduce((sum: number, m: any) => sum + m.monto, 0);
  });

  saldoEsperado = computed(() => {
    const caja = this.cajaActiva();
    if (!caja) {
      return 0;
    }

    return caja.montoInicial + this.ventasEfectivo() + this.ingresosManual() - this.egresosManual();
  });

  actualizarAperturaTexto(campo: 'usuarioApertura', valor: string) {
    this.aperturaForm.update(actual => ({
      ...actual,
      [campo]: valor
    }));
  }

  actualizarAperturaNumero(campo: 'montoInicial', valor: string) {
    const numero = Number(valor);
    this.aperturaForm.update(actual => ({
      ...actual,
      [campo]: Number.isNaN(numero) ? 0 : numero
    }));
  }

  actualizarMovimientoTexto(campo: 'concepto', valor: string) {
    this.movimientoForm.update(actual => ({
      ...actual,
      [campo]: valor
    }));
  }

  actualizarMovimientoTipo(valor: 'INGRESO' | 'EGRESO') {
    this.movimientoForm.update(actual => ({
      ...actual,
      tipo: valor
    }));
  }

  actualizarMovimientoNumero(campo: 'monto', valor: string) {
    const numero = Number(valor);
    this.movimientoForm.update(actual => ({
      ...actual,
      [campo]: Number.isNaN(numero) ? 0 : numero
    }));
  }

  actualizarCierreTexto(campo: 'usuarioCierre' | 'observacion', valor: string) {
    this.cierreForm.update(actual => ({
      ...actual,
      [campo]: valor
    }));
  }

  actualizarCierreNumero(campo: 'efectivoContado', valor: string) {
    const numero = Number(valor);
    this.cierreForm.update(actual => ({
      ...actual,
      [campo]: Number.isNaN(numero) ? 0 : numero
    }));
  }

  abrirCaja(event?: Event) {
    event?.preventDefault();
    this.enviadoApertura.set(true);

    const form = this.aperturaForm();
    if (form.usuarioApertura.trim() === '' || form.montoInicial < 0) {
      return;
    }

    this.cajaService.abrirCaja(form.montoInicial, form.usuarioApertura.trim());

    this.aperturaForm.set({
      usuarioApertura: form.usuarioApertura.trim(),
      montoInicial: 0
    });

    this.enviadoApertura.set(false);
    this.movimientoForm.set({
      tipo: 'INGRESO',
      concepto: '',
      monto: 0
    });
    this.cierreForm.set({
      usuarioCierre: form.usuarioApertura.trim(),
      efectivoContado: 0,
      observacion: ''
    });
  }

  registrarMovimiento(event?: Event) {
    event?.preventDefault();
    this.enviadoMovimiento.set(true);

    const form = this.movimientoForm();
    if (!this.cajaActiva() || form.concepto.trim() === '' || form.monto <= 0) {
      return;
    }

    this.cajaService.registrarMovimiento(form.tipo, form.concepto.trim(), form.monto);

    this.movimientoForm.set({
      tipo: 'INGRESO',
      concepto: '',
      monto: 0
    });
    this.enviadoMovimiento.set(false);
  }

  cerrarCaja(event?: Event) {
    event?.preventDefault();
    this.enviadoCierre.set(true);

    const form = this.cierreForm();
    if (!this.cajaActiva() || form.usuarioCierre.trim() === '' || form.efectivoContado < 0) {
      return;
    }

    this.cajaService.cerrarCaja({
      usuarioCierre: form.usuarioCierre.trim(),
      ventasEfectivo: this.ventasEfectivo(),
      efectivoContado: form.efectivoContado,
      observacion: form.observacion.trim()
    });

    this.enviadoCierre.set(false);
    this.cierreForm.set({
      usuarioCierre: form.usuarioCierre.trim(),
      efectivoContado: 0,
      observacion: ''
    });
  }
}

