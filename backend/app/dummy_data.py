"""Seed the database with realistic NI hardware dummy data."""
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from . import models


NI_ASSETS = [
    {"name": "cDAQ-9174-LAB01", "model": "NI cDAQ-9174",  "asset_type": "Chassis",      "serial_number": "1A2B3C01", "ip_address": "192.168.1.101", "location": "Lab 1", "department": "R&D",        "firmware_version": "2.3.1", "driver_version": "23.3.0", "channel_count": 32},
    {"name": "cDAQ-9174-LAB02", "model": "NI cDAQ-9174",  "asset_type": "Chassis",      "serial_number": "1A2B3C02", "ip_address": "192.168.1.102", "location": "Lab 1", "department": "R&D",        "firmware_version": "2.3.1", "driver_version": "23.3.0", "channel_count": 32},
    {"name": "PXIe-1082-FAC01", "model": "NI PXIe-1082",  "asset_type": "Chassis",      "serial_number": "2D4E5F01", "ip_address": "192.168.1.111", "location": "Factory A", "department": "QA",      "firmware_version": "1.9.0", "driver_version": "23.3.0", "channel_count": 8},
    {"name": "PXIe-1082-FAC02", "model": "NI PXIe-1082",  "asset_type": "Chassis",      "serial_number": "2D4E5F02", "ip_address": "192.168.1.112", "location": "Factory B", "department": "QA",      "firmware_version": "1.9.0", "driver_version": "23.1.0", "channel_count": 8},
    {"name": "USB-6001-WS01",   "model": "NI USB-6001",   "asset_type": "DAQ",          "serial_number": "3G6H7I01", "ip_address": None,            "location": "Lab 2", "department": "Test",       "firmware_version": "1.0.0", "driver_version": "23.3.0", "channel_count": 8},
    {"name": "USB-6001-WS02",   "model": "NI USB-6001",   "asset_type": "DAQ",          "serial_number": "3G6H7I02", "ip_address": None,            "location": "Lab 2", "department": "Test",       "firmware_version": "1.0.0", "driver_version": "23.0.0", "channel_count": 8},
    {"name": "PXIe-4081-QA01",  "model": "NI PXIe-4081",  "asset_type": "DMM",          "serial_number": "4J8K9L01", "ip_address": "192.168.1.121", "location": "Factory A", "department": "QA",      "firmware_version": "3.1.2", "driver_version": "23.3.0", "channel_count": 1},
    {"name": "PXIe-5122-RD01",  "model": "NI PXIe-5122",  "asset_type": "Oscilloscope", "serial_number": "5M0N1O01", "ip_address": "192.168.1.131", "location": "Lab 1", "department": "R&D",        "firmware_version": "4.0.1", "driver_version": "23.3.0", "channel_count": 2},
    {"name": "SMU-4141-RD01",   "model": "NI SMU-4141",   "asset_type": "SMU",          "serial_number": "6P2Q3R01", "ip_address": "192.168.1.141", "location": "Lab 3", "department": "R&D",        "firmware_version": "2.0.0", "driver_version": "23.2.0", "channel_count": 4},
    {"name": "cRIO-9068-FAC01", "model": "NI cRIO-9068",  "asset_type": "Controller",   "serial_number": "7S4T5U01", "ip_address": "192.168.1.151", "location": "Factory A", "department": "Automation","firmware_version": "8.6.0", "driver_version": "23.3.0", "channel_count": 8},
    {"name": "cRIO-9068-FAC02", "model": "NI cRIO-9068",  "asset_type": "Controller",   "serial_number": "7S4T5U02", "ip_address": "192.168.1.152", "location": "Factory B", "department": "Automation","firmware_version": "8.5.0", "driver_version": "23.1.0", "channel_count": 8},
    {"name": "GPIB-USB-HS-01",  "model": "NI GPIB-USB-HS","asset_type": "GPIB",         "serial_number": "8V6W7X01", "ip_address": None,            "location": "Lab 2", "department": "Test",       "firmware_version": "1.5.2", "driver_version": "23.3.0", "channel_count": 0},
]

STATUSES = ["online", "online", "online", "online", "online", "warning", "offline", "error"]

TEST_NAMES = [
    "Voltage Accuracy Check", "Current Measurement Test", "Frequency Response Test",
    "Noise Floor Analysis", "Signal-to-Noise Ratio", "Channel Crosstalk Test",
    "Calibration Verification", "Temperature Coefficient Test", "Linearity Test",
    "Settling Time Test", "Bandwidth Test", "Impedance Measurement",
]

OPERATORS = ["Kim Minjun", "Lee Jiyeon", "Park Sungho", "Choi Yuna", "Jung Hyunwoo"]

ALARM_TEMPLATES = [
    ("critical", "connection",   "{asset} connection lost — no heartbeat for 5 minutes"),
    ("warning",  "performance",  "{asset} CPU usage exceeded 85% threshold"),
    ("warning",  "calibration",  "{asset} calibration due in 7 days"),
    ("info",     "system",       "{asset} firmware update available (v{ver})"),
    ("critical", "performance",  "{asset} temperature exceeded 75°C"),
    ("warning",  "connection",   "{asset} packet loss detected on network interface"),
]

PACKAGES = [
    ("NI-DAQmx",        "23.3.0"),
    ("NI-VISA",         "23.3.0"),
    ("LabVIEW Runtime", "2023 Q3"),
    ("TestStand",       "2023.Q3"),
    ("NI-488.2",        "23.0.0"),
]


def seed(db: Session):
    if db.query(models.Asset).count() > 0:
        return  # already seeded

    now = datetime.utcnow()
    assets = []

    for spec in NI_ASSETS:
        status = random.choice(STATUSES)
        last_seen = now - timedelta(seconds=random.randint(10, 3600)) if status != "offline" else None
        asset = models.Asset(
            **spec,
            status=status,
            last_seen=last_seen,
            tags={"environment": random.choice(["production", "staging", "development"])},
        )
        db.add(asset)
        assets.append(asset)

    db.flush()  # populate IDs

    # ── Test results (last 30 days) ──────────────────────────────────────────
    for _ in range(150):
        asset = random.choice(assets)
        start = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
        dur = random.uniform(2.0, 120.0)
        status = random.choices(["pass", "fail", "error"], weights=[75, 20, 5])[0]
        db.add(models.TestResult(
            asset_id=asset.id,
            test_name=random.choice(TEST_NAMES),
            status=status,
            duration=round(dur, 2),
            started_at=start,
            completed_at=start + timedelta(seconds=dur),
            measurements={
                "voltage_v": round(random.uniform(4.9, 5.1), 4),
                "current_ma": round(random.uniform(99, 101), 3),
                "frequency_hz": round(random.uniform(999, 1001), 2),
            },
            operator=random.choice(OPERATORS),
        ))

    # ── Alarms ────────────────────────────────────────────────────────────────
    for i in range(20):
        asset = random.choice(assets)
        sev, cat, tmpl = random.choice(ALARM_TEMPLATES)
        is_active = random.random() < 0.4
        triggered = now - timedelta(hours=random.randint(1, 72))
        ack_at = None
        ack_by = None
        if not is_active:
            ack_at = triggered + timedelta(minutes=random.randint(5, 120))
            ack_by = random.choice(OPERATORS)
        db.add(models.Alarm(
            asset_id=asset.id,
            severity=sev,
            category=cat,
            message=tmpl.format(asset=asset.name, ver="2.4.0"),
            is_active=is_active,
            triggered_at=triggered,
            acknowledged_at=ack_at,
            acknowledged_by=ack_by,
        ))

    # ── Deployments ───────────────────────────────────────────────────────────
    asset_ids = [a.id for a in assets]
    deploy_specs = [
        ("NI-DAQmx 23.3 Rollout",   *PACKAGES[0], "completed", 5),
        ("NI-VISA Update",          *PACKAGES[1], "completed", 3),
        ("LabVIEW RT Upgrade",      *PACKAGES[2], "running",   0),
        ("TestStand Deploy QA",     *PACKAGES[3], "pending",   0),
    ]
    for name, pkg, ver, status, days_ago in deploy_specs:
        targets = random.sample(asset_ids, k=random.randint(3, 8))
        s_count = len(targets) if status == "completed" else random.randint(0, len(targets))
        f_count = len(targets) - s_count if status == "completed" else 0
        started = now - timedelta(days=days_ago, hours=2) if status != "pending" else None
        completed = started + timedelta(hours=1) if status == "completed" else None
        db.add(models.Deployment(
            name=name,
            package_name=pkg,
            package_version=ver,
            target_assets=targets,
            status=status,
            created_by=random.choice(OPERATORS),
            started_at=started,
            completed_at=completed,
            success_count=s_count,
            fail_count=f_count,
        ))

    db.commit()
    print("[seed] Dummy data inserted successfully.")
