from pydantic import BaseModel, Field
from typing import Optional


class ProductoCrear(BaseModel):
    codigo: str = Field(..., min_length=1, max_length=50)
    nombre: str = Field(..., min_length=1, max_length=150)
    categoria: str = "General"
    descripcion: Optional[str] = None
    precio_compra: float = Field(default=0, ge=0)
    precio_venta: float = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
    stock_minimo: int = Field(default=0, ge=0)
    activo: bool = True


class ProductoActualizar(BaseModel):
    codigo: Optional[str] = Field(default=None, min_length=1, max_length=50)
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    precio_compra: Optional[float] = Field(default=None, ge=0)
    precio_venta: Optional[float] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    stock_minimo: Optional[int] = Field(default=None, ge=0)
    activo: Optional[bool] = None


class ProductoRespuesta(BaseModel):
    id: str
    codigo: str
    nombre: str
    categoria: str = "General"
    descripcion: Optional[str] = None
    precio_compra: float = 0
    precio_venta: float = 0
    stock: int = 0
    stock_minimo: int = 0
    activo: bool = True
