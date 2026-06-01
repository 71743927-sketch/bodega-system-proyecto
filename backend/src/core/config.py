from functools import lru_cache
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv
import os


load_dotenv()


class Settings(BaseModel):
    app_name: str = os.getenv("APP_NAME", "BodegaSys API")
    app_env: str = os.getenv("APP_ENV", "development")

    frontend_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:4200,http://127.0.0.1:4200"
        ).split(",")
        if origin.strip()
    ]

    firebase_credentials_path: str = os.getenv(
        "FIREBASE_CREDENTIALS_PATH",
        "./firebase-service-account.json"
    )

    firestore_collection_productos: str = os.getenv(
        "FIRESTORE_COLLECTION_PRODUCTOS",
        "productos"
    )

    firestore_collection_usuarios: str = os.getenv(
        "FIRESTORE_COLLECTION_USUARIOS",
        "usuarios"
    )

    firestore_collection_auditoria: str = os.getenv(
        "FIRESTORE_COLLECTION_AUDITORIA",
        "auditoria"
    )

    @property
    def firebase_credentials_file(self) -> Path:
        return Path(self.firebase_credentials_path).resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()
