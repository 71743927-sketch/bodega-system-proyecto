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
