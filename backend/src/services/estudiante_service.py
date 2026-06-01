from src.repository.estudiante_repository import EstudianteRepository

class EstudianteService:
    def __init__(self):
        self.estudiante_repository = EstudianteRepository()

    def obtener_nombre(self):
        return {
            "nombre": self.estudiante_repository.obtener_nombre()
        }

    def obtener_apellido_paterno(self):
        return {
            "apellido_paterno": self.estudiante_repository.obtener_apellido_paterno()
        }

    def obtener_apellido_materno(self):
        return {
            "apellido_materno": self.estudiante_repository.obtener_apellido_materno()
        }
