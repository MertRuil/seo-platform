import re
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from selectolax.parser import HTMLParser

from packages.shared.models import Site, SiteVerification
from services.crawler.safe_client import SafeHttpClient

logger = logging.getLogger(__name__)


class DomainVerificationService:
    @staticmethod
    async def verify_dns_txt(domain: str, token: str) -> bool:
        """
        Queries DNS TXT records for domain and _seo-challenge.<domain>.
        Returns True if token matches any TXT record.
        """
        try:
            import dns.resolver
            resolver = dns.resolver.Resolver()
            resolver.timeout = 5.0
            resolver.lifetime = 5.0

            subdomains_to_check = [
                f"_seo-challenge.{domain}",
                domain
            ]

            for qname in subdomains_to_check:
                try:
                    answers = resolver.resolve(qname, "TXT")
                    for rdata in answers:
                        for txt_string in rdata.strings:
                            val = txt_string.decode("utf-8", errors="ignore").strip()
                            if token in val:
                                return True
                except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
                    continue
                except Exception as e:
                    logger.debug(f"DNS lookup failed for {qname}: {e}")
            return False
        except Exception as e:
            logger.warning(f"DNS verification exception for {domain}: {e}")
            return False

    @staticmethod
    async def verify_html_file(site: Site, token: str) -> bool:
        """
        Fetches /.well-known/seo-verification.txt or /{token}.txt.
        Uses SafeHttpClient to enforce SSRF protection.
        """
        base_url = site.primary_url.rstrip("/")
        paths_to_check = [
            f"{base_url}/.well-known/seo-verification.txt",
            f"{base_url}/{token}.txt"
        ]

        client = SafeHttpClient(mode="OWNER_AUDIT", timeout_seconds=7.0)
        for url in paths_to_check:
            try:
                res = await client.fetch(url)
                if res.status_code == 200:
                    text = res.text.strip()
                    if token in text:
                        return True
            except Exception as e:
                logger.debug(f"HTML file check failed for {url}: {e}")
        return False

    @staticmethod
    async def verify_meta_tag(site: Site, token: str) -> bool:
        """
        Fetches primary URL homepage and checks for verification meta tag.
        Uses SafeHttpClient to enforce SSRF protection.
        """
        client = SafeHttpClient(mode="OWNER_AUDIT", timeout_seconds=7.0)
        try:
            res = await client.fetch(site.primary_url)
            if res.status_code == 200:
                tree = HTMLParser(res.text)
                for meta in tree.css("meta"):
                    name = (meta.attributes.get("name") or "").lower()
                    content = meta.attributes.get("content") or ""
                    if name in ("seo-platform-verification", "calpeo-site-verification", "seo-verification"):
                        if token in content:
                            return True
        except Exception as e:
            logger.debug(f"Meta tag check failed for {site.primary_url}: {e}")
        return False

    @classmethod
    async def execute_verification(
        cls,
        db: AsyncSession,
        site: Site,
        method: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Runs verification for the specified site using the given method
        or the method configured on its pending verification record.
        """
        # Fetch verification record
        stmt = select(SiteVerification).where(SiteVerification.site_id == site.id).order_by(SiteVerification.last_checked_at.desc())
        res = await db.execute(stmt)
        verification = res.scalars().first()

        if not verification:
            # Generate new token and record
            import uuid
            token = f"seo-verify-{uuid.uuid4().hex[:24]}"
            verification = SiteVerification(
                site_id=site.id,
                method=method or "DNS_TXT",
                token=token,
                status="PENDING"
            )
            db.add(verification)
            await db.flush()

        active_method = method or verification.method
        token = verification.token
        now = datetime.now(timezone.utc)
        verification.last_checked_at = now
        verification.method = active_method

        is_verified = False
        if active_method == "DNS_TXT":
            is_verified = await cls.verify_dns_txt(site.domain, token)
        elif active_method == "HTML_FILE":
            is_verified = await cls.verify_html_file(site, token)
        elif active_method == "META_TAG":
            is_verified = await cls.verify_meta_tag(site, token)
        else:
            return {
                "success": False,
                "status": "FAILED",
                "method": active_method,
                "message": f"Desteklenmeyen doğrulama yöntemi: {active_method}"
            }

        if is_verified:
            verification.status = "VERIFIED"
            verification.verified_at = now
            site.verification_status = "VERIFIED"
            await db.commit()
            return {
                "success": True,
                "status": "VERIFIED",
                "method": active_method,
                "verified_at": now.isoformat(),
                "message": f"{site.domain} alan adı mülkiyeti başarıyla doğrulandı."
            }
        else:
            verification.status = "FAILED"
            await db.commit()
            return {
                "success": False,
                "status": "FAILED",
                "method": active_method,
                "message": f"Alan adı mülkiyet kaydı doğrulanamadı. Lütfen {active_method} talimatlarını kontrol edin."
            }

    @staticmethod
    def get_instructions(site: Site, verification: SiteVerification) -> Dict[str, Any]:
        """
        Returns actionable instructions for all 3 verification methods.
        """
        token = verification.token
        base_url = site.primary_url.rstrip("/")
        return {
            "token": token,
            "current_status": site.verification_status,
            "methods": {
                "DNS_TXT": {
                    "record_type": "TXT",
                    "host": f"_seo-challenge.{site.domain}",
                    "alternative_host": "@ (Kök Alan Adı)",
                    "value": token,
                    "description": f"DNS yönetim panelinizden '_seo-challenge.{site.domain}' veya '@' için bir TXT kaydı oluşturun ve değeri '{token}' yapın."
                },
                "HTML_FILE": {
                    "file_name": "seo-verification.txt",
                    "path": f"{base_url}/.well-known/seo-verification.txt",
                    "alternative_path": f"{base_url}/{token}.txt",
                    "content": token,
                    "description": f"Web sitenizin kök dizinine veya /.well-known/ klasörüne 'seo-verification.txt' dosyası yükleyip içine '{token}' yazın."
                },
                "META_TAG": {
                    "snippet": f'<meta name="seo-platform-verification" content="{token}">',
                    "location": "Ana sayfa <head> etiketi içerisine ekleyin.",
                    "description": f"Ana sayfanızın <head> bloğuna <meta name=\"seo-platform-verification\" content=\"{token}\"> etiketini ekleyin."
                }
            }
        }
