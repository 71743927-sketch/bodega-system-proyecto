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
