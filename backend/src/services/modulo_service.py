from typing import Any

from fastapi import HTTPException, status

from src.repository.modulo_repository import ModuloRepository


class ModuloService:
    def __init__(self) -> None:
        self.repository = ModuloRepository()

    def listar(self, coleccion: str) -> list[dict[str, Any]]:
        return self.repository.listar(coleccion)

    def obtener(self, coleccion: str, documento_id: str) -> dict[str, Any]:
        documento = self.repository.obtener(coleccion, documento_id)

        if documento is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")

        return documento

    def crear(self, coleccion: str, data: dict[str, Any], documento_id: str | None = None) -> dict[str, Any]:
        return self.repository.crear(coleccion, data, documento_id)

    def actualizar(self, coleccion: str, documento_id: str, data: dict[str, Any]) -> dict[str, Any]:
        documento = self.repository.actualizar(coleccion, documento_id, data)

        if documento is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")

        return documento

    def eliminar(self, coleccion: str, documento_id: str) -> dict[str, str]:
        eliminado = self.repository.eliminar(coleccion, documento_id)

        if not eliminado:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")

        return {"message": "Documento eliminado correctamente"}

    def stock_bajo(self) -> list[dict[str, Any]]:
        return self.repository.stock_bajo()

    def resumen(self) -> dict[str, Any]:
        return self.repository.resumen()