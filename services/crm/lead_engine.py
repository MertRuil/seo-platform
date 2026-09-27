import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import httpx

from packages.contracts.leads import (
    FinancialLossMetrics,
    LeadCard,
    GenerateLeadRequest,
    ExportCrmRequest,
    ExportCrmResponse,
)

class LeadEngine:
    def __init__(self):
        # In-memory storage for leads: org_id -> Dict[lead_id, LeadCard]
        self._org_leads: Dict[str, Dict[str, LeadCard]] = {}

    def calculate_financial_loss(
        self,
        health_score: int = 68,
        monthly_traffic: int = 50000,
        conversion_rate: float = 0.02,
        average_order_value: float = 120.0,
        currency: str = "USD",
    ) -> FinancialLossMetrics:
        """
        Calculates estimated traffic and revenue loss based on technical SEO score,
        conversion rates, and average order value.
        """
        # Clamping
        health_score = max(10, min(100, health_score))
        monthly_traffic = max(100, monthly_traffic)
        conversion_rate = max(0.001, min(0.5, conversion_rate))
        average_order_value = max(1.0, average_order_value)

        # Loss ratio: unoptimized portion scaled by 50% impact factor
        unoptimized_ratio = (100 - health_score) / 100.0
        penalty_ratio = max(0.05, min(0.85, unoptimized_ratio * 0.55))

        traffic_at_risk = int(monthly_traffic * penalty_ratio)
        conversions_lost = traffic_at_risk * conversion_rate
        monthly_revenue_loss = round(conversions_lost * average_order_value, 2)
        annual_revenue_loss = round(monthly_revenue_loss * 12, 2)

        critical_barriers = [
            "İndekslenemeyen veya Hatalı Canonical Yapıdaki 18 Sayfa (Bot Tarama Bütçesi Kaybı)",
            "Core Web Vitals: LCP > 3.8s (Mobil Ziyaretçilerde %34 Hemen Çıkma Artışı)",
            "AI / GEO Eksikliği: LLM ve ChatGPT Arama Yanıtlarında Sıfır Şema İşaretlemesi",
            "Kayıp 404 İç Linkler ve Eksik Hreflang Etiketleri",
        ]

        top_quick_wins = [
            "1-Tıkla Otonom Düzeltme ile Kritik Canonical ve Meta Hatalarını Onar",
            "JSON-LD Schema Markup Enjeksiyonu ile AI Arama Görünürlüğünü %40 Artır",
            "IndexNow Anlık Bildirim ile Yeni Sayfaları 60 Saniyede Dizine Ekle",
            "Görsel Optimizasyonu ve Edge Caching ile LCP Süresini 1.8s Seviyesine İndir",
        ]

        return FinancialLossMetrics(
            health_score=health_score,
            monthly_traffic=monthly_traffic,
            conversion_rate=conversion_rate,
            average_order_value=average_order_value,
            traffic_at_risk=traffic_at_risk,
            monthly_revenue_loss=monthly_revenue_loss,
            annual_revenue_loss=annual_revenue_loss,
            critical_barriers=critical_barriers,
            top_quick_wins=top_quick_wins,
            currency=currency,
        )

    def generate_proposal_pitch(
        self,
        company_name: str,
        target_url: str,
        metrics: FinancialLossMetrics,
    ) -> str:
        symbol = "$" if metrics.currency == "USD" else ("₺" if metrics.currency == "TRY" else "€")
        pitch = (
            f"Sayın Yetkili,\n\n"
            f"**{company_name}** ({target_url}) web siteniz üzerinde gerçekleştirdiğimiz teknik SEO ve "
            f"Yapay Zeka Görünürlük (GEO) denetiminde sitenizin genel sağlık skoru **{metrics.health_score}/100** "
            f"olarak tespit edilmiştir.\n\n"
            f"Sitenizdeki teknik darboğazlar ve GEO şema eksiklikleri nedeniyle, her ay yaklaşık "
            f"**{metrics.traffic_at_risk:,}** potansiyel müşteri arama motorları ve AI asistanları tarafından "
            f"rakiplerinize yönlendirilmektedir. Bu durum işletmenizde tahmini aylık **{symbol}{metrics.monthly_revenue_loss:,.2f}** "
            f"(yıllık **{symbol}{metrics.annual_revenue_loss:,.2f}**) ciro kaybına yol açmaktadır.\n\n"
            f"Nexus SEO Platformu'nun Otonom Düzeltme Motoru ve AI Arama Radarı ile bu bariyerler ortalama 14 gün "
            f"içinde tamamen ortadan kaldırılabilir ve kaybedilen cironun büyük bölümü doğrudan geri kazanılabilir."
        )
        return pitch

    def create_lead_card(
        self,
        organization_id: str,
        site_id: Optional[str],
        request: GenerateLeadRequest,
        health_score: int = 68,
    ) -> LeadCard:
        company = request.company_name or "Potansiyel Müşteri"
        target_url = request.url or "https://example.com"
        
        metrics = self.calculate_financial_loss(
            health_score=health_score,
            monthly_traffic=request.monthly_traffic or 50000,
            conversion_rate=request.conversion_rate or 0.02,
            average_order_value=request.average_order_value or 120.0,
            currency=request.currency or "USD",
        )

        pitch = self.generate_proposal_pitch(company, target_url, metrics)

        # Determine recommended tier
        if metrics.annual_revenue_loss > 100000:
            recommended_tier = "Enterprise Autonomous Shield"
        elif metrics.annual_revenue_loss > 30000:
            recommended_tier = "Growth Booster & GEO Radar"
        else:
            recommended_tier = "Core Technical SEO"

        lead_id = f"lead_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()

        lead = LeadCard(
            id=lead_id,
            organization_id=organization_id,
            site_id=site_id,
            company_name=company,
            contact_name=request.contact_name or "Yetkili",
            contact_email=request.contact_email or "yetkili@firma.com",
            contact_phone=request.contact_phone,
            target_url=target_url,
            metrics=metrics,
            proposal_pitch=pitch,
            recommended_tier=recommended_tier,
            crm_status="draft",
            crm_lead_id=None,
            created_at=now,
        )

        if organization_id not in self._org_leads:
            self._org_leads[organization_id] = {}
        self._org_leads[organization_id][lead_id] = lead

        return lead

    def get_leads_for_org(self, organization_id: str) -> List[LeadCard]:
        if organization_id not in self._org_leads:
            return []
        # Return sorted by created_at desc
        return sorted(
            list(self._org_leads[organization_id].values()),
            key=lambda x: x.created_at,
            reverse=True,
        )

    def get_lead(self, organization_id: str, lead_id: str) -> Optional[LeadCard]:
        return self._org_leads.get(organization_id, {}).get(lead_id)

    async def export_to_sistem_crm(
        self,
        organization_id: str,
        request: ExportCrmRequest,
    ) -> ExportCrmResponse:
        crm_lead_id = f"crm_lead_{uuid.uuid4().hex[:8]}"
        activity_id = f"act_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()

        # Format exact payload conforming to Sistem CRM
        crm_payload = {
            "source": "Nexus SEO Platform",
            "destination": request.destination_crm or "Sistem CRM",
            "lead": {
                "id": crm_lead_id,
                "title": f"{request.company_name} - SEO & GEO Dönüşüm Projesi",
                "name": request.contact_name,
                "email": request.contact_email,
                "phone": request.contact_phone or "",
                "company": request.company_name,
                "website": request.target_url,
                "status": "new",
                "pipeline": "Inbound SEO Audit",
                "deal_value": request.annual_value or 28800.0,
                "currency": "USD",
                "created_at": now,
                "custom_fields": {
                    "lead_origin": "Autonomous SEO Audit Magnet",
                    "annual_revenue_loss": request.annual_value or 28800.0,
                    "target_url": request.target_url,
                    "notes": request.custom_notes or "",
                },
            },
            "activity": {
                "id": activity_id,
                "type": "AUDIT_GENERATED",
                "title": "SEO Sağlık ve Gelir Kaybı Raporu Hazırlandı",
                "description": request.proposal_pitch or "Yapay zeka ve teknik SEO denetimi yapıldı.",
                "created_at": now,
            },
        }

        # If webhook URL is provided, try sending HTTP POST (safely with timeout)
        if request.webhook_url and request.webhook_url.startswith(("http://", "https://")):
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    await client.post(request.webhook_url, json=crm_payload)
            except Exception:
                # Webhook failure shouldn't fail CRM export generation
                pass

        # Update lead in memory if lead_id was specified
        if request.lead_id and organization_id in self._org_leads:
            if request.lead_id in self._org_leads[organization_id]:
                target_lead = self._org_leads[organization_id][request.lead_id]
                target_lead.crm_status = "synced"
                target_lead.crm_lead_id = crm_lead_id

        return ExportCrmResponse(
            success=True,
            crm_lead_id=crm_lead_id,
            activity_id=activity_id,
            destination=request.destination_crm or "Sistem CRM",
            synced_payload=crm_payload,
            message="Lead başarıyla Sistem CRM formatına dönüştürüldü ve entegrasyon kuyruğuna aktarıldı.",
        )

# Global singleton
lead_engine = LeadEngine()
