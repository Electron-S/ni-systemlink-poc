from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    model = Column(String)
    asset_type = Column(String)          # DAQ / Oscilloscope / SMU / DMM / Chassis / Controller / GPIB
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

    test_results = relationship("TestResult", back_populates="asset", cascade="all, delete-orphan")
    alarms = relationship("Alarm", back_populates="asset", cascade="all, delete-orphan")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    package_name = Column(String)
    package_version = Column(String)
    target_assets = Column(JSON, default=[])   # list of asset IDs
    status = Column(String, default="pending") # pending / running / completed / failed
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)


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
