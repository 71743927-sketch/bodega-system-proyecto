class EstudianteRepository:
    def __init__(self):
        self.nombre = "Clinton"
        self.apellido_paterno = "Janampa"
        self.apellido_materno = "Navarro"

    def obtener_nombre(self):
        return self.nombre

    def obtener_apellido_paterno(self):
        return self.apellido_paterno

    def obtener_apellido_materno(self):
        return self.apellido_materno
