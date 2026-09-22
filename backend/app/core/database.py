from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError, SQLAlchemyError
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create database engine with PostgreSQL priority and SQLite fallback
is_sqlite_fallback = False

def create_active_engine():
    global is_sqlite_fallback
    try:
        pg_engine = create_engine(
            settings.sync_database_url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            connect_args={"connect_timeout": 3}
        )
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Successfully connected to PostgreSQL database.")
        is_sqlite_fallback = False
        return pg_engine
    except Exception as e:
        logger.warning(f"PostgreSQL not immediately reachable ({e}). Falling back to high-performance local SQLite database.")
        is_sqlite_fallback = True
        sqlite_engine = create_engine(
            "sqlite:///./kpm_app.db",
            connect_args={"check_same_thread": False}
        )
        return sqlite_engine

try:
    engine = create_active_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    logger.error(f"Error initializing database engine: {e}")
    engine = None
    SessionLocal = None

Base = declarative_base()


def get_db() -> Generator:
    """Dependency for providing a database session in FastAPI endpoints."""
    if SessionLocal is None:
        raise RuntimeError("Database engine is not initialized")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> dict:
    """Checks the database connection and returns health status details."""
    if engine is None:
        return {
            "status": "error",
            "connected": False,
            "message": "Database engine not initialized"
        }
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1")).scalar()
            db_version = connection.execute(text("SELECT sqlite_version()" if is_sqlite_fallback else "SELECT version()")).scalar()
            return {
                "status": "healthy",
                "connected": True,
                "message": f"Database connection successful ({'SQLite Fallback' if is_sqlite_fallback else 'PostgreSQL'})",
                "version": str(db_version),
                "server": "localhost (SQLite)" if is_sqlite_fallback else settings.POSTGRES_SERVER,
                "database": "kpm_app.db" if is_sqlite_fallback else settings.POSTGRES_DB
            }
    except Exception as e:
        logger.error(f"Database unexpected error: {e}")
        return {
            "status": "error",
            "connected": False,
            "message": str(e)
        }


def init_db() -> None:
    """Initialize database tables."""
    if engine is not None:
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables initialized successfully.")
        except Exception as e:
            logger.warning(f"Could not auto-create database tables on startup: {e}")
