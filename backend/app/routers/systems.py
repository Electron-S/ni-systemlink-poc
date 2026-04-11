from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/systems", tags=["systems"])


@router.get("/overview", response_model=schemas.SystemOverview)
def overview(db: Session = Depends(get_db)):
    assets = db.query(models.Asset).all()
    status_counts = {"online": 0, "offline": 0, "warning": 0, "error": 0}
    for a in assets:
        status_counts[a.status] = status_counts.get(a.status, 0) + 1

    active_alarms = db.query(models.Alarm).filter(models.Alarm.is_active == True).count()
    critical_alarms = db.query(models.Alarm).filter(
        models.Alarm.is_active == True, models.Alarm.severity == "critical"
    ).count()

    # queued + running 배포를 "진행 중"으로 표시
    running_deps = db.query(models.Deployment).filter(
        models.Deployment.status.in_(["queued", "running"])
    ).count()

    since = datetime.utcnow() - timedelta(days=1)
    q_today = db.query(models.TestResult).filter(models.TestResult.started_at >= since)
    total_today = q_today.count()
    pass_today = q_today.filter(models.TestResult.status == "pass").count()

    return schemas.SystemOverview(
        total_assets=len(assets),
        online=status_counts["online"],
        offline=status_counts["offline"],
        warning=status_counts["warning"],
        error=status_counts["error"],
        active_alarms=active_alarms,
        critical_alarms=critical_alarms,
        deployments_running=running_deps,
        test_pass_rate=round(pass_today / total_today * 100, 1) if total_today else 0,
        total_tests_today=total_today,
    )
