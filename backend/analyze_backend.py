#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Analizador robusto para backend Python / FastAPI.

Uso:
    python analyze_backend.py --root .

Genera:
    .analysis/backend_analysis_YYYYMMDD_HHMMSS.json
    .analysis/backend_analysis_YYYYMMDD_HHMMSS.md

Analiza:
- Framework detectado
- Dependencias
- Estructura de carpetas
- main.py
- Routers FastAPI
- Endpoints
- Schemas Pydantic
- Services
- Repositories
- CORS
- Seguridad
- Posibles secretos
- Riesgos arquitectónicos
- Recomendaciones para adaptar a Angular + Firebase
"""

from __future__ import annotations

import argparse
import ast
import datetime as dt
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional


IGNORE_DIRS = {
    ".git",
    ".venv",
    "venv",
    "env",
    "ENV",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".idea",
    ".vscode",
    ".analysis",
    "site-packages",
    "Lib",
    "Scripts",
    "Include",
}

IGNORE_FILES = {
    ".DS_Store",
    "Thumbs.db",
}

TEXT_EXTENSIONS = {
    ".py",
    ".txt",
    ".md",
    ".json",
    ".toml",
    ".yaml",
    ".yml",
    ".env",
    ".ini",
    ".cfg",
}

ROUTE_METHODS = {"get", "post", "put", "patch", "delete", "options", "head"}

SECRET_PATTERNS = {
    "private_key": re.compile(r"-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----", re.IGNORECASE),
    "api_key": re.compile(r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"][^'\"]{10,}['\"]"),
    "token": re.compile(r"(?i)(token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*['\"][^'\"]{15,}['\"]"),
    "password": re.compile(r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{6,}['\"]"),
    "database_url": re.compile(r"(?i)(DATABASE_URL|database_url)\s*[:=]\s*['\"]?[^'\"]+"),
    "firebase_admin_key": re.compile(r"(?i)(private_key_id|client_email|firebase_admin|serviceAccount)"),
}

TODO_PATTERN = re.compile(r"\b(TODO|FIXME|HACK|BUG|XXX)\b[:\s-]*(.*)", re.IGNORECASE)


def timestamp() -> str:
    return dt.datetime.now().strftime("%Y%m%d_%H%M%S")


def normalize(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def should_ignore(path: Path, root: Path) -> bool:
    try:
        rel = path.relative_to(root)
        parts = rel.parts
    except ValueError:
        parts = path.parts

    for part in parts:
        if part in IGNORE_DIRS:
            return True

    if path.name in IGNORE_FILES:
        return True

    return False


def is_text_file(path: Path) -> bool:
    if path.name.lower().startswith(".env"):
        return True
    if path.name.lower() in {"dockerfile", "makefile"}:
        return True
    return path.suffix.lower() in TEXT_EXTENSIONS


def read_text(path: Path, max_bytes: int = 2_000_000) -> tuple[Optional[str], Optional[str]]:
    try:
        if path.stat().st_size > max_bytes:
            return None, f"Archivo omitido por tamaño mayor a {max_bytes} bytes"

        data = path.read_bytes()

        if b"\x00" in data[:4096]:
            return None, "Archivo binario detectado"

        return data.decode("utf-8", errors="replace"), None
    except Exception as exc:
        return None, str(exc)


def find_files(root: Path) -> List[Path]:
    files: List[Path] = []

    for current_root, dirs, filenames in os.walk(root):
        current = Path(current_root)

        dirs[:] = [
            d for d in dirs
            if d not in IGNORE_DIRS and not should_ignore(current / d, root)
        ]

        for filename in filenames:
            path = current / filename
            if not should_ignore(path, root):
                files.append(path)

    return files


def load_requirements(root: Path) -> Dict[str, Any]:
    result = {
        "exists": False,
        "dependencies": [],
        "frameworks_detected": [],
        "warnings": [],
    }

    req = root / "requirements.txt"

    if not req.exists():
        result["warnings"].append("No se encontró requirements.txt.")
        return result

    result["exists"] = True

    text, err = read_text(req)
    if err:
        result["warnings"].append(f"No se pudo leer requirements.txt: {err}")
        return result

    dependencies = []

    for line in (text or "").splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#"):
            continue
        dependencies.append(clean)

    result["dependencies"] = dependencies

    joined = "\n".join(dependencies).lower()

    framework_keywords = {
        "fastapi": "FastAPI",
        "uvicorn": "Uvicorn",
        "pydantic": "Pydantic",
        "starlette": "Starlette",
        "flask": "Flask",
        "django": "Django",
        "sqlalchemy": "SQLAlchemy",
        "firebase-admin": "Firebase Admin SDK",
        "python-dotenv": "python-dotenv",
        "pytest": "Pytest",
    }

    for key, label in framework_keywords.items():
        if key in joined:
            result["frameworks_detected"].append(label)

    return result


def get_constant_string(node: ast.AST) -> Optional[str]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def extract_decorator_route(decorator: ast.AST) -> Optional[Dict[str, Any]]:
    """
    Detecta decoradores tipo:
        @router.get("/")
        @app.post("/items")
    """
    if not isinstance(decorator, ast.Call):
        return None

    func = decorator.func

    if not isinstance(func, ast.Attribute):
        return None

    method = func.attr.lower()

    if method not in ROUTE_METHODS:
        return None

    router_name = None

    if isinstance(func.value, ast.Name):
        router_name = func.value.id
    elif isinstance(func.value, ast.Attribute):
        router_name = ast.unparse(func.value)

    path = None

    if decorator.args:
        path = get_constant_string(decorator.args[0])

    kwargs = {}

    for kw in decorator.keywords:
        try:
            kwargs[kw.arg] = ast.unparse(kw.value)
        except Exception:
            kwargs[kw.arg] = "<no_parse>"

    return {
        "router": router_name,
        "method": method.upper(),
        "path": path or "",
        "kwargs": kwargs,
    }


def analyze_python_file(path: Path, root: Path) -> Dict[str, Any]:
    rel = normalize(path, root)

    info: Dict[str, Any] = {
        "file": rel,
        "lines": 0,
        "imports": [],
        "classes": [],
        "functions": [],
        "async_functions": [],
        "routes": [],
        "pydantic_models": [],
        "fastapi_app_detected": False,
        "apirouter_detected": False,
        "include_router_calls": [],
        "syntax_error": None,
    }

    text, err = read_text(path)

    if err:
        info["read_error"] = err
        return info

    text = text or ""
    info["lines"] = text.count("\n") + 1

    if "FastAPI(" in text:
        info["fastapi_app_detected"] = True

    if "APIRouter(" in text:
        info["apirouter_detected"] = True

    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        info["syntax_error"] = str(exc)
        return info

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                info["imports"].append(alias.name)

        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                imported = f"{module}.{alias.name}" if module else alias.name
                info["imports"].append(imported)

        elif isinstance(node, ast.ClassDef):
            bases = []
            for base in node.bases:
                try:
                    bases.append(ast.unparse(base))
                except Exception:
                    pass

            class_item = {
                "name": node.name,
                "line": node.lineno,
                "bases": bases,
            }

            info["classes"].append(class_item)

            bases_joined = " ".join(bases).lower()
            if "basemodel" in bases_joined:
                info["pydantic_models"].append(class_item)

        elif isinstance(node, ast.FunctionDef):
            function_item = {
                "name": node.name,
                "line": node.lineno,
                "decorators": [],
            }

            for decorator in node.decorator_list:
                route = extract_decorator_route(decorator)
                if route:
                    route["function"] = node.name
                    route["line"] = node.lineno
                    info["routes"].append(route)
                    function_item["decorators"].append(route)

            info["functions"].append(function_item)

        elif isinstance(node, ast.AsyncFunctionDef):
            function_item = {
                "name": node.name,
                "line": node.lineno,
                "decorators": [],
            }

            for decorator in node.decorator_list:
                route = extract_decorator_route(decorator)
                if route:
                    route["function"] = node.name
                    route["line"] = node.lineno
                    info["routes"].append(route)
                    function_item["decorators"].append(route)

            info["async_functions"].append(function_item)

        elif isinstance(node, ast.Call):
            try:
                call_text = ast.unparse(node)
            except Exception:
                call_text = ""

            if ".include_router(" in call_text or call_text.startswith("include_router("):
                info["include_router_calls"].append({
                    "line": getattr(node, "lineno", None),
                    "call": call_text,
                })

    info["imports"] = sorted(set(info["imports"]))
    return info


def analyze_project_files(root: Path, files: List[Path]) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "totals": {
            "files": len(files),
            "text_files": 0,
            "python_files": 0,
            "total_lines": 0,
            "python_lines": 0,
        },
        "file_types": {},
        "directories": {},
        "python_files": [],
        "routes": [],
        "schemas": [],
        "services": [],
        "repositories": [],
        "apis": [],
        "possible_secrets": [],
        "todos": [],
        "cors_detected_files": [],
        "auth_detected_files": [],
        "firebase_detected_files": [],
        "database_detected_files": [],
        "tests": [],
        "read_errors": [],
    }

    dir_counter = Counter()

    for path in files:
        rel = normalize(path, root)
        suffix = path.suffix.lower() or "[no_ext]"

        result["file_types"][suffix] = result["file_types"].get(suffix, 0) + 1

        top_dir = rel.split("/")[0] if "/" in rel else "."
        dir_counter[top_dir] += 1

        if "test" in path.name.lower() or "/tests/" in rel.lower():
            result["tests"].append(rel)

        if not is_text_file(path):
            continue

        text, err = read_text(path)

        if err:
            result["read_errors"].append({
                "file": rel,
                "error": err,
            })
            continue

        text = text or ""

        result["totals"]["text_files"] += 1
        result["totals"]["total_lines"] += text.count("\n") + 1

        lowered = text.lower()

        if "cors" in lowered or "corsemiddleware" in text:
            result["cors_detected_files"].append(rel)

        if any(k in lowered for k in ["authorization", "bearer", "jwt", "oauth", "verify_id_token", "firebase_admin.auth"]):
            result["auth_detected_files"].append(rel)

        if any(k in lowered for k in ["firebase_admin", "firestore", "firebase"]):
            result["firebase_detected_files"].append(rel)

        if any(k in lowered for k in ["sqlalchemy", "sqlite", "postgres", "mysql", "mongodb", "pymongo", "database_url"]):
            result["database_detected_files"].append(rel)

        for secret_type, pattern in SECRET_PATTERNS.items():
            for match in pattern.finditer(text):
                result["possible_secrets"].append({
                    "file": rel,
                    "type": secret_type,
                    "preview": match.group(0)[:120],
                })

        for idx, line in enumerate(text.splitlines(), start=1):
            todo = TODO_PATTERN.search(line)
            if todo:
                result["todos"].append({
                    "file": rel,
                    "line": idx,
                    "tag": todo.group(1).upper(),
                    "text": todo.group(2).strip()[:250],
                })

        if path.suffix.lower() == ".py":
            result["totals"]["python_files"] += 1
            result["totals"]["python_lines"] += text.count("\n") + 1

            py_info = analyze_python_file(path, root)
            result["python_files"].append(py_info)

            for route in py_info.get("routes", []):
                route["file"] = rel
                result["routes"].append(route)

            if "/schema/" in rel or rel.startswith("src/schema/"):
                result["schemas"].append(rel)

            if "/services/" in rel or rel.startswith("src/services/"):
                result["services"].append(rel)

            if "/repository/" in rel or rel.startswith("src/repository/") or "/repositories/" in rel:
                result["repositories"].append(rel)

            if "/apis/" in rel or rel.startswith("src/apis/") or "/routers/" in rel:
                result["apis"].append(rel)

    result["directories"] = dict(dir_counter)

    for key in [
        "cors_detected_files",
        "auth_detected_files",
        "firebase_detected_files",
        "database_detected_files",
        "tests",
        "schemas",
        "services",
        "repositories",
        "apis",
    ]:
        result[key] = sorted(set(result[key]))

    return result


def infer_architecture(requirements: Dict[str, Any], analysis: Dict[str, Any]) -> Dict[str, Any]:
    conclusions: List[str] = []
    risks: List[str] = []
    recommendations: List[str] = []

    frameworks = requirements.get("frameworks_detected", [])

    if "FastAPI" in frameworks or any(f.get("fastapi_app_detected") for f in analysis["python_files"]):
        conclusions.append("El backend usa FastAPI.")
    elif "Flask" in frameworks:
        conclusions.append("El backend parece usar Flask.")
    elif "Django" in frameworks:
        conclusions.append("El backend parece usar Django.")
    else:
        conclusions.append("No se detectó claramente el framework principal.")

    if analysis["apis"]:
        conclusions.append("Tiene capa de API/routers separada.")
    if analysis["services"]:
        conclusions.append("Tiene capa de servicios separada.")
    if analysis["repositories"]:
        conclusions.append("Tiene capa de repositorio separada.")
    if analysis["schemas"]:
        conclusions.append("Tiene capa de schemas/modelos de entrada separada.")

    if analysis["routes"]:
        conclusions.append(f"Se detectaron {len(analysis['routes'])} endpoints o rutas FastAPI.")
    else:
        risks.append("No se detectaron endpoints FastAPI con decoradores estándar.")

    if not analysis["cors_detected_files"]:
        risks.append("No se detectó configuración CORS. Angular podría tener problemas al consumir la API.")

    if not analysis["auth_detected_files"]:
        risks.append("No se detectó autenticación/autorización en backend.")

    if not analysis["tests"]:
        risks.append("No se detectaron pruebas automatizadas.")

    if analysis["possible_secrets"]:
        risks.append("Se detectaron posibles secretos o credenciales en el código.")

    if not requirements.get("exists"):
        risks.append("No existe requirements.txt.")

    if "Firebase Admin SDK" not in frameworks and not analysis["firebase_detected_files"]:
        recommendations.append("Si se conectará con Firebase, agregar firebase-admin al backend.")

    recommendations.extend([
        "Agregar CORS para permitir consumo desde Angular.",
        "Validar tokens de Firebase Auth en FastAPI si Angular seguirá usando login con Firebase.",
        "Mantener arquitectura por capas: API → Service → Repository.",
        "Crear routers por módulos reales del sistema: productos, inventario, ventas, caja, usuarios, auditoría.",
        "Crear schemas Pydantic por entidad para validar entrada y salida JSON.",
        "No subir entornos virtuales como venv, .venv, Lib, Scripts ni __pycache__ al repositorio.",
        "Agregar .gitignore para Python.",
        "Agregar README.md con instalación, ejecución y endpoints principales.",
        "Agregar pruebas con pytest para endpoints críticos.",
    ])

    return {
        "conclusions": conclusions,
        "risks": risks,
        "recommendations": recommendations,
    }


def build_markdown(report: Dict[str, Any]) -> str:
    lines: List[str] = []

    meta = report["metadata"]
    req = report["requirements"]
    analysis = report["analysis"]
    inference = report["inference"]

    lines.append("# Reporte de análisis del backend")
    lines.append("")
    lines.append(f"- **Ruta analizada:** `{meta['root']}`")
    lines.append(f"- **Fecha:** `{meta['generated_at']}`")
    lines.append(f"- **Python usado para analizar:** `{meta['python_version']}`")
    lines.append("")

    lines.append("## 1. Resumen ejecutivo")
    lines.append("")
    for item in inference["conclusions"]:
        lines.append(f"- {item}")
    lines.append("")

    lines.append("## 2. Dependencias detectadas")
    lines.append("")
    if req["dependencies"]:
        for dep in req["dependencies"]:
            lines.append(f"- `{dep}`")
    else:
        lines.append("- No se encontraron dependencias.")
    lines.append("")

    lines.append("### Frameworks/librerías principales")
    lines.append("")
    if req["frameworks_detected"]:
        for fw in req["frameworks_detected"]:
            lines.append(f"- {fw}")
    else:
        lines.append("- No se detectaron frameworks principales.")
    lines.append("")

    lines.append("## 3. Métricas generales")
    lines.append("")
    totals = analysis["totals"]
    lines.append(f"- Archivos analizados: `{totals['files']}`")
    lines.append(f"- Archivos de texto: `{totals['text_files']}`")
    lines.append(f"- Archivos Python: `{totals['python_files']}`")
    lines.append(f"- Líneas totales aproximadas: `{totals['total_lines']}`")
    lines.append(f"- Líneas Python aproximadas: `{totals['python_lines']}`")
    lines.append("")

    lines.append("## 4. Capas detectadas")
    lines.append("")
    lines.append(f"- APIs/Routers: `{len(analysis['apis'])}`")
    for f in analysis["apis"]:
        lines.append(f"  - `{f}`")
    lines.append("")
    lines.append(f"- Services: `{len(analysis['services'])}`")
    for f in analysis["services"]:
        lines.append(f"  - `{f}`")
    lines.append("")
    lines.append(f"- Repositories: `{len(analysis['repositories'])}`")
    for f in analysis["repositories"]:
        lines.append(f"  - `{f}`")
    lines.append("")
    lines.append(f"- Schemas: `{len(analysis['schemas'])}`")
    for f in analysis["schemas"]:
        lines.append(f"  - `{f}`")
    lines.append("")

    lines.append("## 5. Endpoints FastAPI detectados")
    lines.append("")
    if analysis["routes"]:
        for route in analysis["routes"]:
            lines.append(
                f"- `{route['method']} {route['path']}` → `{route['function']}` "
                f"en `{route['file']}`"
            )
    else:
        lines.append("- No se detectaron endpoints.")
    lines.append("")

    lines.append("## 6. Archivos principales Python")
    lines.append("")
    for py_file in analysis["python_files"]:
        lines.append(f"### `{py_file['file']}`")
        lines.append(f"- Líneas: `{py_file['lines']}`")
        lines.append(f"- Clases: `{len(py_file['classes'])}`")
        lines.append(f"- Funciones: `{len(py_file['functions'])}`")
        lines.append(f"- Funciones async: `{len(py_file['async_functions'])}`")
        lines.append(f"- Rutas: `{len(py_file['routes'])}`")

        if py_file["include_router_calls"]:
            lines.append("- Include router:")
            for call in py_file["include_router_calls"]:
                lines.append(f"  - Línea {call['line']}: `{call['call']}`")

        if py_file["pydantic_models"]:
            lines.append("- Modelos Pydantic:")
            for model in py_file["pydantic_models"]:
                lines.append(f"  - `{model['name']}` línea `{model['line']}`")

        lines.append("")

    lines.append("## 7. Seguridad, CORS, Firebase y base de datos")
    lines.append("")
    lines.append("### CORS")
    if analysis["cors_detected_files"]:
        for f in analysis["cors_detected_files"]:
            lines.append(f"- `{f}`")
    else:
        lines.append("- No se detectó CORS.")
    lines.append("")

    lines.append("### Autenticación/autorización")
    if analysis["auth_detected_files"]:
        for f in analysis["auth_detected_files"]:
            lines.append(f"- `{f}`")
    else:
        lines.append("- No se detectó autenticación/autorización.")
    lines.append("")

    lines.append("### Firebase")
    if analysis["firebase_detected_files"]:
        for f in analysis["firebase_detected_files"]:
            lines.append(f"- `{f}`")
    else:
        lines.append("- No se detectó Firebase.")
    lines.append("")

    lines.append("### Base de datos")
    if analysis["database_detected_files"]:
        for f in analysis["database_detected_files"]:
            lines.append(f"- `{f}`")
    else:
        lines.append("- No se detectó base de datos.")
    lines.append("")

    lines.append("## 8. Riesgos detectados")
    lines.append("")
    if inference["risks"]:
        for risk in inference["risks"]:
            lines.append(f"- {risk}")
    else:
        lines.append("- No se detectaron riesgos críticos.")
    lines.append("")

    if analysis["possible_secrets"]:
        lines.append("### Posibles secretos")
        for secret in analysis["possible_secrets"]:
            lines.append(f"- `{secret['type']}` en `{secret['file']}`")
        lines.append("")

    if analysis["todos"]:
        lines.append("### TODO/FIXME/HACK")
        for todo in analysis["todos"]:
            lines.append(f"- `{todo['tag']}` en `{todo['file']}:{todo['line']}` - {todo['text']}")
        lines.append("")

    lines.append("## 9. Recomendaciones")
    lines.append("")
    for rec in inference["recommendations"]:
        lines.append(f"- {rec}")
    lines.append("")

    lines.append("## 10. Propuesta de adaptación para Angular + Firebase")
    lines.append("")
    lines.append("Arquitectura recomendada:")
    lines.append("")
    lines.append("```text")
    lines.append("Angular")
    lines.append("   ↓ HTTP / JSON")
    lines.append("FastAPI")
    lines.append("   ↓ Firebase Admin SDK")
    lines.append("Firebase Auth + Firestore + Storage")
    lines.append("```")
    lines.append("")
    lines.append("Módulos sugeridos para el backend real:")
    lines.append("")
    lines.append("- auth")
    lines.append("- productos")
    lines.append("- inventario")
    lines.append("- ventas")
    lines.append("- compras")
    lines.append("- caja")
    lines.append("- usuarios")
    lines.append("- auditoria")
    lines.append("- reportes")
    lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Analizador robusto de backend Python/FastAPI.")
    parser.add_argument("--root", default=".", help="Ruta raíz del proyecto backend.")
    args = parser.parse_args()

    root = Path(args.root).resolve()

    if not root.exists() or not root.is_dir():
        print(f"[ERROR] Ruta inválida: {root}")
        return 1

    print(f"[INFO] Analizando backend en: {root}")
    print("[INFO] Ignorando venv, .venv, Lib, Scripts, __pycache__, site-packages...")

    files = find_files(root)

    requirements = load_requirements(root)
    analysis = analyze_project_files(root, files)
    inference = infer_architecture(requirements, analysis)

    report = {
        "metadata": {
            "root": str(root),
            "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
            "python_version": sys.version.replace("\n", " "),
            "ignored_dirs": sorted(IGNORE_DIRS),
        },
        "requirements": requirements,
        "analysis": analysis,
        "inference": inference,
    }

    out_dir = root / ".analysis"
    out_dir.mkdir(exist_ok=True)

    stamp = timestamp()
    json_path = out_dir / f"backend_analysis_{stamp}.json"
    md_path = out_dir / f"backend_analysis_{stamp}.md"

    json_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    md_path.write_text(
        build_markdown(report),
        encoding="utf-8"
    )

    print("")
    print("[OK] Análisis finalizado.")
    print(f"[OK] Reporte JSON: {json_path}")
    print(f"[OK] Reporte Markdown: {md_path}")
    print("")
    print("Resumen rápido:")

    for item in inference["conclusions"]:
        print(f"  - {item}")

    if inference["risks"]:
        print("")
        print("Riesgos:")
        for risk in inference["risks"]:
            print(f"  - {risk}")

    print("")
    print("Abre el reporte con:")
    print(f"notepad {md_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())