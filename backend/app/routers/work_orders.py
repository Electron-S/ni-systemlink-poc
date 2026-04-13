"""작업 지시 CRUD — Feature 1: Work Order + 테스트 스케줄링."""
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_engineer

router = APIRouter(prefix="/api/work-orders", tags=["work_orders"])


@router.get("", response_model=List[schemas.WorkOrderOut])
def list_work_orders(
    status:   Optional[str] = Query(None),
    asset_id: Optional[int] = Query(None),
    days:     int            = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(models.WorkOrder).filter(models.WorkOrder.scheduled_start >= since)
    if status:
        q = q.filter(models.WorkOrder.status == status)
    if asset_id:
        q = q.filter(models.WorkOrder.asset_id == asset_id)
    orders = q.order_by(models.WorkOrder.scheduled_start.asc()).all()
    out = []
    for o in orders:
        item = schemas.WorkOrderOut.model_validate(o)
        item.asset_name = o.asset.name if o.asset else None
        out.append(item)
    return out


@router.post("", response_model=schemas.WorkOrderOut, status_code=201)
def create_work_order(
    payload: schemas.WorkOrderCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    order = models.WorkOrder(**payload.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    out = schemas.WorkOrderOut.model_validate(order)
    out.asset_name = order.asset.name if order.asset else None
    return out


@router.patch("/{order_id}", response_model=schemas.WorkOrderOut)
def update_work_order(
    order_id: int,
    payload:  schemas.WorkOrderUpdate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    order = db.query(models.WorkOrder).filter(models.WorkOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Work order not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(order, k, v)
    db.commit()
    db.refresh(order)
    out = schemas.WorkOrderOut.model_validate(order)
    out.asset_name = order.asset.name if order.asset else None
    return out


@router.delete("/{order_id}", status_code=204)
def delete_work_order(
    order_id: int,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    order = db.query(models.WorkOrder).filter(models.WorkOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Work order not found")
    db.delete(order)
    db.commit()
