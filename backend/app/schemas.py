from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime


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


class AssetCreate(AssetBase):
    pass


class AssetOut(AssetBase):
    id: int
    status: str
    last_seen: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Deployment ────────────────────────────────────────────────────────────────

class DeploymentCreate(BaseModel):
    name: str
    package_name: str
    package_version: str
    target_assets: List[int]
    created_by: str
    notes: Optional[str] = None


class DeploymentOut(BaseModel):
    id: int
    name: str
    package_name: str
    package_version: str
    target_assets: List[int]
    status: str
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
