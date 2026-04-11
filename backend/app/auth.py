"""간단한 API Key 인증 — X-API-Key 헤더로 동작."""
import hashlib
from datetime import datetime

from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from .database import get_db
from . import models


def _hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def get_current_user(
    x_api_key: str = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> models.User:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key 헤더가 필요합니다")

    key_hash = _hash(x_api_key)
    api_key = (
        db.query(models.APIKey)
        .filter(models.APIKey.key_hash == key_hash, models.APIKey.is_active == True)
        .first()
    )

    if not api_key:
        raise HTTPException(status_code=401, detail="유효하지 않거나 비활성화된 API 키입니다")

    api_key.last_used_at = datetime.utcnow()
    db.commit()

    return api_key.user


def require_engineer(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role not in ("engineer", "admin"):
        raise HTTPException(status_code=403, detail="Engineer 또는 Admin 권한이 필요합니다")
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin 권한이 필요합니다")
    return user


def write_audit(
    db: Session,
    user_identifier: str,
    action: str,
    resource_type: str,
    resource_id: int | None = None,
    detail: dict | None = None,
) -> None:
    """감사 로그 기록."""
    log = models.AuditLog(
        user_identifier=user_identifier,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        detail=detail or {},
    )
    db.add(log)
