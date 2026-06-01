import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class BackendHealthService {

  private readonly apiUrl = API_CONFIG.baseUrl;

  constructor(private http: HttpClient) {
    console.log('ðŸ”¥ BackendHealthService creado');
  }

  health(): Observable<any> {
    const url = `${this.apiUrl}/health`;
    console.log('ðŸš€ Llamando a backend:', url);
    return this.http.get(url);
  }
}
