web: sh -c "python scripts/init_db.py || true; uvicorn apps.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"
