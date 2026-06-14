from typing import Any
from pydantic import BaseModel, Field


class DocumentoGenericoCreate(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class DocumentoGenericoUpdate(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class DocumentoGenericoResponse(BaseModel):
    id: str
    data: dict[str, Any] = Field(default_factory=dict)