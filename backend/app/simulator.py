"""
백그라운드 시뮬레이션 엔진
8초마다 실행되며 현실감 있는 장비 상태 변화 / 테스트 실행 / 알람 발생 / 배포 진행을 생성합니다.
"""
import asyncio
import random
from datetime import datetime
from sqlalchemy.orm import Session
from . import models

OPERATORS = ["김민준", "이지연", "박성호", "최유나", "정현우"]

TEST_NAMES = [
    "전압 정확도 검사", "전류 측정 테스트", "주파수 응답 테스트",
    "노이즈 플로어 분석", "신호 대 잡음비 측정", "채널 크로스토크 테스트",
    "교정 검증", "온도 계수 테스트", "선형성 테스트",
    "안정화 시간 테스트", "대역폭 테스트", "임피던스 측정",
]

ALARM_TEMPLATES = {
    "warning": [
        "{name} CPU 사용률이 임계치(85%)를 초과했습니다",
        "{name} 온도가 70°C에 근접합니다",
        "{name} 네트워크 패킷 손실이 감지됐습니다",
        "{name} 교정 만료가 7일 남았습니다",
        "{name} 메모리 사용률이 80%를 초과했습니다",
    ],
    "critical": [
        "{name} 연결이 끊겼습니다 — 5분간 응답 없음",
        "{name} 온도가 75°C를 초과했습니다",
        "{name} 전원 공급 이상이 감지됐습니다",
        "{name} 하드웨어 오류가 감지됐습니다",
    ],
}


class SimulationEngine:
    def __init__(self, db_factory, manager):
        self.db_factory = db_factory
        self.manager = manager

    async def run(self):
        while True:
            await asyncio.sleep(8)
            db: Session = self.db_factory()
            try:
                events = self._tick(db)
                db.commit()
                for event in events:
                    await self.manager.broadcast({"type": "event", **event})
            except Exception as exc:
                db.rollback()
                print(f"[simulator] 오류: {exc}")
            finally:
                db.close()

    def _tick(self, db: Session) -> list:
        events = []
        assets = db.query(models.Asset).all()

        online  = [a for a in assets if a.status == "online"]
        warning = [a for a in assets if a.status == "warning"]
        error   = [a for a in assets if a.status == "error"]
        offline = [a for a in assets if a.status == "offline"]

        # 1. 온라인 장비에서 테스트 실행 (40% 확률)
        if online and random.random() < 0.40:
            asset = random.choice(online)
            events.append(self._run_test(db, asset))

        # 2. 온라인 → 경고 (장비당 3% 확률)
        for asset in online:
            if random.random() < 0.03:
                asset.status = "warning"
                asset.last_seen = datetime.utcnow()
                events.append({"event_type": "asset_status", "data": {
                    "id": asset.id, "name": asset.name,
                    "old_status": "online", "new_status": "warning",
                }})
                events.append(self._trigger_alarm(db, asset, "warning"))

        # 3. 경고 → 온라인 복구 (25% 확률)
        for asset in warning:
            if random.random() < 0.25:
                asset.status = "online"
                asset.last_seen = datetime.utcnow()
                events.append({"event_type": "asset_status", "data": {
                    "id": asset.id, "name": asset.name,
                    "old_status": "warning", "new_status": "online",
                }})

        # 4. 경고 → 오류 (5% 확률)
        for asset in list(warning):
            if asset.status == "warning" and random.random() < 0.05:
                asset.status = "error"
                events.append({"event_type": "asset_status", "data": {
                    "id": asset.id, "name": asset.name,
                    "old_status": "warning", "new_status": "error",
                }})
                events.append(self._trigger_alarm(db, asset, "critical"))

        # 5. 오류 → 오프라인 (20% 확률)
        for asset in error:
            if random.random() < 0.20:
                asset.status = "offline"
                events.append({"event_type": "asset_status", "data": {
                    "id": asset.id, "name": asset.name,
                    "old_status": "error", "new_status": "offline",
                }})

        # 6. 오프라인 → 온라인 복구 (15% 확률)
        for asset in offline:
            if random.random() < 0.15:
                asset.status = "online"
                asset.last_seen = datetime.utcnow()
                events.append({"event_type": "asset_status", "data": {
                    "id": asset.id, "name": asset.name,
                    "old_status": "offline", "new_status": "online",
                }})

        # 7. 배포 진행
        events.extend(self._progress_deployments(db))

        return events

    def _run_test(self, db: Session, asset: models.Asset) -> dict:
        now      = datetime.utcnow()
        duration = round(random.uniform(3.0, 90.0), 2)
        status   = random.choices(["pass", "fail", "error"], weights=[78, 18, 4])[0]
        test_name = random.choice(TEST_NAMES)

        result = models.TestResult(
            asset_id=asset.id,
            test_name=test_name,
            status=status,
            duration=duration,
            started_at=now,
            completed_at=now,
            measurements={
                "voltage_v":    round(random.uniform(4.85, 5.15), 4),
                "current_ma":   round(random.uniform(95, 105), 3),
                "frequency_hz": round(random.uniform(990, 1010), 2),
            },
            operator=random.choice(OPERATORS),
        )
        db.add(result)
        db.flush()

        return {
            "event_type": "test_completed",
            "data": {
                "id":         result.id,
                "asset_name": asset.name,
                "test_name":  test_name,
                "status":     status,
                "duration":   duration,
            },
        }

    def _trigger_alarm(self, db: Session, asset: models.Asset, severity: str) -> dict:
        templates = ALARM_TEMPLATES.get(severity, ALARM_TEMPLATES["warning"])
        msg = random.choice(templates).format(name=asset.name)
        cat = "performance" if severity == "warning" else "connection"

        alarm = models.Alarm(
            asset_id=asset.id,
            severity=severity,
            category=cat,
            message=msg,
            is_active=True,
            triggered_at=datetime.utcnow(),
        )
        db.add(alarm)
        db.flush()

        return {
            "event_type": "alarm_triggered",
            "data": {
                "id":         alarm.id,
                "asset_name": asset.name,
                "severity":   severity,
                "message":    msg,
            },
        }

    def _progress_deployments(self, db: Session) -> list:
        events = []
        running = db.query(models.Deployment).filter(
            models.Deployment.status == "running"
        ).all()

        for dep in running:
            total = len(dep.target_assets)
            done  = dep.success_count + dep.fail_count
            if done >= total:
                dep.status = "completed"
                dep.completed_at = datetime.utcnow()
                events.append({
                    "event_type": "deployment_done",
                    "data": {"id": dep.id, "name": dep.name,
                             "success": dep.success_count, "fail": dep.fail_count},
                })
            else:
                dep.success_count += 1
                events.append({
                    "event_type": "deployment_progress",
                    "data": {"id": dep.id, "name": dep.name,
                             "success_count": dep.success_count,
                             "fail_count": dep.fail_count, "total": total},
                })

        return events
