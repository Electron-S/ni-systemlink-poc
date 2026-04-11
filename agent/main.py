"""
NI SystemLink PoC — PXI 에이전트 프로세스
3개 에이전트(pxi-lab1, pxi-lab2, pxi-emc)를 asyncio로 동시 실행합니다.
"""
import asyncio
import os
import random
from datetime import datetime, timezone

import httpx

from adapter import MockPXIAdapter

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
API_KEY     = os.getenv("AGENT_API_KEY", "sl-agent-pxi-key-2024")
HEADERS     = {"X-API-Key": API_KEY}

AGENTS = [
    {
        "agent_id":    "pxi-lab1-agent",
        "hostname":    "pxi-lab1-server",
        "ip_address":  "192.168.10.200",
        "version":     "1.0.0",
        "capabilities": ["SMU", "DMM", "Oscilloscope", "Timing"],
    },
    {
        "agent_id":    "pxi-lab2-agent",
        "hostname":    "pxi-lab2-server",
        "ip_address":  "192.168.10.201",
        "version":     "1.0.0",
        "capabilities": ["SMU", "DMM", "Electronic Load"],
    },
    {
        "agent_id":   "pxi-emc-agent",
        "hostname":   "pxi-emc-server",
        "ip_address": "192.168.10.202",
        "version":    "1.0.0",
        "capabilities": ["Chassis", "Oscilloscope"],
    },
]

PMIC_PACKAGES = [
    {"package_name": "NI-SMU Driver",          "version": "23.5.0", "install_path": "/opt/ni/smu"},
    {"package_name": "NI-DMM Driver",          "version": "23.5.0", "install_path": "/opt/ni/dmm"},
    {"package_name": "NI-Scope Driver",        "version": "23.3.0", "install_path": "/opt/ni/scope"},
    {"package_name": "PMIC TestStand Seq",     "version": "3.2.1",  "install_path": "/opt/ni/teststand"},
    {"package_name": "LabVIEW Runtime",        "version": "2023.Q3","install_path": "/opt/ni/labview"},
    {"package_name": "PMIC Calibration Suite", "version": "2.1.0",  "install_path": "/opt/ni/cal"},
]

TEST_NAMES = [
    "출력 전압 정확도 검사", "부하 레귤레이션 측정", "라인 레귤레이션 측정",
    "전력 변환 효율 분析", "출력 리플 전압 측정", "전원 공급 노이즈 제거비",
    "정착 시간 측정", "소프트 스타트 파형 분析",
]

OPERATORS = ["김민준", "이지연", "박성호", "최유나", "정현우"]


async def run_agent(agent_cfg: dict):
    agent_id  = agent_cfg["agent_id"]
    adapter   = MockPXIAdapter(agent_cfg["capabilities"])
    inventory = random.sample(PMIC_PACKAGES, k=random.randint(3, 6))

    # 초기 대기 (에이전트별 지연)
    await asyncio.sleep(random.uniform(3, 10))

    hb_task  = asyncio.create_task(_heartbeat_loop(agent_id, agent_cfg))
    inv_task = asyncio.create_task(_inventory_loop(agent_id, inventory))
    test_task = asyncio.create_task(_test_loop(agent_id, adapter))

    await asyncio.gather(hb_task, inv_task, test_task)


async def _heartbeat_loop(agent_id: str, cfg: dict):
    """30초마다 heartbeat 전송."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=HEADERS, timeout=10) as client:
        while True:
            try:
                await client.post(
                    f"/api/agents/{agent_id}/heartbeat",
                    json={
                        "hostname":     cfg["hostname"],
                        "version":      cfg["version"],
                        "ip_address":   cfg["ip_address"],
                        "capabilities": cfg["capabilities"],
                    },
                )
                print(f"[{agent_id}] heartbeat 전송 완료")
            except Exception as e:
                print(f"[{agent_id}] heartbeat 오류: {e}")
            await asyncio.sleep(30)


async def _inventory_loop(agent_id: str, packages: list):
    """5분마다 인벤토리 업로드."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=HEADERS, timeout=10) as client:
        while True:
            try:
                await client.post(
                    f"/api/agents/{agent_id}/inventory",
                    json={"packages": packages},
                )
                print(f"[{agent_id}] 인벤토리 업로드 완료 ({len(packages)}개)")
            except Exception as e:
                print(f"[{agent_id}] 인벤토리 오류: {e}")
            await asyncio.sleep(300)


async def _test_loop(agent_id: str, adapter: MockPXIAdapter):
    """2분마다 테스트 실행 후 결과 업로드."""
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=HEADERS, timeout=10) as client:
        # 먼저 장비 목록 조회
        while True:
            try:
                resp = await client.get("/api/assets")
                assets = resp.json()
                online_assets = [a for a in assets if a["status"] == "online"]
                if online_assets:
                    break
            except Exception:
                pass
            await asyncio.sleep(10)

        while True:
            try:
                asset = random.choice(online_assets)
                test_name = random.choice(TEST_NAMES)
                duration  = round(random.uniform(5.0, 60.0), 2)
                status    = random.choices(["pass", "fail", "error"], weights=[78, 18, 4])[0]
                now       = datetime.now(timezone.utc).isoformat()

                await client.post(
                    "/api/test-results",
                    json={
                        "asset_id":     asset["id"],
                        "test_name":    test_name,
                        "status":       status,
                        "duration":     duration,
                        "started_at":   now,
                        "completed_at": now,
                        "measurements": adapter.run_test(test_name),
                        "operator":     random.choice(OPERATORS),
                    },
                )
                print(f"[{agent_id}] 테스트 결과 업로드: {test_name} → {status}")
            except Exception as e:
                print(f"[{agent_id}] 테스트 업로드 오류: {e}")
            await asyncio.sleep(120)


async def main():
    print("[agent] PXI 에이전트 프로세스 시작")
    # 백엔드 준비 대기
    for _ in range(30):
        try:
            async with httpx.AsyncClient(base_url=BACKEND_URL, timeout=5) as c:
                r = await c.get("/ready")
                if r.status_code == 200:
                    print("[agent] 백엔드 연결 확인 완료")
                    break
        except Exception:
            pass
        await asyncio.sleep(3)

    await asyncio.gather(*[run_agent(cfg) for cfg in AGENTS])


if __name__ == "__main__":
    asyncio.run(main())
