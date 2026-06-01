#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import re
import json
import datetime


ROOT = Path.cwd()
FRONTEND = ROOT / "frontend"

FILES = {
    "modelo": FRONTEND / "src/app/features/productos/models/producto.ts",
    "pagina": FRONTEND / "src/app/features/productos/pages/productos-page/productos-page.component.ts",
    "servicio_actual": FRONTEND / "src/app/features/productos/services/productos.service.ts",
    "servicio_backend": FRONTEND / "src/app/features/productos/services/productos-backend.service.ts",
}

OUTPUT_DIR = FRONTEND / ".analysis"
OUTPUT_MD = OUTPUT_DIR / "plan_migracion_productos.md"
OUTPUT_JSON = OUTPUT_DIR / "plan_migracion_productos.json"


def read(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(FRONTEND)).replace("\\", "/")
    except Exception:
        return str(path).replace("\\", "/")


def extract_class_methods(content: str):
    pattern = re.compile(
        r"^\s*(?:public\s+|private\s+|protected\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        re.MULTILINE
    )

    ignored = {"if", "for", "while", "switch", "return", "catch", "subscribe", "pipe"}
    methods = []

    for match in pattern.finditer(content):
        name = match.group(1)
        if name not in ignored:
            methods.append(name)

    return sorted(set(methods))


def extract_service_calls(component_content: str):
    """
    Busca llamadas típicas:
    this.productosService.metodo(
    this.servicio.metodo(
    productosService.metodo(
    """
    patterns = [
        r"this\.productosService\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        r"this\.productoService\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        r"this\.service\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        r"productosService\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
    ]

    calls = []

    for pattern in patterns:
        for match in re.finditer(pattern, component_content):
            calls.append(match.group(1))

    return sorted(set(calls))


def extract_injected_services(component_content: str):
    injections = []

    inject_pattern = re.compile(
        r"([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*inject\(([^)]+)\)",
        re.MULTILINE
    )

    constructor_pattern = re.compile(
        r"constructor\s*\((.*?)\)",
        re.DOTALL
    )

    for match in inject_pattern.finditer(component_content):
        injections.append({
            "property": match.group(1).strip(),
            "service": match.group(2).strip()
        })

    constructor_match = constructor_pattern.search(component_content)
    if constructor_match:
        injections.append({
            "property": "constructor",
            "service": constructor_match.group(1).strip()
        })

    return injections


def extract_interface_fields(model_content: str):
    fields = []

    interface_match = re.search(
        r"export\s+interface\s+Producto\s*{(?P<body>.*?)}",
        model_content,
        re.DOTALL
    )

    if not interface_match:
        return fields

    body = interface_match.group("body")

    field_pattern = re.compile(
        r"^\s*([a-zA-Z_][a-zA-Z0-9_]*\??)\s*:\s*([^;]+);?",
        re.MULTILINE
    )

    for match in field_pattern.finditer(body):
        fields.append({
            "name": match.group(1).strip(),
            "type": match.group(2).strip()
        })

    return fields


def extract_imports(content: str):
    return re.findall(r"^\s*import\s+.*?;", content, re.MULTILINE)


def main():
    print("")
    print("==============================================")
    print(" PLAN MIGRACION PRODUCTOS FRONTEND -> BACKEND")
    print("==============================================")
    print(f"Root: {ROOT}")
    print(f"Frontend: {FRONTEND}")
    print("")

    if not FRONTEND.exists():
        print("[ERROR] No existe frontend/. Ejecuta desde la raíz del proyecto.")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    contents = {key: read(path) for key, path in FILES.items()}

    analysis = {
        "metadata": {
            "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "root": str(ROOT),
            "frontend": str(FRONTEND),
        },
        "files": {key: rel(path) for key, path in FILES.items()},
        "exists": {key: path.exists() for key, path in FILES.items()},
        "producto_fields": extract_interface_fields(contents["modelo"]),
        "pagina": {
            "imports": extract_imports(contents["pagina"]),
            "injections": extract_injected_services(contents["pagina"]),
            "service_calls": extract_service_calls(contents["pagina"]),
            "methods": extract_class_methods(contents["pagina"]),
            "lines": contents["pagina"].count("\n") + 1,
        },
        "servicio_actual": {
            "imports": extract_imports(contents["servicio_actual"]),
            "methods": extract_class_methods(contents["servicio_actual"]),
            "uses_firebase": any(k.lower() in contents["servicio_actual"].lower() for k in [
                "firestore", "collection", "adddoc", "setdoc", "updatedoc", "deletedoc", "getdocs"
            ]),
            "lines": contents["servicio_actual"].count("\n") + 1,
        },
        "servicio_backend": {
            "imports": extract_imports(contents["servicio_backend"]),
            "methods": extract_class_methods(contents["servicio_backend"]),
            "uses_http": any(k.lower() in contents["servicio_backend"].lower() for k in [
                "httpclient", "http.get", "http.post", "http.put", "http.delete"
            ]),
            "lines": contents["servicio_backend"].count("\n") + 1,
        },
    }

    missing_calls = []
    backend_methods = set(analysis["servicio_backend"]["methods"])
    current_methods = set(analysis["servicio_actual"]["methods"])

    for call in analysis["pagina"]["service_calls"]:
        if call not in backend_methods:
            missing_calls.append(call)

    analysis["migration"] = {
        "component_calls_not_in_backend_service": missing_calls,
        "current_service_methods_not_in_backend_service": sorted(current_methods - backend_methods),
        "backend_service_methods": sorted(backend_methods),
        "recommendation": "Crear adaptador o migrar ProductosService preservando los métodos que usa la pantalla."
    }

    OUTPUT_JSON.write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    md = []
    md.append("# Plan de migración del módulo Productos")
    md.append("")
    md.append(f"- Fecha: `{analysis['metadata']['generated_at']}`")
    md.append(f"- Frontend: `{FRONTEND}`")
    md.append("")
    md.append("## 1. Archivos analizados")
    md.append("")
    for key, path in analysis["files"].items():
        md.append(f"- **{key}**: `{path}` - Existe: `{analysis['exists'][key]}`")

    md.append("")
    md.append("## 2. Modelo Producto")
    md.append("")
    if analysis["producto_fields"]:
        for field in analysis["producto_fields"]:
            md.append(f"- `{field['name']}`: `{field['type']}`")
    else:
        md.append("- No se detectaron campos del interface Producto.")

    md.append("")
    md.append("## 3. ProductosPageComponent")
    md.append("")
    md.append(f"- Líneas: `{analysis['pagina']['lines']}`")

    md.append("")
    md.append("### Imports")
    for imp in analysis["pagina"]["imports"]:
        md.append(f"- `{imp}`")

    md.append("")
    md.append("### Servicios inyectados")
    for inj in analysis["pagina"]["injections"]:
        md.append(f"- `{inj['property']}` -> `{inj['service']}`")

    md.append("")
    md.append("### Llamadas detectadas a ProductosService")
    if analysis["pagina"]["service_calls"]:
        for call in analysis["pagina"]["service_calls"]:
            md.append(f"- `{call}()`")
    else:
        md.append("- No se detectaron llamadas directas por patrón.")

    md.append("")
    md.append("## 4. ProductosService actual")
    md.append("")
    md.append(f"- Líneas: `{analysis['servicio_actual']['lines']}`")
    md.append(f"- Usa Firebase directo: `{analysis['servicio_actual']['uses_firebase']}`")
    md.append("")
    md.append("### Métodos")
    for method in analysis["servicio_actual"]["methods"]:
        md.append(f"- `{method}()`")

    md.append("")
    md.append("## 5. ProductosBackendService")
    md.append("")
    md.append(f"- Líneas: `{analysis['servicio_backend']['lines']}`")
    md.append(f"- Usa HttpClient/backend: `{analysis['servicio_backend']['uses_http']}`")
    md.append("")
    md.append("### Métodos")
    for method in analysis["servicio_backend"]["methods"]:
        md.append(f"- `{method}()`")

    md.append("")
    md.append("## 6. Diferencias para migración")
    md.append("")
    md.append("### Llamadas del componente que NO existen en ProductosBackendService")
    if missing_calls:
        for call in missing_calls:
            md.append(f"- `{call}()`")
    else:
        md.append("- Todas las llamadas detectadas existen en ProductosBackendService.")

    md.append("")
    md.append("### Métodos del servicio actual que NO existen en ProductosBackendService")
    diff = analysis["migration"]["current_service_methods_not_in_backend_service"]
    if diff:
        for method in diff:
            md.append(f"- `{method}()`")
    else:
        md.append("- No hay diferencias relevantes.")

    md.append("")
    md.append("## 7. Recomendación")
    md.append("")
    md.append("La migración recomendada es crear un adaptador o reemplazar internamente `ProductosService` para que conserve los métodos usados por la pantalla, pero delegue operaciones CRUD al `ProductosBackendService`.")
    md.append("")
    md.append("No conviene cambiar la pantalla directamente hasta asegurar compatibilidad de métodos y del modelo `Producto`.")

    OUTPUT_MD.write_text("\n".join(md), encoding="utf-8")

    print("[OK] Plan generado:")
    print(f"MD:   {OUTPUT_MD}")
    print(f"JSON: {OUTPUT_JSON}")
    print("")
    print("Abre con:")
    print(f'notepad "{OUTPUT_MD}"')

    return 0


if __name__ == "__main__":
    raise SystemExit(main())