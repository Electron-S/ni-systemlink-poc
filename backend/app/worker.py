"""배포 작업 워커 — queued 상태 배포를 순차적으로 처리합니다.
에이전트 인벤토리를 조회해 현재 버전 vs 배포 버전을 비교하고
이미 최신인 경우 skip, 아닌 경우 설치를 시뮬레이션합니다.
"""
import asyncio
import random
from datetime import datetime

from sqlalchemy.orm import Session

from . import models


def _get_managing_agent(db: Session, asset_id: int) -> models.AgentNode | None:
    """해당 자산을 관리하는 에이전트 반환."""
    for agent in db.query(models.AgentNode).filter(models.AgentNode.status == "online").all():
        if asset_id in (agent.managed_asset_ids or []):
            return agent
    return None


def _get_installed_version(db: Session, agent: models.AgentNode, package_name: str) -> str | None:
    inv = (
        db.query(models.AgentInventory)
        .filter(
            models.AgentInventory.agent_id == agent.id,
            models.AgentInventory.package_name == package_name,
        )
        .first()
    )
    return inv.version if inv else None


class DeploymentWorker:
    def __init__(self, db_factory, manager):
        self.db_factory = db_factory
        self.manager = manager

    async def run(self):
        while True:
            await asyncio.sleep(5)
            try:
                await self._process_one()
            except Exception as exc:
                print(f"[worker] 오류: {exc}")

    async def _process_one(self):
        db: Session = self.db_factory()
        try:
            dep = (
                db.query(models.Deployment)
                .filter(models.Deployment.status == "queued")
                .first()
            )
            if not dep:
                return

            dep.status = "running"
            dep.started_at = datetime.utcnow()
            db.commit()

            total = len(dep.targets)

            for target in dep.targets:
                # 취소 중간 체크
                db.refresh(dep)
                if dep.status == "cancelled":
                    for t in dep.targets:
                        if t.status == "pending":
                            t.status = "skipped"
                    db.commit()
                    return

                target.status = "running"
                target.started_at = datetime.utcnow()
                db.commit()

                await self.manager.broadcast({
                    "type": "event",
                    "event_type": "deployment_progress",
                    "data": {
                        "id": dep.id, "name": dep.name,
                        "success_count": dep.success_count,
                        "fail_count":    dep.fail_count,
                        "total":         total,
                    },
                })

                # 에이전트 인벤토리 조회
                agent = _get_managing_agent(db, target.asset_id)
                current_ver = _get_installed_version(db, agent, dep.package_name) if agent else None

                await asyncio.sleep(random.uniform(1.0, 3.5))

                if current_ver == dep.package_version:
                    # 이미 같은 버전 설치됨 → skip
                    target.status = "skipped"
                    target.completed_at = datetime.utcnow()
                    target.log = (
                        f"[SKIP] {dep.package_name} {dep.package_version} 이미 설치됨 — 건너뜁니다"
                    )
                    dep.success_count += 1
                else:
                    success = random.random() < 0.88
                    target.status = "succeeded" if success else "failed"
                    target.completed_at = datetime.utcnow()
                    if success:
                        from_ver = f"{current_ver} → " if current_ver else "(미설치) → "
                        target.log = f"[OK] {dep.package_name} {from_ver}{dep.package_version} 설치 완료"
                        dep.success_count += 1
                    else:
                        target.log = (
                            f"[FAIL] {dep.package_name} {dep.package_version} 설치 실패 — "
                            f"{'드라이버 충돌' if random.random() < 0.5 else '재부팅 타임아웃'}"
                        )
                        dep.fail_count += 1

                db.commit()

            dep.status = "succeeded" if dep.fail_count == 0 else "failed"
            dep.completed_at = datetime.utcnow()
            db.commit()

            await self.manager.broadcast({
                "type": "event",
                "event_type": "deployment_done",
                "data": {
                    "id":      dep.id,
                    "name":    dep.name,
                    "success": dep.success_count,
                    "fail":    dep.fail_count,
                },
            })

        except Exception as exc:
            db.rollback()
            print(f"[worker] 배포 처리 오류: {exc}")
        finally:
            db.close()
