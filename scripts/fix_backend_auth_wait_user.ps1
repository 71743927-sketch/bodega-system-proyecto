$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " FIX BACKEND AUTH - ESPERAR FIREBASE USER" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/" -ForegroundColor Red
    exit 1
}

$BackendAuthPath = Join-Path $Frontend "src/app/core/services/backend-auth.ts"

if (-not (Test-Path $BackendAuthPath)) {
    Write-Host "[ERROR] No existe backend-auth.ts" -ForegroundColor Red
    exit 1
}

Copy-Item $BackendAuthPath "$BackendAuthPath.bak" -Force
Write-Host "[BACKUP] $BackendAuthPath -> $BackendAuthPath.bak" -ForegroundColor Yellow

$BackendAuthContent = @'
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
      console.log('✅ Firebase currentUser ya existe:', auth.currentUser.email);
      return Promise.resolve(auth.currentUser);
    }

    console.log('⏳ Esperando restauración de sesión Firebase...');

    return new Promise<User>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error('No hay usuario Firebase autenticado después de esperar. Inicia sesión nuevamente.'));
      }, timeoutMs);

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        clearTimeout(timer);
        unsubscribe();

        if (user) {
          console.log('✅ Firebase user restaurado:', user.email);
          resolve(user);
        } else {
          reject(new Error('No hay usuario Firebase autenticado. Inicia sesión nuevamente.'));
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
          return throwError(() => new Error('Firebase no devolvió token.'));
        }

        console.log('🔐 Firebase ID Token obtenido. Longitud:', token.length);
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
        console.log('🚀 Llamando a backend auth/me:', url);
        return this.http.get(url, { headers });
      })
    );
  }
}
'@

Set-Content -Path $BackendAuthPath -Value $BackendAuthContent -Encoding UTF8

Write-Host "[OK] backend-auth.ts actualizado" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora reinicia Angular:"
Write-Host "cd frontend"
Write-Host "ng serve -o"