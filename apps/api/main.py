from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from packages.config.settings import settings
from packages.shared.database import engine, Base
from apps.api.routes import (
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
    knowledge
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup tables on startup if in dev/test
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        import logging
        logging.getLogger("uvicorn").warning(f"Database connection warning at startup: {e}")
    yield
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

# CORS Configuration
origins = list(set([settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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

# Health Endpoints (Section 167)
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
    return {"status": "ready" if db_status == "connected" else "degraded", "database": db_status}

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
app.include_router(experiments.router, prefix="/api/v1")
app.include_router(quick_audit.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "platform": "Autonomous AI SEO Platform",
        "status": "online",
        "docs": "/docs",
        "version": "v1"
    }
