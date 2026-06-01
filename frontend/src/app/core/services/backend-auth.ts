import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

import { API_CONFIG } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class BackendAuthService {

  private readonly apiUrl = API_CONFIG.baseUrl;

  constructor(private http: HttpClient) {}

  private esperarUsuarioFirebase(timeoutMs = 8000): Promise<User> {
    const auth = getAuth();

    if (auth.currentUser) {
      console.log('âœ… Firebase currentUser ya existe:', auth.currentUser.email);
      return Promise.resolve(auth.currentUser);
    }

    console.log('â³ Esperando restauraciÃ³n de sesiÃ³n Firebase...');

    return new Promise<User>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error('No hay usuario Firebase autenticado despuÃ©s de esperar. Inicia sesiÃ³n nuevamente.'));
      }, timeoutMs);

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        clearTimeout(timer);
        unsubscribe();

        if (user) {
          console.log('âœ… Firebase user restaurado:', user.email);
          resolve(user);
        } else {
          reject(new Error('No hay usuario Firebase autenticado. Inicia sesiÃ³n nuevamente.'));
        }
      });
    });
  }

  getFirebaseIdToken(): Observable<string> {
    return from(this.esperarUsuarioFirebase()).pipe(
      switchMap((user) => {
        return from(user.getIdToken(true));
      }),
      switchMap((token) => {
        if (!token) {
          return throwError(() => new Error('Firebase no devolviÃ³ token.'));
        }

        console.log('ðŸ” Firebase ID Token obtenido. Longitud:', token.length);
        return from([token]);
      })
    );
  }

  authHeaders(): Observable<HttpHeaders> {
    return this.getFirebaseIdToken().pipe(
      switchMap((token) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`
        });

        return from([headers]);
      })
    );
  }

  me(): Observable<any> {
    return this.authHeaders().pipe(
      switchMap((headers) => {
        const url = `${this.apiUrl}/auth/me`;
        console.log('ðŸš€ Llamando a backend auth/me:', url);
        return this.http.get(url, { headers });
      })
    );
  }
}
