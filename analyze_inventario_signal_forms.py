#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import re
import json
import datetime


ROOT = Path.cwd()
FRONTEND = ROOT / "frontend"
BASE = FRONTEND / "src/app/features/inventario"

TS_PATH = BASE / "pages/inventario-page/inventario-page.component.ts"
HTML_PATH = BASE / "pages/inventario-page/inventario-page.component.html"
SERVICE_PATH = BASE / "services/inventario.service.ts"
MODEL_PATH = BASE / "models/movimiento-inventario.ts"

OUTPUT_DIR = ROOT / ".signal_forms_analysis"
OUTPUT_MD = OUTPUT_DIR / "inventario_signal_forms_report.md"
OUTPUT_JSON = OUTPUT_DIR / "inventario_signal_forms_report.json"


def read(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    except Exception:
        return str(path).replace("\\", "/")


def extract_imports(ts: str):
    return re.findall(r"^\s*import\s+.*?;", ts, flags=re.MULTILINE)


def extract_methods(ts: str):
    pattern = re.compile(
        r"^\s*(?:public\s+|private\s+|protected\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        re.MULTILINE
    )

    ignored = {"if", "for", "while", "switch", "return", "catch"}
    methods = []

    for match in pattern.finditer(ts):
        name = match.group(1)
        if name not in ignored:
            methods.append(name)

    return sorted(set(methods))


def extract_injections(ts: str):
    injections = []

    pattern = re.compile(
        r"([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*inject\(([^)]+)\)",
        re.MULTILINE
    )

    for match in pattern.finditer(ts):
        injections.append({
            "property": match.group(1),
            "service": match.group(2)
        })

    return injections


def extract_signal_fields(ts: str):
    signals = []

    pattern = re.compile(
        r"([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*signal(?:<[^>]+>)?\((.*?)\);",
        re.DOTALL
    )

    for match in pattern.finditer(ts):
        signals.append({
            "name": match.group(1),
            "initial_value_preview": match.group(2).strip()[:300]
        })

    return signals


def extract_html_controls(html: str):
    controls = []

    patterns = [
        ("input", re.compile(r"<input\b[^>]*>", re.IGNORECASE)),
        ("select", re.compile(r"<select\b[^>]*>", re.IGNORECASE)),
        ("textarea", re.compile(r"<textarea\b[^>]*>", re.IGNORECASE)),
    ]

    for kind, pattern in patterns:
        for match in pattern.finditer(html):
            tag = match.group(0)

            typ = ""
            placeholder = ""
            value_binding = ""
            input_event = ""
            form_field = ""

            type_match = re.search(r'type\s*=\s*["\']([^"\']+)["\']', tag)
            placeholder_match = re.search(r'placeholder\s*=\s*["\']([^"\']+)["\']', tag)
            value_match = re.search(r'\[value\]\s*=\s*["\']([^"\']+)["\']', tag)
            input_match = re.search(r'\(input\)\s*=\s*["\']([^"\']+)["\']', tag)
            form_field_match = re.search(r'\[formField\]\s*=\s*["\']([^"\']+)["\']', tag)

            if type_match:
                typ = type_match.group(1)

            if placeholder_match:
                placeholder = placeholder_match.group(1)

            if value_match:
                value_binding = value_match.group(1)

            if input_match:
                input_event = input_match.group(1)

            if form_field_match:
                form_field = form_field_match.group(1)

            controls.append({
                "kind": kind,
                "type": typ,
                "placeholder": placeholder,
                "value_binding": value_binding,
                "input_event": input_event,
                "form_field": form_field,
                "tag_preview": tag[:250]
            })

    return controls


def extract_service_calls(ts: str):
    calls = []

    patterns = [
        r"this\.inventarioService\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        r"this\.productosService\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
        r"this\.movimientosService\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, ts):
            calls.append(match.group(1))

    return sorted(set(calls))


def main():
    print("")
    print("==============================================")
    print(" ANALISIS INVENTARIO - SIGNAL FORMS")
    print("==============================================")
    print(f"Root: {ROOT}")
    print(f"Inventario: {BASE}")
    print("")

    if not BASE.exists():
        print("[ERROR] No existe frontend/src/app/features/inventario")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    ts = read(TS_PATH)
    html = read(HTML_PATH)
    service = read(SERVICE_PATH)
    model = read(MODEL_PATH)

    data = {
        "metadata": {
            "generated_at": now(),
            "root": str(ROOT),
            "base": str(BASE),
        },
        "files": {
            "component_ts": rel(TS_PATH),
            "component_html": rel(HTML_PATH),
            "service": rel(SERVICE_PATH),
            "model": rel(MODEL_PATH),
        },
        "component": {
            "imports": extract_imports(ts),
            "methods": extract_methods(ts),
            "injections": extract_injections(ts),
            "signals": extract_signal_fields(ts),
            "service_calls": extract_service_calls(ts),
            "uses_signal_forms": "@angular/forms/signals" in ts or "[formField]" in html,
            "uses_manual_input": "(input)" in html,
            "uses_value_binding": "[value]" in html,
            "uses_ng_model": "ngModel" in html,
            "uses_reactive_forms_classic": "ReactiveFormsModule" in ts or "formControlName" in html,
        },
        "html": {
            "has_form": "<form" in html.lower(),
            "controls": extract_html_controls(html),
            "input_count": len(re.findall(r"<input\b", html, flags=re.IGNORECASE)),
            "select_count": len(re.findall(r"<select\b", html, flags=re.IGNORECASE)),
            "textarea_count": len(re.findall(r"<textarea\b", html, flags=re.IGNORECASE)),
        },
        "service": {
            "imports": extract_imports(service),
            "methods": extract_methods(service),
            "uses_firestore": any(k in service.lower() for k in ["firestore", "collection", "adddoc", "setdoc", "updatedoc", "deletedoc"]),
            "uses_productos_service": "ProductosService" in service,
        },
        "model_preview": model[:2000],
        "recommendation": {
            "next_step": "Migrar inventario a Signal Forms reales solo después de identificar campos exactos y métodos críticos.",
            "risk": "Inventario afecta stock. No reemplazar a ciegas.",
            "target_pattern": "signal(model) + form(model) + FormField + [formField]"
        }
    }

    OUTPUT_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    md = []
    md.append("# Análisis Inventario para migración a Signal Forms")
    md.append("")
    md.append(f"- Fecha: `{now()}`")
    md.append(f"- Base: `{BASE}`")
    md.append("")
    md.append("## 1. Archivos")
    md.append("")
    for key, value in data["files"].items():
        md.append(f"- **{key}**: `{value}`")

    md.append("")
    md.append("## 2. Estado actual del componente")
    md.append("")
    md.append(f"- Usa Signal Forms reales: `{data['component']['uses_signal_forms']}`")
    md.append(f"- Usa `(input)` manual: `{data['component']['uses_manual_input']}`")
    md.append(f"- Usa `[value]` manual: `{data['component']['uses_value_binding']}`")
    md.append(f"- Usa `ngModel`: `{data['component']['uses_ng_model']}`")
    md.append(f"- Usa Reactive Forms clásico: `{data['component']['uses_reactive_forms_classic']}`")
    md.append("")
    md.append("### Servicios inyectados")
    if data["component"]["injections"]:
        for item in data["component"]["injections"]:
            md.append(f"- `{item['property']}` -> `{item['service']}`")
    else:
        md.append("- No se detectaron servicios inyectados con `inject()`.")

    md.append("")
    md.append("### Métodos del componente")
    for method in data["component"]["methods"]:
        md.append(f"- `{method}()`")

    md.append("")
    md.append("### Llamadas a servicios")
    if data["component"]["service_calls"]:
        for call in data["component"]["service_calls"]:
            md.append(f"- `{call}()`")
    else:
        md.append("- No se detectaron llamadas por patrón.")

    md.append("")
    md.append("## 3. Controles HTML detectados")
    md.append("")
    md.append(f"- Inputs: `{data['html']['input_count']}`")
    md.append(f"- Selects: `{data['html']['select_count']}`")
    md.append(f"- Textareas: `{data['html']['textarea_count']}`")
    md.append("")

    for c in data["html"]["controls"]:
        md.append(f"### `{c['kind']}`")
        md.append(f"- Type: `{c['type']}`")
        md.append(f"- Placeholder: `{c['placeholder']}`")
        md.append(f"- `[value]`: `{c['value_binding']}`")
        md.append(f"- `(input)`: `{c['input_event']}`")
        md.append(f"- `[formField]`: `{c['form_field']}`")
        md.append(f"- Tag: `{c['tag_preview']}`")
        md.append("")

    md.append("## 4. Servicio de inventario")
    md.append("")
    md.append(f"- Usa Firestore directo: `{data['service']['uses_firestore']}`")
    md.append(f"- Usa ProductosService: `{data['service']['uses_productos_service']}`")
    md.append("")
    md.append("### Métodos del servicio")
    for method in data["service"]["methods"]:
        md.append(f"- `{method}()`")

    md.append("")
    md.append("## 5. Recomendación")
    md.append("")
    md.append("- Migrar a Signal Forms reales usando `signal()`, `form()` y `[formField]`.")
    md.append("- Conservar los métodos críticos de stock.")
    md.append("- No cambiar lógica de inventario todavía si el backend no tiene endpoints de inventario.")
    md.append("- Si inventario solo llama a `ProductosService`, se puede migrar únicamente la UI del formulario sin tocar backend.")
    md.append("")

    OUTPUT_MD.write_text("\n".join(md), encoding="utf-8")

    print("[OK] Reporte generado:")
    print(f"MD:   {OUTPUT_MD}")
    print(f"JSON: {OUTPUT_JSON}")
    print("")
    print("Abre con:")
    print(f'notepad "{OUTPUT_MD}"')

    return 0


if __name__ == "__main__":
    raise SystemExit(main())