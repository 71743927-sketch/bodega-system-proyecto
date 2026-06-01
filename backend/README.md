# BodegaSys Backend

Backend FastAPI para conectar Angular con Firebase.

## Ejecutar

python -m venv .venv
.\.venv\Scripts\activate
python -m pip install -r requirements.txt
copy .env.example .env
uvicorn src.main:app --reload

Abrir:

http://127.0.0.1:8000/docs
