import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from packages.shared.database import get_db
from packages.shared.models import LeadRecord
from packages.contracts.leads import LeadCard, GenerateLeadRequest, ExportCrmRequest, ExportCrmResponse
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.crm.lead_engine import lead_engine
from services.crawler.safe_client import SafeHttpClient
from services.crawler.html_extractor import HtmlExtractor
from services.crawler.url_normalizer import UrlNormalizer
from services.seo_engine.engine import SeoRuleEngine

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/leads", tags=["CRM & Lead Engine"])


async def observe_health(url: str):
    try:
        response = await SafeHttpClient(timeout_seconds=10).fetch(UrlNormalizer.normalize(url))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Hedef sayfa güvenli biçimde okunamadı; tahmin üretilmedi.") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Hedef sayfa HTTP {response.status_code} döndürüyor; tahmin üretilmedi.")
    html = HtmlExtractor.extract(response.text, response.final_url, dict(response.headers))
    page = {**vars(html), "url": response.final_url, "status_code": response.status_code,
            "canonical_target": html.canonical_url, "headers":dict(response.headers),
            "h1": next(iter(html.headings.get("h1", [])), None),
            "internal_links":[{"href":l.href,"anchor_text":l.anchor_text,"rel":l.rel} for l in html.links if l.is_internal]}
    return SeoRuleEngine().evaluate_site([page])


@router.get("", response_model=List[LeadCard])
async def list_site_leads(org_id: str, site_id: str, payload: dict = Depends(get_current_user_payload), db: AsyncSession = Depends(get_db)):
    await verify_site_access(org_id, site_id, payload.get("sub"), db)
    records = (await db.execute(select(LeadRecord).where(LeadRecord.organization_id==org_id,LeadRecord.site_id==site_id).order_by(LeadRecord.created_at.desc()))).scalars().all()
    return [LeadCard.model_validate_json(r.payload_json) for r in records]


@router.post("/generate", response_model=LeadCard)
async def generate_lead_opportunity(org_id: str, site_id: str, req: GenerateLeadRequest, payload: dict = Depends(get_current_user_payload), db: AsyncSession = Depends(get_db)):
    site = await verify_site_access(org_id, site_id, payload.get("sub"), db, ["OWNER","ADMIN","SEO_MANAGER"])
    target = req.url or site.primary_url
    observed = await observe_health(target)
    request = req.model_copy(update={"url":target,"company_name":req.company_name or site.name or site.domain})
    lead = lead_engine.create_lead_card(org_id,site_id,request,health_score=observed["health_score"],remember=False)
    lead.metrics.critical_barriers = [issue.title for issue in observed["issues"][:5]]
    lead.metrics.top_quick_wins = [issue.recommendation_template for issue in observed["issues"][:3]]
    lead.proposal_pitch = (f"{lead.company_name} ({target}) ana sayfa denetim puanı: {lead.metrics.health_score}/100. "
        f"Girilen trafik, dönüşüm oranı ve sipariş tutarı varsayımlarıyla aylık {lead.metrics.monthly_revenue_loss} {lead.metrics.currency} senaryo tahmini hesaplandı. "
        "Bu tutar ölçülmüş gelir kaybı veya gelir artışı taahhüdü değildir; ana sayfa denetimi sitenin tamamını temsil etmez.")
    db.add(LeadRecord(id=lead.id,organization_id=org_id,site_id=site_id,payload_json=lead.model_dump_json()))
    await db.commit()
    return lead


@router.post("/quick-audit", response_model=LeadCard)
async def quick_audit_lead_magnet(org_id: str, site_id: str, req: GenerateLeadRequest, payload: dict = Depends(get_current_user_payload), db: AsyncSession = Depends(get_db)):
    return await generate_lead_opportunity(org_id,site_id,req,payload,db)


@router.post("/export-crm", response_model=ExportCrmResponse)
async def export_lead_to_crm(org_id: str, site_id: str, req: ExportCrmRequest, payload: dict = Depends(get_current_user_payload), db: AsyncSession = Depends(get_db)):
    await verify_site_access(org_id, site_id, payload.get("sub"), db, ["OWNER","ADMIN","SEO_MANAGER"])
    record = None
    if req.lead_id:
        record = (await db.execute(select(LeadRecord).where(LeadRecord.id==req.lead_id,LeadRecord.organization_id==org_id,LeadRecord.site_id==site_id))).scalars().first()
        if not record: raise HTTPException(status_code=404,detail="Müşteri kaydı bulunamadı")
    try:
        result = await lead_engine.export_to_sistem_crm(org_id,req)
    except Exception as exc:
        raise HTTPException(status_code=502,detail="CRM webhook teslimi doğrulanamadı. Kayıt senkronize olarak işaretlenmedi.") from exc
    if record:
        lead = LeadCard.model_validate_json(record.payload_json)
        lead.crm_status = "synced" if result.delivered else "exported"
        lead.crm_lead_id = result.crm_lead_id or None
        record.payload_json = lead.model_dump_json()
        await db.commit()
    return result
