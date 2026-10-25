from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from packages.config.settings import settings
from packages.shared.database import engine, Base
from apps.api.routes import (
    admin,
    auth,
    organizations,
    sites,
    issues,
    pages,
    crawls,
    recommendations,
    executions,
    integrations,
    graph,
    experiments,
    quick_audit,
    knowledge,
    connectors,
    billing,
    backlinks,
    geo,
    leads,
    copilot,
    alerts
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = None
    # Setup tables on startup if in dev/test; in production/staging rely on Alembic migrations
    try:
        if not settings.is_production_like:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        else:
            import logging
            logging.getLogger("uvicorn").info("Production environment: Database schema managed strictly via Alembic migrations.")
            if settings.TRUSTED_PROXY_HOPS == 0:
                logging.getLogger("uvicorn").warning(
                    "TRUSTED_PROXY_HOPS=0: rate limit soket IP'sine göre çalışıyor. "
                    "Yük dengeleyici arkasındaysanız tüm istemciler aynı kotayı paylaşır."
                )
            missing = []
            if not (settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET):
                missing.append("Google OAuth (Search Console bağlanamaz)")
            elif "localhost" in settings.GOOGLE_OAUTH_REDIRECT_URI:
                missing.append("GOOGLE_OAUTH_REDIRECT_URI localhost'u gösteriyor")
            if not settings.SMTP_HOST:
                missing.append("SMTP (şifre sıfırlama e-postası gitmez)")
            if not (settings.GOOGLE_API_KEY or settings.OPENAI_API_KEY or settings.ANTHROPIC_API_KEY):
                missing.append("LLM API anahtarı (AI Copilot ve AI önerileri kapalı)")
            if missing:
                logging.getLogger("uvicorn").warning("Eksik üretim yapılandırması: " + "; ".join(missing))
            if settings.REDIS_URL:
                try:
                    import redis.asyncio as aioredis
                    redis_client = aioredis.from_url(
                        settings.REDIS_URL,
                        socket_connect_timeout=1.5,
                        decode_responses=True,
                    )
                    await redis_client.ping()
                    app.state.redis = redis_client
                except Exception as redis_err:
                    logging.getLogger("uvicorn").warning(f"Redis rate-limit store unavailable at startup, using in-memory fallback: {redis_err}")
    except Exception as e:
        import logging
        logging.getLogger("uvicorn").warning(f"Database connection warning at startup: {e}")
    yield
    try:
        if getattr(app.state, "redis", None) is not None:
            await app.state.redis.aclose()
    except Exception:
        pass
    try:
        await engine.dispose()
    except Exception:
        pass

openapi_tags = [
    {
        "name": "Organizations",
        "description": "Organizasyon yönetimi, yeni organizasyon oluşturma, kullanıcı listeleme ve üye yetkilendirme işlemleri.",
    },
    {
        "name": "Auth",
        "description": "Kullanıcı kaydı, oturum açma, JWT token alma ve profil işlemleri.",
    },
    {
        "name": "Sites",
        "description": "Site tanımlama, doğrulama ve bağlayıcı (connector) yönetimi.",
    },
    {
        "name": "Crawls",
        "description": "Otonom polite web tarayıcısı, sitemap analizi ve sayfa keşfi.",
    },
    {
        "name": "Issues",
        "description": "Deterministik SEO ihlalleri ve sorun takip motoru.",
    },
    {
        "name": "Pages",
        "description": "Taranan web sayfaları ve indekslenebilirlik durumları.",
    },
    {
        "name": "Recommendations & AI Agents",
        "description": "Seviye-1 RAG kaynaklı otonom AI uzman ajanları ve önceliklendirilmiş öneriler.",
    },
    {
        "name": "Site Graph & Internal Linking",
        "description": "Yönlendirilmiş link grafı, PageRank dağılımı ve yetim sayfa çözümleri.",
    },
    {
        "name": "Safe Execution & Rollback",
        "description": "İki aşamalı doğrulama, concurrency kontrolü, güvenli uygulama ve atomik geri alma.",
    },
    {
        "name": "Integrations & Performance",
        "description": "Google Search Console, CrUX saha verileri ve Opportunity Engine.",
    },
    {
        "name": "Experiments & Learning",
        "description": "Difference-in-Differences nedensellik ve SEO deney takip motoru.",
    },
    {
        "name": "Knowledge & RAG",
        "description": "Seviye-1 resmi SEO bilgi deposu, hibrit RAG arama, doğrulama ve otonom kürasyon uç noktaları.",
    },
    {
        "name": "Health",
        "description": "Sistem canlılık ve veritabanı bağlantı sağlık kontrolleri.",
    }
]

app = FastAPI(
    title="Autonomous AI SEO Platform API",
    description="Üretim Seviyesinde Otonom AI SEO Platformu ve SEO İşletim Sistemi API Servisi",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=openapi_tags,
    lifespan=lifespan
)

# CORS Configuration (Support Next.js Web, Expo Mobile Web, Vercel, Render, Railway)
origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:19006",
    "http://127.0.0.1:19006"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.onrender\.com|.*\.railway\.app)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Failed-Attempts", "X-Show-Forgot-Password"]
)

import logging
from fastapi import Request
from fastapi.responses import JSONResponse

_err_logger = logging.getLogger("uvicorn.error")

@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    """Sterilize unhandled exceptions to prevent internal server stack trace disclosure."""
    _err_logger.error(f"Beklenmeyen sistem hatası [URL: {request.url.path}]: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Sunucu tarafında beklenmeyen bir hata meydana geldi. Lütfen sistem yöneticisi ile iletişime geçin."}
    )

# Root & Cloud Healthcheck Endpoints (Render, Railway, Kubernetes)
@app.get("/", tags=["Health"])
async def root_status():
    return {
        "service": "Autonomous AI SEO Platform API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "calpeo-seo-api"}

@app.get("/health/live", tags=["Health"])
async def health_live():
    return {"status": "alive", "timestamp": "ok"}

@app.get("/health/ready", tags=["Health"])
async def health_ready():
    # Database connection ping check
    try:
        async with engine.connect() as conn:
            await conn.execute(Base.metadata.tables['users'].select().limit(1))
        db_status = "connected"
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"Health ready DB check failed: {e}")
        db_status = "unhealthy"
    # Yük dengeleyici ve izleme yalnızca durum koduna bakar; veritabanı yoksa servis hazır değildir.
    return JSONResponse(
        status_code=200 if db_status == "connected" else 503,
        content={"status": "ready" if db_status == "connected" else "degraded", "database": db_status},
    )

# Mount API v1 Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(sites.router, prefix="/api/v1")
app.include_router(crawls.router, prefix="/api/v1")
app.include_router(issues.router, prefix="/api/v1")
app.include_router(pages.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")
app.include_router(executions.router, prefix="/api/v1")
app.include_router(integrations.router, prefix="/api/v1")
app.include_router(integrations.global_router, prefix="/api/v1")
app.include_router(experiments.router, prefix="/api/v1")
app.include_router(quick_audit.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(connectors.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(backlinks.router, prefix="/api/v1")
app.include_router(geo.router, prefix="/api/v1")
app.include_router(leads.router, prefix="/api/v1")
app.include_router(copilot.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")

@app.get("/api/v1/notifications")
async def get_notifications():
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    return [
        {
            "id": "notif-1",
            "title": "Kritik SEO Sorunu Tespit Edildi",
            "message": "Son taramada 3 sayfada 404 durumu saptandı. İndekslenebilirlik riski var.",
            "type": "CRITICAL_ALERT",
            "is_read": False,
            "created_at": (now - timedelta(minutes=12)).isoformat()
        },
        {
            "id": "notif-2",
            "title": "Otonom Tarama Tamamlandı",
            "message": "Sayfalar başarıyla tarandı. Sağlık skoru ve teknik metrikler güncellendi.",
            "type": "CRAWL_COMPLETE",
            "is_read": False,
            "created_at": (now - timedelta(minutes=45)).isoformat()
        },
        {
            "id": "notif-3",
            "title": "Yeni AI Düzeltme Önerisi",
            "message": "Schema.org Product JSON-LD yapılandırılmış verisi hazırlandı.",
            "type": "AI_RECOMMENDATION",
            "is_read": True,
            "created_at": (now - timedelta(hours=3)).isoformat()
        },
        {
            "id": "notif-4",
            "title": "Aylık Kota Bilgilendirmesi",
            "message": "Aylık sayfa kotanızın %36'sını kullandınız.",
            "type": "BILLING_UPDATE",
            "is_read": True,
            "created_at": (now - timedelta(days=1)).isoformat()
        }
    ]

@app.get("/")
async def root():
    return {
        "platform": "Autonomous AI SEO Platform",
        "status": "online",
        "docs": "/docs",
        "version": "v1"
    }
