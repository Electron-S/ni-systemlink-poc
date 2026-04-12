from pydantic import BaseModel, computed_field
from typing import Optional, List, Any, Dict
from datetime import datetime, date


# ── User / APIKey / AuditLog ──────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    email: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: int
    user_identifier: str
    action: str
    resource_type: str
    resource_id: Optional[int]
    detail: Dict[str, Any]
    timestamp: datetime

    model_config = {"from_attributes": True}


# ── Asset ────────────────────────────────────────────────────────────────────

class AssetBase(BaseModel):
    name: str
    model: str
    asset_type: str
    serial_number: str
    ip_address: Optional[str] = None
    location: str
    department: str
    firmware_version: str
    driver_version: str
    channel_count: int = 0
    tags: Dict[str, Any] = {}
    calibration_due_date:      Optional[date] = None
    calibration_interval_days: int = 365


class AssetCreate(AssetBase):
    pass


class AssetOut(AssetBase):
    id: int
    status: str
    last_seen: Optional[datetime]
    created_at: datetime

    @computed_field  # type: ignore[misc]
    @property
    def calibration_status(self) -> str:
        if self.calibration_due_date is None:
            return "미등록"
        today = date.today()
        delta = (self.calibration_due_date - today).days
        if delta < 0:
            return "만료"
        if delta <= 30:
            return "만료임박"
        return "유효"

    model_config = {"from_attributes": True}


# ── Deployment ────────────────────────────────────────────────────────────────

class DeploymentCreate(BaseModel):
    name: str
    package_name: str
    package_version: str
    target_asset_ids: List[int]
    created_by: str
    notes: Optional[str] = None


class DeploymentTargetOut(BaseModel):
    id: int
    asset_id: int
    asset_name: Optional[str] = None
    status: str   # pending / running / succeeded / failed / skipped
    log: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class DeploymentOut(BaseModel):
    id: int
    name: str
    package_name: str
    package_version: str
    targets: List[DeploymentTargetOut]
    status: str   # pending / queued / running / succeeded / failed / cancelled
    created_by: str
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    success_count: int
    fail_count: int
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ── TestResult ────────────────────────────────────────────────────────────────

class TestResultCreate(BaseModel):
    asset_id: int
    test_name: str
    status: str
    duration: float
    started_at: datetime
    completed_at: datetime
    measurements: Dict[str, Any] = {}
    operator: str
    notes: Optional[str] = None
    # PMIC 추적성 필드
    dut_id:         Optional[str] = None
    board_rev:      Optional[str] = None
    silicon_rev:    Optional[str] = None
    lot_id:         Optional[str] = None
    corner:         Optional[str] = None
    recipe_version: Optional[str] = None


class TestResultOut(TestResultCreate):
    id: int
    asset_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Alarm ─────────────────────────────────────────────────────────────────────

class AlarmOut(BaseModel):
    id: int
    asset_id: Optional[int]
    asset_name: Optional[str] = None
    severity: str
    category: str
    message: str
    is_active: bool
    triggered_at: datetime
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]

    model_config = {"from_attributes": True}


# ── System Overview ───────────────────────────────────────────────────────────

class SystemOverview(BaseModel):
    total_assets: int
    online: int
    offline: int
    warning: int
    error: int
    active_alarms: int
    critical_alarms: int
    deployments_running: int
    test_pass_rate: float
    total_tests_today: int


# ── Agent ─────────────────────────────────────────────────────────────────────

class HeartbeatPayload(BaseModel):
    hostname: str
    version: str
    ip_address: Optional[str] = None
    capabilities: List[str] = []
    managed_asset_names: Optional[List[str]] = None  # 에이전트가 관리하는 자산 이름 목록


class InventoryItem(BaseModel):
    package_name: str
    version: str
    install_path: Optional[str] = None


class InventoryPayload(BaseModel):
    packages: List[InventoryItem]


class AgentInventoryOut(BaseModel):
    id: int
    package_name: str
    version: str
    install_path: Optional[str]
    recorded_at: datetime

    model_config = {"from_attributes": True}


class AgentOut(BaseModel):
    id: int
    agent_id: str
    hostname: str
    version: str
    status: str
    last_heartbeat: Optional[datetime]
    ip_address: Optional[str]
    capabilities: List[str]
    managed_asset_ids: List[int]
    inventory: List[AgentInventoryOut]

    model_config = {"from_attributes": True}
