#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import re
import datetime


ROOT = Path.cwd()
FRONTEND = ROOT / "frontend"

PRODUCTOS_HTML = FRONTEND / "src/app/features/productos/pages/productos-page/productos-page.component.html"
INVENTARIO_HTML = FRONTEND / "src/app/features/inventario/pages/inventario-page/inventario-page.component.html"


def backup(path: Path):
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = path.with_name(path.name + f".compilefix.{stamp}.bak")
    backup_path.write_text(path.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
    print(f"[BACKUP] {path} -> {backup_path}")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def write(path: Path, content: str):
    path.write_text(content, encoding="utf-8")
    print(f"[OK] Escrito: {path}")


def remove_disallowed_attrs_from_formfield_tags(html: str) -> str:
    """
    Angular Signal Forms no permite ciertos atributos como min/step
    directamente en nodos con [formField].
    Este fixer elimina min/max/step solo en tags que tengan [formField].
    """

    def fix_tag(match):
        tag = match.group(0)

        if "[formField]" not in tag:
            return tag

        # Eliminar atributos problemáticos en tags con [formField]
        tag = re.sub(r'\smin="[^"]*"', "", tag)
        tag = re.sub(r"\smin='[^']*'", "", tag)

        tag = re.sub(r'\smax="[^"]*"', "", tag)
        tag = re.sub(r"\smax='[^']*'", "", tag)

        tag = re.sub(r'\sstep="[^"]*"', "", tag)
        tag = re.sub(r"\sstep='[^']*'", "", tag)

        return tag

    # Input/select/textarea de apertura
    html = re.sub(r"<input\b[^>]*>", fix_tag, html, flags=re.I | re.S)
    html = re.sub(r"<select\b[^>]*>", fix_tag, html, flags=re.I | re.S)
    html = re.sub(r"<textarea\b[^>]*>", fix_tag, html, flags=re.I | re.S)

    return html


def fix_inventario_producto_select(html: str) -> str:
    """
    Revertimos solo productoId a manejo anterior porque el modelo actual
    es number | null y select con [formField] espera string.
    Esto evita romper stock mientras migramos el modelo con más cuidado.
    """

    pattern = r'<select\s+id="productoId"\s+\[formField\]="inventarioForm\.productoId"\s*>'

    replacement = (
        '<select id="productoId" '
        '[value]="formulario().productoId ?? \'\'" '
        '(change)="actualizarProducto($any($event.target).value)">'
    )

    html, count = re.subn(pattern, replacement, html, count=1, flags=re.I | re.S)

    if count:
        print("[OK] inventario productoId revertido temporalmente a manejo compatible")
    else:
        print("[SKIP] No se encontró select productoId con [formField] o ya estaba corregido")

    return html


def main():
    print("")
    print("==============================================")
    print(" FIX SIGNAL FORMS COMPILE ERRORS")
    print("==============================================")
    print(f"Root: {ROOT}")
    print("")

    if not PRODUCTOS_HTML.exists():
        print(f"[ERROR] No existe: {PRODUCTOS_HTML}")
        return 1

    if not INVENTARIO_HTML.exists():
        print(f"[ERROR] No existe: {INVENTARIO_HTML}")
        return 1

    # Productos
    backup(PRODUCTOS_HTML)
    productos_html = read(PRODUCTOS_HTML)
    productos_html = remove_disallowed_attrs_from_formfield_tags(productos_html)
    write(PRODUCTOS_HTML, productos_html)

    # Inventario
    backup(INVENTARIO_HTML)
    inventario_html = read(INVENTARIO_HTML)
    inventario_html = remove_disallowed_attrs_from_formfield_tags(inventario_html)
    inventario_html = fix_inventario_producto_select(inventario_html)
    write(INVENTARIO_HTML, inventario_html)

    print("")
    print("==============================================")
    print(" FIX COMPLETADO")
    print("==============================================")
    print("")
    print("Ahora ejecuta:")
    print('cd "C:\\Users\\clint\\Downloads\\bodega-system-proyecto\\frontend"')
    print("ng serve -o")
    print("")
    print("Si compila, luego migramos productoId a Signal Forms 100% con modelo string.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())