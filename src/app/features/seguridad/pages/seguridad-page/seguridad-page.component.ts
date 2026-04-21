import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AuditoriaService } from '../../../auditoria/services/auditoria.service';
import { ConfiguracionService } from '../../../configuracion/services/configuracion.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-seguridad-page',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './seguridad-page.component.html',
  styleUrl: './seguridad-page.component.css'
})
export class SeguridadPageComponent implements OnDestroy {

  readonly authService = inject(AuthService);
  readonly configuracionService = inject(ConfiguracionService);
  readonly auditoriaService = inject(AuditoriaService);
  private readonly router = inject(Router);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  reloj = signal(Date.now());
  mensaje = signal('');

  configuracion = this.configuracionService.configuracionLectura;
  eventosAuth = computed(() => this.auditoriaService.eventosLectura().filter(evento => evento.modulo === 'AUTH'));

  authResumen = computed(() => {
    const hace7Dias = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recientes = this.eventosAuth().filter(evento => new Date(evento.fecha).getTime() >= hace7Dias);

    return {
      total: recientes.length,
      fallidos: recientes.filter(evento => evento.accion === 'LOGIN_FALLIDO').length,
      bloqueados: recientes.filter(evento => evento.accion === 'LOGIN_BLOQUEADO').length,
      expiradas: recientes.filter(evento => evento.accion === 'SESION_EXPIRADA').length,
      renovadas: recientes.filter(evento => evento.accion === 'SESION_RENOVADA').length
    };
  });

  tiempoRestanteSegundos = computed(() => {
    this.reloj();
    return Math.max(0, Math.floor(this.authService.tiempoRestanteMs() / 1000));
  });

  sesionActiva = computed(() => this.authService.sesion());

  constructor() {
    if (!this.authService.validarSesion()) {
      this.router.navigateByUrl('/login');
      return;
    }

    if (typeof window !== 'undefined') {
      this.intervalId = setInterval(() => {
        this.reloj.set(Date.now());

        if (!this.authService.validarSesion()) {
          this.mensaje.set('La sesión expiró y se redireccionará al login.');
          this.router.navigateByUrl('/login');
        }
      }, 1000);
    }
  }

  renovarSesion() {
    const ok = this.authService.renovarSesionManual();
    this.mensaje.set(ok ? 'La sesión fue renovada manualmente.' : 'No existe una sesión activa para renovar.');
  }

  validarSesionAhora() {
    const ok = this.authService.validarSesion();
    this.mensaje.set(ok ? 'La sesión sigue vigente.' : 'La sesión ya no es válida.');

    if (!ok) {
      this.router.navigateByUrl('/login');
    }
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
