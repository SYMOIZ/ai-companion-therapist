# Backend

Updated 2 October 2026. Entry point: `main.py` (FastAPI). Shared models and auth live under `backend/`.

## Layout

| Path | Role |
|---|---|
| `main.py` | App startup, `/api/db` proxy, demo-account guards, seed data |
| `backend/models.py` | SQLAlchemy models |
| `backend/database.py` | Engine and session |
| `backend/auth.py` | Bearer-token dependency |
| `backend/schemas.py` | Request and response models |
| `backend/routers/` | Auth, chat, journal, booking, therapist, admin, finance, support, notifications, gamification |
| `alembic/versions/73ebc74ae218_initial_postgres_schema.py` | Initial PostgreSQL schema |

## Local database

`docker-compose.yml` starts PostgreSQL for local development. Set `DATABASE_URL` in a gitignored `.env`. Apply Alembic revision `73ebc74ae218` when the database is empty. The API also creates tables on startup and seeds demo rows when the journal table is empty.

Production Postgres listens only on the EC2 loopback. The password stays in `/opt/sukoon/.env` on the host and is not committed.
