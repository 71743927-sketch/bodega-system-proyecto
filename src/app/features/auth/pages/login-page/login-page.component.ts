import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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

  username = signal('');
  mensaje = signal('');
  enviado = signal(false);
  cargando = signal(false);

  formularioValido = computed(() => this.username().trim().length > 0);

  constructor() {
    if (this.authService.autenticado()) {
      this.router.navigateByUrl('/dashboard');
    }
  }

  actualizarUsername(valor: string) {
    this.username.set(valor);
  }

  login(event?: Event) {
    event?.preventDefault();
    this.enviado.set(true);
    this.mensaje.set('');

    if (!this.formularioValido()) {
      this.mensaje.set('Ingresa un nombre de usuario válido.');
      return;
    }

    this.cargando.set(true);

    const result = this.authService.login(this.username().trim());

    this.cargando.set(false);
    this.mensaje.set(result.message);

    if (result.success) {
      this.router.navigateByUrl('/dashboard');
    }
  }
}

