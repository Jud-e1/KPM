import os
import threading
from pathlib import Path
from typing import Generator
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker
import logging

from alembic import command
from alembic.config import Config

from app.core.config import settings
from app.core.sqlite_sync import LOCAL_PATH, enabled as blob_enabled, pull as pull_sqlite, push as push_sqlite, remote_stamp

logger = logging.getLogger(__name__)

is_sqlite_fallback = False
_blob_lock = threading.Lock()
_blob_inflight = 0
_blob_stamp: str | None = None


def _sqlite_engine(path: str):
    return create_engine(
        f"sqlite:///{path}",
        connect_args={"check_same_thread": False},
    )


def _remember_blob_stamp(stamp: str | None) -> None:
    global _blob_stamp
    _blob_stamp = stamp


def _load_shared_sqlite() -> None:
    """Replace the local file when another instance has published a newer copy."""
    global engine, SessionLocal
    if not blob_enabled():
        return
    stamp = remote_stamp()
    if stamp is None or stamp == _blob_stamp:
        return
    if engine is not None:
        engine.dispose()
    pulled = pull_sqlite(LOCAL_PATH)
    engine = _sqlite_engine(LOCAL_PATH)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    _remember_blob_stamp(pulled or stamp)


def _postgres_configured() -> bool:
    return bool(os.environ.get("DATABASE_URL") or settings.DATABASE_URL)


def _publish_shared_sqlite(_session) -> None:
    if not is_sqlite_fallback or not blob_enabled():
        return
    with _blob_lock:
        _remember_blob_stamp(push_sqlite(LOCAL_PATH))


def create_active_engine():
    global is_sqlite_fallback
    if os.environ.get("VERCEL") and not _postgres_configured():
        is_sqlite_fallback = True
        if blob_enabled():
            try:
                _remember_blob_stamp(pull_sqlite(LOCAL_PATH))
            except Exception as exc:
                logger.warning("Could not load shared SQLite: %s", exc)
        return _sqlite_engine(LOCAL_PATH)
    try:
        connect_timeout = 10 if settings.ENVIRONMENT == "production" else 3
        pg_engine = create_engine(
            settings.sync_database_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            pool_recycle=1800,
            connect_args={"connect_timeout": connect_timeout},
        )
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Successfully connected to PostgreSQL database.")
        is_sqlite_fallback = False
        return pg_engine
    except Exception as e:
        if settings.ENVIRONMENT == "production":
            logger.error("PostgreSQL is required in production and was not reachable: %s", e)
            raise
        logger.warning(
            "PostgreSQL not immediately reachable (%s). Falling back to local SQLite.",
            e,
        )
        is_sqlite_fallback = True
        return create_engine(
            "sqlite:///./kpm_app.db",
            connect_args={"check_same_thread": False},
        )


try:
    engine = create_active_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    logger.error("Error initializing database engine: %s", e)
    engine = None
    SessionLocal = None

event.listen(Session, "after_commit", _publish_shared_sqlite)

Base = declarative_base()


def get_db() -> Generator:
    global _blob_inflight
    if SessionLocal is None:
        raise RuntimeError("Database engine is not initialized")
    with _blob_lock:
        _blob_inflight += 1
        if _blob_inflight == 1 and is_sqlite_fallback:
            try:
                _load_shared_sqlite()
            except Exception as exc:
                logger.warning("Could not refresh shared SQLite: %s", exc)
        db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        with _blob_lock:
            _blob_inflight -= 1


def check_db_connection() -> dict:
    if engine is None:
        return {
            "status": "error",
            "connected": False,
            "message": "Database engine not initialized",
        }
    try:
        using_sqlite = engine.dialect.name == "sqlite"
        with engine.connect() as connection:
            connection.execute(text("SELECT 1")).scalar()
            db_version = connection.execute(
                text("SELECT sqlite_version()" if using_sqlite else "SELECT version()")
            ).scalar()
            return {
                "status": "healthy",
                "connected": True,
                "message": (
                    f"Database connection successful "
                    f"({'SQLite Fallback' if using_sqlite else 'PostgreSQL'})"
                ),
                "version": str(db_version),
                "server": "localhost (SQLite)" if using_sqlite else settings.POSTGRES_SERVER,
                "database": "kpm_app.db" if using_sqlite else settings.POSTGRES_DB,
            }
    except Exception as e:
        logger.error("Database unexpected error: %s", e)
        return {"status": "error", "connected": False, "message": str(e)}


def _sqlite_schema_needs_rebuild() -> bool:
    """Detect pre-multi-tenant SQLite files that create_all will not alter."""
    if engine is None or not is_sqlite_fallback:
        return False
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
        if "businesses" not in tables or "business_memberships" not in tables:
            return True
        if "accounting_profiles" in tables:
            cols = {c["name"] for c in insp.get_columns("accounting_profiles")}
            if "business_id" not in cols or "owner_id" in cols:
                return True
        if "inventory_products" in tables:
            cols = {c["name"] for c in insp.get_columns("inventory_products")}
            if "business_id" not in cols or "owner_id" in cols:
                return True
        return False
    except Exception as exc:
        logger.warning("SQLite schema probe failed (%s); rebuilding", exc)
        return True


def init_db() -> None:
    """Create tables for empty/dev DBs. Prefer `alembic upgrade head` in production."""
    if engine is None:
        return
    try:
        import app.models  # noqa: F401

        if is_sqlite_fallback and not blob_enabled() and _sqlite_schema_needs_rebuild():
            logger.warning(
                "SQLite schema is stale (pre-business_id). Dropping and recreating local tables."
            )
            Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        _ensure_completion_columns()
        _migrate_postgres()
        if is_sqlite_fallback and blob_enabled():
            latest = remote_stamp()
            if latest and latest != _blob_stamp:
                _load_shared_sqlite()
            else:
                _publish_shared_sqlite(None)
        logger.info("Database tables initialized (create_all). Run alembic for production migrations.")
    except Exception as e:
        logger.warning("Could not auto-create database tables on startup: %s", e)


def _migrate_postgres() -> None:
    """Apply Alembic on hosted Postgres. Local SQLite keeps create_all only."""
    if is_sqlite_fallback or engine is None or engine.dialect.name != "postgresql":
        return
    config_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    cfg = Config(str(config_path))
    cfg.set_main_option("sqlalchemy.url", settings.sync_database_url.replace("%", "%%"))
    command.upgrade(cfg, "head")


def _ensure_completion_columns() -> None:
    """Add columns introduced after the first multi-tenant schema. create_all will not alter."""
    if engine is None:
        return
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    statements: list[str] = []
    if "users" in tables:
        cols = {c["name"] for c in insp.get_columns("users")}
        if "email_verified" not in cols:
            statements.append(
                "ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE"
            )
    if "businesses" in tables:
        cols = {c["name"] for c in insp.get_columns("businesses")}
        if "plan" not in cols:
            statements.append("ALTER TABLE businesses ADD COLUMN plan VARCHAR(40) NOT NULL DEFAULT 'free'")
        if "stripe_customer_id" not in cols:
            statements.append("ALTER TABLE businesses ADD COLUMN stripe_customer_id VARCHAR(80)")
        if "stripe_subscription_id" not in cols:
            statements.append("ALTER TABLE businesses ADD COLUMN stripe_subscription_id VARCHAR(80)")
    if not statements:
        return
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
