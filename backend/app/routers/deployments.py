from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import require_engineer, write_audit

router = APIRouter(prefix="/api/deployments", tags=["deployments"])


def _enrich(dep: models.Deployment) -> schemas.DeploymentOut:
    out = schemas.DeploymentOut.model_validate(dep)
    for i, t in enumerate(out.targets):
        t.asset_name = dep.targets[i].asset.name if dep.targets[i].asset else None
    return out


@router.get("", response_model=List[schemas.DeploymentOut])
def list_deployments(db: Session = Depends(get_db)):
    deps = db.query(models.Deployment).order_by(models.Deployment.created_at.desc()).all()
    return [_enrich(d) for d in deps]


@router.get("/{dep_id}", response_model=schemas.DeploymentOut)
def get_deployment(dep_id: int, db: Session = Depends(get_db)):
    dep = db.query(models.Deployment).filter(models.Deployment.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="배포를 찾을 수 없습니다")
    return _enrich(dep)


@router.post("", response_model=schemas.DeploymentOut, status_code=201)
def create_deployment(
    payload: schemas.DeploymentCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_engineer),
):
    dep = models.Deployment(
        name=payload.name,
        package_name=payload.package_name,
        package_version=payload.package_version,
        status="pending",
        created_by=user.username,
        notes=payload.notes,
    )
    db.add(dep)
    db.flush()

    for asset_id in payload.target_asset_ids:
        db.add(models.DeploymentTarget(deployment_id=dep.id, asset_id=asset_id))

    write_audit(db, user.username, "CREATE", "Deployment", dep.id,
                {"name": dep.name, "package": dep.package_name, "version": dep.package_version})
    db.commit()
    db.refresh(dep)
    return _enrich(dep)


@router.post("/{dep_id}/queue", response_model=schemas.DeploymentOut)
def queue_deployment(
    dep_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_engineer),
):
    dep = db.query(models.Deployment).filter(models.Deployment.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="배포를 찾을 수 없습니다")
    if dep.status != "pending":
        raise HTTPException(status_code=400, detail="pending 상태인 배포만 대기열에 넣을 수 있습니다")

    dep.status = "queued"
    write_audit(db, user.username, "QUEUE", "Deployment", dep_id, {"name": dep.name})
    db.commit()
    db.refresh(dep)
    return _enrich(dep)


@router.post("/{dep_id}/cancel", response_model=schemas.DeploymentOut)
def cancel_deployment(
    dep_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_engineer),
):
    dep = db.query(models.Deployment).filter(models.Deployment.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="배포를 찾을 수 없습니다")
    if dep.status not in ("pending", "queued"):
        raise HTTPException(status_code=400, detail="pending 또는 queued 상태인 배포만 취소 가능합니다")

    dep.status = "cancelled"
    dep.completed_at = datetime.utcnow()
    write_audit(db, user.username, "CANCEL", "Deployment", dep_id, {"name": dep.name})
    db.commit()
    db.refresh(dep)
    return _enrich(dep)
