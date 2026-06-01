from fastapi import HTTPException, status
from src.repository.persona_repository import PersonaRepository
from src.schema.persona_schema import Persona, PersonaActualizar


class PersonaService:

    def __init__(self):
        self.persona_repository = PersonaRepository()

    def crearPersona(self, persona: Persona):
        return self.persona_repository.crearPersona(persona)

    def obtenerPersonas(self):
        return self.persona_repository.obtenerPersonas()

    def actualizarPersona(self, id: int, personaActualizar: PersonaActualizar):
        persona = self.persona_repository.actualizarPersona(id, personaActualizar)

        if persona is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Persona no encontrada"
            )

        return persona

    def eliminarPersona(self, id: int):
        persona = self.persona_repository.eliminarPersona(id)

        if persona is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Persona no encontrada"
            )

        return {
            "mensaje": "Persona eliminada correctamente",
            "persona_eliminada": persona
        }
