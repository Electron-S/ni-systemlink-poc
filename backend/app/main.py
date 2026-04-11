import asyncio
import json
import random
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, SessionLocal
from . import models
from .dummy_data import seed
from .simulator import SimulationEngine
from .routers import assets, deployments, test_results, alarms, systems


# ── DB init ───────────────────────────────────────────────────────────────────

def init_db():
    models.Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


# ── WebSocket manager ─────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data, ensure_ascii=False))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()

# ── Smooth metric state ───────────────────────────────────────────────────────
_metric_state: dict = {}


def _smooth_metrics(asset_id: int) -> dict:
    prev = _metric_state.get(asset_id)

    def drift(v: float, lo: float, hi: float, d: float) -> float:
        return round(max(lo, min(hi, v + random.uniform(-d, d))), 2)

    if prev is None:
        rng = random.Random(asset_id)
        m = {
            "asset_id":        asset_id,
            "temperature_c":   round(rng.uniform(40, 60), 1),
            "cpu_pct":         round(rng.uniform(20, 60), 1),
            "memory_pct":      round(rng.uniform(30, 60), 1),
            "voltage_v":       round(rng.uniform(4.98, 5.02), 3),
            "channels_active": rng.randint(2, 6),
        }
    else:
        m = {
            "asset_id":        asset_id,
            "temperature_c":   drift(prev["temperature_c"], 35, 75, 1.5),
            "cpu_pct":         drift(prev["cpu_pct"],       5,  95, 4.0),
            "memory_pct":      drift(prev["memory_pct"],    20, 80, 2.0),
            "voltage_v":       round(max(4.90, min(5.10, prev["voltage_v"] + random.uniform(-0.003, 0.003))), 3),
            "channels_active": prev["channels_active"],
        }

    _metric_state[asset_id] = m
    return m


async def realtime_emitter():
    """2초마다 메트릭 전송"""
    db: Session = SessionLocal()
    try:
        asset_ids = [a.id for a in db.query(models.Asset.id).all()]
    finally:
        db.close()

    while True:
        await asyncio.sleep(2)
        if not manager.active:
            continue
        metrics = [_smooth_metrics(aid) for aid in asset_ids]
        await manager.broadcast({"type": "metrics", "data": metrics})


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    sim = SimulationEngine(SessionLocal, manager)
    t1 = asyncio.create_task(realtime_emitter())
    t2 = asyncio.create_task(sim.run())
    yield
    t1.cancel()
    t2.cancel()


app = FastAPI(title="NI SystemLink PoC", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router)
app.include_router(deployments.router)
app.include_router(test_results.router)
app.include_router(alarms.router)
app.include_router(systems.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/realtime")
async def ws_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
