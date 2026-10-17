import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from packages.shared.models import GscSearchMetric
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from packages.shared.database import get_db
from packages.contracts.experiment import ExperimentCreateRequest, ExperimentEvaluationResponse
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.experiments.experiment_engine import ExperimentEngine

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/experiments", tags=["Experiments & Learning"])

@router.post("", response_model=ExperimentEvaluationResponse, status_code=status.HTTP_201_CREATED)
async def create_and_evaluate_experiment(
    org_id: str,
    site_id: str,
    req: ExperimentCreateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    variant = set(req.variant_pages)
    control = set(req.control_pages)
    if variant & control:
        raise HTTPException(status_code=400, detail="Varyant ve kontrol grupları aynı URL'yi içeremez")
    today = datetime.now(timezone.utc).date()
    change = req.change_date or today - timedelta(days=req.window_days)
    start = change - timedelta(days=req.window_days)
    end = change + timedelta(days=req.window_days - 1)
    if end >= today:
        raise HTTPException(status_code=400, detail="Her iki ölçüm penceresi de tamamlanmış olmalıdır")
    rows = (await db.execute(select(GscSearchMetric.page,GscSearchMetric.metric_date,func.sum(GscSearchMetric.clicks)).where(
        GscSearchMetric.site_id==site_id,GscSearchMetric.page.in_(variant|control),GscSearchMetric.metric_date>=start,GscSearchMetric.metric_date<=end,
    ).group_by(GscSearchMetric.page,GscSearchMetric.metric_date))).all()
    totals = [0.0]*4
    counts = [0]*4
    for page,day,clicks in rows:
        index = (0 if page in variant else 2) + (1 if day >= change else 0)
        totals[index] += clicks
        counts[index] += 1
    if not all(counts):
        raise HTTPException(status_code=409, detail="Her iki grubun önce ve sonra pencereleri için Search Console verisi gerekir. Bağlantıyı eşitleyin ve ölçüm tamamlandığında tekrar deneyin.")
    v_before,v_after = totals[0]/len(variant),totals[1]/len(variant)
    c_before,c_after = totals[2]/len(control),totals[3]/len(control)
    if v_before <= 0 or c_before <= 0:
        raise HTTPException(status_code=409, detail="Yüzde değişim için her iki grubun önceki dönemde pozitif tıklama sayısı olmalıdır.")
    res = ExperimentEngine.calculate_diff_in_diff(str(uuid.uuid4()),v_before,v_after,c_before,c_after)
    return ExperimentEvaluationResponse(
        experiment_name=req.name,
        diff_in_diff_lift=res.diff_in_diff_net_clicks,
        variant_relative_lift_percent=round(res.net_relative_lift*100,2),
        variant_growth_percent=round(res.variant_growth*100,2),
        control_growth_percent=round(res.control_growth*100,2),
        is_statistically_significant=False,
        conclusion=f"{start}–{end} Search Console verisiyle sayfa başına karşılaştırma hesaplandı. Bu fark istatistiksel anlamlılık veya nedensellik kanıtı değildir; eksik günler ve grup seçimi sonucu etkileyebilir.",
    )
