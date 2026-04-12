"""
백그라운드 시뮬레이션 엔진 — PMIC 도메인
8초마다 실행: 장비 상태 변화 / PMIC 테스트 실행 / 알람 발생
"""
import asyncio
import random
from datetime import datetime
from sqlalchemy.orm import Session
from . import models
from .test_generators import (
    _pmic_measurements, _generate_steps,
    _generate_measurement_details, _generate_waveform,
)

OPERATORS    = ["김민준", "이지연", "박성호", "최유나", "정현우", "홍길동"]
DUT_IDS      = [f"DUT-{l}{str(n).zfill(3)}" for l in "AB" for n in range(1, 31)]
BOARD_REVS   = ["REV-A", "REV-B", "REV-C", "REV-D"]
SILICON_REVS = ["ES1.0", "ES1.1", "ES2.0", "MP1.0"]
LOTS         = ["LOT-2024Q3-001", "LOT-2024Q4-015", "LOT-2025Q1-008", "LOT-2025Q2-022"]
CORNERS      = ["TT", "FF", "SS", "FS", "SF"]
RECIPE_VERS  = ["v1.0.2", "v1.1.0", "v1.2.3", "v2.0.0"]

TEST_NAMES = [
    "출력 전압 정확도 검사",
    "부하 레귤레이션 측정",
    "라인 레귤레이션 측정",
    "전력 변환 효율 분석",
    "출력 리플 전압 측정",
    "전원 공급 노이즈 제거비",
    "과전류 보호 검증",
    "저전압 잠금 검증",
    "정착 시간 측정",
    "소프트 스타트 파형 분석",
    "스위칭 주파수 안정성",
    "온도 드리프트 분석",
]

ALARM_TEMPLATES = {
    "warning": [
        "{name} CPU 사용률이 85%를 초과했습니다",
        "{name} 온도가 70°C에 근접합니다",
        "{name} 네트워크 패킷 손실이 감지됐습니다",
        "{name} 교정 만료가 7일 남았습니다",
        "{name} 출력 전압 드리프트 ±30mV 감지",
        "{name} SMU 교정 정확도 저하 감지",
    ],
    "critical": [
        "{name} 연결이 끊겼습니다 — 5분간 응답 없음",
        "{name} 온도가 75°C를 초과했습니다",
        "{name} 출력 전압 드리프트 ±50mV 초과 — 즉시 점검 필요",
        "{name} 전원 공급 이상이 감지됐습니다",
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

        # 1. 온라인 장비에서 PMIC 테스트 실행 (40% 확률)
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

        return events

    def _run_test(self, db: Session, asset: models.Asset) -> dict:
        now       = datetime.utcnow()
        duration  = round(random.uniform(5.0, 180.0), 2)
        status    = random.choices(["pass", "fail", "error"], weights=[78, 18, 4])[0]
        test_name = random.choice(TEST_NAMES)
        meas      = _pmic_measurements(test_name)

        result = models.TestResult(
            asset_id=asset.id,
            test_name=test_name,
            status=status,
            duration=duration,
            started_at=now,
            completed_at=now,
            measurements=meas,
            operator=random.choice(OPERATORS),
            dut_id=random.choice(DUT_IDS),
            board_rev=random.choice(BOARD_REVS),
            silicon_rev=random.choice(SILICON_REVS),
            lot_id=random.choice(LOTS),
            corner=random.choice(CORNERS),
            recipe_version=random.choice(RECIPE_VERS),
            steps=_generate_steps(test_name, status, duration),
            measurement_details=_generate_measurement_details(test_name, status, meas),
            waveform_data=_generate_waveform(test_name, status, meas),
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
