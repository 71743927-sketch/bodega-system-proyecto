from pathlib import Path
import argparse
import datetime
import shutil


def write_file(root: Path, relative_path: str, content: str, force: bool, backup: bool):
    target = root / relative_path

    if target.exists() and not force:
        print(f"[SKIP] Ya existe: {relative_path}")
        return

    if target.exists() and backup:
        backup_dir = root / ".backup" / datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / relative_path
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup_path)
        print(f"[BACKUP] {relative_path} -> {backup_path}")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.strip() + "\n", encoding="utf-8")
    print(f"[OK] {relative_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--backup", action="store_true")
    args = parser.parse_args()

    root = Path(args.root).resolve()

    if (root / "angular.json").exists():
        print("[ERROR] Esta carpeta parece ser Angular. Ejecuta en backend-estudiante.")
        return

    files = {}

    files[".gitignore"] = """
.venv/
venv/
env/
__pycache__/
*.pyc
.env
.env.*
firebase-service-account.json
serviceAccountKey.json
*.log
.analysis/
.backup/
"""

    files[".env.example"] = """
APP_NAME=BodegaSys API
APP_ENV=development
FRONTEND_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
FIREBASE_CREDENTIALS_PATH=./firebase-service-account.json
FIRESTORE_COLLECTION_PRODUCTOS=productos
FIRESTORE_COLLECTION_USUARIOS=usuarios
FIRESTORE_COLLECTION_AUDITORIA=auditoria
"""

    files["requirements.txt"] = """
fastapi==0.136.3
uvicorn==0.48.0
pydantic==2.13.4
python-dotenv==1.0.1
firebase-admin==6.5.0
pytest==8.3.4
httpx==0.27.2
"""

    files["README.md"] = """
# BodegaSys Backend

Backend FastAPI para conectar Angular con Firebase.

## Ejecutar

python -m venv .venv
.\\.venv\\Scripts\\activate
python -m pip install -r requirements.txt
copy .env.example .env
uvicorn src.main:app --reload

Abrir:

http://127.0.0.1:8000/docs
"""

    files["src/__init__.py"] = ""

    files["src/main.py"] = """
from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from src.core.cors import configure_cors
from src.apis.health_api import router as health_router
from src.apis.auth_api import router as auth_router
from src.apis.productos_api import router as productos_router


app = FastAPI(
    title="BodegaSys API",
    description="Backend FastAPI para Angular + Firebase",
    version="1.0.0",
)

configure_cors(app)

app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(productos_router, prefix="/api/productos", tags=["productos"])


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")
"""

    files["src/core/__init__.py"] = ""

    files["src/core/config.py"] = """
from functools import lru_cache
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv
import os


load_dotenv()


class Settings(BaseModel):
    app_name: str = os.getenv("APP_NAME", "BodegaSys API")
    app_env: str = os.getenv("APP_ENV", "development")

    frontend_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:4200,http://127.0.0.1:4200"
        ).split(",")
        if origin.strip()
    ]

    firebase_credentials_path: str = os.getenv(
        "FIREBASE_CREDENTIALS_PATH",
        "./firebase-service-account.json"
    )

    firestore_collection_productos: str = os.getenv(
        "FIRESTORE_COLLECTION_PRODUCTOS",
        "productos"
    )

    firestore_collection_usuarios: str = os.getenv(
        "FIRESTORE_COLLECTION_USUARIOS",
        "usuarios"
    )

    firestore_collection_auditoria: str = os.getenv(
        "FIRESTORE_COLLECTION_AUDITORIA",
        "auditoria"
    )

    @property
    def firebase_credentials_file(self) -> Path:
        return Path(self.firebase_credentials_path).resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()
"""

    files["src/core/cors.py"] = """
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import get_settings


def configure_cors(app: FastAPI) -> None:
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
"""

    files["src/firebase/__init__.py"] = ""

    files["src/firebase/firebase_client.py"] = """
from __future__ import annotations

import firebase_admin
from firebase_admin import auth, credentials, firestore, storage

from src.core.config import get_settings


def initialize_firebase() -> None:
    if firebase_admin._apps:
        return

    settings = get_settings()
    credentials_path = settings.firebase_credentials_file

    if not credentials_path.exists():
        raise FileNotFoundError(
            f"No se encontró Firebase Admin JSON: {credentials_path}. "
            "Coloca firebase-service-account.json en la raíz del backend."
        )

    cred = credentials.Certificate(str(credentials_path))
    firebase_admin.initialize_app(cred)


def get_firestore_client():
    initialize_firebase()
    return firestore.client()


def get_firebase_auth():
    initialize_firebase()
    return auth


def get_storage_bucket():
    initialize_firebase()
    return storage.bucket()
"""

    files["src/firebase/auth_client.py"] = """
from __future__ import annotations

from fastapi import Header, HTTPException, status
from firebase_admin import auth

from src.firebase.firebase_client import initialize_firebase


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta header Authorization",
        )

    parts = authorization.split()

    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato inválido. Usa: Bearer <firebase_id_token>",
        )

    return parts[1]


def verify_firebase_token(authorization: str | None = Header(default=None)) -> dict:
    initialize_firebase()
    token = extract_bearer_token(authorization)

    try:
        return auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token Firebase inválido: {str(exc)}",
        )
"""

    files["src/apis/__init__.py"] = ""

    files["src/apis/health_api.py"] = """
from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "BodegaSys API funcionando correctamente",
    }
"""

    files["src/apis/auth_api.py"] = """
from fastapi import APIRouter, Depends

from src.firebase.auth_client import verify_firebase_token


router = APIRouter()


@router.get("/me")
def obtener_usuario_actual(user: dict = Depends(verify_firebase_token)):
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "name": user.get("name"),
        "claims": user,
    }
"""

    files["src/schema/__init__.py"] = ""

    files["src/schema/producto_schema.py"] = """
from typing import Optional
from pydantic import BaseModel, Field


class ProductoCrear(BaseModel):
    codigo: str = Field(..., min_length=1, max_length=50)
    nombre: str = Field(..., min_length=1, max_length=150)
    descripcion: Optional[str] = None
    precio_compra: float = Field(default=0, ge=0)
    precio_venta: float = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
    stock_minimo: int = Field(default=0, ge=0)
    activo: bool = True


class ProductoActualizar(BaseModel):
    codigo: Optional[str] = Field(default=None, min_length=1, max_length=50)
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    descripcion: Optional[str] = None
    precio_compra: Optional[float] = Field(default=None, ge=0)
    precio_venta: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    stock_minimo: Optional[int] = Field(default=None, ge=0)
    activo: Optional[bool] = None
"""

    files["src/repository/__init__.py"] = ""

    files["src/repository/productos_repository.py"] = """
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from src.core.config import get_settings
from src.firebase.firebase_client import get_firestore_client
from src.schema.producto_schema import ProductoActualizar, ProductoCrear


class ProductosRepository:
    def __init__(self):
        settings = get_settings()
        self.db = get_firestore_client()
        self.collection = self.db.collection(settings.firestore_collection_productos)

    def listar(self) -> list[dict[str, Any]]:
        productos = []

        for doc in self.collection.stream():
            data = doc.to_dict() or {}
            data["id"] = doc.id
            productos.append(data)

        return productos

    def obtener_por_id(self, producto_id: str) -> dict[str, Any] | None:
        doc = self.collection.document(producto_id).get()

        if not doc.exists:
            return None

        data = doc.to_dict() or {}
        data["id"] = doc.id
        return data

    def crear(self, producto: ProductoCrear, usuario_uid: str | None) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()

        data = producto.model_dump()
        data["created_at"] = now
        data["updated_at"] = now
        data["created_by"] = usuario_uid

        ref = self.collection.document()
        ref.set(data)

        data["id"] = ref.id
        return data

    def actualizar(
        self,
        producto_id: str,
        producto: ProductoActualizar,
        usuario_uid: str | None,
    ) -> dict[str, Any] | None:
        ref = self.collection.document(producto_id)
        current = ref.get()

        if not current.exists:
            return None

        data = producto.model_dump(exclude_unset=True)
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        data["updated_by"] = usuario_uid

        ref.update(data)

        updated = ref.get().to_dict() or {}
        updated["id"] = producto_id
        return updated

    def eliminar(self, producto_id: str) -> bool:
        ref = self.collection.document(producto_id)
        current = ref.get()

        if not current.exists:
            return False

        ref.delete()
        return True
"""

    files["src/services/__init__.py"] = ""

    files["src/services/productos_service.py"] = """
from fastapi import HTTPException, status

from src.repository.productos_repository import ProductosRepository
from src.schema.producto_schema import ProductoActualizar, ProductoCrear


class ProductosService:
    def __init__(self):
        self.repository = ProductosRepository()

    def listar_productos(self):
        return self.repository.listar()

    def obtener_producto(self, producto_id: str):
        producto = self.repository.obtener_por_id(producto_id)

        if not producto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado",
            )

        return producto

    def crear_producto(self, producto: ProductoCrear, usuario_uid: str | None):
        self._validar_precios(producto.precio_compra, producto.precio_venta)
        return self.repository.crear(producto, usuario_uid)

    def actualizar_producto(
        self,
        producto_id: str,
        producto: ProductoActualizar,
        usuario_uid: str | None,
    ):
        if producto.precio_compra is not None and producto.precio_venta is not None:
            self._validar_precios(producto.precio_compra, producto.precio_venta)

        actualizado = self.repository.actualizar(producto_id, producto, usuario_uid)

        if not actualizado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado",
            )

        return actualizado

    def eliminar_producto(self, producto_id: str):
        eliminado = self.repository.eliminar(producto_id)

        if not eliminado:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Producto no encontrado",
            )

        return {
            "message": "Producto eliminado correctamente",
            "id": producto_id,
        }

    @staticmethod
    def _validar_precios(precio_compra: float, precio_venta: float) -> None:
        if precio_venta < precio_compra:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El precio de venta no puede ser menor al precio de compra",
            )
"""

    files["src/apis/productos_api.py"] = """
from fastapi import APIRouter, Depends, status

from src.firebase.auth_client import verify_firebase_token
from src.schema.producto_schema import ProductoActualizar, ProductoCrear
from src.services.productos_service import ProductosService


router = APIRouter()


@router.get("/")
def listar_productos(user: dict = Depends(verify_firebase_token)):
    service = ProductosService()
    return service.listar_productos()


@router.get("/{producto_id}")
def obtener_producto(
    producto_id: str,
    user: dict = Depends(verify_firebase_token),
):
    service = ProductosService()
    return service.obtener_producto(producto_id)


@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_producto(
    producto: ProductoCrear,
    user: dict = Depends(verify_firebase_token),
):
    service = ProductosService()
    return service.crear_producto(producto, user.get("uid"))


@router.put("/{producto_id}")
def actualizar_producto(
    producto_id: str,
    producto: ProductoActualizar,
    user: dict = Depends(verify_firebase_token),
):
    service = ProductosService()
    return service.actualizar_producto(producto_id, producto, user.get("uid"))


@router.delete("/{producto_id}")
def eliminar_producto(
    producto_id: str,
    user: dict = Depends(verify_firebase_token),
):
    service = ProductosService()
    return service.eliminar_producto(producto_id)
"""

    files["tests/__init__.py"] = ""

    files["tests/test_health.py"] = """
from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
"""

    print(f"[INFO] Generando backend en: {root}")

    for relative_path, content in files.items():
        write_file(root, relative_path, content, args.force, args.backup)

    print("")
    print("[OK] Backend base generado.")
    print("")
    print("Siguientes comandos:")
    print("python -m venv .venv")
    print(r".\.venv\Scripts\activate")
    print("python -m pip install --upgrade pip")
    print("python -m pip install -r requirements.txt")
    print("copy .env.example .env")
    print("uvicorn src.main:app --reload")


if __name__ == "__main__":
    main()