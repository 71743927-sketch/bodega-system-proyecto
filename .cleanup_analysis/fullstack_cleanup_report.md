# Reporte de limpieza fullstack

- Proyecto: `C:\Users\clint\Downloads\bodega-system-proyecto`
- Fecha: `2026-05-31 19:58:23`

## 1. Resumen

- Frontend existe: `True`
- Backend existe: `True`
- Archivos frontend analizados: `201`
- Archivos backend analizados: `43`
- Candidatos de limpieza: `31`

## 2. Backend

### Routers detectados en main.py
- `app.include_router(health_router, prefix="/api", tags=["health"])`
- `app.include_router(auth_router, prefix="/api/auth", tags=["auth"])`
- `app.include_router(productos_router, prefix="/api/productos", tags=["productos"])`

### Errores de sintaxis Python
- `src/firebase/auth_client.py`: invalid non-printable character U+FEFF (<unknown>, line 1)
- `src/schema/producto_schema.py`: invalid non-printable character U+FEFF (<unknown>, line 1)

### Candidatos legacy estudiante/persona
- `src/apis/estudiante_api.py` - Relacionado con estudiante/persona del backend reutilizado. - confianza: `alta si no aparece en src/main.py`
- `src/apis/persona_api.py` - Relacionado con estudiante/persona del backend reutilizado. - confianza: `alta si no aparece en src/main.py`
- `src/repository/estudiante_repository.py` - Relacionado con estudiante/persona del backend reutilizado. - confianza: `alta si no aparece en src/main.py`
- `src/repository/persona_repository.py` - Relacionado con estudiante/persona del backend reutilizado. - confianza: `alta si no aparece en src/main.py`
- `src/schema/persona_schema.py` - Relacionado con estudiante/persona del backend reutilizado. - confianza: `alta si no aparece en src/main.py`
- `src/services/estudiante_service.py` - Relacionado con estudiante/persona del backend reutilizado. - confianza: `alta si no aparece en src/main.py`
- `src/services/persona_service.py` - Relacionado con estudiante/persona del backend reutilizado. - confianza: `alta si no aparece en src/main.py`

### Scripts auxiliares en backend
- No se detectaron scripts auxiliares.

### Python posiblemente no usado
- `.backup/20260530_182434/src/main.py` - modulo `.backup.20260530_182434.src.main` - No aparece importado por otros archivos Python detectados.

### Archivos sensibles locales
- `backend/.env` - Archivo sensible local. Debe estar ignorado por Git.
- `backend/firebase-service-account.json` - Archivo sensible local. Debe estar ignorado por Git.

## 3. Frontend

### Scripts auxiliares en frontend
- `agregar_boton_copiar_token.ps1` - Archivo auxiliar en la raiz de frontend. Considerar mover a scripts/legacy.
- `analizar_productos_frontend.ps1` - Archivo auxiliar en la raiz de frontend. Considerar mover a scripts/legacy.
- `setup_firebase_auth_real.ps1` - Archivo auxiliar en la raiz de frontend. Considerar mover a scripts/legacy.

### TypeScript posiblemente no usado
- `src/app/core/firebase/auditoria-debug.ts` - El nombre base del archivo aparece muy pocas veces. Revisar manualmente antes de borrar. - confianza: `baja/media`
- `src/app/core/firebase/firebase-bootstrap.service.ts` - El nombre base del archivo aparece muy pocas veces. Revisar manualmente antes de borrar. - confianza: `baja/media`
- `src/app/core/firebase/firebase-debug.ts` - El nombre base del archivo aparece muy pocas veces. Revisar manualmente antes de borrar. - confianza: `baja/media`

## 4. Plan de limpieza sugerido

- `frontend/src/app/app.routes.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/core/services/backend-auth.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/core/services/backend-health.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/auth/pages/login-page/login-page.component.css.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/auth/pages/login-page/login-page.component.html.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/auth/pages/login-page/login-page.component.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/auth/services/auth.service.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/backend-test/pages/backend-test-page/backend-test-page.component.html.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/backend-test/pages/backend-test-page/backend-test-page.component.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/productos/models/producto.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/productos/services/productos-backend.service.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/src/app/features/productos/services/productos.service.ts.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/tsconfig.app.json.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `backend/src/firebase/auth_client.py.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `backend/src/schema/producto_schema.py.bak`
  - Acción: `quarantine`
  - Motivo: Archivo temporal, backup o log.
  - Confianza: `alta`
- `frontend/agregar_boton_copiar_token.ps1`
  - Acción: `move_to_scripts_legacy`
  - Motivo: Archivo auxiliar en la raiz de frontend. Considerar mover a scripts/legacy.
  - Confianza: `media`
- `frontend/analizar_productos_frontend.ps1`
  - Acción: `move_to_scripts_legacy`
  - Motivo: Archivo auxiliar en la raiz de frontend. Considerar mover a scripts/legacy.
  - Confianza: `media`
- `frontend/setup_firebase_auth_real.ps1`
  - Acción: `move_to_scripts_legacy`
  - Motivo: Archivo auxiliar en la raiz de frontend. Considerar mover a scripts/legacy.
  - Confianza: `media`
- `analyze_fullstack_cleanup.py`
  - Acción: `move_to_scripts`
  - Motivo: Script auxiliar en raiz. Considerar mover a scripts/.
  - Confianza: `media`
- `fix_vscode_diagnostics.ps1`
  - Acción: `move_to_scripts`
  - Motivo: Script auxiliar en raiz. Considerar mover a scripts/.
  - Confianza: `media`
- `backend/src/apis/estudiante_api.py`
  - Acción: `review_legacy`
  - Motivo: Relacionado con estudiante/persona del backend reutilizado.
  - Confianza: `alta si no aparece en src/main.py`
- `backend/src/apis/persona_api.py`
  - Acción: `review_legacy`
  - Motivo: Relacionado con estudiante/persona del backend reutilizado.
  - Confianza: `alta si no aparece en src/main.py`
- `backend/src/repository/estudiante_repository.py`
  - Acción: `review_legacy`
  - Motivo: Relacionado con estudiante/persona del backend reutilizado.
  - Confianza: `alta si no aparece en src/main.py`
- `backend/src/repository/persona_repository.py`
  - Acción: `review_legacy`
  - Motivo: Relacionado con estudiante/persona del backend reutilizado.
  - Confianza: `alta si no aparece en src/main.py`
- `backend/src/schema/persona_schema.py`
  - Acción: `review_legacy`
  - Motivo: Relacionado con estudiante/persona del backend reutilizado.
  - Confianza: `alta si no aparece en src/main.py`
- `backend/src/services/estudiante_service.py`
  - Acción: `review_legacy`
  - Motivo: Relacionado con estudiante/persona del backend reutilizado.
  - Confianza: `alta si no aparece en src/main.py`
- `backend/src/services/persona_service.py`
  - Acción: `review_legacy`
  - Motivo: Relacionado con estudiante/persona del backend reutilizado.
  - Confianza: `alta si no aparece en src/main.py`
- `frontend/src/app/core/firebase/auditoria-debug.ts`
  - Acción: `review_only`
  - Motivo: El nombre base del archivo aparece muy pocas veces. Revisar manualmente antes de borrar.
  - Confianza: `baja/media`
- `frontend/src/app/core/firebase/firebase-bootstrap.service.ts`
  - Acción: `review_only`
  - Motivo: El nombre base del archivo aparece muy pocas veces. Revisar manualmente antes de borrar.
  - Confianza: `baja/media`
- `frontend/src/app/core/firebase/firebase-debug.ts`
  - Acción: `review_only`
  - Motivo: El nombre base del archivo aparece muy pocas veces. Revisar manualmente antes de borrar.
  - Confianza: `baja/media`
- `backend/.backup/20260530_182434/src/main.py`
  - Acción: `review_only`
  - Motivo: No aparece importado por otros archivos Python detectados.
  - Confianza: `media`

## 5. Recomendación

No elimines archivos marcados como `review_only` sin revisar.
Primero limpia scripts auxiliares, backups `.bak`, logs y módulos legacy confirmados.

Después de limpiar, prueba:

```powershell
cd backend
python -m uvicorn src.main:app --reload

cd ../frontend
ng serve -o
```