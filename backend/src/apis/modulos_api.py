from typing import Any

from fastapi import APIRouter, status

from src.schema.modulo_schema import DocumentoGenericoCreate, DocumentoGenericoResponse, DocumentoGenericoUpdate
from src.services.modulo_service import ModuloService

router = APIRouter(tags=["Modulos BodegaSys"])


def get_service() -> ModuloService:
    """
    Crea el servicio solo cuando se llama un endpoint.
    Esto evita que Swagger falle si Firebase aun no esta inicializado durante la importacion.
    """
    return ModuloService()


@router.get("/inventario/", response_model=list[DocumentoGenericoResponse])
def listar_inventario() -> list[dict[str, Any]]:
    return get_service().listar("inventario")


@router.post("/inventario/movimientos", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_movimiento_inventario(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("movimientos_inventario", payload.data)


@router.get("/inventario/stock-bajo", response_model=list[DocumentoGenericoResponse])
def stock_bajo() -> list[dict[str, Any]]:
    return get_service().stock_bajo()


@router.get("/ventas/", response_model=list[DocumentoGenericoResponse])
def listar_ventas() -> list[dict[str, Any]]:
    return get_service().listar("ventas")


@router.post("/ventas/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_venta(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("ventas", payload.data)


@router.get("/ventas/{venta_id}", response_model=DocumentoGenericoResponse)
def obtener_venta(venta_id: str) -> dict[str, Any]:
    return get_service().obtener("ventas", venta_id)


@router.get("/compras/", response_model=list[DocumentoGenericoResponse])
def listar_compras() -> list[dict[str, Any]]:
    return get_service().listar("compras")


@router.post("/compras/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_compra(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("compras", payload.data)


@router.get("/caja/resumen")
def caja_resumen() -> dict[str, Any]:
    service = get_service()
    return {
        "movimientos": len(service.listar("caja_movimientos")),
        "cierres": len(service.listar("caja_cierres"))
    }


@router.post("/caja/movimientos", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_movimiento_caja(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("caja_movimientos", payload.data)


@router.post("/caja/cierre", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def cerrar_caja(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("caja_cierres", payload.data)


@router.get("/usuarios/", response_model=list[DocumentoGenericoResponse])
def listar_usuarios() -> list[dict[str, Any]]:
    return get_service().listar("usuarios")


@router.post("/usuarios/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    documento_id = payload.data.get("uid") or payload.data.get("email")
    return get_service().crear("usuarios", payload.data, documento_id)


@router.put("/usuarios/{usuario_id}", response_model=DocumentoGenericoResponse)
def actualizar_usuario(usuario_id: str, payload: DocumentoGenericoUpdate) -> dict[str, Any]:
    return get_service().actualizar("usuarios", usuario_id, payload.data)


@router.get("/proveedores/", response_model=list[DocumentoGenericoResponse])
def listar_proveedores() -> list[dict[str, Any]]:
    return get_service().listar("proveedores")


@router.post("/proveedores/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_proveedor(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("proveedores", payload.data)


@router.get("/reportes/resumen")
def reporte_resumen() -> dict[str, Any]:
    return get_service().resumen()


@router.get("/reportes/productos")
def reporte_productos() -> list[dict[str, Any]]:
    return get_service().listar("productos")


@router.get("/reportes/ventas")
def reporte_ventas() -> list[dict[str, Any]]:
    return get_service().listar("ventas")


@router.get("/comprobantes/", response_model=list[DocumentoGenericoResponse])
def listar_comprobantes() -> list[dict[str, Any]]:
    return get_service().listar("comprobantes")


@router.post("/comprobantes/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_comprobante(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("comprobantes", payload.data)


@router.get("/alertas/", response_model=list[DocumentoGenericoResponse])
def listar_alertas() -> list[dict[str, Any]]:
    return get_service().listar("alertas")


@router.post("/alertas/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_alerta(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("alertas", payload.data)


@router.get("/auditoria/", response_model=list[DocumentoGenericoResponse])
def listar_auditoria() -> list[dict[str, Any]]:
    return get_service().listar("auditoria")


@router.post("/auditoria/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_evento_auditoria(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("auditoria", payload.data)


@router.get("/respaldo/resumen")
def respaldo_resumen() -> dict[str, Any]:
    return get_service().resumen()


@router.post("/respaldo/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_respaldo(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    return get_service().crear("respaldos", payload.data)


@router.get("/configuracion/", response_model=list[DocumentoGenericoResponse])
def listar_configuracion() -> list[dict[str, Any]]:
    return get_service().listar("configuracion")


@router.post("/configuracion/", response_model=DocumentoGenericoResponse, status_code=status.HTTP_201_CREATED)
def crear_configuracion(payload: DocumentoGenericoCreate) -> dict[str, Any]:
    clave = payload.data.get("clave")
    return get_service().crear("configuracion", payload.data, clave)


@router.put("/configuracion/{configuracion_id}", response_model=DocumentoGenericoResponse)
def actualizar_configuracion(configuracion_id: str, payload: DocumentoGenericoUpdate) -> dict[str, Any]:
    return get_service().actualizar("configuracion", configuracion_id, payload.data)