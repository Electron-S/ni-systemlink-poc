"""테스트 규격 관리 CRUD — Feature 3: Specification Manager."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_engineer

router = APIRouter(prefix="/api/specs", tags=["specs"])


@router.get("", response_model=List[schemas.TestSpecOut])
def list_specs(
    product:          Optional[str]  = Query(None),
    measurement_name: Optional[str]  = Query(None),
    corner:           Optional[str]  = Query(None),
    is_active:        bool           = Query(True),
    db: Session = Depends(get_db),
):
    q = db.query(models.TestSpec).filter(models.TestSpec.is_active == is_active)
    if product:
        q = q.filter(models.TestSpec.product == product)
    if measurement_name:
        q = q.filter(models.TestSpec.measurement_name == measurement_name)
    if corner:
        q = q.filter(models.TestSpec.corner == corner)
    return q.order_by(models.TestSpec.product, models.TestSpec.measurement_name, models.TestSpec.corner).all()


@router.get("/products")
def list_products(db: Session = Depends(get_db)):
    """활성 규격에 등록된 제품 목록."""
    rows = (
        db.query(models.TestSpec.product)
          .filter(models.TestSpec.is_active.is_(True))
          .distinct()
          .order_by(models.TestSpec.product)
          .all()
    )
    return {"products": [r[0] for r in rows]}


@router.post("", response_model=schemas.TestSpecOut, status_code=201)
def create_spec(
    payload: schemas.TestSpecCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    spec = models.TestSpec(**payload.model_dump())
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return spec


@router.patch("/{spec_id}", response_model=schemas.TestSpecOut)
def update_spec(
    spec_id: int,
    payload: schemas.TestSpecCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    spec = db.query(models.TestSpec).filter(models.TestSpec.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found")
    for k, v in payload.model_dump().items():
        setattr(spec, k, v)
    db.commit()
    db.refresh(spec)
    return spec


@router.delete("/{spec_id}", status_code=204)
def deactivate_spec(
    spec_id: int,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    """규격 비활성화 (소프트 삭제)."""
    spec = db.query(models.TestSpec).filter(models.TestSpec.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found")
    spec.is_active = False
    db.commit()
