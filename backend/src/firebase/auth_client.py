from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

from src.firebase.firebase_client import initialize_firebase


bearer_scheme = HTTPBearer(
    scheme_name="Firebase Bearer Token",
    description="Pega tu Firebase ID Token. Puedes pegarlo con o sin la palabra Bearer.",
    auto_error=False,
)


def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """
    Valida el Firebase ID Token enviado en:

    Authorization: Bearer <firebase_id_token>

    Swagger mostrara el boton Authorize.
    """

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta header Authorization",
        )

    token = credentials.credentials.strip()

    # Por si el usuario pega accidentalmente: Bearer eyJ...
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token vacio",
        )

    initialize_firebase()

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token Firebase invalido: {str(exc)}",
        )
