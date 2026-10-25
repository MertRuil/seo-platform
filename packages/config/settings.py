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
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    ALLOW_TEST_OAUTH_TOKENS: bool = False
    APP_SECRET_KEY: str = "default-insecure-secret-key-change-in-production-min-32-chars"
    ENCRYPTION_KEY: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"  # Fallback for local tests without postgres
    DATABASE_SYNC_URL: Optional[str] = None

    # Initial platform admin (seeded by scripts/init_db.py only when both are set)
    INITIAL_ADMIN_EMAIL: Optional[str] = None
    INITIAL_ADMIN_PASSWORD: Optional[str] = None

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Önündeki güvenilir reverse proxy sayısı (Render/Railway yük dengeleyicisi = 1).
    # 0 iken X-Forwarded-For okunmaz; proxy arkasında 0 bırakılırsa tüm istemciler tek IP görünür.
    TRUSTED_PROXY_HOPS: int = 0

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
    PERPLEXITY_API_KEY: Optional[str] = None
    DEFAULT_LLM_MODEL: str = "gemini-3.8-flash"
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # RAG Knowledge System & Rate Limiting
    RAG_RATE_LIMIT_RPM: int = 15
    RAG_RATE_LIMIT_TPM: int = 50000
    RAG_DAILY_REQUEST_BUDGET: int = 1500
    RAG_DAILY_TOKEN_BUDGET: int = 500000
    RAG_VERIFICATION_MIN_CONFIDENCE: float = 0.85
    RAG_STORE_PATH: str = "data/knowledge_store.json"

    # Google Search Console OAuth
    GOOGLE_OAUTH_CLIENT_ID: Optional[str] = None
    GOOGLE_OAUTH_CLIENT_SECRET: Optional[str] = None
    GOOGLE_OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/v1/integrations/google/callback"
    GITHUB_OAUTH_CLIENT_ID: Optional[str] = None

    # CrUX & External SEO/Backlink Providers
    CRUX_API_KEY: Optional[str] = None
    DATAFORSEO_LOGIN: Optional[str] = None
    DATAFORSEO_PASSWORD: Optional[str] = None
    OPENPAGERANK_API_KEY: Optional[str] = None

    # Paddle ödemeleri
    PADDLE_API_KEY: Optional[str] = None
    PADDLE_WEBHOOK_SECRET: Optional[str] = None
    PADDLE_SANDBOX: bool = True

    # App URLs
    API_BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "CALPEO <noreply@calpeo.io>"

    @model_validator(mode="after")
    def reject_insecure_production_secrets(self):
        # Test OAuth tokens MUST NEVER be enabled outside 'test' environment
        if self.ENVIRONMENT.lower() != "test":
            self.ALLOW_TEST_OAUTH_TOKENS = False

        if self.ENVIRONMENT.lower() in {"production", "prod", "staging"}:
            if self.APP_SECRET_KEY.startswith("default-insecure-") or len(self.APP_SECRET_KEY) < 32:
                raise ValueError("APP_SECRET_KEY must be a non-default value of at least 32 characters in production/staging")
            if self.ENCRYPTION_KEY == "0123456789abcdef" * 4:
                raise ValueError("ENCRYPTION_KEY must be changed in production/staging")
            try:
                if len(bytes.fromhex(self.ENCRYPTION_KEY)) != 32:
                    raise ValueError
            except ValueError as exc:
                raise ValueError("ENCRYPTION_KEY must be a 64-character hexadecimal AES-256 key") from exc

            # PostgreSQL is the only supported data source outside local development/test
            if not self.DATABASE_URL.lower().startswith(("postgresql://", "postgresql+asyncpg://", "postgres://")):
                raise ValueError("DATABASE_URL must point to PostgreSQL in production/staging (sqlite is not allowed)")
        return self

    @property
    def is_production_like(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod", "staging"}

settings = Settings()
