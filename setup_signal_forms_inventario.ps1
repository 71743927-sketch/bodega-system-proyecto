$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " MIGRAR INVENTARIO A SIGNAL FORMS" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Frontend: $Frontend"
Write-Host ""

if (-not (Test-Path $Frontend)) {
    Write-Host "[ERROR] No existe frontend/. Ejecuta desde la raiz del proyecto." -ForegroundColor Red
    exit 1
}

$TsPath = Join-Path $Frontend "src/app/features/inventario/pages/inventario-page/inventario-page.component.ts"
$HtmlPath = Join-Path $Frontend "src/app/features/inventario/pages/inventario-page/inventario-page.component.html"

if (-not (Test-Path $TsPath)) {
    Write-Host "[ERROR] No existe inventario-page.component.ts" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $HtmlPath)) {
    Write-Host "[ERROR] No existe inventario-page.component.html" -ForegroundColor Red
    exit 1
}

Copy-Item $TsPath "$TsPath.signal.bak" -Force
Copy-Item $HtmlPath "$HtmlPath.signal.bak" -Force

Write-Host "[BACKUP] $TsPath -> $TsPath.signal.bak" -ForegroundColor Yellow
Write-Host "[BACKUP] $HtmlPath -> $HtmlPath.signal.bak" -ForegroundColor Yellow

$Ts = Get-Content $TsPath -Raw
$Html = Get-Content $HtmlPath -Raw

# ============================================================
# 1. Agregar import de Signal Forms
# ============================================================

if ($Ts -notmatch "@angular/forms/signals") {
    $Ts = $Ts -replace "import \{ Component, computed, inject, signal \} from '@angular/core';", "import { Component, computed, inject, signal } from '@angular/core';`r`nimport { form, FormField } from '@angular/forms/signals';"
    Write-Host "[OK] Import agregado: form, FormField" -ForegroundColor Green
}
else {
    Write-Host "[SKIP] Ya existe import de @angular/forms/signals" -ForegroundColor Yellow
}

# ============================================================
# 2. Agregar FormField al imports del componente standalone
# ============================================================

if ($Ts -match "imports:\s*\[") {
    if ($Ts -notmatch "imports:\s*\[[^\]]*FormField") {
        $Ts = $Ts -replace "imports:\s*\[", "imports: [FormField, "
        Write-Host "[OK] FormField agregado al arreglo imports" -ForegroundColor Green
    }
    else {
        Write-Host "[SKIP] FormField ya estaba en imports" -ForegroundColor Yellow
    }
}
else {
    Write-Host "[WARN] No se encontro imports: [] en el componente." -ForegroundColor Yellow
    Write-Host "      Si falla, agrega manualmente imports: [FormField]." -ForegroundColor Yellow
}

# ============================================================
# 3. Crear readonly inventarioForm = form(this.formulario);
#    Se inserta despues de la declaracion formulario = signal(...)
# ============================================================

if ($Ts -notmatch "inventarioForm\s*=") {
    $Lines = $Ts -split "`r?`n"
    $NewLines = New-Object System.Collections.Generic.List[string]
    $Inserted = $false
    $InsideFormulario = $false

    foreach ($Line in $Lines) {
        $NewLines.Add($Line)

        if ($Line -match "formulario\s*=\s*signal") {
            $InsideFormulario = $true
        }

        if ($InsideFormulario -and $Line.Trim() -eq "});" -and -not $Inserted) {
            $NewLines.Add("")
            $NewLines.Add("  readonly inventarioForm = form(this.formulario);")
            $Inserted = $true
            $InsideFormulario = $false
        }
    }

    if ($Inserted) {
        $Ts = $NewLines -join "`r`n"
        Write-Host "[OK] inventarioForm creado con form(this.formulario)" -ForegroundColor Green
    }
    else {
        Write-Host "[WARN] No se pudo insertar inventarioForm automaticamente." -ForegroundColor Yellow
        Write-Host "      Agrega manualmente despues de formulario = signal(...):" -ForegroundColor Yellow
        Write-Host "      readonly inventarioForm = form(this.formulario);" -ForegroundColor Yellow
    }
}
else {
    Write-Host "[SKIP] inventarioForm ya existe" -ForegroundColor Yellow
}

# ============================================================
# 4. Reemplazos HTML del formulario principal
# ============================================================

# Cantidad
$Html = [regex]::
    $Html,
    '(?s)<input\s+id="cantidad"[\s\S]*?/>',
    '<input id="cantidad" type="number" min="0" [formField]="inventarioForm.cantidad" />'
)

# Usuario
$Html = [regex]::
    $Html,
    '(?s)<input\s+id="usuario"[\s\S]*?/>',
    '<input id="usuario" type="text" [formField]="inventarioForm.usuario" placeholder="Ej. Administrador" />'
)

# Producto
$Html = [regex]::
    $Html,
    '(?s)<select\s+id="productoId"[^>]*>',
    '<select id="productoId" [formField]="inventarioForm.productoId">'
)

# Tipo
$Html = [regex]::
    $Html,
    '(?s)<select\s+id="tipo"[^>]*>',
    '<select id="tipo" [formField]="inventarioForm.tipo">'
)

# Observacion
$Html = [regex]::
    $Html,
    '(?s)<textarea\s+id="observacion"[^>]*>',
    '<textarea id="observacion" rows="4" [formField]="inventarioForm.observacion" placeholder="Ej. Reposición de mercadería, merma, corrección de inventario, etc.">'
)

# ============================================================
# 5. Guardar archivos
# ============================================================

Set-Content -Path $TsPath -Value $Ts -Encoding UTF8
Set-Content -Path $HtmlPath -Value $Html -Encoding UTF8

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " INVENTARIO MIGRADO A SIGNAL FORMS" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "cd frontend"
Write-Host "ng serve -o"
Write-Host ""
Write-Host "Luego prueba:"
Write-Host "http://localhost:4200/inventario"