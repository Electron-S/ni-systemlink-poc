from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, schemas
from ..database import get_db
from ..auth import require_engineer

router = APIRouter(prefix="/api/test-results", tags=["test_results"])


@router.get("", response_model=List[schemas.TestResultOut])
def list_results(
    asset_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(models.TestResult).filter(models.TestResult.started_at >= since)
    if asset_id:
        q = q.filter(models.TestResult.asset_id == asset_id)
    if status:
        q = q.filter(models.TestResult.status == status)

    results = q.order_by(models.TestResult.started_at.desc()).limit(limit).all()
    out = []
    for r in results:
        item = schemas.TestResultOut.model_validate(r)
        item.asset_name = r.asset.name if r.asset else None
        out.append(item)
    return out


@router.post("", response_model=schemas.TestResultOut, status_code=201)
def create_result(
    payload: schemas.TestResultCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    result = models.TestResult(**payload.model_dump())
    db.add(result)
    db.commit()
    db.refresh(result)
    out = schemas.TestResultOut.model_validate(result)
    out.asset_name = result.asset.name if result.asset else None
    return out


@router.get("/stats")
def get_stats(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(models.TestResult).filter(models.TestResult.started_at >= since)
    total = q.count()
    passed = q.filter(models.TestResult.status == "pass").count()
    failed = q.filter(models.TestResult.status == "fail").count()
    errors = q.filter(models.TestResult.status == "error").count()
    avg_dur = db.query(func.avg(models.TestResult.duration)).filter(
        models.TestResult.started_at >= since
    ).scalar() or 0

    # Daily pass-rate trend
    trend = []
    for d in range(days - 1, -1, -1):
        day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=d)
        day_end = day_start + timedelta(days=1)
        day_q = db.query(models.TestResult).filter(
            models.TestResult.started_at >= day_start,
            models.TestResult.started_at < day_end,
        )
        day_total = day_q.count()
        day_pass = day_q.filter(models.TestResult.status == "pass").count()
        trend.append({
            "date": day_start.strftime("%m/%d"),
            "total": day_total,
            "pass": day_pass,
            "pass_rate": round(day_pass / day_total * 100, 1) if day_total else 0,
        })

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "pass_rate": round(passed / total * 100, 1) if total else 0,
        "avg_duration_s": round(avg_dur, 2),
        "trend": trend,
    }
