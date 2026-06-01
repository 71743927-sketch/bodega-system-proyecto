from __future__ import annotations

import firebase_admin
from firebase_admin import auth, credentials, firestore, storage

from src.core.config import get_settings


def initialize_firebase() -> None:
    if firebase_admin._apps:
        return

    settings = get_settings()
    credentials_path = settings.firebase_credentials_file

    if not credentials_path.exists():
        raise FileNotFoundError(
            f"No se encontró Firebase Admin JSON: {credentials_path}. "
            "Coloca firebase-service-account.json en la raíz del backend."
        )

    cred = credentials.Certificate(str(credentials_path))
    firebase_admin.initialize_app(cred)


def get_firestore_client():
    initialize_firebase()
    return firestore.client()


def get_firebase_auth():
    initialize_firebase()
    return auth


def get_storage_bucket():
    initialize_firebase()
    return storage.bucket()
