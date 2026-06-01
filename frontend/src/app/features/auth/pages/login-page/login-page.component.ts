import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { BackendAuthService } from '../../../../core/services/backend-auth';
import { BackendHealthService } from '../../../../core/services/backend-health';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent {

  readonly authService = inject(AuthService);
  private router = inject(Router);
  private backendAuth = inject(BackendAuthService);
  private backendHealth = inject(BackendHealthService);

  email = signal('');
  password = signal('');
  mensaje = signal('');
  enviado = signal(false);
  cargando = signal(false);

  formularioValido = computed(() =>
    this.email().trim().length > 0 && this.password().trim().length > 0
  );

  constructor() {
    console.log('Login Firebase real cargado');

    this.backendHealth.health().subscribe({
      next: (res) => console.log('Backend OK:', res),
      error: (err) => console.error('Error health backend:', err)
    });

    if (this.authService.autenticado()) {
      this.router.navigateByUrl('/dashboard');
    }
  }

  actualizarEmail(valor: string) {
    this.email.set(valor);
  }

  actualizarPassword(valor: string) {
    this.password.set(valor);
  }

  async login(event?: Event) {
    event?.preventDefault();
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Ingresa correo y contraseÃ±a.');
      return;
    }

    this.cargando.set(true);

    const result = await this.authService.login(
      this.email().trim(),
      this.password().trim()
    );

    this.cargando.set(false);
    this.mensaje.set(result.message);

    if (result.success) {
      this.backendAuth.me().subscribe({
        next: (res) => {
          console.log('Usuario validado por backend:', res);
          this.router.navigateByUrl('/dashboard');
        },
        error: (err) => {
          console.error('Error validando usuario en backend:', err);
          this.router.navigateByUrl('/dashboard');
        }
      });
    }
  }
}
