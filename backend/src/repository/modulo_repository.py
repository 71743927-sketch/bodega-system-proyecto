from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from src.firebase.firebase_client import get_firestore_client


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()

    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)

    return value


def _serialize_dict(data: dict[str, Any]) -> dict[str, Any]:
    return {key: _serialize_value(value) for key, value in data.items()}


class ModuloRepository:
    def __init__(self) -> None:
        self.db = get_firestore_client()

    def listar(self, coleccion: str, limite: int = 100) -> list[dict[str, Any]]:
        docs = self.db.collection(coleccion).limit(limite).stream()
        resultado = []

        for doc in docs:
            resultado.append({
                "id": doc.id,
                "data": _serialize_dict(doc.to_dict() or {})
            })

        return resultado

    def obtener(self, coleccion: str, documento_id: str) -> dict[str, Any] | None:
        doc = self.db.collection(coleccion).document(documento_id).get()

        if not doc.exists:
            return None

        return {
            "id": doc.id,
            "data": _serialize_dict(doc.to_dict() or {})
        }

    def crear(self, coleccion: str, data: dict[str, Any], documento_id: str | None = None) -> dict[str, Any]:
        if not documento_id:
            documento_id = str(uuid4())

        payload = dict(data)
        now = datetime.utcnow().isoformat()
        payload.setdefault("activo", True)
        payload.setdefault("createdAt", now)
        payload["updatedAt"] = now

        self.db.collection(coleccion).document(documento_id).set(payload)

        return self.obtener(coleccion, documento_id) or {
            "id": documento_id,
            "data": payload
        }

    def actualizar(self, coleccion: str, documento_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        existente = self.obtener(coleccion, documento_id)

        if existente is None:
            return None

        payload = dict(data)
        payload["updatedAt"] = datetime.utcnow().isoformat()

        self.db.collection(coleccion).document(documento_id).update(payload)

        return self.obtener(coleccion, documento_id)

    def eliminar(self, coleccion: str, documento_id: str) -> bool:
        existente = self.obtener(coleccion, documento_id)

        if existente is None:
            return False

        self.db.collection(coleccion).document(documento_id).delete()
        return True

    def stock_bajo(self) -> list[dict[str, Any]]:
        productos = self.listar("productos", 500)
        resultado = []

        for producto in productos:
            data = producto.get("data", {})
            stock = data.get("stock", 0)
            minimo = data.get("stock_minimo", data.get("stockMinimo", 0))

            try:
                if int(stock) <= int(minimo):
                    resultado.append(producto)
            except Exception:
                continue

        return resultado

    def resumen(self) -> dict[str, Any]:
        return {
            "productos": len(self.listar("productos", 500)),
            "ventas": len(self.listar("ventas", 500)),
            "compras": len(self.listar("compras", 500)),
            "usuarios": len(self.listar("usuarios", 500)),
            "stock_bajo": len(self.stock_bajo())
        }