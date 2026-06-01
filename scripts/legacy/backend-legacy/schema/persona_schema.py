from pydantic import BaseModel


class Persona(BaseModel):
    id: int
    nombre: str
    apellido_paterno: str
    apellido_materno: str


class PersonaActualizar(BaseModel):
    nombre: str
    apellido_paterno: str
    apellido_materno: str
