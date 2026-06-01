#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
bootstrap_backend.py

Generador robusto para backend FastAPI + Firebase Admin SDK.

Arquitectura generada:

Angular
   ↓ HTTP / JSON + Firebase ID Token
FastAPI
   ↓ Firebase Admin SDK
Firebase Auth + Firestore + Storage

Uso:
    python .\bootstrap_backend.py --root . --backup --force

Opciones:
    --root .              Ruta donde se generará el backend.
    --dry-run             Simula sin crear archivos.
    --backup              Crea respaldo de archivos existentes antes de sobrescribir.
    --force               Sobrescribe archivos existentes.
    --allow-angular-root  Permite ejecutar en carpeta Angular. No recomendado.
"""

from __future__ import annotations

import argparse
import datetime as dt
import shutil
import textwrap
from pathlib import Path


FILES = {
    ".gitignore": r"""
# Python virtual environments
.venv/
venv/
env/
ENV/

# Python cache
__pycache__/
*.py[cod]
*$py.class

# Environment variables
.env
.env.*

# Firebase private credentials
firebase-service-account.json
serviceAccountKey.json
*.service-account.json
*.firebase-admin.json

# IDE
.vscode/
.idea/

# Tests and coverage
.pytest_cache/
.coverage
htmlcov/

# Build
build/
dist/
*.egg-info/

# Logs
*.log

# Local analysis
.analysis/
.backup/
analyze_backend.py
diagnostico_fastapi.txt
""",

    ".env.example": r"""
APP_NAME=BodegaSys API
APP_ENV=development

# Angular local
FRONTEND_ORIGINS=http://localhost:4200,http://127.0.0.1:4200

# Firebase Admin SDK private file
# Descarga este JSON desde Firebase Console > Project Settings > Service Accounts.
# NO subir este archivo a GitHub.
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json

# Firestore collections
FIRESTORE_COLLECTION_PRODUCTOS=productos
FIRESTORE_COLLECTION_USUARIOS=usuarios
FIRESTORE_COLLECTION_AUDITORIA=auditoria
""",

    "requirements.txt": r"""
fastapi==0.136.3
uvicorn==0.48.0
pydantic==2.13.4
python-dotenv==1.0.1
firebase-admin==6.5.0
pytest==8.3.4
httpx==0.27.2
""",

    "README.md": r"""
# BodegaSys Backend

Backend FastAPI para conectar Angular con Firebase.

## Arquitectura

```text
Angular
   ↓ HTTP / JSON + Firebase ID Token
FastAPI
   ↓ Firebase Admin SDK
Firebase Auth + Firestore + Storage