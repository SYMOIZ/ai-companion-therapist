import os
import sys

# Load env variables from .env manually if file exists
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    print(f"Loading environment variables from {env_path}", flush=True)
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                os.enniron[key.strip()] = val.strip()
#updated
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database URL configuration
# Support PostgreSQL natively via DATABASE_URL or fallback to local SQLite sukoon.db
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if DATABASE_URL and DATABASE_URL.startswith("postgres"):
    # Normalize legacy postgres:// connection schemes in SQLAlchemy
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # Ensure psycopg2 driver is installed
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not found, installing psycopg2-binary...", flush=True)
        import subprocess
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "--user", "--break-system-packages", "psycopg2-binary"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            # Try reloading dependencies
            import importlib
            importlib.invalidate_caches()
        except Exception as e:
            print(f"Self-healing driver installation failed: {e}", flush=True)

if not DATABASE_URL:
    # Use existing sukoon.db in the root workspace
    DATABASE_URL = "sqlite:///sukoon.db"

# For SQLite, we need to disable same_thread check
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    # Add pool_pre_ping and pool_recycle to auto-recover from stale cloud pool EOF/drops
    # Configure larger connection pool to scale under high concurrency
    engine = create_engine(
        DATABASE_URL, 
        connect_args=connect_args, 
        pool_pre_ping=True, 
        pool_recycle=300,
        pool_size=25,
        max_overflow=35,
        pool_timeout=45
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Self-healing Schema database migration for PostgreSQL (Supabase)
if engine.name != "sqlite":
    print("Running PostgreSQL database self-healing auto-migration schema corrections...", flush=True)
    try:
        from sqlalchemy import text
        with engine.begin() as conn:
            # 1. Corrections for therapist_profiles columns
            cols_tp = [
                ("approval_status", "VARCHAR DEFAULT 'pending'"),
                ("pricing_45", "FLOAT DEFAULT 0.0"),
                ("pricing_60", "FLOAT DEFAULT 0.0"),
                ("pricing_90", "FLOAT DEFAULT 0.0"),
                ("offer_video", "INTEGER DEFAULT 1"),
                ("offer_chat", "INTEGER DEFAULT 1"),
                ("bank_details_locked", "INTEGER DEFAULT 0"),
                ("violation_strikes", "INTEGER DEFAULT 0"),
                ("updated_at", "VARCHAR")
            ]
            for col, col_type in cols_tp:
                try:
                    conn.execute(text(f"ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS {col} {col_type};"))
                    print(f"Verified therapist_profiles column: {col}", flush=True)
                except Exception as ex:
                    print(f"Skipped therapist_profiles column {col}: {ex}", flush=True)
    except Exception as e:
        print(f"PostgreSQL database self-healing failed: {e}", flush=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

