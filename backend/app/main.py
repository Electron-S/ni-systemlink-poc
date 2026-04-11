import asyncio
import json
import random
import time
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, SessionLocal
from . import models
from .dummy_data import seed
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
        self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()


async def realtime_emitter():
    """Push simulated asset metrics to all WebSocket clients every 2 s."""
    db: Session = SessionLocal()
    try:
        asset_ids = [a.id for a in db.query(models.Asset.id).all()]
    finally:
        db.close()

    while True:
        await asyncio.sleep(2)
        if not manager.active:
            continue
        t = int(time.time())
        metrics = []
        for aid in asset_ids:
            rng = random.Random(aid + t // 2)
            metrics.append({
                "asset_id":      aid,
                "temperature_c": round(rng.uniform(35, 72), 1),
                "cpu_pct":       round(rng.uniform(5, 95), 1),
                "memory_pct":    round(rng.uniform(20, 80), 1),
                "voltage_v":     round(rng.uniform(4.95, 5.05), 3),
                "channels_active": rng.randint(0, 8),
            })
        await manager.broadcast({"type": "metrics", "data": metrics})


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(realtime_emitter())
    yield
    task.cancel()


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
            await ws.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(ws)
