import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    PROJECT_NAME: str = "KPM Full-Stack App"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # PostgreSQL Configuration
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "kpm_db"
    POSTGRES_SSLMODE: str | None = None

    DATABASE_URL: str | None = None

    # Auth
    SECRET_KEY: str = "kpm-dev-secret-change-me-in-production-32chars"
    GOOGLE_CLIENT_ID: str | None = None

    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Shared secret for ml-service → core internal routes (empty = open in local/dev)
    ML_SERVICE_TOKEN: str | None = None

    # Redis (optional — summary cache falls back to in-process when unset/unreachable)
    REDIS_URL: str | None = None
    REDIS_SUMMARY_TTL_SECONDS: int = 30

    def _with_sslmode(self, url: str) -> str:
        if not self.POSTGRES_SSLMODE or "sslmode=" in url:
            return url
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}sslmode={self.POSTGRES_SSLMODE}"

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            # Ensure it uses postgresql://
            if self.DATABASE_URL.startswith("postgres://"):
                url = self.DATABASE_URL.replace("postgres://", "postgresql://", 1)
            else:
                url = self.DATABASE_URL
            return self._with_sslmode(url)
        return self._with_sslmode(
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
