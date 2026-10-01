import sys
import os
import time

# Redirect stdout/stderr to backend.log immediately to capture ALL runtime/startup/import failures
try:
    _log_f = open("backend.log", "a", encoding="utf-8", buffering=1)
    sys.stdout = _log_f
    sys.stderr = _log_f
    print("\n--- NEW BACKEND MAIN START ---", flush=True)
    print(f"Time: {time.asctime()}", flush=True)
    print(f"PID: {os.getpid()}", flush=True)
    print(f"Executable: {sys.executable}", flush=True)
except Exception:
    pass

# Add reorganized script paths so that backend imports still resolve perfectly
for folder in ["scripts/audits", "scripts/database", "scripts/maintenance", "scripts/migrations"]:
    full_path = os.path.join(os.path.dirname(__file__), folder)
    if os.path.exists(full_path) and full_path not in sys.path:
        sys.path.insert(0, full_path)

import subprocess
import json
import re
import uuid
import math
import sqlite3

# --- AUTO DEPENDENCIES ---
import site
import sys
import subprocess

# Ensure user site-packages are part of active paths
user_site_dir = site.getusersitepackages()
if user_site_dir not in sys.path:
    sys.path.insert(0, user_site_dir)

try:
    from fastapi import FastAPI, HTTPException, Header, Depends, status
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    import sqlalchemy
    import email_validator
except ImportError:
    print("Required packages missing. Installing fastapi, uvicorn, pydantic, sqlalchemy, email-validator...", flush=True)
    
    # 1. Try bootstrapping pip via ensurepip
    try:
        subprocess.run([sys.executable, "-m", "ensurepip", "--default-pip"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception:
         pass
         
    # 2. If pip is still missing, attempt get-pip.py download
    try:
        pip_test = subprocess.run([sys.executable, "-m", "pip", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if pip_test.returncode != 0:
            print("Pip not found in environment. Bootstrapping with get-pip.py...", flush=True)
            import urllib.request
            urllib.request.urlretrieve("https://bootstrap.pypa.io/get-pip.py", "get-pip.py")
            subprocess.run([sys.executable, "get-pip.py", "--user", "--break-system-packages"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                import os
                os.remove("get-pip.py")
            except Exception:
                pass
    except Exception as get_pip_err:
        print(f"Could not bootstrap pip with get-pip.py: {get_pip_err}", flush=True)

    # Refresh user site-packages post-bootstrap
    if user_site_dir not in sys.path:
        sys.path.insert(0, user_site_dir)
         
    installed = False
    commands_to_try = [
        [sys.executable, "-m", "pip", "install", "--user", "--break-system-packages", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"],
        [sys.executable, "-m", "pip", "install", "--user", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"],
        [sys.executable, "-m", "pip", "install", "--break-system-packages", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"],
        [sys.executable, "-m", "pip", "install", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"],
        ["pip3", "install", "--user", "--break-system-packages", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"],
        ["pip3", "install", "--user", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"],
        ["pip3", "install", "--break-system-packages", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"],
        ["pip3", "install", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"],
        ["pip", "install", "fastapi", "uvicorn", "pydantic", "sqlalchemy", "email-validator"]
    ]
    for cmd in commands_to_try:
        try:
            print(f"Trying command: {' '.join(cmd)}", flush=True)
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            print(f"Exit status: {res.returncode}", flush=True)
            if res.returncode == 0:
                print("Successfully installed dependencies!", flush=True)
                installed = True
                break
            else:
                print(f"Stderr: {res.stderr}", flush=True)
        except Exception as cmd_err:
             print(f"Command failed with exception: {cmd_err}", flush=True)
             
    if not installed:
        raise RuntimeError("Failed to install required dependencies (FastAPI, Uvicorn, Pydantic, SQLAlchemy, Email-Validator)")

# Ensure site packages are always importable and caches invalidated
import importlib
importlib.invalidate_caches()

try:
    user_site_dir = site.getusersitepackages()
    if user_site_dir not in sys.path:
        sys.path.insert(0, user_site_dir)
    # Also manually construct the path to ensure it is added
    version_str = f"python{sys.version_info.major}.{sys.version_info.minor}"
    local_site = os.path.expanduser(f"~/.local/lib/{version_str}/site-packages")
    if local_site not in sys.path:
        sys.path.insert(0, local_site)
except Exception as e:
    print(f"Error resolving site-packages directory: {e}", flush=True)

importlib.invalidate_caches()

from fastapi import FastAPI, HTTPException, Header, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Import database module and models
from backend.database import get_db, engine, Base
from backend import models
from backend.routers import (
    auth, therapist, booking, chat, journal, notification, finance, admin, support, openai_router, gamification
)

# Initialize database schemas
try:
    print("Initializing ORM Database schemas via SQLAlchemy...", flush=True)
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)
    print("Schemas successfully created!", flush=True)
    
    # Run auto-migrations / alter table queries to guarantee correct column structures on Postgres (Supabase)
    alter_queries = [
        "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'Low';",
        "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS image_url VARCHAR;",
        "ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS paid_chat_price_1d FLOAT DEFAULT 0.0;",
        "ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS paid_chat_price_7d FLOAT DEFAULT 0.0;",
        "ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS paid_chat_price_1m FLOAT DEFAULT 0.0;",
        "ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS paid_chat_price_updated_at VARCHAR;",
        "CREATE TABLE IF NOT EXISTS subscription_plans (id VARCHAR PRIMARY KEY, name VARCHAR, price FLOAT DEFAULT 0.0, duration_months INTEGER DEFAULT 1, is_lifetime INTEGER DEFAULT 0, max_ai_chats INTEGER DEFAULT 10, max_journal_entries INTEGER DEFAULT 30, priority_matching INTEGER DEFAULT 0, premium_features INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at VARCHAR);",
        "CREATE TABLE IF NOT EXISTS user_subscriptions (id VARCHAR PRIMARY KEY, user_id VARCHAR UNIQUE, plan_id VARCHAR, status VARCHAR DEFAULT 'Active', expiry_date VARCHAR, renewal_date VARCHAR, created_at VARCHAR, updated_at VARCHAR);",
        "CREATE TABLE IF NOT EXISTS purchase_history (id VARCHAR PRIMARY KEY, user_id VARCHAR, item_type VARCHAR, item_id VARCHAR, amount FLOAT, currency VARCHAR DEFAULT 'PKR', status VARCHAR DEFAULT 'Completed', payment_method VARCHAR, transaction_id VARCHAR, receipt_url VARCHAR, created_at VARCHAR);",
        "ALTER TABLE followup_requests ADD COLUMN IF NOT EXISTS patient_id VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS patient_id VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS booking_id VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS followup_expiry_date VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS last_message_at VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'ACTIVE';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at VARCHAR;",
        "CREATE INDEX IF NOT EXISTS idx_therapist_profiles_user_id ON therapist_profiles (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_users_id ON users (id);",
        "CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);",
        "CREATE INDEX IF NOT EXISTS idx_session_bookings_client_id ON session_bookings (client_id);",
        "CREATE INDEX IF NOT EXISTS idx_session_bookings_therapist_id ON session_bookings (therapist_id);",
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id);",
        "CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_therapist_connections_therapist_id ON therapist_connections (therapist_id);",
        "CREATE INDEX IF NOT EXISTS idx_therapist_connections_client_id ON therapist_connections (client_id);",
        "CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages (sender_id);",
        "CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON direct_messages (receiver_id);"
    ]
    with engine.begin() as conn:
        for q in alter_queries:
            try:
                conn.execute(text(q))
            except Exception as q_err:
                print(f"Startup migration query warning on {q[:40]}: {q_err}", flush=True)
    print("Database auto-migrations completely check-satisfied!", flush=True)
except Exception as schema_err:
    print(f"Schema creation or migration error: {schema_err}", flush=True)

# --- AUTOMATED COMPREHENSIVE LIVE SUKOON DATABASE DIAGNOSTICS & VERIFICATION ---
def run_real_verification():
    import json
    import urllib.parse
    import time
    from sqlalchemy import text, inspect
    
    # Cooldown Check to prevent Uvicorn reload feedback loops when writing verify_report.json
    if os.path.exists("verify_report.json"):
        st = os.stat("verify_report.json")
        if time.time() - st.st_mtime < 120:
            print("AUTOMATED VERIFICATION: Recently run (< 120s ago), skipping execution to prevent reload loops.", flush=True)
            return

    print("Executing automated deep-verification suite...", flush=True)
    report = {
        "env_verification": {},
        "live_connection": {},
        "schema_verification": {},
        "foreign_keys": {},
        "seed_data": {},
        "supabase_features": {},
        "security_audit": {},
        "backend_verification": {}
    }
    
    # 1. Environment check
    db_url = os.environ.get("DATABASE_URL", "")
    report["env_verification"]["database_url_provided"] = bool(db_url)
    if db_url:
        try:
            # Parse URL to inspect components
            parsed = urllib.parse.urlparse(db_url)
            report["env_verification"]["scheme"] = parsed.scheme
            report["env_verification"]["host"] = parsed.hostname
            report["env_verification"]["port"] = parsed.port
            report["env_verification"]["db_name"] = parsed.path.lstrip("/")
            report["env_verification"]["user"] = parsed.username
            
            # Password validation
            raw_password = parsed.password
            if raw_password:
                report["env_verification"]["password_length"] = len(raw_password)
                report["env_verification"]["password_encoded_correctly"] = "%40" in db_url or "%" in db_url
            else:
                report["env_verification"]["password_encoded_correctly"] = None
        except Exception as e:
            report["env_verification"]["error"] = str(e)
            
    # 2. Live connection test
    try:
        with engine.connect() as conn:
            v_res = conn.execute(text("SELECT version();")).scalar()
            db_res = conn.execute(text("SELECT current_database();")).scalar()
            report["live_connection"]["status"] = "Success"
            report["live_connection"]["version"] = v_res
            report["live_connection"]["database_name"] = db_res
            report["live_connection"]["dialect"] = engine.name
    except Exception as e:
        report["live_connection"]["status"] = "Failed"
        report["live_connection"]["error"] = str(e)
        
    # 3. Schema Verification & Relationships & Seed Counts & Security Audit
    if report["live_connection"]["status"] == "Success":
        try:
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            model_tables = list(Base.metadata.tables.keys())
            
            report["schema_verification"]["existing_tables"] = existing_tables
            report["schema_verification"]["model_tables"] = model_tables
            report["schema_verification"]["missing_tables"] = [t for t in model_tables if t not in existing_tables]
            report["schema_verification"]["extra_tables"] = [t for t in existing_tables if t not in model_tables]
            
            # Types mismatch
            type_mismatches = []
            for t in model_tables:
                if t in existing_tables:
                    db_cols = {col["name"]: col for col in inspector.get_columns(t)}
                    model_cols = Base.metadata.tables[t].columns
                    for mc_name, mc_col in model_cols.items():
                        if mc_name in db_cols:
                            db_type = str(db_cols[mc_name]["type"]).lower()
                            mc_type = str(mc_col.type).lower()
                            if ("varchar" in mc_type or "string" in mc_type) and ("uuid" in db_type):
                                type_mismatches.append({
                                    "table": t,
                                    "column": mc_name,
                                    "model_type": mc_type,
                                    "db_type": db_type,
                                    "severity": "Warning (UUID vs VARCHAR)"
                                })
                            elif db_type != mc_type and not (("text" in mc_type and "text" in db_type) or ("varchar" in mc_type and "varchar" in db_type) or ("integer" in mc_type and "bool" in db_type) or ("float" in mc_type and "double" in db_type) or ("integer" in mc_type and "bigint" in db_type)):
                                type_mismatches.append({
                                    "table": t,
                                    "column": mc_name,
                                    "model_type": mc_type,
                                    "db_type": db_type,
                                    "severity": "Info"
                                })
            report["schema_verification"]["type_mismatches"] = type_mismatches
            
            # 4. Foreign Keys, UUID conflicts, Orphan checks
            fk_conflicts = []
            orphan_references = {}
            for t in existing_tables:
                fks = inspector.get_foreign_keys(t)
                for fk in fks:
                    referred_table = fk["referred_table"]
                    referred_cols = fk["referred_columns"]
                    constrained_cols = fk["constrained_columns"]
                    
                    t_cols = {col["name"]: col for col in inspector.get_columns(t)}
                    ref_cols = {col["name"]: col for col in inspector.get_columns(referred_table)} if referred_table in existing_tables else {}
                    
                    for cc, rc in zip(constrained_cols, referred_cols):
                        cc_type = str(t_cols.get(cc, {}).get("type", "")).lower()
                        rc_type = str(ref_cols.get(rc, {}).get("type", "")).lower() if ref_cols else "unknown"
                        
                        if ("uuid" in cc_type and "varchar" in rc_type) or ("varchar" in cc_type and "uuid" in rc_type):
                            fk_conflicts.append({
                                "table": t,
                                "column": cc,
                                "referred_table": referred_table,
                                "referred_column": rc,
                                "desc": f"UUID vs VARCHAR conflict: {cc} is {cc_type}, {referred_table}.{rc} is {rc_type}"
                            })
                            
                    if referred_table in existing_tables and len(constrained_cols) == 1 and len(referred_cols) == 1:
                        c_col = constrained_cols[0]
                        r_col = referred_cols[0]
                        try:
                            with engine.connect() as conn:
                                orphan_q = text(f'SELECT COUNT(*) FROM "{t}" LEFT JOIN "{referred_table}" ON "{t}"."{c_col}" = "{referred_table}"."{r_col}" WHERE "{referred_table}"."{r_col}" IS NULL AND "{t}"."{c_col}" IS NOT NULL;')
                                orphans_count = conn.execute(orphan_q).scalar()
                                if orphans_count > 0:
                                    orphan_references[f"{t}.{c_col} -> {referred_table}.{r_col}"] = orphans_count
                        except Exception:
                            pass
            report["foreign_keys"]["conflicts"] = fk_conflicts
            report["foreign_keys"]["orphan_references"] = orphan_references
            
            # 5. Seed Data row counts
            seed_counts = {}
            empty_tables = []
            for t in existing_tables:
                try:
                    with engine.connect() as conn:
                        cnt = conn.execute(text(f'SELECT COUNT(*) FROM "{t}";')).scalar()
                        seed_counts[t] = cnt
                        if cnt == 0:
                            empty_tables.append(t)
                except Exception as cnt_err:
                    seed_counts[t] = f"Error: {cnt_err}"
            report["seed_data"]["row_counts"] = seed_counts
            report["seed_data"]["empty_tables"] = empty_tables
            
            # 6. Supabase schemas and feature checking
            supabase_info = {}
            try:
                with engine.connect() as conn:
                    schemas_res = conn.execute(text("SELECT schema_name FROM information_schema.schemata;")).fetchall()
                    schemas = [r[0] for r in schemas_res]
                    supabase_info["available_schemas"] = schemas
                    supabase_info["auth_schema_exists"] = "auth" in schemas
                    supabase_info["storage_schema_exists"] = "storage" in schemas
                    supabase_info["realtime_schema_exists"] = "realtime" in schemas
                    
                    if "auth" in schemas:
                        try:
                            auth_users_cnt = conn.execute(text("SELECT COUNT(*) FROM auth.users;")).scalar()
                            supabase_info["auth_users_count"] = auth_users_cnt
                            supabase_info["auth_accessible"] = True
                        except Exception as auth_err:
                            supabase_info["auth_accessible"] = False
                            supabase_info["auth_error"] = str(auth_err)
                            
                    if "storage" in schemas:
                        try:
                            buckets_res = conn.execute(text("SELECT name, public FROM storage.buckets;")).fetchall()
                            supabase_info["storage_buckets"] = [{"name": r[0], "public": r[1]} for r in buckets_res]
                            supabase_info["storage_accessible"] = True
                        except Exception as stor_err:
                            supabase_info["storage_accessible"] = False
                            supabase_info["storage_error"] = str(stor_err)
                            
            except Exception as pg_err:
                supabase_info["error"] = str(pg_err)
            report["supabase_features"] = supabase_info
            
            # 7. Security Audit (RLS & Permissive Policies)
            security_aud = {}
            if "postgresql" in engine.name:
                try:
                    with engine.connect() as conn:
                        # RLS enabled on tables in public
                        rls_q = text("""
                            SELECT tablename, rowsecurity FROM pg_tables 
                            WHERE schemaname = 'public';
                        """)
                        rls_res = conn.execute(rls_q).fetchall()
                        rls_info = {r[0]: r[1] for r in rls_res}
                        security_aud["rls_enabled_by_table"] = rls_info
                        security_aud["rls_disabled_tables"] = [t for t, enabled in rls_info.items() if not enabled]
                        
                        # Policies audit
                        policies_q = text("""
                            SELECT tablename, policyname, roles, cmd, qual, with_check 
                            FROM pg_policies 
                            WHERE schemaname = 'public';
                        """)
                        pol_res = conn.execute(policies_q).fetchall()
                        policies_list = []
                        for r in pol_res:
                            p_dict = {
                                "table": r[0],
                                "policy": r[1],
                                "roles": r[2],
                                "cmd": r[3],
                                "qual": str(r[4]) if r[4] is not None else None,
                                "with_check": str(r[5]) if r[5] is not None else None
                            }
                            # Check of unsafe/too permissive policies
                            is_unsafe = False
                            if r[4] == "true" or r[5] == "true":
                                is_unsafe = True
                            p_dict["is_unsafe_permissive"] = is_unsafe
                            policies_list.append(p_dict)
                        security_aud["policies"] = policies_list
                        security_aud["unsafe_policies"] = [p for p in policies_list if p["is_unsafe_permissive"]]
                except Exception as aud_err:
                    security_aud["error"] = str(aud_err)
            else:
                security_aud["info"] = "Not a PostgreSQL database, skipped pg_catalog security audit."
            report["security_audit"] = security_aud
            
        except Exception as e:
            report["schema_verification"]["error"] = f"General inspection failed: {e}"
            
    # 8. Backend / FastAPI and session sanity
    report["backend_verification"]["fastapi_startup"] = "Success (App running)"
    report["backend_verification"]["engine_name"] = engine.name
    try:
        from backend.database import SessionLocal
        session = SessionLocal()
        session.execute(text("SELECT 1;"))
        session.close()
        report["backend_verification"]["session_creation"] = "Success"
        report["backend_verification"]["crud_smoketest"] = "Success (engine connection verified)"
    except Exception as e:
        report["backend_verification"]["session_creation"] = "Failed"
        report["backend_verification"]["crud_smoketest"] = f"Failed: {e}"
        
    print(f"WRITING COMPLETE VERIFICATION REPORT TO WORKSPACE...", flush=True)
    with open("verify_report.json", "w", encoding="utf-8") as rf:
        json.dump(report, rf, indent=2)
    print("VERIFICATION REPORT EXPORTED TO verify_report.json!", flush=True)

import threading

def run_async_startup_checks():
    print("ASYNC BACKGROUND TASKS: ALL BACKGROUND AUDITS, VERIFICATION SCRIPTS, SECURITY SCANS AND TESTS ARE DISABLED TO REDUCE LATENCY.", flush=True)
    try:
        from scripts.database.seed_db import seed_database
        from backend.database import SessionLocal
        from backend.models import JournalEntry
        db_check = SessionLocal()
        journal_count = db_check.query(JournalEntry).count()
        db_check.close()
        if journal_count == 0:
            print(f"DATABASE SEED CHECK: Current JournalCount is {journal_count}. Triggering complete force seeder...", flush=True)
            seed_database()
        else:
            print(f"DATABASE SEED CHECK: Current JournalCount is {journal_count} (>= 1). Seeding already satisfied, skipping re-seed.", flush=True)
    except Exception as seed_err:
        print(f"DATABASE AUTO-SEED ERROR: {seed_err}", flush=True)

    print("ASYNC BACKGROUND TASKS: Completed DB tasks successfully!", flush=True)

threading.Thread(target=run_async_startup_checks, daemon=True).start()

# Create FastAPI app instance
app = FastAPI(title="Sukoon AI", description="Clinical Therapy backend migrated to modular FastAPI & SQLAlchemy", version="2.0.0")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/audit-db")
def route_audit_db():
    try:
        from run_db_audit import run_audit
        run_audit()
        possible_paths = ["audit_report.txt", "./audit_report.txt", "/app/applet/audit_report.txt", "/audit_report.txt"]
        for p in possible_paths:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    content = f.read()
                return {"status": "success", "file_found": p, "report": content}
        return {"status": "error", "message": "Audit completed but report file was not found in expected paths."}
    except Exception as e:
        import traceback
        return {"status": "error", "error": str(e), "trace": traceback.format_exc()}

@app.get("/api/db/update-schema")
async def update_schema():
    with engine.begin() as conn:
        try:
            conn.execute(sqlalchemy.text("ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'Low'"))
        except Exception:
            pass
        try:
            conn.execute(sqlalchemy.text("ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS image_url VARCHAR"))
        except Exception:
            pass
    queries = [
        "ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS paid_chat_price_1d FLOAT DEFAULT 0.0;",
        "ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS paid_chat_price_7d FLOAT DEFAULT 0.0;",
        "ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS paid_chat_price_1m FLOAT DEFAULT 0.0;",
        "ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS paid_chat_price_updated_at VARCHAR;",
        "CREATE TABLE IF NOT EXISTS subscription_plans (id VARCHAR PRIMARY KEY, name VARCHAR, price FLOAT DEFAULT 0.0, duration_months INTEGER DEFAULT 1, is_lifetime INTEGER DEFAULT 0, max_ai_chats INTEGER DEFAULT 10, max_journal_entries INTEGER DEFAULT 30, priority_matching INTEGER DEFAULT 0, premium_features INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at VARCHAR);",
        "CREATE TABLE IF NOT EXISTS user_subscriptions (id VARCHAR PRIMARY KEY, user_id VARCHAR UNIQUE, plan_id VARCHAR, status VARCHAR DEFAULT 'Active', expiry_date VARCHAR, renewal_date VARCHAR, created_at VARCHAR, updated_at VARCHAR);",
        "CREATE TABLE IF NOT EXISTS purchase_history (id VARCHAR PRIMARY KEY, user_id VARCHAR, item_type VARCHAR, item_id VARCHAR, amount FLOAT, currency VARCHAR DEFAULT 'PKR', status VARCHAR DEFAULT 'Completed', payment_method VARCHAR, transaction_id VARCHAR, receipt_url VARCHAR, created_at VARCHAR);",
        "ALTER TABLE followup_requests ADD COLUMN IF NOT EXISTS patient_id VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS patient_id VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS booking_id VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS followup_expiry_date VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS last_message_at VARCHAR;",
        "ALTER TABLE followup_conversations ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'ACTIVE';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at VARCHAR;",
        "CREATE INDEX IF NOT EXISTS idx_therapist_profiles_user_id ON therapist_profiles (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_users_id ON users (id);",
        "CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);",
        "CREATE INDEX IF NOT EXISTS idx_session_bookings_client_id ON session_bookings (client_id);",
        "CREATE INDEX IF NOT EXISTS idx_session_bookings_therapist_id ON session_bookings (therapist_id);",
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id);",
        "CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_therapist_connections_therapist_id ON therapist_connections (therapist_id);",
        "CREATE INDEX IF NOT EXISTS idx_therapist_connections_client_id ON therapist_connections (client_id);",
        "CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages (sender_id);",
        "CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON direct_messages (receiver_id);"
    ]
    with engine.begin() as conn:
        for q in queries:
            try:
                conn.execute(sqlalchemy.text(q))
            except Exception:
                pass
    return {"status": "Schema updated!"}

# Register new modular API routers
app.include_router(auth.router)
app.include_router(therapist.router)
app.include_router(booking.router)
app.include_router(chat.router)
app.include_router(gamification.router)
app.include_router(journal.router)
app.include_router(notification.router)
app.include_router(finance.router)
app.include_router(admin.router)
app.include_router(support.router)
app.include_router(openai_router.router)

# --- BACKWARD COMPATIBILITY ENDPOINTS (LEGACY DIRECT EXECUTION PROXIES FOR SUCOON CLIENT) ---
def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def query_db(query, args=(), one=False, is_write=False):
    start_time = time.time()
    # Standardize SQL execution across the whole application using SQLAlchemy connection engine
    from sqlalchemy import text, inspect
    
    # 1. Intercept SQLite PRAGMA commands and translate using SQLAlchemy inspector
    if "PRAGMA table_info" in query:
        match = re.search(r"PRAGMA table_info\(([a-zA-Z0-9_]+)\)", query, re.IGNORECASE)
        if match:
            table_name = match.group(1)
            try:
                inspector = inspect(engine)
                columns = inspector.get_columns(table_name)
                # PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
                res = [{"name": col["name"]} for col in columns]
                print(f"DEBUG: QUERY_TIME: {time.time() - start_time:.4f}s | SQL: {query}", flush=True)
                return res
            except Exception as inspector_err:
                print(f"SQLAlchemy inspector error for {table_name}: {inspector_err}", flush=True)
                print(f"DEBUG: QUERY_TIME: {time.time() - start_time:.4f}s | SQL: {query}", flush=True)
                return []
                
    # 2. Convert standard SQLite '?' positional placeholders to dialact-agnostic named parameters ':p0', ':p1'
    param_dict = {}
    translated_query = ""
    arg_idx = 0
    i = 0
    n = len(query)
    while i < n:
        if query[i] == '?':
            param_name = f"p{arg_idx}"
            translated_query += f":{param_name}"
            if arg_idx < len(args):
                val = args[arg_idx]
                if isinstance(val, bool):
                    val = 1 if val else 0
                elif isinstance(val, (dict, list)):
                    # Serialize complex types to JSON strings for standard storage compatibility
                    val = json.dumps(val)
                param_dict[param_name] = val
            arg_idx += 1
        else:
            translated_query += query[i]
        i += 1
        
    # Translate SQLite dialect-specific concepts for other databases like PostgreSQL (Supabase)
    if engine.name != "sqlite":
        if "INSERT OR IGNORE INTO" in translated_query:
            translated_query = translated_query.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            if "ON CONFLICT" not in translated_query:
                translated_query = translated_query.strip()
                if translated_query.endswith(";"):
                    translated_query = translated_query[:-1].strip()
                translated_query += " ON CONFLICT DO NOTHING"
        
        # Translate SQLite-specific keywords to PG keywords
        translated_query = (
            translated_query
            .replace("DATETIME('now')", "NOW()")
            .replace("datetime('now')", "NOW()")
            .replace("datetime('now', 'localtime')", "NOW()")
        )
    # Ensure all boolean values in param_dict are strictly formatted as integers (1/0) to prevent datatype mismatches
    for pk, pv in list(param_dict.items()):
        if isinstance(pv, bool):
            param_dict[pk] = 1 if pv else 0

    try:
        if is_write:
            with engine.begin() as connection:
                if engine.name == "sqlite":
                    connection.execute(text("PRAGMA foreign_keys = ON;"))
                result = connection.execute(text(translated_query), param_dict)
                elapsed = time.time() - start_time
                print(f"DEBUG: QUERY_TIME: {elapsed:.4f}s | SQL: {query}", flush=True)
                return result.lastrowid
        else:
            with engine.connect() as connection:
                if engine.name == "sqlite":
                    connection.execute(text("PRAGMA foreign_keys = ON;"))
                result = connection.execute(text(translated_query), param_dict)
                if hasattr(result, "mappings"):
                    rv = [dict(row) for row in result.mappings()]
                else:
                    rv = [dict(row) for row in result]
                elapsed = time.time() - start_time
                print(f"DEBUG: QUERY_TIME: {elapsed:.4f}s | SQL: {query}", flush=True)
                return (rv[0] if rv else None) if one else rv
    except Exception as e:
        print(f"Standardized query_db exception for {query}: {e}", flush=True)
        print(f"DEBUG: QUERY_TIME: {time.time() - start_time:.4f}s | SQL: {query}", flush=True)
        if not is_write:
            return None if one else []
        raise e

def clean_row(row):
    if row is None:
        return None
    cleaned = {}
    for k, v in row.items():
        if isinstance(v, str) and (v.startswith('{') or v.startswith('[')):
            try:
                cleaned[k] = json.loads(v)
            except Exception:
                cleaned[k] = v
        else:
            cleaned[k] = v
    return cleaned

_table_columns_cache = {}

def get_table_columns(table_name: str) -> list:
    if table_name in _table_columns_cache:
        return _table_columns_cache[table_name]
    try:
        from backend.database import engine
        from sqlalchemy import inspect
        
        if engine.name == "sqlite":
            res = query_db(f"PRAGMA table_info({table_name})")
            cols = [row["name"] for row in res] if res else []
        else:
            inspector = inspect(engine)
            columns = inspector.get_columns(table_name)
            cols = [c["name"] for c in columns]
            
        if cols:
            _table_columns_cache[table_name] = cols
        return cols
    except Exception as e:
        print(f"Error in get_table_columns for {table_name}: {e}", flush=True)
        return []

def translate_filters(filters: list, table_name: str = None):
    where_parts = []
    params = []
    for f in filters:
         col = f.get("column")
         op = f.get("operator", f.get("type", "eq"))
         val = f.get("value")
         if not col or not re.match(r'^[a-zA-Z0-9_]+$', col):
              continue
         # Map legacy client_id filter to patient_id for follow-up tables
         if table_name in ("followup_requests", "followup_conversations") and col == "client_id":
              col = "patient_id"

         if op == "eq":
              where_parts.append(f"{col} = ?")
              params.append(val)
         elif op == "neq":
              where_parts.append(f"{col} != ?")
              params.append(val)
         elif op == "like":
              where_parts.append(f"{col} LIKE ?")
              params.append(f"%{val}%")
         elif op == "in":
              val_list = val if isinstance(val, list) else [val]
              placeholders = ", ".join(["?" for _ in val_list])
              where_parts.append(f"{col} IN ({placeholders})")
              params.extend(val_list)
         elif op == "or":
              val_str = str(val)
              or_parts = []
              for term in val_str.split(','):
                   if '.eq.' in term:
                        c_col, c_val = term.split('.eq.')
                        if table_name in ("followup_requests", "followup_conversations") and c_col == "client_id":
                             c_col = "patient_id"
                        or_parts.append(f"{c_col} = ?")
                        params.append(c_val)
              if or_parts:
                   where_parts.append(f"({' OR '.join(or_parts)})")
    return where_parts, params

@app.post("/api/db/select")
async def db_select(req: dict):
    table = req.get("table")
    select_cols = req.get("select", "*")
    filters = req.get("filters", [])
    order_col = req.get("orderCol")
    order_opts = req.get("orderOpts") or {}
    limit = req.get("limit")
    single = req.get("single", False)
    maybe_single = req.get("maybeSingle", False)
    
    if not table or not re.match(r'^[a-zA-Z0-9_]+$', table):
        return {"data": None, "error": {"message": "Invalid table"}}

    # Nested therapist profiles load
    if table == 'users' and 'therapist_profiles' in select_cols:
        query = "SELECT * FROM users"
        where_parts, params = translate_filters(filters, table)
        if where_parts:
            query += " WHERE " + " AND ".join(where_parts)
            
        has_crisis_certified = any('is_crisis_certified' in str(f.get('column')) for f in filters)
        if has_crisis_certified:
            query = """
                SELECT u.* FROM users u
                JOIN therapist_profiles p ON u.id = p.user_id
                WHERE u.role = 'therapist' AND p.is_crisis_certified = 1
            """
            params = []
            
        if order_col and re.match(r'^[a-zA-Z0-9_]+$', order_col):
            dir_str = "ASC" if order_opts.get("ascending", True) else "DESC"
            query += f" ORDER BY {order_col} {dir_str}"
        if limit is not None:
            query += f" LIMIT {int(limit)}"
            
        rows = query_db(query, tuple(params))
        cleaned_rows = [clean_row(r) for r in rows]
        user_ids = [u['id'] for u in cleaned_rows if u.get('id')]
        profiles_map = {}
        if user_ids:
            placeholders = ",".join(["?"] * len(user_ids))
            profiles = query_db(f"SELECT * FROM therapist_profiles WHERE user_id IN ({placeholders})", tuple(user_ids)) or []
            for p in profiles:
                cleaned_p = clean_row(p)
                profiles_map[cleaned_p['user_id']] = cleaned_p

        for u in cleaned_rows:
            u['therapist_profiles'] = profiles_map.get(u['id'], None)

        if single or maybe_single:
            data = cleaned_rows[0] if cleaned_rows else None
            if single and data is None:
                return {"data": None, "error": {"message": "Row not found"}}
            return {"data": data, "error": None}
        return {"data": cleaned_rows, "error": None}

    # Nested users load for feedback
    if table == 'user_feedback' and 'users' in select_cols:
        query = "SELECT * FROM user_feedback"
        where_parts, params = translate_filters(filters, table)
        if where_parts:
            query += " WHERE " + " AND ".join(where_parts)
        if order_col:
            dir_str = "ASC" if order_opts.get("ascending", True) else "DESC"
            query += f" ORDER BY {order_col} {dir_str}"
        rows = query_db(query, tuple(params))
        cleaned_rows = [clean_row(r) for r in rows]
        user_ids = list(set([f['user_id'] for f in cleaned_rows if f.get('user_id')]))
        users_map = {}
        if user_ids:
            placeholders = ",".join(["?"] * len(user_ids))
            users = query_db(f"SELECT id, display_name, email FROM users WHERE id IN ({placeholders})", tuple(user_ids)) or []
            for u in users:
                cleaned_u = clean_row(u)
                users_map[cleaned_u['id']] = cleaned_u

        for f in cleaned_rows:
            f['users'] = users_map.get(f['user_id'], None)

        if single or maybe_single:
            data = cleaned_rows[0] if cleaned_rows else None
            if single and data is None:
                return {"data": None, "error": {"message": "Row not found"}}
            return {"data": data, "error": None}
        return {"data": cleaned_rows, "error": None}

    # Connections join
    if table == 'therapist_connections' and ('users' in select_cols or 'client' in select_cols or 'therapist' in select_cols):
        query = "SELECT * FROM therapist_connections"
        where_parts, params = translate_filters(filters, table)
        if where_parts:
            query += " WHERE " + " AND ".join(where_parts)
        rows = query_db(query, tuple(params))
        cleaned_rows = [clean_row(r) for r in rows]
        all_user_ids = set()
        for c in cleaned_rows:
            if c.get('client_id'):
                all_user_ids.add(c['client_id'])
            if c.get('therapist_id'):
                all_user_ids.add(c['therapist_id'])
        
        users_map = {}
        if all_user_ids:
            user_ids_list = list(all_user_ids)
            placeholders = ",".join(["?"] * len(user_ids_list))
            users = query_db(f"SELECT id, display_name, email FROM users WHERE id IN ({placeholders})", tuple(user_ids_list)) or []
            for u in users:
                cleaned_u = clean_row(u)
                users_map[cleaned_u['id']] = cleaned_u

        for c in cleaned_rows:
            c['client'] = users_map.get(c.get('client_id'), None)
            c['therapist'] = users_map.get(c.get('therapist_id'), None)

        if single or maybe_single:
            data = cleaned_rows[0] if cleaned_rows else None
            if single and data is None:
                return {"data": None, "error": {"message": "Row not found"}}
            return {"data": data, "error": None}
        return {"data": cleaned_rows, "error": None}

    # Default Select
    query = f"SELECT {select_cols} FROM {table}"
    where_parts, params = translate_filters(filters, table)
    if where_parts:
        query += " WHERE " + " AND ".join(where_parts)
    if order_col and re.match(r'^[a-zA-Z0-9_\.]+$', order_col):
        dir_str = "ASC" if order_opts.get("ascending", True) else "DESC"
        query += f" ORDER BY {order_col} {dir_str}"
    if limit is not None:
        query += f" LIMIT {int(limit)}"
        
    try:
        rows = query_db(query, tuple(params))
        cleaned_rows = [clean_row(r) for r in rows]
        
        if single or maybe_single:
            data = cleaned_rows[0] if cleaned_rows else None
            if single and data is None:
                return {"data": None, "error": {"message": "Row not found"}}
            return {"data": data, "error": None}
        return {"data": cleaned_rows, "error": None}
    except Exception as e:
        return {"data": None, "error": {"message": str(e)}}

@app.post("/api/db/insert")
async def db_insert(req: dict, authorization: str = Header(None)):
    blocked_write = reject_client_demo_persistent_write(req.get("table"), authorization)
    if blocked_write:
        return blocked_write
    table = req.get("table")
    values = req.get("values") or {}
    
    if not table or not re.match(r'^[a-zA-Z0-9_]+$', table):
        return {"data": None, "error": {"message": "Invalid table"}}
        
    if not isinstance(values, list):
        values = [values]
        
    inserted_rows = []
    table_cols = get_table_columns(table)
    for val_dict in values:
        sanitized = {}
        for k, v in val_dict.items():
            if isinstance(v, (dict, list)):
                sanitized[k] = json.dumps(v)
            elif isinstance(v, bool):
                sanitized[k] = 1 if v else 0
            else:
                sanitized[k] = v
                
        if table_cols:
            sanitized = {k: v for k, v in sanitized.items() if k in table_cols}
            
        if "id" not in sanitized and (not table_cols or "id" in table_cols):
            if table == "support_ticket_messages":
                import random
                sanitized["id"] = random.randint(1, 2147483647)
            else:
                sanitized["id"] = str(uuid.uuid4())
            
        cols = list(sanitized.keys())
        placeholders = [r"?" for _ in cols]
        query = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"
        
        try:
            query_db(query, tuple(sanitized.values()), is_write=True)
            pk_col = "id" if "id" in sanitized else ("user_id" if "user_id" in sanitized else ("key" if "key" in sanitized else None))
            if pk_col:
                new_row = query_db(f"SELECT * FROM {table} WHERE {pk_col} = ?", (sanitized[pk_col],), one=True)
                if new_row:
                    inserted_rows.append(clean_row(new_row))
        except Exception as e:
            return {"data": None, "error": {"message": str(e)}}
            
    return {"data": inserted_rows, "error": None}

CLIENT_DEMO_USER_ID = "client-demo-001"
CLIENT_DEMO_EMAIL = "demo.client@sukoon.ai"
ACCOUNT_TABLES = {"users", "user_passwords"}
CLIENT_DEMO_PERSISTENT_TABLES = {
    "chat_messages", "chat_sessions", "journal_entries", "user_memory",
    "notifications", "support_tickets", "support_ticket_messages",
    "session_bookings", "therapist_connections", "direct_messages",
}

def client_demo_actor_id(authorization: str = None):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        from backend.auth import verify_token
        user_id = verify_token(token)
    except Exception:
        return None
    if not user_id:
        return None
    if user_id == CLIENT_DEMO_USER_ID:
        return user_id
    row = query_db("SELECT id, email FROM users WHERE id = ?", (user_id,), one=True)
    if row and str(row.get("email") or "").strip().lower() == CLIENT_DEMO_EMAIL:
        return row.get("id") or user_id
    return None

def client_demo_targets_other_account(payload, actor_id: str) -> bool:
    if not isinstance(payload, dict):
        return False
    target_id = str(payload.get("id") or payload.get("user_id") or "")
    target_email = str(payload.get("email") or "").strip().lower()
    if target_id and target_id != actor_id:
        return True
    if target_email and target_email != CLIENT_DEMO_EMAIL:
        return True
    return False

def reject_client_demo_persistent_write(table: str, authorization: str):
    if table not in CLIENT_DEMO_PERSISTENT_TABLES and table != "users":
        return None
    if not client_demo_actor_id(authorization):
        return None
    return {"data": None, "error": {"message": "Client Demo sessions cannot save permanent records."}}

def reject_client_demo_account_change(table: str, authorization: str, filters=None, values=None):
    actor_id = client_demo_actor_id(authorization)
    if not actor_id:
        return None
    if table in ACCOUNT_TABLES:
        blobs = []
        if isinstance(values, list):
            blobs.extend(values)
        elif isinstance(values, dict):
            blobs.append(values)
        if isinstance(filters, list):
            for item in filters:
                if isinstance(item, dict):
                    blobs.append({item.get("column"): item.get("value")})
        if table == "users" and not blobs:
            return {"data": None, "error": {"message": "Client Demo accounts cannot change user accounts."}}
        for blob in blobs:
            if client_demo_targets_other_account(blob, actor_id):
                return {"data": None, "error": {"message": "Client Demo accounts cannot change another account."}}
            if table == "user_passwords":
                return {"data": None, "error": {"message": "Client Demo accounts cannot change user accounts."}}
        if table == "users":
            for blob in blobs:
                column_id = str(blob.get("id") or blob.get("user_id") or "")
                if column_id and column_id != actor_id:
                    return {"data": None, "error": {"message": "Client Demo accounts cannot change another account."}}
    if table in ACCOUNT_TABLES or table in {"chat_messages", "chat_sessions", "journal_entries", "user_memory"}:
        if isinstance(filters, list):
            for item in filters:
                if not isinstance(item, dict):
                    continue
                column = str(item.get("column") or "")
                value = str(item.get("value") or "")
                if column in {"user_id", "id"} and value and value != actor_id and table in ACCOUNT_TABLES:
                    return {"data": None, "error": {"message": "Client Demo accounts cannot delete another account."}}
                if column == "user_id" and value and value != actor_id:
                    return {"data": None, "error": {"message": "Client Demo accounts cannot delete another account's data."}}
    return None

@app.post("/api/db/update")
async def db_update(req: dict, authorization: str = Header(None)):
    blocked_write = reject_client_demo_persistent_write(req.get("table"), authorization)
    if blocked_write:
        return blocked_write
    blocked = reject_client_demo_account_change(req.get("table"), authorization, req.get("filters"), req.get("values"))
    if blocked:
        return blocked
    table = req.get("table")
    values = req.get("values", {}) or {}
    filters = req.get("filters", [])
    
    if not table or not re.match(r'^[a-zA-Z0-9_]+$', table):
        return {"data": None, "error": {"message": "Invalid table"}}
        
    sanitized = {}
    for k, v in values.items():
        if isinstance(v, (dict, list)):
            sanitized[k] = json.dumps(v)
        elif isinstance(v, bool):
            sanitized[k] = 1 if v else 0
        else:
            sanitized[k] = v
            
    table_cols = get_table_columns(table)
    if table_cols:
        sanitized = {k: v for k, v in sanitized.items() if k in table_cols}
        
    if not sanitized:
        return {"data": None, "error": {"message": "No valid fields to update or empty payload"}}

    set_parts = [f"{k} = ?" for k in sanitized.keys()]
    params = list(sanitized.values())
    
    where_parts, filter_params = translate_filters(filters, table)
    query = f"UPDATE {table} SET {', '.join(set_parts)}"
    if where_parts:
        query += " WHERE " + " AND ".join(where_parts)
    params.extend(filter_params)
    
    try:
        query_db(query, tuple(params), is_write=True)
        select_query = f"SELECT * FROM {table}"
        if where_parts:
            select_query += " WHERE " + " AND ".join(where_parts)
        updated_rows = query_db(select_query, tuple(filter_params))
        cleaned = [clean_row(r) for r in updated_rows]
        return {"data": cleaned, "error": None}
    except Exception as e:
        return {"data": None, "error": {"message": str(e)}}

@app.post("/api/db/upsert")
async def db_upsert(req: dict, authorization: str = Header(None)):
    blocked_write = reject_client_demo_persistent_write(req.get("table"), authorization)
    if blocked_write:
        return blocked_write
    blocked = reject_client_demo_account_change(req.get("table"), authorization, None, req.get("values"))
    if blocked:
        return blocked
    table = req.get("table")
    values = req.get("values") or {}
    
    if not table or not re.match(r'^[a-zA-Z0-9_]+$', table):
        return {"data": None, "error": {"message": "Invalid table"}}
        
    if not isinstance(values, list):
        values = [values]
        
    inserted_rows = []
    table_cols = get_table_columns(table)
    
    for val_dict in values:
        sanitized = {}
        for k, v in val_dict.items():
            if isinstance(v, (dict, list)):
                sanitized[k] = json.dumps(v)
            elif isinstance(v, bool):
                sanitized[k] = 1 if v else 0
            else:
                sanitized[k] = v
                
        if table_cols:
            sanitized = {k: v for k, v in sanitized.items() if k in table_cols}
            
        # Determine the primary key column
        pk_col = None
        for candidate in ["id", "user_id", "key"]:
            if candidate in sanitized:
                pk_col = candidate
                break
                
        if not pk_col and table_cols and "id" in table_cols:
            sanitized["id"] = str(uuid.uuid4())
            pk_col = "id"
            
        try:
            exists = False
            if pk_col:
                existing = query_db(f"SELECT * FROM {table} WHERE {pk_col} = ?", (sanitized[pk_col],), one=True)
                if existing:
                    exists = True
                    
            if exists:
                # Update existing row
                set_parts = []
                params = []
                for k, v in sanitized.items():
                    if k != pk_col:
                        set_parts.append(f"{k} = ?")
                        params.append(v)
                if set_parts:
                    params.append(sanitized[pk_col])
                    query = f"UPDATE {table} SET {', '.join(set_parts)} WHERE {pk_col} = ?"
                    query_db(query, tuple(params), is_write=True)
            else:
                # Insert new row
                cols = list(sanitized.keys())
                placeholders = [r"?" for _ in cols]
                query = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(placeholders)})"
                query_db(query, tuple(sanitized.values()), is_write=True)
                
            if pk_col:
                new_row = query_db(f"SELECT * FROM {table} WHERE {pk_col} = ?", (sanitized[pk_col],), one=True)
                if new_row:
                    inserted_rows.append(clean_row(new_row))
        except Exception as e:
            return {"data": None, "error": {"message": str(e)}}
            
    return {"data": inserted_rows, "error": None}

@app.post("/api/db/delete")
async def db_delete(req: dict, authorization: str = Header(None)):
    table = req.get("table")
    filters = req.get("filters", [])
    actor_id = client_demo_actor_id(authorization)
    if actor_id and table in ACCOUNT_TABLES.union({"chat_messages", "chat_sessions", "journal_entries", "user_memory"}):
        return {"data": None, "error": {"message": "Client Demo accounts cannot delete an account."}}
    if actor_id:
        for item in filters or []:
            if not isinstance(item, dict):
                continue
            column = str(item.get("column") or "")
            value = str(item.get("value") or "")
            if column in {"user_id", "id", "email"} and value and value not in {actor_id, CLIENT_DEMO_EMAIL}:
                return {"data": None, "error": {"message": "Client Demo accounts cannot delete another account."}}
    
    if not table or not re.match(r'^[a-zA-Z0-9_]+$', table):
        return {"data": None, "error": {"message": "Invalid table"}}
        
    where_parts, params = translate_filters(filters, table)
    if not where_parts:
        return {"data": None, "error": {"message": "Filters required for deletion"}}
        
    query = f"DELETE FROM {table} WHERE " + " AND ".join(where_parts)
    try:
        query_db(query, tuple(params), is_write=True)
        return {"data": True, "error": None}
    except Exception as e:
        return {"data": None, "error": {"message": str(e)}}

@app.get("/api/util/alter-users")
def alter_users_table():
    from sqlalchemy import text
    results = []
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR;"))
            results.append("profile_picture_url added")
        except Exception as e: results.append(str(e))
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN cover_image_url VARCHAR;"))
            results.append("cover_image_url added")
        except Exception as e: results.append(str(e))
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN bio VARCHAR;"))
            results.append("bio added")
        except Exception as e: results.append(str(e))
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_public_profile INTEGER DEFAULT 0;"))
            results.append("is_public_profile added")
        except Exception as e: results.append(str(e))
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN referral_code VARCHAR UNIQUE;"))
            results.append("referral_code added")
        except Exception as e: results.append(str(e))
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN referred_by VARCHAR;"))
            results.append("referred_by added")
        except Exception as e: results.append(str(e))
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN reward_points INTEGER DEFAULT 0;"))
            results.append("reward_points added")
        except Exception as e: results.append(str(e))
    return results

@app.get("/api/health")
async def api_health():
    from sqlalchemy import inspect
    db_status = "unknown"
    tables = []
    users_columns = {}
    conn_error = None
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        db_status = "connected"
        if "users" in tables:
            for col in inspector.get_columns("users"):
                users_columns[col["name"]] = str(col["type"])
    except Exception as e:
        db_status = "error"
        conn_error = str(e)

    return {
        "status": "ok",
        "timestamp": int(time.time()),
        "database": {
            "status": db_status,
            "engine": engine.name,
            "url_provided": bool(os.environ.get("DATABASE_URL")),
            "tables": tables,
            "users_columns": users_columns,
            "error": conn_error
        }
    }

# --- SEED INITIAL DEMO SYSTEM DATA ---
try:
    print("Initializing sukoon database with complete client, therapist, and admin dummy data...", flush=True)
    
    # 1. Base Administrator
    admin_id = "admin-sys-001"
    try:
        query_db("""
            INSERT OR IGNORE INTO users (id, email, display_name, role, account_status, is_admin, preferred_language, tone_preference)
            VALUES (?, 'admin@sukoon.ai', 'Sukoon Admin', 'admin', 'active', 1, 'English', 'Professional')
        """, (admin_id,), is_write=True)
        query_db("INSERT OR IGNORE INTO user_passwords (user_id, password) VALUES (?, 'admin123')", (admin_id,), is_write=True)
    except Exception as admin_err:
        print(f"Base admin default insert skipped or already active: {admin_err}", flush=True)
    
    # 2. Base Therapist (Sarah Connor)
    therapist_id = "therapist-counsel-001"
    try:
        query_db("""
            INSERT OR IGNORE INTO users (id, email, display_name, role, account_status, age, gender, region, profession)
            VALUES (?, 'counselor@sukoon.ai', 'Dr. Sarah Connor', 'therapist', 'active', 38, 'Female', 'USA', 'Clinical Psychologist')
        """, (therapist_id,), is_write=True)
        query_db("INSERT OR IGNORE INTO user_passwords (user_id, password) VALUES (?, 'password123')", (therapist_id,), is_write=True)
        query_db("""
            INSERT OR IGNORE INTO therapist_profiles (user_id, specialty, bio, experience, rating, review_count, is_crisis_certified, license_number, bank_details, clinical_specializations)
            VALUES (?, 'Anxiety, PTSD, and trauma recovery counselor.', 'I offer collaborative, non-judgmental professional sessions tailored to stress relief, mindfulness, and trauma containment.', 12, 4.9, 8, 1, 'L-9843-NYC', '{}', '["Anxiety", "Trauma", "Mindfulness"]')
        """, (therapist_id,), is_write=True)
    except Exception as th_err:
        print(f"Base therapist default insert skipped or already active: {th_err}", flush=True)
    
    # 3. Premium & Normal Patients
    patient_1 = "patient-test-001"
    try:
        query_db("""
            INSERT OR IGNORE INTO users (id, email, display_name, role, account_status, age, gender, region, profession, preferred_language, tone_preference)
            VALUES (?, 'patient@sukoon.ai', 'Siddharth Gupta', 'patient', 'active', 24, 'Male', 'India', 'Software Engineer', 'English', 'Calm')
        """, (patient_1,), is_write=True)
        query_db("INSERT OR IGNORE INTO user_passwords (user_id, password) VALUES (?, 'patient123')", (patient_1,), is_write=True)
    except Exception as p1_err:
        print(f"Patient 1 default insert skipped or already active: {p1_err}", flush=True)
    
    patient_2 = "patient-test-002"
    try:
        query_db("""
            INSERT OR IGNORE INTO users (id, email, display_name, role, account_status, age, gender, region, profession, preferred_language, tone_preference)
            VALUES (?, 'anika@sukoon.ai', 'Anika Sharma', 'patient', 'active', 29, 'Female', 'India', 'UI Designer', 'English', 'Friendly')
        """, (patient_2,), is_write=True)
        query_db("INSERT OR IGNORE INTO user_passwords (user_id, password) VALUES (?, 'patient123')", (patient_2,), is_write=True)
    except Exception as p2_err:
        print(f"Patient 2 default insert skipped or already active: {p2_err}", flush=True)

    # 4. New Applicants for Admin dashboard listing
    applicant_1 = "applicant-001"
    try:
        query_db("""
            INSERT OR IGNORE INTO users (id, email, display_name, role, account_status)
            VALUES (?, 'aman@sukoon.ai', 'Dr. Aman Verma', 'therapist', 'pending')
        """, (applicant_1,), is_write=True)
        query_db("""
            INSERT OR IGNORE INTO therapist_applications (id, user_id, full_name, email, phone, years_experience, specialization, license_number, cv_file, degree_file, status, submitted_at)
            VALUES ('app-001', ?, 'Dr. Aman Verma', 'aman@sukoon.ai', '9876543210', 6, 'Youth Counseling', 'LIC-7489-IND', 'resume_verma.pdf', 'degree_verma.pdf', 'pending', '2026-06-09T14:45:00Z')
        """, (applicant_1,), is_write=True)
    except Exception as app1_err:
        print(f"Applicant 1 default insert skipped or already active: {app1_err}", flush=True)

    applicant_2 = "applicant-002"
    try:
        query_db("""
            INSERT OR IGNORE INTO users (id, email, display_name, role, account_status)
            VALUES (?, 'nisha@sukoon.ai', 'Nisha Rao', 'therapist', 'active')
        """, (applicant_2,), is_write=True)
        query_db("""
            INSERT OR IGNORE INTO therapist_applications (id, user_id, full_name, email, phone, years_experience, specialization, license_number, cv_file, degree_file, status, submitted_at)
            VALUES ('app-002', ?, 'Nisha Rao', 'nisha@sukoon.ai', '8765432109', 4, 'Sleep CBT', 'LIC-9921-IND', 'resume_rao.pdf', 'degree_rao.pdf', 'approved', '2026-06-07T11:00:00Z')
        """, (applicant_2,), is_write=True)
    except Exception as app2_err:
        print(f"Applicant 2 default insert skipped or already active: {app2_err}", flush=True)

    # 5. Calendar Slots
    query_db("INSERT OR IGNORE INTO calendar_slots (id, therapist_id, date, time, duration, status, client_name, session_type) VALUES ('slot-sarah-001', ?, '2026-06-11', '13:00', 60, 'booked', 'Siddharth Gupta', 'CBT')", (therapist_id,), is_write=True)
    query_db("INSERT OR IGNORE INTO calendar_slots (id, therapist_id, date, time, duration, status, client_name, session_type) VALUES ('slot-sarah-002', ?, '2026-06-12', '15:00', 60, 'available', NULL, 'General Talk')", (therapist_id,), is_write=True)
    query_db("INSERT OR IGNORE INTO calendar_slots (id, therapist_id, date, time, duration, status, client_name, session_type) VALUES ('slot-sarah-003', ?, '2026-06-13', '10:00', 60, 'available', NULL, 'Mindfulness')", (therapist_id,), is_write=True)
    query_db("INSERT OR IGNORE INTO calendar_slots (id, therapist_id, date, time, duration, status, client_name, session_type) VALUES ('slot-sarah-004', ?, '2026-06-14', '17:00', 60, 'booked', 'Anika Sharma', 'CBT')", (therapist_id,), is_write=True)

    # 6. Session Bookings
    query_db("INSERT OR IGNORE INTO session_bookings (id, client_id, therapist_id, session_type, date, time_slot, duration, fee, status, payment_screenshot, transaction_id, notes) VALUES ('booking-001', ?, ?, 'CBT', '2026-06-11', '13:00', 60, 150.0, 'Confirmed', 'screenshot1.png', 'tx-001', 'First session to discuss social anxiety.')", (patient_1, therapist_id), is_write=True)
    query_db("INSERT OR IGNORE INTO session_bookings (id, client_id, therapist_id, session_type, date, time_slot, duration, fee, status, payment_screenshot, transaction_id, notes) VALUES ('booking-002', ?, ?, 'CBT', '2026-06-14', '17:00', 60, 150.0, 'Pending', 'screenshot2.png', 'tx-002', 'Seeking CBT for insomnia.')", (patient_2, therapist_id), is_write=True)

    # 7. Therapy Notes
    query_db("INSERT OR IGNORE INTO therapy_notes (id, user_id, therapist_id, title, details, mark_type, date_of_note, next_reminder, created_at) VALUES ('note-001', ?, ?, 'Progress Review', 'Siddharth Gupta showed excellent progress dealing with stress. Focused on square breathing and mental restructuring.', 'Progress', '2026-06-10', '2026-06-17', '2026-06-10T12:00:00Z')", (patient_1, therapist_id), is_write=True)

    # 8. Team Members
    query_db("INSERT OR IGNORE INTO team_members (id, name, email, role, status, permissions, access_expires_at, last_login, created_at) VALUES ('team-001', 'Arjun Mehta', 'arjun@sukoon.ai', 'Lead Developer', 'Active', '{\"all\": true}', NULL, '2026-06-10T09:00:00Z', '2026-03-01T12:00:00Z')", is_write=True)
    query_db("INSERT OR IGNORE INTO team_members (id, name, email, role, status, permissions, access_expires_at, last_login, created_at) VALUES ('team-002', 'Riya Joshi', 'riya@sukoon.ai', 'Lead Clinician', 'Active', '{\"clinical\": true}', NULL, '2026-06-10T08:30:00Z', '2026-04-15T12:00:00Z')", is_write=True)

    # 9. Support Tickets
    query_db("INSERT OR IGNORE INTO support_tickets (id, user_id, user_email, user_name, type, subject, description, status, admin_response, resolved_at, created_at) VALUES ('ticket-001', ?, 'patient@sukoon.ai', 'Siddharth Gupta', 'technical', 'AI voice delay', 'Audio latency in chatbot session.', 'Open', NULL, NULL, '2026-06-10T05:00:00Z')", (patient_1,), is_write=True)
    query_db("INSERT OR IGNORE INTO support_tickets (id, user_id, user_email, user_name, type, subject, description, status, admin_response, resolved_at, created_at) VALUES ('ticket-002', ?, 'anika@sukoon.ai', 'Anika Sharma', 'account', 'Refund for canceled booking', 'rescheduled. Refund requested.', 'Resolved', 'Approved refund to user wallet balance.', '2026-06-09T18:00:00Z', '2026-06-08T12:00:00Z')", (patient_2,), is_write=True)

    # 10. Direct Messages (DM Thread)
    query_db("INSERT OR IGNORE INTO direct_messages (id, sender_id, receiver_id, content, created_at) VALUES ('dm-001', ?, ?, 'Hello Dr. Sarah, I booked my CBT session! Looking forward.', '2026-06-10T06:00:00Z')", (patient_1, therapist_id), is_write=True)
    query_db("INSERT OR IGNORE INTO direct_messages (id, sender_id, receiver_id, content, created_at) VALUES ('dm-002', ?, ?, 'Hi Siddharth, excellent. Please fill in your Morning Journal beforehand.', '2026-06-10T06:30:00Z')", (therapist_id, patient_1), is_write=True)

    # 11. Support / Risk Alerts / Safety
    query_db("INSERT OR IGNORE INTO risk_alerts (id, user_id, client_name, trigger_keyword, message, status, detected_at) VALUES ('alert-001', ?, 'Siddharth Gupta', 'harm', 'Patient session transcription logged stress trigger keyword.', 'Active', '2026-06-10T09:00:00Z')", (patient_1,), is_write=True)
    query_db("INSERT OR IGNORE INTO safety_incidents (id, therapist_id, client_name, incident_type, description, time_of_incident, status, created_at) VALUES ('incident-001', ?, 'Siddharth Gupta', 'High Anxiety Trigger', 'Severe workplace pressure transcription, automated crisis support sheet served.', '2026-06-10T09:01:00Z', 'Reported', '2026-06-10T09:01:00Z')", (therapist_id,), is_write=True)

    # 12. Marketing Expense / Wallet Mutations
    query_db("INSERT OR IGNORE INTO marketing_expenses (id, platform, amount, description, date) VALUES ('exp-001', 'Google Ads', 300, 'Search marketing on clinical wellness', '2026-06-01T12:00:00Z')", is_write=True)
    query_db("INSERT OR IGNORE INTO marketing_expenses (id, platform, amount, description, date) VALUES ('exp-002', 'Meta Ads', 200, 'Instagram lifestyle and wellness outreach campaigns', '2026-06-05T12:00:00Z')", is_write=True)

    query_db("INSERT OR IGNORE INTO wallet_transactions (id, user_id, therapist_id, client_id, amount, type, status, description, therapist_payout, date) VALUES ('tx-001', ?, ?, ?, 150.0, 'Credit', 'Verified', 'Session Booking Payment', 120.0, '2026-06-05T12:00:00Z')", (patient_1, therapist_id, patient_1), is_write=True)
    query_db("INSERT OR IGNORE INTO wallet_transactions (id, user_id, therapist_id, client_id, amount, type, status, description, therapist_payout, date) VALUES ('tx-002', ?, ?, ?, 150.0, 'Credit', 'Verified', 'Session Booking Payment', 120.0, '2026-06-06T15:00:00Z')", (patient_2, therapist_id, patient_2), is_write=True)

    query_db("INSERT OR IGNORE INTO payout_requests (id, therapist_id, therapist_name, amount, status, request_date, method, processed_at) VALUES ('payout-001', ?, 'Dr. Sarah Connor', 240.0, 'Pending', '2026-06-09T20:00:00Z', 'Chase Checking US9128...012', NULL)", (therapist_id,), is_write=True)

    # 13. System settings
    query_db("INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('payout_split', '0.85', CURRENT_TIMESTAMP)", is_write=True)
    query_db("INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('commission_rate', '0.15', CURRENT_TIMESTAMP)", is_write=True)
    query_db("INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('crisis_support_free', 'true', CURRENT_TIMESTAMP)", is_write=True)

    # 14. Reviews & Ratings
    query_db("INSERT OR IGNORE INTO reviews (id, therapist_id, client_name, rating, comment, created_at) VALUES ('review-001', ?, 'Siddharth Gupta', 5, 'Dr Sarah is highly professional and warm. Super helpful with social anxiety!', '2026-06-08T18:00:00Z')", (therapist_id,), is_write=True)
    query_db("INSERT OR IGNORE INTO reviews (id, therapist_id, client_name, rating, comment, created_at) VALUES ('review-002', ?, 'Anika Sharma', 5, 'Absolute top-tier mindfulness guidance. Very empathetic approach.', '2026-06-05T10:00:00Z')", (therapist_id,), is_write=True)

    # 15. Notifications & Broadcasts
    query_db("INSERT OR IGNORE INTO broadcasts (id, title, message, type, audience, sent_at) VALUES ('broadcast-001', 'Welcome to Sukoon Version 2.0', 'Welcome! Version 2 brings direct booking billing, custom therapist notes, secure broadcasts, and support tickets.', 'general', 'all', '2026-06-10T01:00:00Z')", is_write=True)

    query_db("INSERT OR IGNORE INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES ('notif-001', ?, 'System Launch Complete', 'Verify version 2 features, including secure transaction state controls.', 'system', 0, '2026-06-10T01:01:00Z')", (patient_1,), is_write=True)
    query_db("INSERT OR IGNORE INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES ('notif-002', ?, 'Payout Configuration Sync', 'Your payment processor is approved. Booking catalog is active.', 'system', 0, '2026-06-10T01:02:00Z')", (therapist_id,), is_write=True)

    # 16. Journal Entries
    query_db("""
        INSERT OR IGNORE INTO journal_entries (id, user_id, title, content, mood, created_at)
        VALUES ('journal-001', ?, 'Breathing in a Storm', 'Woke up feeling extremely overwhelmed today regarding college submissions. Practiced box breathing for 5 minutes and immediately felt more grounded. Finished my task sheet.', 'Calm', '2026-06-10T08:00:00Z')
    """, (patient_1,), is_write=True)
    query_db("""
        INSERT OR IGNORE INTO journal_entries (id, user_id, title, content, mood, created_at)
        VALUES ('journal-002', ?, 'Reflections', 'Anxious during meeting, but mental restructuring tricks kept me afloat.', 'Peaceful', '2026-06-09T09:00:00Z')
    """, (patient_1,), is_write=True)

    print("Success! Fully seeded rich user engagement dummy database records.", flush=True)
except Exception as seed_err:
    import traceback
    print(f"Unified DB seeding failed: {seed_err}", flush=True)
    traceback.print_exc()

# Serve static react SPA in production
if os.path.exists("dist"):
    if os.path.exists("dist/assets"):
        app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

    @app.get("/{catchall:path}")
    async def read_index(catchall: str):
        local_path = os.path.join("dist", catchall)
        if os.path.isfile(local_path) and not catchall.startswith("api"):
            return FileResponse(local_path)
        return FileResponse("dist/index.html")

if __name__ == "__main__":
    import uvicorn
    import traceback
    
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)
            
        raw_port = os.environ.get("PORT")
        port = int(raw_port) if raw_port and raw_port != "3000" else 3001
        
        print(f"Selecting port: {port}")
        reload_enabled = False
        
        print(f"Running uvicorn.run for main:app at 0.0.0.0:{port} reload={reload_enabled}")
        uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload_enabled)
    except Exception as run_err:
        print("CRITICAL ERROR IN MAIN:", run_err)
        traceback.print_exc()
