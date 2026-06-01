from src.schema.persona_schema import Persona, PersonaActualizar


class PersonaRepository:

    def __init__(self):
        self.personas: list[Persona] = []

    def crearPersona(self, persona: Persona):
        self.personas.append(persona)
        return persona

    def obtenerPersonas(self):
        return self.personas

    def actualizarPersona(self, id: int, personaActualizar: PersonaActualizar):
        for persona in self.personas:
            if persona.id == id:
                persona.nombre = personaActualizar.nombre
                persona.apellido_paterno = personaActualizar.apellido_paterno
                persona.apellido_materno = personaActualizar.apellido_materno
                return persona

        return None

    def eliminarPersona(self, id: int):
        for persona in self.personas:
            if persona.id == id:
                self.personas.remove(persona)
                return persona

        return None
