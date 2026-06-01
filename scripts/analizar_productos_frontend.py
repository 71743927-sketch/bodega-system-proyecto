#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import re
import datetime
import json


ROOT = Path.cwd()
FRONTEND = ROOT / "frontend"
PRODUCTOS_PATH = FRONTEND / "src" / "app" / "features" / "productos"
OUTPUT_DIR = FRONTEND / ".analysis"
OUTPUT_MD = OUTPUT_DIR / "analisis_productos_frontend.md"
OUTPUT_JSON = OUTPUT_DIR / "analisis_productos_frontend.json"


FIREBASE_KEYWORDS = [
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
    "getDownloadURL",
]

HTTP_KEYWORDS = [
    "HttpClient",
    "http.get",
    "http.post",
    "http.put",
    "http.delete",
    "ProductosBackendService",
    "BackendAuthService",
]

METHOD_PATTERN = re.compile(
    r"^\s*(public\s+|private\s+|protected\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
    re.MULTILINE
)

CLASS_PATTERN = re.compile(
    r"export\s+class\s+([A-Za-z_][A-Za-z0-9_]*)",
    re.MULTILINE
)

IMPORT_PATTERN = re.compile(
    r"^\s*import\s+.*?;",
    re.MULTILINE
)


def safe_read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        return f"__READ_ERROR__ {exc}"


def relative(path: Path) -> str:
    try:
        return str(path.relative_to(FRONTEND)).replace("\\", "/")
    except Exception:
        return str(path).replace("\\", "/")


def analyze_file(path: Path) -> dict:
    content = safe_read(path)

    firebase_hits = []
    for keyword in FIREBASE_KEYWORDS:
        if keyword.lower() in content.lower():
            firebase_hits.append(keyword)

    http_hits = []
    for keyword in HTTP_KEYWORDS:
        if keyword.lower() in content.lower():
            http_hits.append(keyword)

    methods = []
    for match in METHOD_PATTERN.finditer(content):
        methods.append(match.group(2))

    classes = CLASS_PATTERN.findall(content)
    imports = IMPORT_PATTERN.findall(content)

    return {
        "file": relative(path),
        "extension": path.suffix,
        "lines": content.count("\n") + 1,
        "classes": classes,
        "methods": methods,
        "imports": imports,
        "firebase_detected": len(firebase_hits) > 0,
        "firebase_keywords": firebase_hits,
        "http_detected": len(http_hits) > 0,
        "http_keywords": http_hits,
        "content_preview": content[:1500],
    }


def main():
    print("")
    print("==============================================")
    print(" ANALISIS MODULO PRODUCTOS - FRONTEND ANGULAR")
    print("==============================================")
    print(f"Root: {ROOT}")
    print(f"Frontend: {FRONTEND}")
    print(f"Productos: {PRODUCTOS_PATH}")
    print("")

    if not FRONTEND.exists():
        print("[ERROR] No existe carpeta frontend/. Ejecuta desde la raiz del proyecto.")
        return 1

    if not PRODUCTOS_PATH.exists():
        print("[ERROR] No existe frontend/src/app/features/productos")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = []
    for ext in ["*.ts", "*.html", "*.css", "*.scss"]:
        files.extend(PRODUCTOS_PATH.rglob(ext))

    files = sorted(files)

    analysis = {
        "metadata": {
            "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "root": str(ROOT),
            "frontend": str(FRONTEND),
            "productos_path": str(PRODUCTOS_PATH),
        },
        "summary": {
            "total_files": len(files),
            "typescript_files": len([f for f in files if f.suffix == ".ts"]),
            "html_files": len([f for f in files if f.suffix == ".html"]),
            "style_files": len([f for f in files if f.suffix in [".css", ".scss"]]),
        },
        "files": [analyze_file(f) for f in files],
    }

    OUTPUT_JSON.write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    md = []
    md.append("# Analisis del modulo Productos")
    md.append("")
    md.append(f"- Ruta analizada: `{PRODUCTOS_PATH}`")
    md.append(f"- Fecha: `{analysis['metadata']['generated_at']}`")
    md.append("")
    md.append("## 1. Resumen")
    md.append("")
    md.append(f"- Total de archivos: `{analysis['summary']['total_files']}`")
    md.append(f"- Archivos TypeScript: `{analysis['summary']['typescript_files']}`")
    md.append(f"- Archivos HTML: `{analysis['summary']['html_files']}`")
    md.append(f"- Archivos de estilos: `{analysis['summary']['style_files']}`")
    md.append("")
    md.append("## 2. Archivos encontrados")
    md.append("")

    for item in analysis["files"]:
        md.append(f"- `{item['file']}`")

    md.append("")
    md.append("## 3. Analisis TypeScript")
    md.append("")

    for item in analysis["files"]:
        if item["extension"] != ".ts":
            continue

        md.append(f"### `{item['file']}`")
        md.append("")
        md.append(f"- Lineas aproximadas: `{item['lines']}`")

        if item["classes"]:
            md.append(f"- Clases detectadas: `{', '.join(item['classes'])}`")
        else:
            md.append("- Clases detectadas: ninguna")

        if item["firebase_detected"]:
            md.append("- Firebase/Firestore detectado: **SI**")
            md.append(f"- Palabras Firebase: `{', '.join(item['firebase_keywords'])}`")
        else:
            md.append("- Firebase/Firestore detectado: **NO**")

        if item["http_detected"]:
            md.append("- HttpClient/backend detectado: **SI**")
            md.append(f"- Palabras HTTP/backend: `{', '.join(item['http_keywords'])}`")
        else:
            md.append("- HttpClient/backend detectado: **NO**")

        if item["methods"]:
            md.append("- Metodos detectados:")
            for method in item["methods"]:
                md.append(f"  - `{method}()`")
        else:
            md.append("- Metodos detectados: ninguno")

        if item["imports"]:
            md.append("- Imports:")
            for imp in item["imports"]:
                md.append(f"  - `{imp}`")

        md.append("")

    md.append("## 4. Recomendacion inicial")
    md.append("")
    md.append("Si `productos.service.ts` usa Firebase directo, la migracion recomendada es:")
    md.append("")
    md.append("```text")
    md.append("productos.service.ts actual")
    md.append("   -> reemplazo progresivo")
    md.append("productos-backend.service.ts")
    md.append("   -> HTTP + token Firebase")
    md.append("FastAPI /api/productos")
    md.append("   -> Firebase Admin SDK")
    md.append("Firestore productos")
    md.append("```")
    md.append("")
    md.append("No se recomienda borrar el servicio actual hasta confirmar que GET, POST, PUT y DELETE funcionan con backend.")
    md.append("")

    OUTPUT_MD.write_text("\n".join(md), encoding="utf-8")

    print("[OK] Analisis generado:")
    print(f"MD:   {OUTPUT_MD}")
    print(f"JSON: {OUTPUT_JSON}")
    print("")
    print("Abre el reporte con:")
    print(f'notepad "{OUTPUT_MD}"')

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
