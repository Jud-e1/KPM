from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=True)

    CORE_API_BASE: str = "http://127.0.0.1:8000/api/v1"
    ML_SERVICE_TOKEN: str | None = None
    DATABASE_URL: str | None = None
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "kpm_db"
    POSTGRES_SSLMODE: str | None = None
    ENVIRONMENT: str = "development"
    REGISTRY_ROOT: str = "registry"
    POLL_INTERVAL_SEC: float = 5.0
    HOST: str = "127.0.0.1"
    PORT: int = 8001

    def _with_sslmode(self, url: str) -> str:
        if not self.POSTGRES_SSLMODE or "sslmode=" in url:
            return url
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}sslmode={self.POSTGRES_SSLMODE}"

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            if self.DATABASE_URL.startswith("postgres://"):
                url = self.DATABASE_URL.replace("postgres://", "postgresql://", 1)
            else:
                url = self.DATABASE_URL
            return self._with_sslmode(url)
        return self._with_sslmode(
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
