"""Read-only web release checks. Never prints secret values or changes infrastructure."""
import argparse
import asyncio
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse


def assess(values, features):
    checks = []
    def check(name, ok, action):
        checks.append({"check":name,"passed":bool(ok),"action":"" if ok else action})
    def supplied(key):
        value = values.get(key, "").strip()
        return value and not any(word in value.lower() for word in ["your_", "change-me", "change_in_production", "placeholder", "mock_"])
    check("production_environment",values.get("ENVIRONMENT","").lower() in {"production","prod","staging"},"ENVIRONMENT değerini production veya staging yapın.")
    key=values.get("APP_SECRET_KEY","")
    check("session_secret",len(key)>=32 and not key.startswith(("default-","test-")),"Rastgele en az 32 karakterlik APP_SECRET_KEY kullanın; web ve API aynı değeri kullanmalıdır.")
    encryption=values.get("ENCRYPTION_KEY","")
    check("encryption_key",bool(re.fullmatch(r"[a-fA-F0-9]{64}",encryption)) and encryption != "0123456789abcdef"*4,"ENCRYPTION_KEY için ayrı 32 baytlık rastgele hex anahtar kullanın.")
    check("database",values.get("DATABASE_URL","").startswith(("postgresql+asyncpg://","postgresql://","postgres://")),"Üretim PostgreSQL bağlantısını yapılandırın.")
    check("queue",values.get("REDIS_URL","").startswith(("redis://","rediss://")),"API ile worker'ın aynı Redis kuyruğunu kullandığını doğrulayın.")
    backend=urlparse(values.get("BACKEND_API_URL",""))
    check("web_proxy",bool(backend.hostname and backend.path.rstrip("/").endswith("/api/v1")),"BACKEND_API_URL erişilebilir FastAPI adresi olmalı ve /api/v1 ile bitmelidir.")
    front=urlparse(values.get("FRONTEND_URL",""))
    check("frontend_https",front.scheme=="https" and bool(front.hostname),"FRONTEND_URL için herkese açık HTTPS web adresini tanımlayın.")
    check("demo_disabled",values.get("ALLOW_LOCAL_DEMO","").lower()!="true","Üretimde ALLOW_LOCAL_DEMO değerini kaldırın.")
    check("email_delivery",supplied("SMTP_HOST") and supplied("SMTP_FROM") and "example.com" not in values.get("SMTP_FROM",""),"SMTP_HOST, SMTP_PORT, SMTP_FROM ve sağlayıcının istediği kimlik bilgilerini tanımlayın; gerçek teslimi staging'de doğrulayın.")
    if "google" in features:
        check("google_oauth",supplied("GOOGLE_OAUTH_CLIENT_ID") and supplied("GOOGLE_OAUTH_CLIENT_SECRET"),"Google OAuth istemci kimliği ve gizli anahtarı gerekiyor.")
        callback=urlparse(values.get("GOOGLE_OAUTH_REDIRECT_URI",""))
        check("google_callback",callback.scheme=="https" and callback.netloc==front.netloc and callback.path=="/api/v1/integrations/google/callback","Google dönüş adresini web ile aynı origin üzerinde /api/v1/integrations/google/callback yapın; Google Console'a da aynısını kaydedin.")
    if "billing" in features:
        check("paddle",supplied("PADDLE_API_KEY") and supplied("PADDLE_WEBHOOK_SECRET"),"Paddle API anahtarını ve webhook imza anahtarını yapılandırın.")
        check("paddle_live_mode",values.get("PADDLE_SANDBOX", "true").lower()=="false","Canlı ödeme yayını için PADDLE_SANDBOX=false yapın; önce sandbox ödeme ve webhook döngüsünü tamamlayın.")
    if "ai" in features:
        provider=values.get("LLM_PROVIDER","google").lower()
        provider_key={"google":"GOOGLE_API_KEY","openai":"OPENAI_API_KEY","anthropic":"ANTHROPIC_API_KEY"}.get(provider,"")
        check("ai_provider",bool(provider_key and supplied(provider_key) and supplied("DEFAULT_LLM_MODEL")),"Seçilen LLM sağlayıcısının anahtarını ve hesabınızda kullanılabilir model kimliğini tanımlayın.")
    return checks


async def service_checks(values, features):
    checks=[]
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
    url=values.get("DATABASE_URL","")
    if url.startswith("postgres://"): url=url.replace("postgres://","postgresql+asyncpg://",1)
    if url.startswith("postgresql://"): url=url.replace("postgresql://","postgresql+asyncpg://",1)
    engine=None
    try:
        engine=create_async_engine(url,connect_args={"timeout":5})
        async with engine.connect() as connection:
            version=(await connection.execute(text("SELECT version_num FROM alembic_version"))).scalar()
            checks.append({"check":"database_migration","passed":version=="20261015_complete_schema","action":"" if version=="20261015_complete_schema" else "Yedeği doğruladıktan sonra migration'ları uygulayın."})
            if "billing" in features:
                missing=(await connection.execute(text("SELECT COUNT(*) FROM plan_prices p JOIN plans plan ON plan.id=p.plan_id WHERE p.active AND p.amount_minor > 0 AND plan.is_public AND (p.external_price_id IS NULL OR p.external_price_id NOT LIKE 'pri_%')"))).scalar()
                count=(await connection.execute(text("SELECT COUNT(*) FROM plan_prices WHERE active AND amount_minor > 0"))).scalar()
                checks.append({"check":"paddle_price_ids","passed":bool(count and missing==0),"action":"" if count and missing==0 else "Tüm yayınlanacak ücretli plan/dönemlere gerçek Paddle fiyat kimliklerini girin."})
    except Exception:
        checks.append({"check":"database_connection","passed":False,"action":"Veritabanı bağlantısı veya salt okunur şema kontrolü başarısız. Değerler güvenlik için yazdırılmadı."})
    finally:
        if engine is not None: await engine.dispose()
    try:
        from redis.asyncio import from_url
        redis=from_url(values.get("REDIS_URL",""),socket_connect_timeout=5,socket_timeout=5)
        try: ok=await redis.ping()
        finally: await redis.aclose()
        checks.append({"check":"redis_connection","passed":bool(ok),"action":""})
    except Exception:
        checks.append({"check":"redis_connection","passed":False,"action":"Redis bağlantısı kurulamadı. Worker ayrıca çalışıyor olmalıdır."})
    return checks


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file",type=Path)
    parser.add_argument("--features",default="google,billing,ai")
    parser.add_argument("--check-services",action="store_true",help="Read-only PostgreSQL/Redis checks; no payment or email is sent")
    args=parser.parse_args()
    values={}
    if args.env_file:
        from dotenv import dotenv_values
        values.update({k:v or "" for k,v in dotenv_values(args.env_file).items()})
    values.update(os.environ)
    features=set(args.features.split(","))
    checks=assess(values,features)
    if args.check_services: checks.extend(asyncio.run(service_checks(values,features)))
    passed=all(c["passed"] for c in checks)
    print(json.dumps({"configuration_ready":passed,"checks":checks,"manual_gates":["Açığa çıkan eski parolalar/anahtarlar döndürüldü","API ve worker aynı sürümle çalışıyor","SMTP gerçek teslim testi tamamlandı","Paddle checkout ve imzalı webhook staging'de doğrulandı","Google OAuth dönüşü ve GSC eşitlemesi gerçek hesapla doğrulandı","Üretim yedeği ve geri yükleme denemesi tamamlandı"]},ensure_ascii=False,indent=2))
    return 0 if passed else 1

if __name__=="__main__": raise SystemExit(main())
