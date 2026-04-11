"""감사 로그 조회 API."""
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/audit-logs", tags=["audit_logs"])


@router.get("", response_model=List[schemas.AuditLogOut])
def list_audit_logs(
    resource_type: str = Query(None),
    limit: int = Query(100, le=500),
    skip: int = Query(0),
    db: Session = Depends(get_db),
):
    q = db.query(models.AuditLog)
    if resource_type:
        q = q.filter(models.AuditLog.resource_type == resource_type)
    return q.order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
