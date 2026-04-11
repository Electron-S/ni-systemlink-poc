from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/alarms", tags=["alarms"])


@router.get("", response_model=List[schemas.AlarmOut])
def list_alarms(
    active_only: bool = Query(False),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Alarm)
    if active_only:
        q = q.filter(models.Alarm.is_active == True)
    if severity:
        q = q.filter(models.Alarm.severity == severity)

    results = q.order_by(models.Alarm.triggered_at.desc()).all()
    out = []
    for a in results:
        item = schemas.AlarmOut.model_validate(a)
        item.asset_name = a.asset.name if a.asset else None
        out.append(item)
    return out


@router.patch("/{alarm_id}/acknowledge")
def acknowledge_alarm(alarm_id: int, acknowledged_by: str, db: Session = Depends(get_db)):
    alarm = db.query(models.Alarm).filter(models.Alarm.id == alarm_id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    alarm.is_active = False
    alarm.acknowledged_at = datetime.utcnow()
    alarm.acknowledged_by = acknowledged_by
    db.commit()
    return {"id": alarm_id, "acknowledged": True}
