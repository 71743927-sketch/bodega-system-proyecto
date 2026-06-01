from pathlib import Path
import argparse
import textwrap


FILES = {
    ".gitignore": r"""
# Entornos virtuales
venv/
.venv/
env/
ENV/

# Python cache
__pycache__/
*.py[cod]
*$py.class

# Variables de entorno y credenciales
.env
.env.*
firebase-service-account.json
serviceAccountKey.json
*.service-account.json

# IDEs
.vscode/
.idea/

# Testing
.pytest_cache/
.coverage
htmlcov/

# Build
build/
dist/
*.egg-info/

# Logs
*.log

# Análisis local
.analysis/
diagnostico_fastapi.txt
""",

    ".env.example": r"""
# Entorno
APP_NAME=BodegaSys API
APP_ENV=development

# CORS
FRONTEND_ORIGINS=http://localhost:4200,http://127.0.0.1:4200

# Firebase Admin SDK
# Ruta local al JSON privado descargado desde Firebase Console.
# NO subir este archivo a GitHub.
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json

# Firestore
FIRESTORE_COLLECTION_PRODUCTOS=productos
FIRESTORE_COLLECTION_USUARIOS=usuarios
""",

    "requirements.txt": r"""
fastapi==0.136.3
uvicorn==0.48.0
pydantic==2.13.4
python-dotenv==1.0.1
firebase-admin==6.5.0
""",

    "README.md": r"""
# BodegaSys Backend - FastAPI + Firebase

Backend inicial para conectar Angular con Firebase mediante FastAPI.

## Arquitectura

```text
Angular
   ↓ HTTP / JSON + Firebase ID Token
FastAPI
   ↓ Firebase Admin SDK
Firebase Auth + Firestore + Storage