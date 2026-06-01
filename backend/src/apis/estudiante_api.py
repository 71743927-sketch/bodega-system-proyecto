from fastapi import APIRouter
from src.services.estudiante_service import EstudianteService

router = APIRouter()
estudiante_service = EstudianteService()


@router.get("/nombre")
def obtener_nombre():
    return estudiante_service.obtener_nombre()


@router.get("/apellido-paterno")
def obtener_apellido_paterno():
    return estudiante_service.obtener_apellido_paterno()


@router.get("/apellido-materno")
def obtener_apellido_materno():
    return estudiante_service.obtener_apellido_materno()
