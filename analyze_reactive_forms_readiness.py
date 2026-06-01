#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import os
import json
import datetime
import re


ROOT = Path.cwd()
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"

OUTPUT_DIR = ROOT / ".reactive_forms_analysis"
OUTPUT_MD = OUTPUT_DIR / "reactive_forms_readiness_report.md"
OUTPUT_JSON = OUTPUT_DIR / "reactive_forms_readiness_report.json"

IGNORE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    ".angular",
    ".firebase",
    ".venv",
    ".analysis",
    ".cleanup_analysis",
    ".cleanup_quarantine",
}


def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def rel(path: Path, base: Path = FRONTEND) -> str:
    try:
        return str(path.relative_to(base)).replace("\\", "/")
    except Exception:
        return str(path).replace("\\", "/")


def should_skip(path: Path) -> bool:
    return any(part in IGNORE_DIRS for part in path.parts)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def walk_files(base: Path):
    result = []

    if not base.exists():
        return result

    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for file in files:
            path = Path(root) / file

            if should_skip(path):
                continue

            result.append(path)

    return sorted(result)


def component_base_from_html(html_file: Path) -> Path:
    name = html_file.name.replace(".component.html", ".component")
    return html_file.parent / name


def find_related_ts(html_file: Path) -> Path | None:
    ts = html_file.with_suffix("").with_suffix(".ts")

    # caso normal: login-page.component.html -> login-page.component.ts
    if ts.exists():
        return ts

    alt = html_file.parent / html_file.name.replace(".html", ".ts")
    if alt.exists():
        return alt

    return None


def analyze_html_file(html_file: Path):
    html = read_text(html_file)
    ts_file = find_related_ts(html_file)
    ts = read_text(ts_file) if ts_file else ""

    html_lower = html.lower()
    ts_lower = ts.lower()

    has_form = "<form" in html_lower
    has_ng_submit = "(ngsubmit)" in html_lower
    has_submit_event = "(submit)" in html_lower
    has_form_group_binding = "[formgroup]" in html_lower
    has_form_control_name = "formcontrolname" in html_lower
    has_ng_model = "ngmodel" in html_lower
    has_input_event = "(input)" in html_lower
    has_change_event = "(change)" in html_lower

    has_reactive_module = "reactiveformsmodule" in ts_lower
    has_form_builder = "formbuilder" in ts_lower
    has_form_group = "formgroup" in ts_lower
    has_form_control = "formcontrol" in ts_lower
    has_validators = "validators" in ts_lower
    has_signal = "signal(" in ts_lower or "signal<" in ts_lower
    has_setters = bool(re.search(r"actualizar[A-ZÁÉÍÓÚÑa-záéíóúñ0-9_]*\s*\(", ts))

    controls = re.findall(r'formControlName\s*=\s*["\']([^"\']+)["\']', html)
    input_count = len(re.findall(r"<input\b", html_lower))
    select_count = len(re.findall(r"<select\b", html_lower))
    textarea_count = len(re.findall(r"<textarea\b", html_lower))

    if has_form_group_binding and has_form_control_name and has_reactive_module:
        status = "reactive_real"
        priority = "ninguna"
        recommendation = "Ya parece usar Reactive Forms real."
    elif has_form and (has_input_event or has_signal or has_setters) and not has_form_group_binding:
        status = "manual_reactive_like"
        priority = "alta"
        recommendation = "Migrar a Reactive Forms real con FormBuilder, Validators, [formGroup] y formControlName."
    elif has_ng_model:
        status = "template_driven"
        priority = "alta"
        recommendation = "Migrar de ngModel/template-driven a Reactive Forms."
    elif has_form and not has_form_group_binding:
        status = "plain_form"
        priority = "media"
        recommendation = "Revisar y migrar si tiene lógica de validación o envío."
    else:
        status = "no_form_or_unclear"
        priority = "baja"
        recommendation = "No parece formulario principal o requiere revisión manual."

    return {
        "html_file": rel(html_file),
        "ts_file": rel(ts_file) if ts_file else None,
        "has_form": has_form,
        "has_ng_submit": has_ng_submit,
        "has_submit_event": has_submit_event,
        "has_form_group_binding": has_form_group_binding,
        "has_form_control_name": has_form_control_name,
        "has_ng_model": has_ng_model,
        "has_input_event": has_input_event,
        "has_change_event": has_change_event,
        "has_reactive_module": has_reactive_module,
        "has_form_builder": has_form_builder,
        "has_form_group": has_form_group,
        "has_form_control": has_form_control,
        "has_validators": has_validators,
        "has_signal": has_signal,
        "has_setters": has_setters,
        "controls": controls,
        "input_count": input_count,
        "select_count": select_count,
        "textarea_count": textarea_count,
        "status": status,
        "priority": priority,
        "recommendation": recommendation,
    }


def analyze_ts_file(ts_file: Path):
    ts = read_text(ts_file)
    ts_lower = ts.lower()

    return {
        "file": rel(ts_file),
        "uses_reactive_forms_module": "reactiveformsmodule" in ts_lower,
        "uses_form_builder": "formbuilder" in ts_lower,
        "uses_form_group": "formgroup" in ts_lower,
        "uses_form_control": "formcontrol" in ts_lower,
        "uses_validators": "validators" in ts_lower,
        "uses_signal": "signal(" in ts_lower or "signal<" in ts_lower,
        "uses_ng_model_import": "formsmodule" in ts_lower,
        "has_manual_update_methods": bool(re.search(r"actualizar[A-ZÁÉÍÓÚÑa-záéíóúñ0-9_]*\s*\(", ts)),
    }


def main():
    print("")
    print("==============================================")
    print(" ANALISIS REACTIVE FORMS READINESS")
    print("==============================================")
    print(f"Root: {ROOT}")
    print(f"Frontend: {FRONTEND}")
    print("")

    if not FRONTEND.exists():
        print("[ERROR] No existe frontend/. Ejecuta desde la raiz del proyecto.")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = walk_files(SRC)

    html_files = [f for f in files if f.suffix == ".html"]
    ts_files = [f for f in files if f.suffix == ".ts" and not f.name.endswith(".spec.ts")]

    html_analysis = [analyze_html_file(f) for f in html_files]
    ts_analysis = [analyze_ts_file(f) for f in ts_files]

    candidates = [
        item for item in html_analysis
        if item["status"] in ["manual_reactive_like", "template_driven", "plain_form"]
    ]

    priority_order = {
        "alta": 1,
        "media": 2,
        "baja": 3,
        "ninguna": 4,
    }

    candidates = sorted(
        candidates,
        key=lambda x: (
            priority_order.get(x["priority"], 99),
            x["html_file"]
        )
    )

    data = {
        "metadata": {
            "generated_at": now(),
            "root": str(ROOT),
            "frontend": str(FRONTEND),
        },
        "summary": {
            "html_files": len(html_files),
            "ts_files": len(ts_files),
            "forms_detected": len([x for x in html_analysis if x["has_form"]]),
            "reactive_real": len([x for x in html_analysis if x["status"] == "reactive_real"]),
            "manual_reactive_like": len([x for x in html_analysis if x["status"] == "manual_reactive_like"]),
            "template_driven": len([x for x in html_analysis if x["status"] == "template_driven"]),
            "plain_form": len([x for x in html_analysis if x["status"] == "plain_form"]),
            "candidates": len(candidates),
        },
        "html_analysis": html_analysis,
        "ts_analysis": ts_analysis,
        "migration_candidates": candidates,
    }

    OUTPUT_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    md = []
    md.append("# Analisis de formularios reactivos reales")
    md.append("")
    md.append(f"- Proyecto: `{ROOT}`")
    md.append(f"- Frontend: `{FRONTEND}`")
    md.append(f"- Fecha: `{now()}`")
    md.append("")
    md.append("## 1. Resumen")
    md.append("")
    md.append(f"- HTML analizados: `{data['summary']['html_files']}`")
    md.append(f"- TypeScript analizados: `{data['summary']['ts_files']}`")
    md.append(f"- Formularios detectados: `{data['summary']['forms_detected']}`")
    md.append(f"- Formularios Reactive Forms reales detectados: `{data['summary']['reactive_real']}`")
    md.append(f"- Formularios manuales tipo reactivo detectados: `{data['summary']['manual_reactive_like']}`")
    md.append(f"- Formularios template-driven detectados: `{data['summary']['template_driven']}`")
    md.append(f"- Formularios simples detectados: `{data['summary']['plain_form']}`")
    md.append(f"- Candidatos a migracion: `{data['summary']['candidates']}`")
    md.append("")
    md.append("## 2. Candidatos a migrar")
    md.append("")

    if candidates:
        for item in candidates:
            md.append(f"### `{item['html_file']}`")
            md.append("")
            md.append(f"- TS asociado: `{item['ts_file']}`")
            md.append(f"- Estado: `{item['status']}`")
            md.append(f"- Prioridad: `{item['priority']}`")
            md.append(f"- Inputs: `{item['input_count']}`")
            md.append(f"- Selects: `{item['select_count']}`")
            md.append(f"- Textareas: `{item['textarea_count']}`")
            md.append(f"- Usa `<form>`: `{item['has_form']}`")
            md.append(f"- Usa `(input)`: `{item['has_input_event']}`")
            md.append(f"- Usa `ngModel`: `{item['has_ng_model']}`")
            md.append(f"- Usa `[formGroup]`: `{item['has_form_group_binding']}`")
            md.append(f"- Usa `formControlName`: `{item['has_form_control_name']}`")
            md.append(f"- TS usa `ReactiveFormsModule`: `{item['has_reactive_module']}`")
            md.append(f"- TS usa `FormBuilder`: `{item['has_form_builder']}`")
            md.append(f"- TS usa `Validators`: `{item['has_validators']}`")
            md.append(f"- TS usa `signal`: `{item['has_signal']}`")
            md.append(f"- TS tiene setters manuales `actualizar...`: `{item['has_setters']}`")
            md.append(f"- Recomendacion: {item['recommendation']}")
            md.append("")
    else:
        md.append("- No se detectaron candidatos claros.")
        md.append("")

    md.append("## 3. Formularios ya reactivos")
    md.append("")

    reactive_items = [x for x in html_analysis if x["status"] == "reactive_real"]

    if reactive_items:
        for item in reactive_items:
            md.append(f"- `{item['html_file']}` asociado a `{item['ts_file']}`")
    else:
        md.append("- No se detectaron formularios Reactive Forms reales.")
    md.append("")

    md.append("## 4. Recomendacion de migracion")
    md.append("")
    md.append("Orden recomendado:")
    md.append("")
    md.append("1. Login")
    md.append("2. Productos")
    md.append("3. Inventario")
    md.append("4. Compras")
    md.append("5. Ventas")
    md.append("6. Caja")
    md.append("")
    md.append("Criterio:")
    md.append("")
    md.append("- Primero formularios con prioridad `alta`.")
    md.append("- No migrar todo de golpe.")
    md.append("- Hacer backup antes de cada modulo.")
    md.append("- Probar `ng serve` despues de cada migracion.")
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