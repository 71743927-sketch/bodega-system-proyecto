$ErrorActionPreference = "Stop"

$Root = Get-Location
$ProductosPath = Join-Path $Root "src/app/features/productos"
$OutputDir = Join-Path $Root ".analysis"
$OutputFile = Join-Path $OutputDir "analisis_productos_frontend.md"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " ANALISIS MODULO PRODUCTOS - FRONTEND ANGULAR" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Productos: $ProductosPath"
Write-Host ""

if (-not (Test-Path $ProductosPath)) {
    Write-Host "[ERROR] No existe src/app/features/productos" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$Files = Get-ChildItem -Path $ProductosPath -Recurse -File -Include *.ts,*.html,*.css,*.scss

$TsFiles = $Files | Where-Object { $_.Extension -eq ".ts" }
$HtmlFiles = $Files | Where-Object { $_.Extension -eq ".html" }
$StyleFiles = $Files | Where-Object { $_.Extension -in @(".css", ".scss") }

$FirebaseKeywords = @(
    "firebase",
    "Firestore",
    "collection",
    "collectionData",
    "doc",
    "docData",
    "addDoc",
    "setDoc",
    "updateDoc",
    "deleteDoc",
    "getDocs",
    "getDoc",
    "query",
    "where",
    "orderBy",
    "Storage",
    "uploadBytes",
    "getDownloadURL"
)

$HttpKeywords = @(
    "HttpClient",
    "http.get",
    "http.post",
    "http.put",
    "http.delete"
)

$MethodRegex = "^\s*(public\s+|private\s+|protected\s+)?([a-zA-Z0-9_]+)\s*\("

$Report = @()
$Report += "# Analisis del modulo Productos"
$Report += ""
$Report += "- Ruta analizada: `$ProductosPath`"
$Report += "- Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$Report += ""
$Report += "## 1. Resumen"
$Report += ""
$Report += "- Archivos TypeScript: $($TsFiles.Count)"
$Report += "- Archivos HTML: $($HtmlFiles.Count)"
$Report += "- Archivos de estilos: $($StyleFiles.Count)"
$Report += ""

$Report += "## 2. Archivos encontrados"
$Report += ""
foreach ($file in $Files) {
    $relative = $file.FullName.Replace($Root.Path, "").TrimStart("\")
    $Report += "- `$relative`"
}
$Report += ""

$Report += "## 3. Analisis TypeScript"
$Report += ""

foreach ($file in $TsFiles) {
    $relative = $file.FullName.Replace($Root.Path, "").TrimStart("\")
    $content = Get-Content $file.FullName -Raw

    $Report += "### `$relative`"
    $Report += ""

    $lineCount = ($content -split "`n").Count
    $Report += "- Lineas aproximadas: $lineCount"

    $firebaseHits = @()
    foreach ($keyword in $FirebaseKeywords) {
        if ($content -match [regex]::Escape($keyword)) {
            $firebaseHits += $keyword
        }
    }

    $httpHits = @()
    foreach ($keyword in $HttpKeywords) {
        if ($content -match [regex]::Escape($keyword)) {
            $httpHits += $keyword
        }
    }

    if ($firebaseHits.Count -gt 0) {
        $Report += "- Firebase/Firestore detectado: SI"
        $Report += "- Palabras Firebase: $($firebaseHits -join ', ')"
    } else {
        $Report += "- Firebase/Firestore detectado: NO"
    }

    if ($httpHits.Count -gt 0) {
        $Report += "- HttpClient/backend detectado: SI"
        $Report += "- Palabras HTTP: $($httpHits -join ', ')"
    } else {
        $Report += "- HttpClient/backend detectado: NO"
    }

    $methods = Select-String -Path $file.FullName -Pattern $MethodRegex | ForEach-Object {
        $_.Line.Trim()
    }

    if ($methods.Count -gt 0) {
        $Report += "- Metodos detectados:"
        foreach ($m in $methods) {
            $Report += "  - `$m`"
        }
    } else {
        $Report += "- Metodos detectados: ninguno por patron simple"
    }

    $imports = Select-String -Path $file.FullName -Pattern "^import " | ForEach-Object {
        $_.Line.Trim()
    }

    if ($imports.Count -gt 0) {
        $Report += "- Imports:"
        foreach ($imp in $imports) {
            $Report += "  - `$imp`"
        }
    }

    $Report += ""
}

$Report += "## 4. Recomendacion inicial"
$Report += ""
$Report += "Si el servicio actual de productos usa Firebase directo, la migracion recomendada es:"
$Report += ""
$Report += "```text"
$Report += "productos.service.ts actual"
$Report += "   ↓ reemplazo progresivo"
$Report += "productos-backend.service.ts"
$Report += "   ↓ HTTP + token Firebase"
$Report += "FastAPI /api/productos"
$Report += "   ↓ Firebase Admin SDK"
$Report += "Firestore productos"
$Report += "```"
$Report += ""
$Report += "No se recomienda borrar el servicio actual hasta confirmar que GET, POST, PUT y DELETE funcionan con backend."
$Report += ""

Set-Content -Path $OutputFile -Value ($Report -join "`r`n") -Encoding UTF8

Write-Host "[OK] Analisis generado en:" -ForegroundColor Green
Write-Host $OutputFile -ForegroundColor Green
Write-Host ""
Write-Host "Abre el reporte con:"
Write-Host "notepad `"$OutputFile`""