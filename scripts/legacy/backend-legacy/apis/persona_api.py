from fastapi import APIRouter
from src.services.persona_service import PersonaService
from src.schema.persona_schema import Persona, PersonaActualizar

routerPersona = APIRouter()
persona_service = PersonaService()

@routerPersona.post("/")
def crearPersona(persona: Persona):
    return persona_service.crearPersona(persona)

@routerPersona.get("/")
def obtenerPersonas():
    return persona_service.obtenerPersonas()

@routerPersona.put("/{id}")
def actualizarPersona(id: int, personaActualizar: PersonaActualizar):
    return persona_service.actualizarPersona(id, personaActualizar)

@routerPersona.delete("/{id}")
def eliminarPersona(id: int):
    return persona_service.eliminarPersona(id)
