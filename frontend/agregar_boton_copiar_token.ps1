$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " AGREGAR BOTON COPIAR TOKEN FIREBASE" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/. Ejecuta este script desde la raiz del proyecto." -ForegroundColor Red
    exit 1
}

$TsPath = Join-Path $Frontend "src/app/features/backend-test/pages/backend-test-page/backend-test-page.component.ts"
$HtmlPath = Join-Path $Frontend "src/app/features/backend-test/pages/backend-test-page/backend-test-page.component.html"

if (-not (Test-Path $TsPath)) {
    Write-Host "[ERROR] No existe:" -ForegroundColor Red
    Write-Host $TsPath -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $HtmlPath)) {
    Write-Host "[ERROR] No existe:" -ForegroundColor Red
    Write-Host $HtmlPath -ForegroundColor Red
    exit 1
}

Copy-Item $TsPath "$TsPath.bak" -Force
Copy-Item $HtmlPath "$HtmlPath.bak" -Force

Write-Host "[BACKUP] $TsPath -> $TsPath.bak" -ForegroundColor Yellow
Write-Host "[BACKUP] $HtmlPath -> $HtmlPath.bak" -ForegroundColor Yellow

$TsContent = Get-Content $TsPath -Raw
$HtmlContent = Get-Content $HtmlPath -Raw

# Verificar que el componente tenga AuthService inyectado
if ($TsContent -notmatch "AuthService") {
    Write-Host "[ERROR] El componente no tiene AuthService. Primero debe existir AuthService en backend-test-page.component.ts" -ForegroundColor Red
    exit 1
}

# Agregar metodo si no existe
if ($TsContent -notmatch "copiarTokenFirebase") {

$Method = @'

  async copiarTokenFirebase() {
    try {
      console.log('🔐 Solicitando token Firebase...');

      const token = await this.authService.getIdToken();

      if (!token) {
        const mensaje = 'No hay token Firebase. Inicia sesión nuevamente en /login.';

        console.error('❌', mensaje);

        this.error.set({
          prueba: 'Copiar token Firebase',
          error: {
            message: mensaje
          }
        });

        return;
      }

      const bearerToken = `Bearer ${token}`;

      await navigator.clipboard.writeText(bearerToken);

      console.log('✅ Token Firebase copiado al portapapeles.');
      console.log('📋 Pega este valor en Swagger authorization:', bearerToken);

      this.resultado.set({
        prueba: 'Copiar token Firebase',
        respuesta: {
          mensaje: 'Token copiado al portapapeles.',
          instrucciones: 'Ve a Swagger, abre /api/auth/me, pega el token en authorization y presiona Execute.',
          formato: 'Bearer <firebase_id_token>',
          longitudToken: token.length
        }
      });

      this.error.set(null);
    } catch (err: any) {
      console.error('❌ Error copiando token Firebase:', err);

      this.error.set({
        prueba: 'Copiar token Firebase',
        error: {
          message: err?.message ?? String(err),
          raw: err
        }
      });
    }
  }
'@

    # Insertar metodo antes de la ultima llave de la clase
    $TsContent = $TsContent -replace "\r?\n}\s*$", "$Method`r`n}"
    Set-Content -Path $TsPath -Value $TsContent -Encoding UTF8

    Write-Host "[OK] Metodo copiarTokenFirebase agregado." -ForegroundColor Green
} else {
    Write-Host "[SKIP] El metodo copiarTokenFirebase ya existe." -ForegroundColor Yellow
}

# Agregar boton en HTML si no existe
if ($HtmlContent -notmatch "copiarTokenFirebase") {

    $Button = @'

      <button type="button" (click)="copiarTokenFirebase()" [disabled]="cargando()">
        Copiar token Firebase
      </button>
'@

    # Insertar despues del boton Probar /api/auth/me si existe
    if ($HtmlContent -match "Probar /api/auth/me") {
        $HtmlContent = $HtmlContent -replace "(?s)(<button[^>]*\(click\)=""probarUsuarioActual\(\)""[^>]*>.*?Probar /api/auth/me.*?</button>)", "`$1$Button"
    } else {
        # Si no encuentra el boton, lo agrega dentro de actions
        $HtmlContent = $HtmlContent -replace "(<div class=""actions"">)", "`$1$Button"
    }

    Set-Content -Path $HtmlPath -Value $HtmlContent -Encoding UTF8
    Write-Host "[OK] Boton Copiar token Firebase agregado." -ForegroundColor Green
} else {
    Write-Host "[SKIP] El boton copiarTokenFirebase ya existe." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " LISTO" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora reinicia Angular:"
Write-Host "cd frontend"
Write-Host "ng serve -o"
Write-Host ""
Write-Host "Luego:"
Write-Host "1. Inicia sesion en /login"
Write-Host "2. Ve a /backend-test"
Write-Host "3. Clic en Copiar token Firebase"
Write-Host "4. Pega el valor en Swagger -> authorization"