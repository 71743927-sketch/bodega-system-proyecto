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
