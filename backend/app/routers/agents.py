"""에이전트 관련 API — heartbeat / inventory / 목록 조회."""
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=List[schemas.AgentOut])
def list_agents(db: Session = Depends(get_db)):
    return db.query(models.AgentNode).order_by(models.AgentNode.last_heartbeat.desc()).all()


@router.get("/{agent_id}", response_model=schemas.AgentOut)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    node = db.query(models.AgentNode).filter(models.AgentNode.agent_id == agent_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="에이전트를 찾을 수 없습니다")
    return node


@router.post("/{agent_id}/heartbeat", response_model=schemas.AgentOut)
def heartbeat(
    agent_id: str,
    payload: schemas.HeartbeatPayload,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    node = db.query(models.AgentNode).filter(models.AgentNode.agent_id == agent_id).first()
    if not node:
        node = models.AgentNode(agent_id=agent_id)
        db.add(node)

    node.hostname       = payload.hostname
    node.version        = payload.version
    node.ip_address     = payload.ip_address
    node.capabilities   = payload.capabilities
    node.status         = "online"
    node.last_heartbeat = datetime.utcnow()
    db.commit()
    db.refresh(node)
    return node


@router.post("/{agent_id}/inventory")
def update_inventory(
    agent_id: str,
    payload: schemas.InventoryPayload,
    db: Session = Depends(get_db),
    _user: models.User = Depends(get_current_user),
):
    node = db.query(models.AgentNode).filter(models.AgentNode.agent_id == agent_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="에이전트를 찾을 수 없습니다")

    # 기존 인벤토리 삭제 후 재등록
    db.query(models.AgentInventory).filter(models.AgentInventory.agent_id == node.id).delete()
    for item in payload.packages:
        db.add(models.AgentInventory(
            agent_id=node.id,
            package_name=item.package_name,
            version=item.version,
            install_path=item.install_path,
        ))
    db.commit()
    return {"agent_id": agent_id, "package_count": len(payload.packages)}
