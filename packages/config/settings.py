from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # General
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_SECRET_KEY: str = "default-insecure-secret-key-change-in-production-min-32-chars"
    ENCRYPTION_KEY: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"  # Fallback for local tests without postgres
    DATABASE_SYNC_URL: Optional[str] = None

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # S3 / MinIO
    S3_ENDPOINT: str = "localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_NAME: str = "seo-crawl-snapshots"
    S3_USE_SSL: bool = False

    # LLM Providers
    LLM_PROVIDER: str = "google"
    GOOGLE_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    DEFAULT_LLM_MODEL: str = "gemini-1.5-pro"
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Google Search Console OAuth
    GOOGLE_OAUTH_CLIENT_ID: Optional[str] = None
    GOOGLE_OAUTH_CLIENT_SECRET: Optional[str] = None
    GOOGLE_OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/v1/integrations/google/callback"

    # CrUX
    CRUX_API_KEY: Optional[str] = None

    # App URLs
    API_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"

    @model_validator(mode="after")
    def reject_insecure_production_secrets(self):
        if self.ENVIRONMENT.lower() in {"production", "prod"}:
            if self.APP_SECRET_KEY.startswith("default-insecure-") or len(self.APP_SECRET_KEY) < 32:
                raise ValueError("APP_SECRET_KEY must be a non-default value of at least 32 characters in production")
            if self.ENCRYPTION_KEY == "0123456789abcdef" * 4:
                raise ValueError("ENCRYPTION_KEY must be changed in production")
            try:
                if len(bytes.fromhex(self.ENCRYPTION_KEY)) != 32:
                    raise ValueError
            except ValueError as exc:
                raise ValueError("ENCRYPTION_KEY must be a 64-character hexadecimal AES-256 key") from exc
        return self

settings = Settings()
