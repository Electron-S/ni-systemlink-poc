"""PMIC 개발팀 환경에 맞는 시드 데이터 — 장비/테스트/알람/배포/사용자."""
import hashlib
import os
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from . import models

# ── API Key 해시 헬퍼 ─────────────────────────────────────────────────────────

def _hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


# ── PMIC 장비 목록 ────────────────────────────────────────────────────────────

PMIC_ASSETS = [
    # PXIe 섀시
    {"name": "PXIe-1084-LAB1-01", "model": "NI PXIe-1084",  "asset_type": "Chassis",
     "serial_number": "A1B2C3D001", "ip_address": "192.168.10.101",
     "location": "PMIC Lab 1", "department": "설계1팀",
     "firmware_version": "2.4.0", "driver_version": "23.5.0", "channel_count": 14},
    {"name": "PXIe-1084-LAB2-01", "model": "NI PXIe-1084",  "asset_type": "Chassis",
     "serial_number": "A1B2C3D002", "ip_address": "192.168.10.102",
     "location": "PMIC Lab 2", "department": "검증팀",
     "firmware_version": "2.4.0", "driver_version": "23.5.0", "channel_count": 14},
    {"name": "PXIe-1082-EMC-01",  "model": "NI PXIe-1082",  "asset_type": "Chassis",
     "serial_number": "A1B2C3D003", "ip_address": "192.168.10.121",
     "location": "EMC룸", "department": "신뢰성팀",
     "firmware_version": "1.9.2", "driver_version": "23.3.0", "channel_count": 8},
    # SMU (Source Measurement Unit)
    {"name": "PXIe-4162-LAB1-01", "model": "NI PXIe-4162",  "asset_type": "SMU",
     "serial_number": "E4F5G6H001", "ip_address": "192.168.10.111",
     "location": "PMIC Lab 1", "department": "설계1팀",
     "firmware_version": "3.1.0", "driver_version": "23.5.0", "channel_count": 4},
    {"name": "PXIe-4162-LAB1-02", "model": "NI PXIe-4162",  "asset_type": "SMU",
     "serial_number": "E4F5G6H002", "ip_address": "192.168.10.112",
     "location": "PMIC Lab 1", "department": "설계2팀",
     "firmware_version": "3.1.0", "driver_version": "23.5.0", "channel_count": 4},
    {"name": "PXIe-4163-LAB2-01", "model": "NI PXIe-4163",  "asset_type": "SMU",
     "serial_number": "E4F5G6H003", "ip_address": "192.168.10.113",
     "location": "PMIC Lab 2", "department": "검증팀",
     "firmware_version": "3.0.1", "driver_version": "23.3.0", "channel_count": 8},
    # DMM (Digital Multimeter)
    {"name": "PXIe-4081-LAB1-01", "model": "NI PXIe-4081",  "asset_type": "DMM",
     "serial_number": "I7J8K9L001", "ip_address": "192.168.10.131",
     "location": "PMIC Lab 1", "department": "설계1팀",
     "firmware_version": "4.2.1", "driver_version": "23.5.0", "channel_count": 1},
    {"name": "PXIe-4081-LAB2-01", "model": "NI PXIe-4081",  "asset_type": "DMM",
     "serial_number": "I7J8K9L002", "ip_address": "192.168.10.132",
     "location": "PMIC Lab 2", "department": "검증팀",
     "firmware_version": "4.2.0", "driver_version": "23.3.0", "channel_count": 1},
    # 오실로스코프
    {"name": "PXIe-5124-LAB1-01", "model": "NI PXIe-5124",  "asset_type": "Oscilloscope",
     "serial_number": "M0N1O2P001", "ip_address": "192.168.10.141",
     "location": "PMIC Lab 1", "department": "설계1팀",
     "firmware_version": "5.0.2", "driver_version": "23.5.0", "channel_count": 2},
    {"name": "PXIe-5124-REL-01",  "model": "NI PXIe-5124",  "asset_type": "Oscilloscope",
     "serial_number": "M0N1O2P002", "ip_address": "192.168.10.142",
     "location": "신뢰성실", "department": "신뢰성팀",
     "firmware_version": "5.0.1", "driver_version": "23.3.0", "channel_count": 2},
    # 전자 부하 (Electronic Load)
    {"name": "PXIe-4051-LAB2-01", "model": "NI PXIe-4051",  "asset_type": "Electronic Load",
     "serial_number": "Q3R4S5T001", "ip_address": "192.168.10.151",
     "location": "PMIC Lab 2", "department": "검증팀",
     "firmware_version": "2.0.0", "driver_version": "23.5.0", "channel_count": 4},
    # 타이밍 모듈
    {"name": "PXIe-6674T-LAB1-01", "model": "NI PXIe-6674T", "asset_type": "Timing",
     "serial_number": "U6V7W8X001", "ip_address": "192.168.10.161",
     "location": "PMIC Lab 1", "department": "설계2팀",
     "firmware_version": "1.3.0", "driver_version": "23.5.0", "channel_count": 0},
]

STATUSES = ["online", "online", "online", "online", "online", "warning", "offline", "error"]

# ── PMIC 테스트 항목 ──────────────────────────────────────────────────────────

TEST_NAMES = [
    "출력 전압 정확도 검사",   # Output Voltage Accuracy
    "부하 레귤레이션 측정",    # Load Regulation
    "라인 레귤레이션 측정",    # Line Regulation
    "전력 변환 효율 분석",     # Conversion Efficiency
    "출력 리플 전압 측정",     # Output Ripple
    "전원 공급 노이즈 제거비", # PSRR
    "과전류 보호 검증",        # OCP
    "저전압 잠금 검증",        # UVLO
    "정착 시간 측정",          # Settling Time
    "소프트 스타트 파형 분석", # Soft-start
    "스위칭 주파수 안정성",    # Switching Frequency
    "온도 드리프트 분석",      # Temperature Drift
    "과부하 복구 시간",        # Overload Recovery
    "입출력 격리 검증",        # Isolation Test
]

OPERATORS = ["김민준", "이지연", "박성호", "최유나", "정현우", "홍길동"]

ALARM_TEMPLATES = [
    ("critical", "connection",   "{asset} 연결 끊김 — 5분간 응답 없음"),
    ("warning",  "performance",  "{asset} CPU 사용률 85% 초과"),
    ("warning",  "calibration",  "{asset} 교정 만료 7일 전 — 재교정 필요"),
    ("info",     "system",       "{asset} 펌웨어 업데이트 가능 (v{ver})"),
    ("critical", "performance",  "{asset} 온도 75°C 초과 — 즉시 점검 필요"),
    ("warning",  "connection",   "{asset} 네트워크 패킷 손실 감지"),
    ("critical", "performance",  "{asset} 출력 전압 드리프트 ±50mV 초과"),
    ("warning",  "calibration",  "{asset} SMU 교정 정확도 저하 감지"),
]

PACKAGES = [
    ("NI-SMU Driver",          "23.5.0"),
    ("NI-DMM Driver",          "23.5.0"),
    ("NI-Scope Driver",        "23.3.0"),
    ("PMIC TestStand Seq",     "3.2.1"),
    ("PMIC Calibration Suite", "2.1.0"),
]

# ── PMIC 추적성 메타데이터 풀 ─────────────────────────────────────────────────
DUT_IDS       = [f"DUT-{l}{str(n).zfill(3)}" for l in "AB" for n in range(1, 31)]
BOARD_REVS    = ["REV-A", "REV-B", "REV-C", "REV-D"]
SILICON_REVS  = ["ES1.0", "ES1.1", "ES2.0", "MP1.0"]
LOTS          = ["LOT-2024Q3-001", "LOT-2024Q4-015", "LOT-2025Q1-008", "LOT-2025Q2-022"]
CORNERS       = ["TT", "FF", "SS", "FS", "SF"]
RECIPE_VERS   = ["v1.0.2", "v1.1.0", "v1.2.3", "v2.0.0"]

# 에이전트 → 관리 자산 매핑 (장비 이름 기준)
AGENT_ASSET_MAP = {
    "pxi-lab1-agent": [
        "PXIe-1084-LAB1-01", "PXIe-4162-LAB1-01", "PXIe-4162-LAB1-02",
        "PXIe-4081-LAB1-01", "PXIe-5124-LAB1-01", "PXIe-6674T-LAB1-01",
    ],
    "pxi-lab2-agent": [
        "PXIe-1084-LAB2-01", "PXIe-4163-LAB2-01",
        "PXIe-4081-LAB2-01", "PXIe-4051-LAB2-01",
    ],
    "pxi-emc-agent": [
        "PXIe-1082-EMC-01", "PXIe-5124-REL-01",
    ],
}


def _pmic_measurements(test_name: str) -> dict:
    """테스트 항목별 PMIC 도메인 측정값 생성."""
    if "효율" in test_name:
        vin = round(random.uniform(3.5, 4.2), 3)
        vout = round(random.uniform(1.78, 1.82), 4)
        iout = round(random.uniform(100, 500), 1)
        iin = round(iout * vout / vin * random.uniform(1.05, 1.15), 1)
        eff = round(iout * vout / (iin * vin) * 100, 2)
        return {"vin_v": vin, "vout_v": vout, "iin_ma": iin, "iout_ma": iout, "efficiency_pct": eff}
    elif "리플" in test_name:
        return {"vout_v": round(random.uniform(1.79, 1.81), 4),
                "ripple_mv": round(random.uniform(2.0, 15.0), 2),
                "iout_ma": round(random.uniform(100, 300), 1)}
    elif "PSRR" in test_name or "노이즈" in test_name:
        return {"psrr_db": round(random.uniform(55, 75), 1),
                "freq_khz": round(random.uniform(100, 1000), 1),
                "vout_v": round(random.uniform(1.799, 1.801), 4)}
    elif "정착" in test_name or "소프트" in test_name:
        return {"settling_us": round(random.uniform(5, 50), 1),
                "vout_v": round(random.uniform(1.78, 1.82), 4),
                "overshoot_mv": round(random.uniform(0, 30), 1)}
    elif "전압" in test_name or "레귤레이션" in test_name:
        vin = round(random.uniform(3.6, 4.2), 3)
        vout = round(random.uniform(1.78, 1.82), 4)
        return {"vin_v": vin, "vout_v": vout,
                "iout_ma": round(random.uniform(50, 500), 1),
                "deviation_mv": round(abs(vout - 1.800) * 1000, 2)}
    else:
        return {"vin_v":  round(random.uniform(3.6, 4.2), 3),
                "vout_v": round(random.uniform(1.78, 1.82), 4),
                "iout_ma": round(random.uniform(100, 300), 1)}


def seed(db: Session):
    if db.query(models.Asset).count() > 0:
        return  # 이미 시드됨

    now = datetime.utcnow()

    # ── 사용자 & API 키 ───────────────────────────────────────────────────────
    admin_key  = os.getenv("ADMIN_API_KEY",    "sl-admin-key-2024")
    eng_key    = os.getenv("ENGINEER_API_KEY", "sl-engineer-key-2024")
    agent_key  = os.getenv("AGENT_API_KEY",    "sl-agent-pxi-key-2024")

    users_data = [
        {"username": "admin",    "full_name": "시스템 관리자", "email": "admin@pmic.local",    "role": "admin",    "key": admin_key,  "label": "Admin Key"},
        {"username": "engineer", "full_name": "검증 엔지니어", "email": "eng@pmic.local",      "role": "engineer", "key": eng_key,    "label": "Engineer Key"},
        {"username": "agent",    "full_name": "PXI Agent",     "email": "agent@pmic.local",   "role": "engineer", "key": agent_key,  "label": "Agent Key"},
    ]
    for ud in users_data:
        user = models.User(username=ud["username"], full_name=ud["full_name"],
                           email=ud["email"], role=ud["role"])
        db.add(user)
        db.flush()
        api_key = models.APIKey(key_hash=hashlib.sha256(ud["key"].encode()).hexdigest(),
                                label=ud["label"], user_id=user.id)
        db.add(api_key)

    db.flush()

    # ── 장비 ──────────────────────────────────────────────────────────────────
    assets = []
    for spec in PMIC_ASSETS:
        status = random.choice(STATUSES)
        last_seen = now - timedelta(seconds=random.randint(10, 3600)) if status != "offline" else None
        asset = models.Asset(
            **spec,
            status=status,
            last_seen=last_seen,
            tags={"env": random.choice(["production", "staging"]),
                  "project": random.choice(["PMIC-A100", "PMIC-B200", "PMIC-C300"])},
        )
        db.add(asset)
        assets.append(asset)

    db.flush()

    # ── 테스트 결과 (30일) ────────────────────────────────────────────────────
    for _ in range(250):
        asset = random.choice(assets)
        start = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
        dur = round(random.uniform(5.0, 180.0), 2)
        status = random.choices(["pass", "fail", "error"], weights=[78, 18, 4])[0]
        test_name = random.choice(TEST_NAMES)
        db.add(models.TestResult(
            asset_id=asset.id,
            test_name=test_name,
            status=status,
            duration=dur,
            started_at=start,
            completed_at=start + timedelta(seconds=dur),
            measurements=_pmic_measurements(test_name),
            operator=random.choice(OPERATORS),
            dut_id=random.choice(DUT_IDS),
            board_rev=random.choice(BOARD_REVS),
            silicon_rev=random.choice(SILICON_REVS),
            lot_id=random.choice(LOTS),
            corner=random.choice(CORNERS),
            recipe_version=random.choice(RECIPE_VERS),
        ))

    # ── 알람 ──────────────────────────────────────────────────────────────────
    for _ in range(25):
        asset = random.choice(assets)
        sev, cat, tmpl = random.choice(ALARM_TEMPLATES)
        is_active = random.random() < 0.4
        triggered = now - timedelta(hours=random.randint(1, 72))
        ack_at = (triggered + timedelta(minutes=random.randint(5, 120))) if not is_active else None
        ack_by = random.choice(OPERATORS) if not is_active else None
        db.add(models.Alarm(
            asset_id=asset.id,
            severity=sev,
            category=cat,
            message=tmpl.format(asset=asset.name, ver="2.5.0"),
            is_active=is_active,
            triggered_at=triggered,
            acknowledged_at=ack_at,
            acknowledged_by=ack_by,
        ))

    # ── 배포 ──────────────────────────────────────────────────────────────────
    asset_ids = [a.id for a in assets]
    deploy_specs = [
        ("NI-SMU 드라이버 23.5 업데이트",       *PACKAGES[0], "succeeded", 5),
        ("NI-DMM 드라이버 23.5 업데이트",        *PACKAGES[1], "succeeded", 3),
        ("PMIC TestStand 시퀀스 3.2.1 배포",      *PACKAGES[3], "running",   0),
        ("PMIC Calibration Suite 2.1.0 배포",    *PACKAGES[4], "pending",   0),
    ]
    for name, pkg, ver, status, days_ago in deploy_specs:
        targets_ids = random.sample(asset_ids, k=random.randint(3, 8))
        s_count = len(targets_ids) if status == "succeeded" else random.randint(0, len(targets_ids))
        f_count = len(targets_ids) - s_count if status == "succeeded" else 0
        started = now - timedelta(days=days_ago, hours=2) if status != "pending" else None
        completed = started + timedelta(hours=1) if status == "succeeded" else None
        dep = models.Deployment(
            name=name,
            package_name=pkg,
            package_version=ver,
            status=status,
            created_by=random.choice(OPERATORS),
            started_at=started,
            completed_at=completed,
            success_count=s_count,
            fail_count=f_count,
        )
        db.add(dep)
        db.flush()

        for aid in targets_ids:
            t_status = "succeeded" if status == "succeeded" else (
                "running" if status == "running" else "pending"
            )
            db.add(models.DeploymentTarget(
                deployment_id=dep.id,
                asset_id=aid,
                status=t_status,
            ))

    # ── 에이전트 노드 ─────────────────────────────────────────────────────────
    agent_nodes = [
        {"agent_id": "pxi-lab1-agent",  "hostname": "pxi-lab1-server",  "ip_address": "192.168.10.200",
         "version": "1.0.0", "capabilities": ["SMU", "DMM", "Oscilloscope", "Timing"]},
        {"agent_id": "pxi-lab2-agent",  "hostname": "pxi-lab2-server",  "ip_address": "192.168.10.201",
         "version": "1.0.0", "capabilities": ["SMU", "DMM", "Electronic Load"]},
        {"agent_id": "pxi-emc-agent",   "hostname": "pxi-emc-server",   "ip_address": "192.168.10.202",
         "version": "1.0.0", "capabilities": ["Chassis", "Oscilloscope"]},
    ]
    pmic_packages = [
        ("NI-SMU Driver",          "23.5.0", "/opt/ni/smu"),
        ("NI-DMM Driver",          "23.5.0", "/opt/ni/dmm"),
        ("NI-Scope Driver",        "23.3.0", "/opt/ni/scope"),
        ("PMIC TestStand Seq",     "3.2.1",  "/opt/ni/teststand"),
        ("LabVIEW Runtime",        "2023.Q3","/opt/ni/labview"),
        ("PMIC Calibration Suite", "2.1.0",  "/opt/ni/cal"),
    ]
    # 자산 이름 → ID 맵
    asset_name_map = {a.name: a.id for a in assets}

    for nd in agent_nodes:
        managed_ids = [
            asset_name_map[n]
            for n in AGENT_ASSET_MAP.get(nd["agent_id"], [])
            if n in asset_name_map
        ]
        node = models.AgentNode(
            agent_id=nd["agent_id"],
            hostname=nd["hostname"],
            ip_address=nd["ip_address"],
            version=nd["version"],
            status="online",
            last_heartbeat=now - timedelta(seconds=random.randint(5, 30)),
            capabilities=nd["capabilities"],
            managed_asset_ids=managed_ids,
        )
        db.add(node)
        db.flush()
        for pkg_name, pkg_ver, pkg_path in random.sample(pmic_packages, k=random.randint(3, 6)):
            db.add(models.AgentInventory(
                agent_id=node.id,
                package_name=pkg_name,
                version=pkg_ver,
                install_path=pkg_path,
            ))

    db.commit()
    print("[seed] PMIC 더미 데이터 삽입 완료.")
