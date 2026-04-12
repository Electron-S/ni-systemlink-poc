import random
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_engineer

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("", response_model=List[schemas.AssetOut])
def list_assets(
    status: Optional[str] = Query(None),
    asset_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Asset)
    if status:
        q = q.filter(models.Asset.status == status)
    if asset_type:
        q = q.filter(models.Asset.asset_type == asset_type)
    return q.order_by(models.Asset.name).all()


@router.get("/{asset_id}", response_model=schemas.AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.get("/{asset_id}/metrics")
def get_asset_metrics(asset_id: int, db: Session = Depends(get_db)):
    """Return a snapshot of simulated real-time metrics for one asset."""
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _generate_metrics(asset_id)


@router.patch("/{asset_id}/status")
def update_status(asset_id: int, status: str, db: Session = Depends(get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.status = status
    db.commit()
    return {"id": asset_id, "status": status}


@router.get("/{asset_id}/calibration-history", response_model=List[schemas.CalibrationEventOut])
def get_calibration_history(asset_id: int, db: Session = Depends(get_db)):
    """장비 교정 수행 이력 목록 (최신순)."""
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return (
        db.query(models.CalibrationEvent)
          .filter(models.CalibrationEvent.asset_id == asset_id)
          .order_by(models.CalibrationEvent.performed_at.desc())
          .all()
    )


@router.post("/{asset_id}/calibration-events", response_model=schemas.CalibrationEventOut, status_code=201)
def create_calibration_event(
    asset_id: int,
    payload: schemas.CalibrationEventCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    """교정 수행 결과 등록 — next_due_date 제공 시 장비 만료일도 갱신."""
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    event = models.CalibrationEvent(asset_id=asset_id, **payload.model_dump())
    db.add(event)
    if payload.next_due_date:
        asset.calibration_due_date = payload.next_due_date
    db.commit()
    db.refresh(event)
    return event


def _generate_metrics(asset_id: int) -> dict:
    rng = random.Random(asset_id)  # deterministic seed per asset, varies over time
    import time
    t = int(time.time())
    rng2 = random.Random(asset_id + t // 2)
    return {
        "asset_id": asset_id,
        "temperature_c": round(rng2.uniform(35, 72), 1),
        "cpu_pct":       round(rng2.uniform(5, 95), 1),
        "memory_pct":    round(rng2.uniform(20, 80), 1),
        "voltage_v":     round(rng2.uniform(4.95, 5.05), 3),
        "channels_active": rng2.randint(0, 8),
    }
