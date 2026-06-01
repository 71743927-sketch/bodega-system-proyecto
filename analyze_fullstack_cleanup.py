#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from pathlib import Path
import os
import json
import ast
import shutil
import datetime
import argparse


ROOT = Path.cwd()
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"

OUTPUT_DIR = ROOT / ".cleanup_analysis"
OUTPUT_MD = OUTPUT_DIR / "fullstack_cleanup_report.md"
OUTPUT_JSON = OUTPUT_DIR / "fullstack_cleanup_report.json"

IGNORE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    ".angular",
    ".firebase",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".analysis",
    ".cleanup_analysis",
    ".cleanup_quarantine",
}

JUNK_EXTENSIONS = {
    ".bak",
    ".log",
    ".tmp",
    ".temp",
}

JUNK_NAMES = {
    ".DS_Store",
    "Thumbs.db",
}

BACKEND_LEGACY_WORDS = [
    "estudiante",
    "persona",
]

SCRIPT_PREFIXES = [
    "setup_",
    "fix_",
    "analyze_",
    "analizar_",
    "bootstrap_",
]


def now():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def stamp():
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    except Exception:
        return str(path).replace("\\", "/")


def rel_from(path: Path, base: Path) -> str:
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

        current = Path(root)

        for file in files:
            path = current / file

            if should_skip(path):
                continue

            result.append(path)

    return sorted(result)


def collect_frontend():
    data = {
        "exists": FRONTEND.exists(),
        "total_files": 0,
        "ts_files": [],
        "html_files": [],
        "style_files": [],
        "root_auxiliary_files": [],
        "junk_files": [],
        "possible_unused_ts": [],
        "references": {},
        "notes": [],
    }

    if not FRONTEND.exists():
        data["notes"].append("No existe carpeta frontend.")
        return data

    files = walk_files(FRONTEND)
    data["total_files"] = len(files)

    ts_files = [f for f in files if f.suffix == ".ts"]
    html_files = [f for f in files if f.suffix == ".html"]
    style_files = [f for f in files if f.suffix in [".css", ".scss"]]

    data["ts_files"] = [rel_from(f, FRONTEND) for f in ts_files]
    data["html_files"] = [rel_from(f, FRONTEND) for f in html_files]
    data["style_files"] = [rel_from(f, FRONTEND) for f in style_files]

    all_text = ""
    for f in files:
        if f.suffix in [".ts", ".html", ".css", ".scss", ".json"]:
            all_text += "\n" + read_text(f)

    for f in files:
        frontend_rel = rel_from(f, FRONTEND)

        if f.name in JUNK_NAMES or f.suffix.lower() in JUNK_EXTENSIONS:
            data["junk_files"].append({
                "file": frontend_rel,
                "reason": "Archivo temporal, backup o log.",
                "confidence": "alta"
            })

        if f.parent == FRONTEND and f.suffix.lower() in [".ps1", ".py", ".txt"]:
            data["root_auxiliary_files"].append({
                "file": frontend_rel,
                "reason": "Archivo auxiliar en la raiz de frontend. Considerar mover a scripts/legacy.",
                "confidence": "media"
            })

    # Detección simple de TS posiblemente no usados:
    # Si el nombre base del archivo no aparece en el texto global, se marca para revisión.
    for f in ts_files:
        frontend_rel = rel_from(f, FRONTEND)

        if frontend_rel.endswith(".spec.ts"):
            continue

        if "/models/" in frontend_rel:
            continue

        if frontend_rel in [
            "src/main.ts",
            "src/app/app.config.ts",
            "src/app/app.routes.ts",
            "src/app/app.ts",
            "src/app/app.component.ts",
        ]:
            continue

        base_name = f.stem.replace(".component", "").replace(".service", "").replace(".guard", "")

        occurrences = all_text.count(base_name)

        data["references"][frontend_rel] = occurrences

        if occurrences <= 1:
            data["possible_unused_ts"].append({
                "file": frontend_rel,
                "reason": "El nombre base del archivo aparece muy pocas veces. Revisar manualmente antes de borrar.",
                "confidence": "baja/media"
            })

    return data


def py_module_name(path: Path) -> str:
    try:
        p = path.relative_to(BACKEND).with_suffix("")
        parts = list(p.parts)
        if parts[-1] == "__init__":
            parts = parts[:-1]
        return ".".join(parts)
    except Exception:
        return ""


def collect_backend():
    data = {
        "exists": BACKEND.exists(),
        "total_files": 0,
        "py_files": [],
        "root_auxiliary_files": [],
        "junk_files": [],
        "legacy_candidates": [],
        "possible_unused_py": [],
        "sensitive_files": [],
        "imports": [],
        "imported_modules": [],
        "routers_in_main": [],
        "syntax_errors": [],
        "notes": [],
    }

    if not BACKEND.exists():
        data["notes"].append("No existe carpeta backend.")
        return data

    files = walk_files(BACKEND)
    py_files = [f for f in files if f.suffix == ".py"]

    data["total_files"] = len(files)
    data["py_files"] = [rel_from(f, BACKEND) for f in py_files]

    imported = set()

    for py in py_files:
        text = read_text(py)

        try:
            tree = ast.parse(text)
        except SyntaxError as e:
            data["syntax_errors"].append({
                "file": rel_from(py, BACKEND),
                "error": str(e)
            })
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imported.add(alias.name)
                    data["imports"].append({
                        "file": rel_from(py, BACKEND),
                        "import": alias.name
                    })

            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                imported.add(module)
                data["imports"].append({
                    "file": rel_from(py, BACKEND),
                    "import": module
                })

        if rel_from(py, BACKEND) == "src/main.py":
            for line in text.splitlines():
                if "include_router" in line:
                    data["routers_in_main"].append(line.strip())

    data["imported_modules"] = sorted(imported)

    for f in files:
        backend_rel = rel_from(f, BACKEND)

        if f.name in JUNK_NAMES or f.suffix.lower() in JUNK_EXTENSIONS:
            data["junk_files"].append({
                "file": backend_rel,
                "reason": "Archivo temporal, backup o log.",
                "confidence": "alta"
            })

        if f.parent == BACKEND and f.suffix.lower() in [".py", ".txt"]:
            if any(f.name.lower().startswith(prefix) for prefix in SCRIPT_PREFIXES):
                data["root_auxiliary_files"].append({
                    "file": backend_rel,
                    "reason": "Script auxiliar en raiz del backend. Considerar mover a scripts/legacy.",
                    "confidence": "media"
                })

        if any(word in backend_rel.lower() for word in BACKEND_LEGACY_WORDS):
            data["legacy_candidates"].append({
                "file": backend_rel,
                "reason": "Relacionado con estudiante/persona del backend reutilizado.",
                "confidence": "alta si no aparece en src/main.py"
            })

    sensitive = [
        BACKEND / ".env",
        BACKEND / "firebase-service-account.json",
        BACKEND / "serviceAccountKey.json",
    ]

    for s in sensitive:
        if s.exists():
            data["sensitive_files"].append({
                "file": rel(s),
                "reason": "Archivo sensible local. Debe estar ignorado por Git."
            })

    for py in py_files:
        backend_rel = rel_from(py, BACKEND)

        if backend_rel == "src/main.py":
            continue

        if backend_rel.endswith("__init__.py"):
            continue

        if backend_rel.startswith("tests/"):
            continue

        module = py_module_name(py)

        is_imported = False
        for imp in imported:
            if imp == module or imp.startswith(module + ".") or module.startswith(imp + "."):
                is_imported = True
                break

        if not is_imported:
            data["possible_unused_py"].append({
                "file": backend_rel,
                "module": module,
                "reason": "No aparece importado por otros archivos Python detectados.",
                "confidence": "media"
            })

    return data


def collect_root():
    data = {
        "root_files": [],
        "auxiliary_files": [],
        "junk_files": [],
        "folders": [],
    }

    for item in ROOT.iterdir():
        if item.is_dir():
            data["folders"].append(item.name)
            continue

        data["root_files"].append(item.name)

        if item.name in JUNK_NAMES or item.suffix.lower() in JUNK_EXTENSIONS:
            data["junk_files"].append({
                "file": item.name,
                "reason": "Archivo temporal, backup o log.",
                "confidence": "alta"
            })

        if item.suffix.lower() in [".py", ".ps1"]:
            data["auxiliary_files"].append({
                "file": item.name,
                "reason": "Script auxiliar en raiz. Considerar mover a scripts/.",
                "confidence": "media"
            })

    return data


def build_cleanup_plan(frontend, backend, root):
    plan = []

    for item in frontend["junk_files"]:
        plan.append({
            "path": "frontend/" + item["file"],
            "action": "quarantine",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    for item in backend["junk_files"]:
        plan.append({
            "path": "backend/" + item["file"],
            "action": "quarantine",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    for item in root["junk_files"]:
        plan.append({
            "path": item["file"],
            "action": "quarantine",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    for item in backend["root_auxiliary_files"]:
        plan.append({
            "path": "backend/" + item["file"],
            "action": "move_to_scripts_legacy",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    for item in frontend["root_auxiliary_files"]:
        plan.append({
            "path": "frontend/" + item["file"],
            "action": "move_to_scripts_legacy",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    for item in root["auxiliary_files"]:
        plan.append({
            "path": item["file"],
            "action": "move_to_scripts",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    for item in backend["legacy_candidates"]:
        plan.append({
            "path": "backend/" + item["file"],
            "action": "review_legacy",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    for item in frontend["possible_unused_ts"]:
        plan.append({
            "path": "frontend/" + item["file"],
            "action": "review_only",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    for item in backend["possible_unused_py"]:
        plan.append({
            "path": "backend/" + item["file"],
            "action": "review_only",
            "reason": item["reason"],
            "confidence": item["confidence"]
        })

    return plan


def write_reports(data):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    OUTPUT_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    md = []

    md.append("# Reporte de limpieza fullstack")
    md.append("")
    md.append(f"- Proyecto: `{ROOT}`")
    md.append(f"- Fecha: `{now()}`")
    md.append("")
    md.append("## 1. Resumen")
    md.append("")
    md.append(f"- Frontend existe: `{data['frontend']['exists']}`")
    md.append(f"- Backend existe: `{data['backend']['exists']}`")
    md.append(f"- Archivos frontend analizados: `{data['frontend']['total_files']}`")
    md.append(f"- Archivos backend analizados: `{data['backend']['total_files']}`")
    md.append(f"- Candidatos de limpieza: `{len(data['cleanup_plan'])}`")
    md.append("")

    md.append("## 2. Backend")
    md.append("")
    md.append("### Routers detectados en main.py")
    if data["backend"]["routers_in_main"]:
        for r in data["backend"]["routers_in_main"]:
            md.append(f"- `{r}`")
    else:
        md.append("- No se detectaron routers.")

    md.append("")
    md.append("### Errores de sintaxis Python")
    if data["backend"]["syntax_errors"]:
        for e in data["backend"]["syntax_errors"]:
            md.append(f"- `{e['file']}`: {e['error']}")
    else:
        md.append("- No se detectaron errores de sintaxis.")

    md.append("")
    md.append("### Candidatos legacy estudiante/persona")
    if data["backend"]["legacy_candidates"]:
        for item in data["backend"]["legacy_candidates"]:
            md.append(f"- `{item['file']}` - {item['reason']} - confianza: `{item['confidence']}`")
    else:
        md.append("- No se detectaron candidatos legacy.")

    md.append("")
    md.append("### Scripts auxiliares en backend")
    if data["backend"]["root_auxiliary_files"]:
        for item in data["backend"]["root_auxiliary_files"]:
            md.append(f"- `{item['file']}` - {item['reason']}")
    else:
        md.append("- No se detectaron scripts auxiliares.")

    md.append("")
    md.append("### Python posiblemente no usado")
    if data["backend"]["possible_unused_py"]:
        for item in data["backend"]["possible_unused_py"]:
            md.append(f"- `{item['file']}` - modulo `{item['module']}` - {item['reason']}")
    else:
        md.append("- No se detectaron candidatos Python no usados.")

    md.append("")
    md.append("### Archivos sensibles locales")
    if data["backend"]["sensitive_files"]:
        for item in data["backend"]["sensitive_files"]:
            md.append(f"- `{item['file']}` - {item['reason']}")
    else:
        md.append("- No se detectaron archivos sensibles locales.")

    md.append("")
    md.append("## 3. Frontend")
    md.append("")
    md.append("### Scripts auxiliares en frontend")
    if data["frontend"]["root_auxiliary_files"]:
        for item in data["frontend"]["root_auxiliary_files"]:
            md.append(f"- `{item['file']}` - {item['reason']}")
    else:
        md.append("- No se detectaron scripts auxiliares.")

    md.append("")
    md.append("### TypeScript posiblemente no usado")
    if data["frontend"]["possible_unused_ts"]:
        for item in data["frontend"]["possible_unused_ts"]:
            md.append(f"- `{item['file']}` - {item['reason']} - confianza: `{item['confidence']}`")
    else:
        md.append("- No se detectaron candidatos TypeScript no usados.")

    md.append("")
    md.append("## 4. Plan de limpieza sugerido")
    md.append("")
    if data["cleanup_plan"]:
        for item in data["cleanup_plan"]:
            md.append(f"- `{item['path']}`")
            md.append(f"  - Acción: `{item['action']}`")
            md.append(f"  - Motivo: {item['reason']}")
            md.append(f"  - Confianza: `{item['confidence']}`")
    else:
        md.append("- No hay candidatos.")

    md.append("")
    md.append("## 5. Recomendación")
    md.append("")
    md.append("No elimines archivos marcados como `review_only` sin revisar.")
    md.append("Primero limpia scripts auxiliares, backups `.bak`, logs y módulos legacy confirmados.")
    md.append("")
    md.append("Después de limpiar, prueba:")
    md.append("")
    md.append("```powershell")
    md.append("cd backend")
    md.append("python -m uvicorn src.main:app --reload")
    md.append("")
    md.append("cd ../frontend")
    md.append("ng serve -o")
    md.append("```")

    OUTPUT_MD.write_text("\n".join(md), encoding="utf-8")


def move_candidates(plan):
    quarantine = ROOT / ".cleanup_quarantine" / stamp()
    quarantine.mkdir(parents=True, exist_ok=True)

    for item in plan:
        action = item["action"]
        source = ROOT / item["path"]

        if not source.exists():
            continue

        if action == "quarantine":
            target = quarantine / item["path"]
        elif action == "move_to_scripts_legacy":
            target = ROOT / "scripts" / "legacy" / source.name
        elif action == "move_to_scripts":
            target = ROOT / "scripts" / source.name
        else:
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(target))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--move-candidates", action="store_true")
    args = parser.parse_args()

    print("")
    print("==============================================")
    print(" ANALISIS FULLSTACK CLEANUP")
    print("==============================================")
    print(f"Root: {ROOT}")
    print(f"Frontend: {FRONTEND}")
    print(f"Backend: {BACKEND}")
    print("")

    frontend = collect_frontend()
    backend = collect_backend()
    root = collect_root()
    plan = build_cleanup_plan(frontend, backend, root)

    data = {
        "metadata": {
            "generated_at": now(),
            "root": str(ROOT),
            "frontend": str(FRONTEND),
            "backend": str(BACKEND),
        },
        "frontend": frontend,
        "backend": backend,
        "root": root,
        "cleanup_plan": plan,
    }

    write_reports(data)

    if args.move_candidates:
        move_candidates(plan)
        print("[OK] Candidatos seguros movidos.")

    print("[OK] Reporte generado:")
    print(f"MD:   {OUTPUT_MD}")
    print(f"JSON: {OUTPUT_JSON}")
    print("")
    print("Abre con:")
    print(f'notepad "{OUTPUT_MD}"')

    return 0


if __name__ == "__main__":
    raise SystemExit(main())