$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"
$Backend = Join-Path $Root "backend"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Quarantine = Join-Path $Root ".cleanup_quarantine\$Timestamp"
$LegacyScripts = Join-Path $Root "scripts\legacy"
$BackendLegacy = Join-Path $LegacyScripts "backend-legacy"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " LIMPIEZA SEGURA FULLSTACK" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host "Backend: $Backend"
Write-Host "Quarantine: $Quarantine"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Backend)) {
    Write-Host "[ERROR] No existe backend/" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $Quarantine -Force | Out-Null
New-Item -ItemType Directory -Path $LegacyScripts -Force | Out-Null
New-Item -ItemType Directory -Path $BackendLegacy -Force | Out-Null

function Move-Safe {
    param(
        [string]$Source,
        [string]$Target
    )

    if (Test-Path $Source) {
        $TargetDir = Split-Path $Target -Parent

        if (-not (Test-Path $TargetDir)) {
            New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
        }

        Move-Item $Source $Target -Force
        Write-Host "[OK] Movido:" -ForegroundColor Green
        Write-Host "     $Source"
        Write-Host "  -> $Target"
    }
    else {
        Write-Host "[SKIP] No existe: $Source" -ForegroundColor DarkYellow
    }
}

function Remove-BomUtf8 {
    param(
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        Write-Host "[SKIP] No existe para quitar BOM: $Path" -ForegroundColor DarkYellow
        return
    }

    $bytes = [System.IO.File]::ReadAllBytes($Path)

    if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) {
        Copy-Item $Path "$Path.bom.bak" -Force

        $newBytes = New-Object byte[] ($bytes.Length - 3)
        [Array]::Copy($bytes, 3, $newBytes, 0, $bytes.Length - 3)
        [System.IO.File]::WriteAllBytes($Path, $newBytes)

        Write-Host "[OK] BOM UTF-8 removido: $Path" -ForegroundColor Green
    }
    else {
        Write-Host "[OK] Sin BOM detectado: $Path" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "1. Moviendo archivos .bak a cuarentena..." -ForegroundColor Cyan

$BakFiles = Get-ChildItem -Path $Root -Recurse -File -Filter "*.bak" |
    Where-Object {
        $_.FullName -notlike "*\.git\*" -and
        $_.FullName -notlike "*node_modules*" -and
        $_.FullName -notlike "*\.venv*" -and
        $_.FullName -notlike "*\.cleanup_quarantine*"
    }

foreach ($file in $BakFiles) {
    $relative = $file.FullName.Substring($Root.Path.Length).TrimStart("\")
    $target = Join-Path $Quarantine $relative
    Move-Safe $file.FullName $target
}

Write-Host ""
Write-Host "2. Moviendo scripts auxiliares del frontend a scripts/legacy..." -ForegroundColor Cyan

Move-Safe (Join-Path $Frontend "agregar_boton_copiar_token.ps1") (Join-Path $LegacyScripts "agregar_boton_copiar_token.ps1")
Move-Safe (Join-Path $Frontend "analizar_productos_frontend.ps1") (Join-Path $LegacyScripts "analizar_productos_frontend.ps1")
Move-Safe (Join-Path $Frontend "setup_firebase_auth_real.ps1") (Join-Path $LegacyScripts "setup_firebase_auth_real.ps1")

Write-Host ""
Write-Host "3. Moviendo modulos legacy estudiante/persona del backend..." -ForegroundColor Cyan

Move-Safe (Join-Path $Backend "src\apis\estudiante_api.py") (Join-Path $BackendLegacy "apis\estudiante_api.py")
Move-Safe (Join-Path $Backend "src\apis\persona_api.py") (Join-Path $BackendLegacy "apis\persona_api.py")
Move-Safe (Join-Path $Backend "src\repository\estudiante_repository.py") (Join-Path $BackendLegacy "repository\estudiante_repository.py")
Move-Safe (Join-Path $Backend "src\repository\persona_repository.py") (Join-Path $BackendLegacy "repository\persona_repository.py")
Move-Safe (Join-Path $Backend "src\schema\persona_schema.py") (Join-Path $BackendLegacy "schema\persona_schema.py")
Move-Safe (Join-Path $Backend "src\services\estudiante_service.py") (Join-Path $BackendLegacy "services\estudiante_service.py")
Move-Safe (Join-Path $Backend "src\services\persona_service.py") (Join-Path $BackendLegacy "services\persona_service.py")

Write-Host ""
Write-Host "4. Moviendo backup interno del backend si existe..." -ForegroundColor Cyan

Move-Safe (Join-Path $Backend ".backup") (Join-Path $Quarantine "backend\.backup")

Write-Host ""
Write-Host "5. Corrigiendo BOM UTF-8 en archivos Python..." -ForegroundColor Cyan

Remove-BomUtf8 (Join-Path $Backend "src\firebase\auth_client.py")
Remove-BomUtf8 (Join-Path $Backend "src\schema\producto_schema.py")

Write-Host ""
Write-Host "6. Verificando que secretos siguen existiendo localmente pero no se tocaron..." -ForegroundColor Cyan

if (Test-Path (Join-Path $Backend ".env")) {
    Write-Host "[OK] backend/.env existe localmente." -ForegroundColor Green
}
else {
    Write-Host "[WARN] backend/.env no existe." -ForegroundColor Yellow
}

if (Test-Path (Join-Path $Backend "firebase-service-account.json")) {
    Write-Host "[OK] backend/firebase-service-account.json existe localmente." -ForegroundColor Green
}
else {
    Write-Host "[WARN] backend/firebase-service-account.json no existe." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " LIMPIEZA SEGURA COMPLETADA" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora prueba:"
Write-Host "1. Backend:"
Write-Host "   cd backend"
Write-Host "   .\.venv\Scripts\Activate.ps1"
Write-Host "   python -m uvicorn src.main:app --reload"
Write-Host ""
Write-Host "2. Frontend:"
Write-Host "   cd frontend"
Write-Host "   ng serve -o"
Write-Host ""
Write-Host "Luego revisa:"
Write-Host "   git status --short"