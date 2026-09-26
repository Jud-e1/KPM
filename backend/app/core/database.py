from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

is_sqlite_fallback = False


def create_active_engine():
    global is_sqlite_fallback
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

Base = declarative_base()


def get_db() -> Generator:
    if SessionLocal is None:
        raise RuntimeError("Database engine is not initialized")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
        from sqlalchemy import inspect

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

        if is_sqlite_fallback and _sqlite_schema_needs_rebuild():
            logger.warning(
                "SQLite schema is stale (pre-business_id). Dropping and recreating local tables."
            )
            Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized (create_all). Run alembic for production migrations.")
    except Exception as e:
        logger.warning("Could not auto-create database tables on startup: %s", e)
