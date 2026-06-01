$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"

$LoginTs = Join-Path $Frontend "src/app/features/auth/pages/login-page/login-page.component.ts"
$LoginHtml = Join-Path $Frontend "src/app/features/auth/pages/login-page/login-page.component.html"

Copy-Item $LoginTs "$LoginTs.compilefix.bak" -Force
Copy-Item $LoginHtml "$LoginHtml.compilefix.bak" -Force

$Ts = Get-Content $LoginTs -Raw
$Html = Get-Content $LoginHtml -Raw

# Agregar JsonPipe
if ($Ts -notmatch "JsonPipe") {
    $Ts = $Ts -replace "import \{ Component, computed, inject, signal \} from '@angular/core';", "import { Component, computed, inject, signal } from '@angular/core';`r`nimport { JsonPipe } from '@angular/common';"
}

# Agregar JsonPipe al imports del componente
$Ts = $Ts -replace "imports: \[FormField\]", "imports: [FormField, JsonPipe]"

# Usar submit nativo para no requerir FormsModule/ReactiveFormsModule
$Html = $Html -replace '\(ngSubmit\)="login\(\)"', '(submit)="login(); $event.preventDefault()"'

Set-Content -Path $LoginTs -Value $Ts -Encoding UTF8
Set-Content -Path $LoginHtml -Value $Html -Encoding UTF8

Write-Host "[OK] Login Signal Forms ajustado para compilar." -ForegroundColor Green