import { Component, computed, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { Router } from '@angular/router';
import { form, FormField } from '@angular/forms/signals';

import { AuthService } from '../../services/auth.service';
import { BackendAuthService } from '../../../../core/services/backend-auth';
import { BackendHealthService } from '../../../../core/services/backend-health';

interface LoginSignalFormModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormField, JsonPipe],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent {

  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly backendAuth = inject(BackendAuthService);
  private readonly backendHealth = inject(BackendHealthService);

  readonly loginModel = signal<LoginSignalFormModel>({
    email: '',
    password: ''
  });

  readonly loginForm = form(this.loginModel);

  readonly enviado = signal(false);
  readonly cargando = signal(false);
  readonly mensaje = signal('');

  readonly emailValue = computed(() => this.loginModel().email.trim());
  readonly passwordValue = computed(() => this.loginModel().password.trim());

  readonly emailRequerido = computed(() => this.emailValue().length === 0);
  readonly emailFormatoInvalido = computed(() => {
    const value = this.emailValue();
    if (!value) return false;
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  });

  readonly passwordRequerido = computed(() => this.passwordValue().length === 0);
  readonly passwordCorto = computed(() => {
    const value = this.passwordValue();
    if (!value) return false;
    return value.length < 6;
  });

  readonly formularioValido = computed(() =>
    !this.emailRequerido() &&
    !this.emailFormatoInvalido() &&
    !this.passwordRequerido() &&
    !this.passwordCorto()
  );

  constructor() {
    console.log('Login con Signal Forms cargado');

    this.backendHealth.health().subscribe({
      next: (res) => console.log('Backend OK:', res),
      error: (err) => console.error('Error health backend:', err)
    });

    if (this.authService.autenticado()) {
      this.router.navigateByUrl('/dashboard');
    }
  }

  async login() {
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Ingresa un correo valido y una contraseÃ±a de minimo 6 caracteres.');
      return;
    }

    this.cargando.set(true);

    const result = await this.authService.login(
      this.emailValue(),
      this.passwordValue()
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

