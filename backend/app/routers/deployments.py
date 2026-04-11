from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/deployments", tags=["deployments"])


@router.get("", response_model=List[schemas.DeploymentOut])
def list_deployments(db: Session = Depends(get_db)):
    return db.query(models.Deployment).order_by(models.Deployment.created_at.desc()).all()


@router.get("/{dep_id}", response_model=schemas.DeploymentOut)
def get_deployment(dep_id: int, db: Session = Depends(get_db)):
    dep = db.query(models.Deployment).filter(models.Deployment.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return dep


@router.post("", response_model=schemas.DeploymentOut, status_code=201)
def create_deployment(payload: schemas.DeploymentCreate, db: Session = Depends(get_db)):
    dep = models.Deployment(**payload.model_dump())
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


@router.patch("/{dep_id}/status")
def update_deployment_status(dep_id: int, status: str, db: Session = Depends(get_db)):
    dep = db.query(models.Deployment).filter(models.Deployment.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    dep.status = status
    if status == "running" and not dep.started_at:
        dep.started_at = datetime.utcnow()
    if status in ("completed", "failed"):
        dep.completed_at = datetime.utcnow()
        if status == "completed":
            dep.success_count = len(dep.target_assets)
            dep.fail_count = 0

    db.commit()
    return {"id": dep_id, "status": status}
