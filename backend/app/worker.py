"""배포 작업 워커 — queued 상태 배포를 순차적으로 처리합니다."""
import asyncio
import random
from datetime import datetime

from sqlalchemy.orm import Session

from . import models


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
                # cancelled 중간 체크
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
                        "id": dep.id,
                        "name": dep.name,
                        "success_count": dep.success_count,
                        "fail_count": dep.fail_count,
                        "total": total,
                    },
                })

                # 설치 시뮬레이션 (1~4초)
                await asyncio.sleep(random.uniform(1.0, 4.0))

                success = random.random() < 0.88   # 88% 성공률
                target.status = "succeeded" if success else "failed"
                target.completed_at = datetime.utcnow()
                target.log = (
                    f"[OK] {dep.package_name} {dep.package_version} 설치 완료"
                    if success else
                    f"[FAIL] {dep.package_name} 설치 실패 — 드라이버 충돌"
                )
                if success:
                    dep.success_count += 1
                else:
                    dep.fail_count += 1
                db.commit()

            dep.status = "succeeded" if dep.fail_count == 0 else "failed"
            dep.completed_at = datetime.utcnow()
            db.commit()

            await self.manager.broadcast({
                "type": "event",
                "event_type": "deployment_done",
                "data": {
                    "id": dep.id,
                    "name": dep.name,
                    "success": dep.success_count,
                    "fail": dep.fail_count,
                },
            })

        except Exception as exc:
            db.rollback()
            print(f"[worker] 배포 처리 오류: {exc}")
        finally:
            db.close()
