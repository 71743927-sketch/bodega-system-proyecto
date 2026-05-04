import { SweetAlertGlobalButtonService } from './services/sweet-alert-global-button.service';
import { inject } from '@angular/core';
import { FirebaseBootstrapService } from './core/firebase/firebase-bootstrap.service';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly firebaseBootstrap = inject(FirebaseBootstrapService);
  private readonly firebaseBootstrapForceRun = (() => {
    if (typeof window !== 'undefined') {
      queueMicrotask(() => void this.firebaseBootstrap.init());
    }
    return true;
  })();
}


