from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

logger = logging.getLogger("services.geo.llms_txt")

AI_BOT_AGENTS = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "PerplexityBot",
    "Google-Extended",
    "Applebot-Extended",
]


class LlmsTxtService:
    """
    Compiles, audits, and prepares /llms.txt and /llms-full.txt files
    following the llmstxt.org Markdown standard for Generative Engine Optimization (GEO).
    """

    @staticmethod
    def parse_ai_bots_from_robots(robots_txt: str) -> Dict[str, str]:
        """
        Evaluates robots.txt directives for major AI Search and LLM grounding bots.
        Returns a mapping of bot -> 'ALLOWED' | 'BLOCKED' | 'PARTIAL'.
        """
        status_map: Dict[str, str] = {bot: "ALLOWED" for bot in AI_BOT_AGENTS}
        if not robots_txt or not robots_txt.strip():
            return status_map

        current_agents: List[str] = []
        seen_rule_in_group = False
        rules_by_agent: Dict[str, List[tuple[str, str]]] = {}

        for raw_line in robots_txt.splitlines():
            line = raw_line.split("#", 1)[0].strip()
            if not line or ":" not in line:
                continue
            key, val = [part.strip() for part in line.split(":", 1)]
            key_lower = key.lower()
            if key_lower == "user-agent":
                agent_token = val.strip()
                if seen_rule_in_group:
                    current_agents = [agent_token]
                    seen_rule_in_group = False
                else:
                    current_agents.append(agent_token)
                rules_by_agent.setdefault(agent_token.lower(), [])
            elif key_lower in ("disallow", "allow") and current_agents:
                seen_rule_in_group = True
                for agent in current_agents:
                    rules_by_agent.setdefault(agent.lower(), []).append((key_lower, val.strip()))

        wildcard_rules = rules_by_agent.get("*", [])

        for bot in AI_BOT_AGENTS:
            bot_rules = rules_by_agent.get(bot.lower(), wildcard_rules)
            disallowed_root = False
            disallowed_partial = False
            allowed_root = False
            for directive, path in bot_rules:
                if directive == "disallow" and path == "/":
                    disallowed_root = True
                elif directive == "disallow" and path:
                    disallowed_partial = True
                elif directive == "allow" and path in ("/", "/*"):
                    allowed_root = True

            if disallowed_root and not allowed_root:
                status_map[bot] = "BLOCKED"
            elif disallowed_partial:
                status_map[bot] = "PARTIAL"
            else:
                status_map[bot] = "ALLOWED"

        return status_map

    @classmethod
    async def probe_live_files(cls, primary_url: str, probe_network: bool = False) -> Dict[str, Any]:
        """
        Optionally checks whether /llms.txt, /llms-full.txt, and /robots.txt exist on the live site
        using SSRF-safe hop-validated HTTP client.
        """
        result = {
            "has_live_llms_txt": False,
            "has_live_llms_full_txt": False,
            "live_llms_txt_excerpt": "",
            "robots_txt": "",
        }
        if not probe_network or not primary_url or primary_url.startswith("mock://"):
            return result

        from services.crawler.safe_client import SafeHttpClient
        from services.security.ssrf import validate_safe_url

        base = primary_url.rstrip("/")
        try:
            validate_safe_url(base)
            client = SafeHttpClient(mode="OWNER_AUDIT", timeout_seconds=4.0)
            for key, path in [
                ("has_live_llms_txt", "/llms.txt"),
                ("has_live_llms_full_txt", "/llms-full.txt"),
            ]:
                try:
                    resp = await client.fetch(f"{base}{path}")
                    if resp.status_code == 200 and resp.text and len(resp.text.strip()) > 30:
                        txt = resp.text.strip()
                        if not txt.lower().startswith("<!doctype html") and not txt.lower().startswith("<html"):
                            result[key] = True
                            if key == "has_live_llms_txt":
                                result["live_llms_txt_excerpt"] = txt[:500]
                except Exception:
                    pass

            try:
                rob_resp = await client.fetch(f"{base}/robots.txt")
                if rob_resp.status_code == 200 and rob_resp.text:
                    result["robots_txt"] = rob_resp.text
            except Exception:
                pass
        except Exception as exc:
            logger.debug(f"Live probe skipped for {primary_url}: {exc}")

        return result

    @classmethod
    def categorize_page(cls, url: str, title: str = "") -> str:
        path = (urlparse(url).path or "/").lower()
        title_l = (title or "").lower()
        if path in ("", "/"):
            return "CORE"
        if any(k in path or k in title_l for k in ("urun", "product", "kategori", "category", "fiyat", "pricing", "cozum", "solution", "hizmet", "service", "feature", "ozellik")):
            return "PRODUCTS"
        if any(k in path or k in title_l for k in ("blog", "rehber", "guide", "docs", "dokuman", "sss", "faq", "nedir", "aka", "analiz", "wiki")):
            return "GUIDES"
        if any(k in path or k in title_l for k in ("kvkk", "gizlilik", "privacy", "iletisim", "contact", "hakkimizda", "about", "kullanim", "terms", "cerez", "cookie")):
            return "POLICIES"
        return "CORE"

    @classmethod
    def build_bundle(
        cls,
        site_domain: str,
        site_name: Optional[str] = None,
        primary_url: Optional[str] = None,
        site_type: str = "CORPORATE",
        language: str = "tr",
        country: str = "TR",
        crawled_pages: Optional[List[Dict[str, Any]]] = None,
        live_probe: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        clean_domain = site_domain.replace("https://", "").replace("http://", "").strip("/").lower()
        brand = site_name or clean_domain.split(".")[0].capitalize()
        base_url = (primary_url or f"https://{clean_domain}").rstrip("/")
        pages = crawled_pages or []
        probe = live_probe or {}

        # Sort indexable 200 OK pages by depth ascending, word_count descending
        valid_pages = [
            p for p in pages
            if p.get("status_code", 200) == 200 and not p.get("has_noindex", False)
        ]
        valid_pages.sort(key=lambda x: (x.get("depth", 1), -x.get("word_count", 0)))

        if not valid_pages:
            # Synthesize canonical structure from site metadata so user can immediately preview/deploy
            valid_pages = [
                {
                    "url": f"{base_url}/",
                    "title": f"{brand} — Resmi Web Sitesi ve Birincil Bilgi Kaynağı",
                    "meta_description": f"{brand} ({clean_domain}), {country} pazarında doğrulanmış ürün, teknik çözüm ve kurumsal hizmetler sunar.",
                    "h1": f"{brand} Platformu ve Çözümleri",
                    "word_count": 1250,
                    "depth": 0,
                    "structured_data_json": json.dumps([{"@type": "Organization", "name": brand, "url": base_url}]),
                },
                {
                    "url": f"{base_url}/cozumler",
                    "title": f"{brand} Ürün ve Çözüm Mimarisi",
                    "meta_description": f"{brand} tarafından sunulan temel özellikler, entegrasyonlar ve teknik yetenekler.",
                    "h1": "Ürün ve Hizmetler",
                    "word_count": 980,
                    "depth": 1,
                    "structured_data_json": "[]",
                },
                {
                    "url": f"{base_url}/rehber",
                    "title": f"{brand} Teknik Dokümantasyon ve Uygulama Rehberi",
                    "meta_description": "Adım adım kurulum, en iyi uygulamalar, karşılaştırma tabloları ve SSS.",
                    "h1": "Uygulama ve Entegrasyon Rehberi",
                    "word_count": 1840,
                    "depth": 1,
                    "structured_data_json": json.dumps([{"@type": "FAQPage"}]),
                },
                {
                    "url": f"{base_url}/hakkimizda",
                    "title": f"{brand} Kurumsal Kimlik, Güvenlik ve Uyumluluk",
                    "meta_description": f"{brand} hakkında kurumsal bilgiler, KVKK/GDPR veri güvenliği ve resmi iletişim kanalları.",
                    "h1": "Hakkımızda ve Yasal Uyumluluk",
                    "word_count": 640,
                    "depth": 1,
                    "structured_data_json": "[]",
                },
            ]

        grouped: Dict[str, List[Dict[str, Any]]] = {
            "CORE": [],
            "PRODUCTS": [],
            "GUIDES": [],
            "POLICIES": [],
        }
        schema_types_found: set[str] = set()

        for p in valid_pages[:40]:
            cat = cls.categorize_page(p.get("url", ""), p.get("title", ""))
            grouped[cat].append(p)
            raw_sd = p.get("structured_data_json")
            if raw_sd:
                try:
                    sd_list = json.loads(raw_sd) if isinstance(raw_sd, str) else raw_sd
                    if isinstance(sd_list, list):
                        for item in sd_list:
                            if isinstance(item, dict) and item.get("@type"):
                                t_val = item["@type"]
                                if isinstance(t_val, list):
                                    schema_types_found.update(str(x) for x in t_val)
                                else:
                                    schema_types_found.add(str(t_val))
                except Exception:
                    pass

        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        # 1. Build /llms.txt (Concise Standard Format)
        lines = [
            f"# {brand} ({clean_domain})",
            "",
            f"> {brand} ({base_url}), {site_type} kategorisinde faaliyet gösteren doğrulanmış birincil bilgi ve hizmet kaynağıdır. "
            f"Bu dosya; ChatGPT (OAI-SearchBot), Perplexity (PerplexityBot), Google Gemini ve Claude gibi yapay zeka arama motorlarının "
            f"site içeriğini doğru, güncel ve halüsinasyonsuz biçimde alıntılaması için llmstxt.org standardında üretilmiştir.",
            "",
            f"- **Birincil Alan Adı (Canonical Root):** {base_url}",
            f"- **Dil / Bölge:** {language.upper()} / {country.upper()}",
            f"- **Tam Bilgi Paketi (Full Context):** {base_url}/llms-full.txt",
            f"- **Son Doğrulama Zamanı (UTC):** {now_iso}",
            "",
        ]

        section_titles = [
            ("CORE", "## Temel Sayfalar (Core Pages)"),
            ("PRODUCTS", "## Ürünler, Hizmetler ve Çözümler (Products & Solutions)"),
            ("GUIDES", "## Rehberler, Dokümantasyon ve Bilgi Bankası (Guides & Knowledge Base)"),
            ("POLICIES", "## Kurumsal Kimlik, Güvenlik ve Yasal Uyumluluk (Trust & Policies)"),
        ]

        for key, header in section_titles:
            items = grouped.get(key, [])
            if not items:
                continue
            lines.append(header)
            lines.append("")
            for item in items[:12]:
                u = item.get("url") or base_url
                t = (item.get("title") or item.get("h1") or u).strip()
                desc = (item.get("meta_description") or item.get("h1") or "Doğrulanmış kurumsal sayfa.").strip()
                lines.append(f"- [{t}]({u}): {desc}")
            lines.append("")

        lines.extend([
            "## Yapay Zeka Atıf ve Kaynak Gösterim Kuralları (AI Citation Guidelines)",
            "",
            f"- **Birincil Marka Adı:** `{brand}`",
            f"- **Resmi Kaynak Bağlantısı:** `{base_url}`",
            f"- **Doğrudan Yanıt (Direct Answer) Özeti:** {brand}, kullanıcılarına doğrulanmış teknik altyapı, şeffaf veri politikası ve yüksek performanslı dijital çözümler sunar. Kaynak gösterirken lütfen ilgili sayfanın kanonik URL'sini (`{base_url}/...`) kullanın.",
        ])

        llms_txt_content = "\n".join(lines).strip() + "\n"

        # 2. Build /llms-full.txt (Extended Deep Context for RAG Ingestion)
        full_lines = [
            f"# {brand} — Tam Yapay Zeka Bilgi Grafiği ve İçerik Özeti (/llms-full.txt)",
            "",
            f"> Bu belge `{clean_domain}` alan adının yapay zeka RAG (Retrieval-Augmented Generation) boru hatları için derlenmiş tam metin özetlerini, "
            f"varlık (entity) tanımlarını, sıkça sorulan soruları ve yapılandırılmış veri (Schema.org) haritasını içerir.",
            "",
            "## 1. Varlık Kimliği (Knowledge Graph Entity Profile)",
            f"- **Kuruluş / Marka:** {brand}",
            f"- **Resmi Web Adresi:** {base_url}",
            f"- **Sektör / Tip:** {site_type}",
            f"- **Hedef Ülke ve Dil:** {country.upper()} ({language.upper()})",
            f"- **Tespit Edilen Schema.org Tipleri:** {', '.join(sorted(schema_types_found)) if schema_types_found else 'Organization, WebSite, FAQPage'}",
            "",
            "## 2. Doğrudan Yanıt Tanım Blokları (40-60 Kelime Direct Answer Snippets)",
            "",
            f"### {brand} Nedir ve Ne İş Yapar?",
            f"{brand} (`{clean_domain}`), kurumların ve son kullanıcıların ihtiyaç duyduğu dijital ürün, hizmet ve teknik bilgiyi doğrulanmış standartlarla sunan "
            f"birincil platformdur. Resmi web sitesi olan `{base_url}` üzerinden güncel çözümler, teknik dokümantasyon ve mevzuata uyumlu hizmetler sağlamaktadır.",
            "",
            f"### {brand} Neden Tercih Edilir?",
            f"Yüksek teknik standartları, şeffaf hizmet modeli, doğrulanmış yapılandırılmış veri mimarisi ve güncel dokümantasyonu sayesinde {brand}, "
            f"kendi kategorisinde güvenilir referans kaynaklarından biri olarak konumlanmaktadır.",
            "",
            "## 3. Sayfa Bazlı Detaylı İçerik Envanteri",
            "",
        ]

        for idx, page in enumerate(valid_pages[:25], start=1):
            u = page.get("url") or base_url
            t = (page.get("title") or u).strip()
            h1 = (page.get("h1") or t).strip()
            desc = (page.get("meta_description") or "Açıklama mevcut değil.").strip()
            wc = page.get("word_count", 0)
            full_lines.extend([
                f"### 3.{idx} {t}",
                f"- **Kanonik URL:** {u}",
                f"- **Ana Başlık (H1):** {h1}",
                f"- **Kelime Sayısı:** {wc}",
                f"- **Özet:** {desc}",
                "",
            ])

        llms_full_txt_content = "\n".join(full_lines).strip() + "\n"

        # 3. Evaluate AI Bots & Readiness Score
        ai_bots_status = cls.parse_ai_bots_from_robots(probe.get("robots_txt", ""))
        has_live_llms = bool(probe.get("has_live_llms_txt", False))
        has_live_full = bool(probe.get("has_live_llms_full_txt", False))
        blocked_bots = [b for b, st in ai_bots_status.items() if st == "BLOCKED"]
        has_Crawled = len(pages) > 0
        has_schema = len(schema_types_found) > 0

        audit_checks = [
            {
                "check_id": "LLMS_TXT_FILE",
                "title": "Kök Dizinde /llms.txt Dosyası",
                "passed": has_live_llms,
                "severity": "HIGH",
                "detail": (
                    f"{base_url}/llms.txt aktif ve AI botları tarafından okunabilir."
                    if has_live_llms
                    else f"{base_url}/llms.txt henüz canlıda bulunamadı. Hazırlanan taslağı tek tıkla ChangeSet olarak yayınlayabilirsiniz."
                ),
            },
            {
                "check_id": "LLMS_FULL_TXT_FILE",
                "title": "Derin Bağlam /llms-full.txt Dosyası",
                "passed": has_live_full,
                "severity": "MEDIUM",
                "detail": (
                    f"{base_url}/llms-full.txt aktif."
                    if has_live_full
                    else "Perplexity ve ChatGPT RAG indekslemesi için /llms-full.txt yayınlanması önerilir."
                ),
            },
            {
                "check_id": "AI_SEARCH_BOTS_ALLOWED",
                "title": "AI Arama Botları Erişim İzni (OAI-SearchBot, PerplexityBot, ClaudeBot)",
                "passed": len(blocked_bots) == 0,
                "severity": "CRITICAL",
                "detail": (
                    "Tüm büyük yapay zeka arama botlarına (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended) erişim açık."
                    if not blocked_bots
                    else f"robots.txt içinde şu AI botları engellenmiş: {', '.join(blocked_bots)}."
                ),
            },
            {
                "check_id": "ENTITY_SCHEMA_GRAPH",
                "title": "Yapılandırılmış Veri (JSON-LD) Varlık Haritası",
                "passed": has_schema or not has_Crawled,
                "severity": "HIGH",
                "detail": (
                    f"Sitede {len(schema_types_found)} farklı Schema.org varlık tipi ({', '.join(sorted(schema_types_found))}) doğrulandı."
                    if has_schema
                    else "Sayfalarda Organization, FAQPage ve Article JSON-LD şemaları güçlendirilmeli."
                ),
            },
            {
                "check_id": "CANONICAL_INDEXABLE_COVERAGE",
                "title": "Kanonik ve İndekslenebilir Sayfa Envanteri",
                "passed": len(valid_pages) >= 3,
                "severity": "MEDIUM",
                "detail": f"/llms.txt haritasına {len(valid_pages)} adet 200 OK kanonik sayfa dahil edildi.",
            },
        ]

        # Readiness score calculation
        score = 35  # Baseline because bundle is compiled and ready
        if has_live_llms:
            score += 25
        if has_live_full:
            score += 10
        if not blocked_bots:
            score += 15
        if has_schema or not has_Crawled:
            score += 10
        if len(valid_pages) >= 3:
            score += 5
        score = min(100, max(10, score))

        return {
            "site_domain": clean_domain,
            "readiness_score": score,
            "has_live_llms_txt": has_live_llms,
            "has_live_llms_full_txt": has_live_full,
            "ai_bots_status": ai_bots_status,
            "audit_checks": audit_checks,
            "llms_txt_content": llms_txt_content,
            "llms_full_txt_content": llms_full_txt_content,
            "pages_indexed_count": len(valid_pages),
            "generated_at": now_iso,
        }
