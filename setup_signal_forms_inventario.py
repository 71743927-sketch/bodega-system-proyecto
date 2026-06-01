#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import re
import datetime


ROOT = Path.cwd()
FRONTEND = ROOT / "frontend"

TS_PATH = FRONTEND / "src/app/features/inventario/pages/inventario-page/inventario-page.component.ts"
HTML_PATH = FRONTEND / "src/app/features/inventario/pages/inventario-page/inventario-page.component.html"


def backup(path: Path):
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = path.with_name(path.name + f".signal.{stamp}.bak")
    backup_path.write_text(path.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
    print(f"[BACKUP] {path} -> {backup_path}")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def write(path: Path, content: str):
    path.write_text(content, encoding="utf-8")
    print(f"[OK] Escrito: {path}")


def add_signal_forms_import(ts: str) -> str:
    if "@angular/forms/signals" in ts:
        print("[SKIP] Ya existe import de @angular/forms/signals")
        return ts

    pattern = "import { Component, computed, inject, signal } from '@angular/core';"

    if pattern in ts:
        ts = ts.replace(
            pattern,
            pattern + "\nimport { form, FormField } from '@angular/forms/signals';"
        )
        print("[OK] Import agregado: form, FormField")
    else:
        # fallback: insertar después del primer import de @angular/core
        ts = re.sub(
            r"(import\s+\{[^}]*\}\s+from\s+'@angular/core';)",
            r"\1\nimport { form, FormField } from '@angular/forms/signals';",
            ts,
            count=1
        )
        print("[OK] Import agregado por fallback")

    return ts


def add_formfield_to_component_imports(ts: str) -> str:
    # Si ya existe FormField en imports del componente, no tocar.
    if re.search(r"imports\s*:\s*\[[^\]]*FormField", ts, flags=re.S):
        print("[SKIP] FormField ya existe en imports")
        return ts

    # Caso standalone con imports: [...]
    if re.search(r"imports\s*:\s*\[", ts):
        ts = re.sub(
            r"imports\s*:\s*\[",
            "imports: [FormField, ",
            ts,
            count=1
        )
        print("[OK] FormField agregado a imports")
        return ts

    # Si no tiene imports, agregar después de standalone: true
    if "standalone: true" in ts:
        ts = ts.replace(
            "standalone: true,",
            "standalone: true,\n  imports: [FormField],"
        )
        print("[OK] imports: [FormField] agregado al componente")
        return ts

    print("[WARN] No se pudo agregar FormField automáticamente. Revisa el @Component.")
    return ts


def add_inventario_form(ts: str) -> str:
    if "inventarioForm" in ts:
        print("[SKIP] inventarioForm ya existe")
        return ts

    lines = ts.splitlines()
    new_lines = []
    inserted = False

    inside_formulario = False
    paren_balance = 0

    for line in lines:
        new_lines.append(line)

        if not inserted and re.search(r"\bformulario\s*=\s*signal", line):
            inside_formulario = True
            paren_balance += line.count("(") - line.count(")")

            # Por si la declaración está en una sola línea
            if paren_balance <= 0 and line.strip().endswith(";"):
                new_lines.append("")
                new_lines.append("  readonly inventarioForm = form(this.formulario);")
                inserted = True
                inside_formulario = False

            continue

        if inside_formulario:
            paren_balance += line.count("(") - line.count(")")

            if paren_balance <= 0 and line.strip().endswith(";"):
                new_lines.append("")
                new_lines.append("  readonly inventarioForm = form(this.formulario);")
                inserted = True
                inside_formulario = False

    if inserted:
        print("[OK] inventarioForm agregado: form(this.formulario)")
    else:
        print("[WARN] No se pudo insertar inventarioForm automáticamente.")
        print("      Agrega manualmente dentro de la clase:")
        print("      readonly inventarioForm = form(this.formulario);")

    return "\n".join(new_lines) + "\n"


def replace_opening_tag_by_id(html: str, tag: str, element_id: str, replacement: str) -> str:
    pattern = rf"<{tag}\b(?=[^>]*\bid=[\"']{re.escape(element_id)}[\"'])[^>]*>"
    new_html, count = re.subn(pattern, replacement, html, count=1, flags=re.S | re.I)

    if count:
        print(f"[OK] Reemplazado <{tag} id=\"{element_id}\">")
    else:
        print(f"[WARN] No se encontró <{tag} id=\"{element_id}\">")

    return new_html


def migrate_html(html: str) -> str:
    html = replace_opening_tag_by_id(
        html,
        "input",
        "cantidad",
        '<input id="cantidad" type="number" min="0" [formField]="inventarioForm.cantidad" />'
    )

    html = replace_opening_tag_by_id(
        html,
        "input",
        "usuario",
        '<input id="usuario" type="text" [formField]="inventarioForm.usuario" placeholder="Ej. Administrador" />'
    )

    html = replace_opening_tag_by_id(
        html,
        "select",
        "productoId",
        '<select id="productoId" [formField]="inventarioForm.productoId">'
    )

    html = replace_opening_tag_by_id(
        html,
        "select",
        "tipo",
        '<select id="tipo" [formField]="inventarioForm.tipo">'
    )

    html = replace_opening_tag_by_id(
        html,
        "textarea",
        "observacion",
        '<textarea id="observacion" rows="4" [formField]="inventarioForm.observacion" placeholder="Ej. Reposición de mercadería, merma, corrección de inventario, etc.">'
    )

    return html


def main():
    print("")
    print("==============================================")
    print(" MIGRAR INVENTARIO A SIGNAL FORMS")
    print("==============================================")
    print(f"Root: {ROOT}")
    print(f"Frontend: {FRONTEND}")
    print(f"TS: {TS_PATH}")
    print(f"HTML: {HTML_PATH}")
    print("")

    if not FRONTEND.exists():
        print("[ERROR] No existe frontend/. Ejecuta desde la raíz del proyecto.")
        return 1

    if not TS_PATH.exists():
        print("[ERROR] No existe inventario-page.component.ts")
        return 1

    if not HTML_PATH.exists():
        print("[ERROR] No existe inventario-page.component.html")
        return 1

    backup(TS_PATH)
    backup(HTML_PATH)

    ts = read(TS_PATH)
    html = read(HTML_PATH)

    ts = add_signal_forms_import(ts)
    ts = add_formfield_to_component_imports(ts)
    ts = add_inventario_form(ts)

    html = migrate_html(html)

    write(TS_PATH, ts)
    write(HTML_PATH, html)

    print("")
    print("==============================================")
    print(" INVENTARIO MIGRADO A SIGNAL FORMS")
    print("==============================================")
    print("")
    print("Ahora ejecuta:")
    print('cd "C:\\Users\\clint\\Downloads\\bodega-system-proyecto\\frontend"')
    print("ng serve -o")
    print("")
    print("Luego prueba:")
    print("http://localhost:4200/inventario")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())