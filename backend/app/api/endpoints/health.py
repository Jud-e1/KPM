from fastapi import APIRouter
from app.core.database import check_db_connection
from app.core.config import settings

router = APIRouter()


@router.get("/health", summary="Health and Database Status")
def health_check():
    """Returns application health, environment information, and PostgreSQL connection status."""
    db_status = check_db_connection()
    return {
        "status": "online" if db_status.get("connected") else "degraded",
        "app_name": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }
