from fastapi import APIRouter, Depends

from src.firebase.auth_client import verify_firebase_token


router = APIRouter()


@router.get("/me")
def obtener_usuario_actual(user: dict = Depends(verify_firebase_token)):
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "name": user.get("name"),
        "claims": user,
    }
