from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def configure_cors(app: FastAPI) -> None:
    """
    Configura CORS para permitir la comunicación entre:
    - Frontend Angular local
    - Frontend Angular desplegado en Render
    - Backend FastAPI desplegado en Render

    Es necesario permitir Authorization porque el frontend envía
    Firebase Bearer Token hacia el backend.
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
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600,
    )