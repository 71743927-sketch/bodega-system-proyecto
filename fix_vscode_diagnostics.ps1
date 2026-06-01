$ErrorActionPreference = "Stop"

$Root = Get-Location
$Frontend = Join-Path $Root "frontend"
$Backend = Join-Path $Root "backend"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " FIX VS CODE DIAGNOSTICS" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Fix tsconfig.app.json
$TsConfigApp = Join-Path $Frontend "tsconfig.app.json"

if (Test-Path $TsConfigApp) {
    Copy-Item $TsConfigApp "$TsConfigApp.bak" -Force

    $Content = @'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": [],
    "rootDir": "./src"
  },
  "files": [
    "src/main.ts"
  ],
  "include": [
    "src/**/*.d.ts"
  ]
}
'@

    Set-Content -Path $TsConfigApp -Value $Content -Encoding UTF8
    Write-Host "[OK] frontend/tsconfig.app.json corregido" -ForegroundColor Green
} else {
    Write-Host "[WARN] No se encontro frontend/tsconfig.app.json" -ForegroundColor Yellow
}

# 2. Crear settings de VS Code para Python
$VsCodeDir = Join-Path $Root ".vscode"
$SettingsPath = Join-Path $VsCodeDir "settings.json"

if (-not (Test-Path $VsCodeDir)) {
    New-Item -ItemType Directory -Path $VsCodeDir -Force | Out-Null
}

$Settings = @'
{
  "python.defaultInterpreterPath": "${workspaceFolder}/backend/.venv/Scripts/python.exe",
  "typescript.tsdk": "frontend/node_modules/typescript/lib",
  "eslint.workingDirectories": [
    {
      "directory": "frontend",
      "changeProcessCWD": true
    }
  ]
}
'@

Set-Content -Path $SettingsPath -Value $Settings -Encoding UTF8
Write-Host "[OK] .vscode/settings.json actualizado" -ForegroundColor Green

Write-Host ""
Write-Host "Ahora haz:"
Write-Host "1. Cierra VS Code."
Write-Host "2. Abre desde la raiz:"
Write-Host "   code ."
Write-Host "3. Ejecuta TypeScript: Restart TS Server"
Write-Host "4. Selecciona Python interpreter backend/.venv/Scripts/python.exe"