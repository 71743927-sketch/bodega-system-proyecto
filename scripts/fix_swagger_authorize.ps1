$ErrorActionPreference = "Stop"

$Root = Get-Location
$Backend = Join-Path $Root "backend"
$AuthClientPath = Join-Path $Backend "src/firebase/auth_client.py"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " FIX SWAGGER AUTHORIZE - FIREBASE TOKEN" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Test-Path $AuthClientPath)) {
    Write-Host "[ERROR] No existe auth_client.py" -ForegroundColor Red
    Write-Host $AuthClientPath
    exit 1
}

Copy-Item $AuthClientPath "$AuthClientPath.bak" -Force
Write-Host "[BACKUP] $AuthClientPath -> $AuthClientPath.bak" -ForegroundColor Yellow

$Content = @'
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
'@

Set-Content -Path $AuthClientPath -Value $Content -Encoding UTF8

Write-Host "[OK] auth_client.py actualizado" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora reinicia backend:"
Write-Host "cd backend"
Write-Host ".\.venv\Scripts\activate"
Write-Host "python -m uvicorn src.main:app --reload"