from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    full_name = Column(String(128))
    email = Column(String(256), unique=True)
    role = Column(String(32), default="viewer")   # admin / engineer / viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key_hash = Column(String(64), unique=True, index=True, nullable=False)  # SHA-256 hex
    label = Column(String(128))
    user_id = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="api_keys")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_identifier = Column(String(128))   # username or api_key label
    action = Column(String(64))             # CREATE / UPDATE / DELETE / ACK / QUEUE / CANCEL
    resource_type = Column(String(64))      # Asset / Deployment / Alarm / ...
    resource_id = Column(Integer, nullable=True)
    detail = Column(JSON, default={})
    timestamp = Column(DateTime, server_default=func.now(), index=True)


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    model = Column(String)
    asset_type = Column(String)          # SMU / DMM / Oscilloscope / Chassis / DAQ / Power Supply
    serial_number = Column(String, unique=True)
    ip_address = Column(String, nullable=True)
    location = Column(String)
    department = Column(String)
    firmware_version = Column(String)
    driver_version = Column(String)
    status = Column(String, default="offline")  # online / offline / warning / error
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    channel_count = Column(Integer, default=0)
    tags = Column(JSON, default={})

    # ── 시나리오 01: 교정 관리 ────────────────────────────────────────────────
    calibration_due_date      = Column(Date, nullable=True)   # 다음 교정 만료일
    calibration_interval_days = Column(Integer, default=365)  # 교정 주기 (일)

    # ── 섀시 슬롯 관계 ────────────────────────────────────────────────────────
    chassis_id   = Column(Integer, ForeignKey("assets.id"), nullable=True)  # 장착된 섀시 ID
    slot_number  = Column(Integer, nullable=True)                            # 슬롯 번호

    test_results        = relationship("TestResult",        back_populates="asset", cascade="all, delete-orphan")
    alarms              = relationship("Alarm",             back_populates="asset", cascade="all, delete-orphan")
    calibration_events  = relationship("CalibrationEvent", back_populates="asset", cascade="all, delete-orphan")
    modules             = relationship("Asset", foreign_keys="Asset.chassis_id",
                                       primaryjoin="Asset.id == Asset.chassis_id")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    package_name = Column(String)
    package_version = Column(String)
    # State machine: pending → queued → running → succeeded / failed / cancelled
    status = Column(String, default="pending")
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)

    targets = relationship("DeploymentTarget", back_populates="deployment", cascade="all, delete-orphan")


class DeploymentTarget(Base):
    __tablename__ = "deployment_targets"

    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    status = Column(String, default="pending")  # pending / running / succeeded / failed / skipped
    log = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    deployment = relationship("Deployment", back_populates="targets")
    asset = relationship("Asset")


class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))
    test_name = Column(String)
    status = Column(String)   # pass / fail / error
    duration = Column(Float)  # seconds
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    measurements = Column(JSON, default={})
    operator = Column(String)
    notes = Column(Text, nullable=True)

    # ── PMIC 추적성 필드 ───────────────────────────────────────────────────────
    dut_id         = Column(String, nullable=True, index=True)  # 피시험체 ID
    board_rev      = Column(String, nullable=True)              # 보드 리비전 (REV-C)
    silicon_rev    = Column(String, nullable=True)              # 실리콘 리비전 (ES1.1 / MP)
    lot_id         = Column(String, nullable=True, index=True)  # 웨이퍼 Lot ID
    corner         = Column(String, nullable=True)              # 공정 코너 (TT/FF/SS/FS/SF)
    recipe_version = Column(String, nullable=True)              # 테스트 레시피 버전

    # ── 스텝 계층 (step-level traceability) ──────────────────────────────────
    steps = Column(JSON, nullable=True)  # [{seq, name, status, duration_ms, error_msg}]

    # ── 상세 측정 데이터 (조건 × 규격 × 판정) ────────────────────────────────
    measurement_details = Column(JSON, nullable=True)  # [{name, condition, value, unit, spec_min, spec_max, status}]
    waveform_data       = Column(JSON, nullable=True)  # {name, x_label, y_label, x[], y[], spec_min, spec_max, is_fail, meta}

    asset = relationship("Asset", back_populates="test_results")


class Alarm(Base):
    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    severity = Column(String)   # info / warning / critical
    category = Column(String)   # connection / performance / calibration / system
    message = Column(String)
    is_active = Column(Boolean, default=True)
    triggered_at = Column(DateTime, server_default=func.now())
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String, nullable=True)

    asset = relationship("Asset", back_populates="alarms")


class CalibrationEvent(Base):
    """장비별 교정 수행 이력 (시나리오: calibration history)."""
    __tablename__ = "calibration_events"

    id            = Column(Integer, primary_key=True, index=True)
    asset_id      = Column(Integer, ForeignKey("assets.id"), nullable=False)
    performed_at  = Column(DateTime, nullable=False)
    performed_by  = Column(String(128), nullable=False)
    result        = Column(String(16), nullable=False)   # pass / fail
    notes         = Column(Text, nullable=True)
    next_due_date = Column(Date, nullable=True)

    asset = relationship("Asset", back_populates="calibration_events")


class AgentNode(Base):
    __tablename__ = "agent_nodes"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String(128), unique=True, index=True)
    hostname = Column(String(256))
    version = Column(String(32))
    status = Column(String(32), default="offline")   # online / offline
    last_heartbeat = Column(DateTime, nullable=True)
    ip_address = Column(String(64), nullable=True)
    capabilities = Column(JSON, default=[])
    managed_asset_ids = Column(JSON, default=[])     # 이 에이전트가 관리하는 Asset ID 목록

    inventory = relationship("AgentInventory", back_populates="agent", cascade="all, delete-orphan")


class AgentInventory(Base):
    __tablename__ = "agent_inventory"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agent_nodes.id"), nullable=False)
    package_name = Column(String(256))
    version = Column(String(64))
    install_path = Column(String(512), nullable=True)
    recorded_at = Column(DateTime, server_default=func.now())

    agent = relationship("AgentNode", back_populates="inventory")
