from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def configure_cors(app: FastAPI) -> None:
    """
    CORS para permitir comunicación entre:
    - Angular local
    - Angular en Render
    - FastAPI en Render

    Se permite Authorization porque el frontend envía Firebase Bearer Token.
    """

    allowed_origins = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "https://bodegasys-frontend.onrender.com",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
        expose_headers=["*"],
        max_age=3600,
    )