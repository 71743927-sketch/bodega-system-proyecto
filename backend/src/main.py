from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from src.core.cors import configure_cors
from src.apis.health_api import router as health_router
from src.apis.auth_api import router as auth_router
from src.apis.productos_api import router as productos_router


app = FastAPI(
    title="BodegaSys API",
    description="Backend FastAPI para Angular + Firebase",
    version="1.0.0",
)

configure_cors(app)

app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(productos_router, prefix="/api/productos", tags=["productos"])


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")

# Routers adicionales generados para alinear backend con frontend
from src.apis.modulos_api import router as modulos_router
app.include_router(modulos_router, prefix="/api")
