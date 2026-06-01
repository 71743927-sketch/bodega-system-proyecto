import { Component, OnInit } from '@angular/core';
import { BackendHealthService } from './core/services/backend-health';

@Component({
  selector: 'app-root',
  template: `<h1>Revisa consola</h1>`
})
export class AppComponent implements OnInit {

  constructor(private backend: BackendHealthService) {}

  ngOnInit() {
    this.backend.health().subscribe({
      next: (res) => console.log('✅ Backend OK:', res),
      error: (err) => console.error('❌ Error:', err)
    });
  }
}
