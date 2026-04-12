"""PMIC 테스트 데이터 생성 유틸리티.

simulator.py 와 dummy_data.py 양쪽에서 공통으로 사용.
- _pmic_measurements()        : 테스트명 → 집계 측정값 dict
- _generate_steps()           : 스텝 계층 JSON
- _generate_measurement_details() : 조건별 측정값 + 규격 한계 JSON
- _generate_waveform()        : 파형 시계열 JSON (해당 테스트만)
"""
import math
import random
from typing import Optional

# ── 스텝 템플릿 ───────────────────────────────────────────────────────────────

_STEP_TEMPLATES: dict = {
    "출력 전압":    ["채널 초기화", "Vin 설정", "Vout 영부하 측정", "Vout 50% 부하 측정", "Vout 100% 부하 측정", "편차 분석 및 판정"],
    "부하 레귤레이션": ["채널 초기화", "기준 전압 설정", "부하 0→100% 스윕", "레귤레이션 계산", "합격 기준 검증"],
    "라인 레귤레이션": ["채널 초기화", "Vin 스윕 설정", "Vout 추적 측정", "레귤레이션 계산", "합격 기준 검증"],
    "전력 변환 효율": ["채널 초기화", "입력 전력 측정", "출력 전력 측정", "효율 계산", "온도 모니터링", "합격 기준 검증"],
    "출력 리플":    ["오실로스코프 설정", "AC 커플링 적용", "리플 파형 캡처", "RMS 계산", "주파수 분석", "규격 검증"],
    "노이즈 제거비": ["신호 발생기 설정", "입력 노이즈 주입", "출력 노이즈 측정", "PSRR 계산", "주파수 스윕", "규격 검증"],
    "과전류 보호":  ["부하 설정", "전류 램프 증가", "OCP 트리거 감지", "복구 시간 측정", "규격 검증"],
    "저전압 잠금":  ["UVLO 임계값 설정", "Vin 하강 측정", "차단 포인트 감지", "복구 임계값 확인", "규격 검증"],
    "정착 시간":    ["로드 스텝 설정", "스텝 응답 캡처", "정착 시간 계산", "오버슈트 분석", "규격 검증"],
    "소프트 스타트": ["트리거 설정", "전원 ON 파형 캡처", "램프 기울기 분석", "피크 전압 확인", "규격 검증"],
    "스위칭 주파수": ["스펙트럼 분석 설정", "기본파 측정", "고조파 분석", "주파수 안정성 평가", "규격 검증"],
    "온도 드리프트": ["초기 온도 측정", "온도 사이클 적용", "드리프트 추적", "최대 편차 계산", "규격 검증"],
    "과부하 복구":  ["과부하 인가", "보호 동작 확인", "복구 신호 감지", "복구 시간 측정", "규격 검증"],
    "입출력 격리":  ["절연 저항 측정", "내압 시험", "누설 전류 측정", "격리 규격 검증"],
}
_DEFAULT_STEPS = ["초기화 및 연결 확인", "설정 적용", "측정 실행", "데이터 분석", "결과 판정"]


def _generate_steps(test_name: str, status: str, total_duration_s: float) -> list:
    step_names = _DEFAULT_STEPS
    for kw, tmpl in _STEP_TEMPLATES.items():
        if kw in test_name:
            step_names = tmpl
            break

    n = len(step_names)
    weights = [random.uniform(0.05, 0.35) for _ in range(n)]
    total_w = sum(weights)
    durations_ms = [w / total_w * total_duration_s * 1000 for w in weights]

    if status == "pass":
        step_statuses = ["pass"] * n
    elif status == "fail":
        fi = random.randint(max(1, n - 3), n - 1)
        step_statuses = ["pass"] * fi + ["fail"] + ["skip"] * (n - fi - 1)
    else:
        ei = random.randint(0, n - 2)
        step_statuses = ["pass"] * ei + ["error"] + ["skip"] * (n - ei - 1)

    steps = []
    for i, (name, st, dur) in enumerate(zip(step_names, step_statuses, durations_ms)):
        step: dict = {"seq": i + 1, "name": name, "status": st, "duration_ms": round(dur, 1)}
        if st == "fail":
            step["error_msg"] = "측정값이 허용 범위를 초과했습니다 (규격 이탈)"
        elif st == "error":
            step["error_msg"] = "장비 통신 오류 또는 타임아웃"
        steps.append(step)
    return steps


# ── 집계 측정값 ───────────────────────────────────────────────────────────────

def _pmic_measurements(test_name: str) -> dict:
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
        return {"vin_v": round(random.uniform(3.6, 4.2), 3),
                "vout_v": round(random.uniform(1.78, 1.82), 4),
                "iout_ma": round(random.uniform(100, 300), 1)}


# ── 조건별 측정 상세 (규격 한계 포함) ────────────────────────────────────────

def _generate_measurement_details(test_name: str, status: str, measurements: dict) -> list:
    """측정 조건 × 규격 한계 × 합격 판정 목록 생성."""
    fail = (status != "pass")

    if "전압 정확도" in test_name or "레귤레이션" in test_name:
        vout = measurements.get("vout_v", 1.800)
        s_min, s_max = 1.792, 1.808
        conditions = [
            ("부하 0%,   Vin=4.0V", random.uniform(-0.003, 0.003)),
            ("부하 25%,  Vin=3.9V", random.uniform(-0.004, 0.004)),
            ("부하 50%,  Vin=3.8V", random.uniform(-0.005, 0.005)),
            ("부하 75%,  Vin=3.7V", random.uniform(-0.006, 0.006)),
            ("부하 100%, Vin=3.6V", random.uniform(-0.007, 0.007)),
        ]
        fi = random.randint(2, 4) if fail else -1
        rows = []
        for i, (cond, delta) in enumerate(conditions):
            v = round(vout + delta, 4)
            if i == fi:
                v = round(s_max + random.uniform(0.003, 0.012), 4)
            rows.append({"name": "출력 전압 (Vout)", "condition": cond, "value": v, "unit": "V",
                         "spec_min": s_min, "spec_max": s_max,
                         "status": "pass" if s_min <= v <= s_max else "fail"})
        return rows

    elif "효율" in test_name:
        base = measurements.get("efficiency_pct", 88.0)
        s_min = 85.0
        loads = [("부하 25%", 0.85), ("부하 50%", 1.00), ("부하 75%", 0.97), ("부하 100%", 0.91)]
        fi = random.randint(0, 3) if fail else -1
        rows = []
        for i, (cond, f) in enumerate(loads):
            v = round(base * f + random.gauss(0, 0.3), 1)
            if i == fi:
                v = round(s_min - random.uniform(2, 8), 1)
            rows.append({"name": "전력 변환 효율", "condition": cond, "value": v, "unit": "%",
                         "spec_min": s_min, "spec_max": None,
                         "status": "pass" if v >= s_min else "fail"})
        return rows

    elif "리플" in test_name:
        base = measurements.get("ripple_mv", 5.0)
        s_max = 10.0
        loads = [("부하 25%, 120kHz", 0.55), ("부하 50%, 120kHz", 0.80), ("부하 100%, 120kHz", 1.10)]
        fi = random.randint(1, 2) if fail else -1
        rows = []
        for i, (cond, f) in enumerate(loads):
            v = round(base * f + random.gauss(0, 0.3), 2)
            if i == fi:
                v = round(s_max + random.uniform(1, 7), 2)
            rows.append({"name": "출력 리플 (pk-pk)", "condition": cond, "value": v, "unit": "mV",
                         "spec_min": None, "spec_max": s_max,
                         "status": "pass" if v <= s_max else "fail"})
        return rows

    elif "정착 시간" in test_name:
        base = measurements.get("settling_us", 20)
        s_max = 50.0
        steps_cond = [("0→100mA 스텝", 0.9), ("50→300mA 스텝", 1.1), ("100→500mA 스텝", 1.3)]
        fi = random.randint(1, 2) if fail else -1
        rows = []
        for i, (cond, f) in enumerate(steps_cond):
            v = round(base * f + random.gauss(0, 1.5), 1)
            if i == fi:
                v = round(s_max + random.uniform(5, 40), 1)
            rows.append({"name": "부하 정착 시간", "condition": cond, "value": v, "unit": "μs",
                         "spec_min": None, "spec_max": s_max,
                         "status": "pass" if v <= s_max else "fail"})
        return rows

    elif "소프트 스타트" in test_name:
        ov = measurements.get("overshoot_mv", 12)
        st = measurements.get("settling_us", 150)
        s_ov, s_st = 30.0, 200.0
        if fail:
            which = random.randint(0, 1)
            if which == 0:
                ov = round(s_ov + random.uniform(5, 25), 1)
            else:
                st = round(s_st + random.uniform(10, 80), 1)
        return [
            {"name": "소프트 스타트 시간", "condition": "전원 투입 후", "value": round(st, 1), "unit": "μs",
             "spec_min": None, "spec_max": s_st, "status": "pass" if st <= s_st else "fail"},
            {"name": "피크 오버슈트", "condition": "전원 투입 후", "value": round(ov, 1), "unit": "mV",
             "spec_min": None, "spec_max": s_ov, "status": "pass" if ov <= s_ov else "fail"},
        ]

    elif "과전류 보호" in test_name:
        ocp_ma = round(random.uniform(550, 650), 1)
        s_min, s_max = 500.0, 700.0
        if fail:
            ocp_ma = round(s_max + random.uniform(20, 100), 1)
        recov_ms = round(random.uniform(1, 5), 2)
        return [
            {"name": "OCP 트리거 전류", "condition": "Vin=3.8V, T=25°C", "value": ocp_ma, "unit": "mA",
             "spec_min": s_min, "spec_max": s_max, "status": "pass" if s_min <= ocp_ma <= s_max else "fail"},
            {"name": "복구 시간", "condition": "히컵 모드", "value": recov_ms, "unit": "ms",
             "spec_min": None, "spec_max": 10.0, "status": "pass" if recov_ms <= 10 else "fail"},
        ]

    elif "저전압 잠금" in test_name:
        uvlo_mv = round(random.uniform(2600, 2800), 0)
        s_min, s_max = 2500.0, 2900.0
        if fail:
            uvlo_mv = round(s_min - random.uniform(50, 200), 0)
        return [
            {"name": "UVLO 차단 임계값", "condition": "Vin 하강 스윕", "value": uvlo_mv, "unit": "mV",
             "spec_min": s_min, "spec_max": s_max, "status": "pass" if s_min <= uvlo_mv <= s_max else "fail"},
            {"name": "UVLO 복구 임계값", "condition": "Vin 상승 스윕",
             "value": round(uvlo_mv + random.uniform(100, 300), 0), "unit": "mV",
             "spec_min": None, "spec_max": None, "status": "pass"},
        ]

    else:
        # Generic: wrap existing measurements
        rows = []
        for k, v in measurements.items():
            rows.append({"name": k.replace("_", " "), "condition": "표준 (Vin=3.8V, T=25°C)",
                         "value": v, "unit": "",
                         "spec_min": None, "spec_max": None,
                         "status": "pass" if status == "pass" else "unknown"})
        return rows


# ── 파형 데이터 ───────────────────────────────────────────────────────────────

def _generate_waveform(test_name: str, status: str, measurements: dict) -> Optional[dict]:
    """테스트 유형에 맞는 시뮬레이션 파형 생성.
    반환: {name, x_label, y_label, x[], y[], spec_min, spec_max, is_fail, meta}
    파형이 없는 테스트 유형은 None 반환.
    """
    fail = (status != "pass")
    N = 200

    # ── 출력 리플 (오실로스코프 AC 커플링) ───────────────────────────────────
    if "리플" in test_name:
        ripple_mv = measurements.get("ripple_mv", random.uniform(4, 8))
        spec_pkpk = 10.0
        if fail:
            ripple_mv = spec_pkpk * random.uniform(1.15, 1.8)

        T_us = 66.7  # 8 cycles @ 120kHz
        x = [round(i * T_us / N, 3) for i in range(N)]
        amp = ripple_mv / 2
        y = [round(amp * math.sin(2 * math.pi * i / N * 8) + random.gauss(0, amp * 0.09), 3)
             for i in range(N)]
        pk_pk = round(max(y) - min(y), 2)
        return {
            "name": "출력 리플 파형 (AC 커플링)",
            "x_label": "시간 (μs)", "y_label": "전압 (mV)",
            "x": x, "y": y,
            "spec_min": round(-spec_pkpk / 2, 1),
            "spec_max": round(spec_pkpk / 2, 1),
            "is_fail": fail,
            "meta": f"pk-pk {pk_pk} mV  /  규격 < {spec_pkpk} mV",
        }

    # ── 소프트 스타트 (전원 투입 후 전압 램프) ────────────────────────────────
    elif "소프트 스타트" in test_name:
        vout_mv = measurements.get("vout_v", 1.800) * 1000
        ov = measurements.get("overshoot_mv", 10)
        spec_ov = 30.0
        if fail:
            ov = spec_ov * random.uniform(1.15, 1.9)

        T_us = 250
        x = [round(i * T_us / N, 1) for i in range(N)]
        tau = 45.0
        y = []
        for i in range(N):
            t = x[i]
            v = vout_mv * (1 - math.exp(-t / tau))
            dt = t - tau * 2.8
            if dt > 0:
                v += ov * math.exp(-dt / 18) * math.sin(math.pi * dt / 22)
            y.append(round(v + random.gauss(0, 0.4), 2))
        return {
            "name": "소프트 스타트 파형",
            "x_label": "시간 (μs)", "y_label": "전압 (mV)",
            "x": x, "y": y,
            "spec_min": None,
            "spec_max": round(vout_mv + spec_ov, 1),
            "is_fail": fail,
            "meta": f"오버슈트 {round(ov, 1)} mV  /  규격 ≤ {spec_ov} mV",
        }

    # ── 정착 시간 (부하 스텝 과도응답) ───────────────────────────────────────
    elif "정착 시간" in test_name:
        settling_us = measurements.get("settling_us", 20)
        ov = measurements.get("overshoot_mv", 10)
        spec_settling = 50.0
        spec_ov = 30.0
        if fail:
            settling_us = spec_settling * random.uniform(1.1, 2.0)
            ov = spec_ov * random.uniform(1.1, 1.6)

        vout_mv = 1800.0
        dip_mv = -60.0
        T_us = 250
        step_t = 40
        x = [round(i * T_us / N, 1) for i in range(N)]
        tau = settling_us / 4.5
        y = []
        for i in range(N):
            t = x[i]
            if t < step_t:
                v = vout_mv
            else:
                dt = t - step_t
                v = vout_mv + dip_mv * math.exp(-dt / tau) * math.cos(2 * math.pi * dt / (tau * 1.6))
                if dt < 8:
                    v -= ov * math.exp(-dt / 6) * math.sin(math.pi * dt / 8)
            y.append(round(v + random.gauss(0, 0.3), 2))
        return {
            "name": "부하 과도응답 파형 (Vout)",
            "x_label": "시간 (μs)", "y_label": "전압 (mV)",
            "x": x, "y": y,
            "spec_min": round(vout_mv - spec_ov, 1),
            "spec_max": round(vout_mv + spec_ov, 1),
            "is_fail": fail,
            "meta": f"정착 시간 {round(settling_us, 1)} μs  /  규격 ≤ {spec_settling} μs",
        }

    # ── 스위칭 주파수 (게이트 드라이브 파형) ──────────────────────────────────
    elif "스위칭 주파수" in test_name:
        fsw_khz = 120.0
        if fail:
            fsw_khz *= random.uniform(0.82, 0.88)  # frequency drift
        spec_min_k, spec_max_k = 110.0, 130.0

        T_us = round(20 / fsw_khz * 1000, 3)  # 20 cycles
        x = [round(i * T_us / N, 4) for i in range(N)]
        y = []
        for i in range(N):
            t = x[i]
            phase = (t * fsw_khz / 1000) % 1.0
            if phase < 0.45:
                y.append(round(3300 + random.gauss(0, 18), 1))
            else:
                y.append(round(random.gauss(0, 18), 1))
        actual_fsw = round(1.0 / (T_us / 20 / 1000) / 1000, 1)
        return {
            "name": "게이트 드라이브 파형",
            "x_label": "시간 (μs)", "y_label": "전압 (mV)",
            "x": x, "y": y,
            "spec_min": None, "spec_max": None,
            "is_fail": fail,
            "meta": f"측정 {actual_fsw} kHz  /  규격 {spec_min_k}~{spec_max_k} kHz",
        }

    # ── 과전류 보호 (OCP 트립 & 복구) ─────────────────────────────────────────
    elif "과전류 보호" in test_name:
        vout_mv = 1800.0
        T_us = 500
        trip_i = int(N * 0.42)
        recov_i = int(N * 0.68)
        x = [round(i * T_us / N, 1) for i in range(N)]
        y = []
        for i in range(N):
            if i < trip_i:
                v = vout_mv - i * (200.0 / trip_i)
            elif i < recov_i:
                v = random.gauss(80, 25)
            else:
                v = vout_mv * (1 - math.exp(-(i - recov_i) / 18.0))
            y.append(round(v + random.gauss(0, 2), 1))
        return {
            "name": "OCP 트립 및 복구 파형 (Vout)",
            "x_label": "시간 (μs)", "y_label": "전압 (mV)",
            "x": x, "y": y,
            "spec_min": None, "spec_max": round(vout_mv + 8, 1),
            "is_fail": fail,
            "meta": "과전류 → 히컵 차단 → 자동 복구",
        }

    # ── 저전압 잠금 (UVLO 동작) ───────────────────────────────────────────────
    elif "저전압 잠금" in test_name:
        vout_mv = 1800.0
        T_us = 1000
        ramp_s = int(N * 0.35)
        ramp_e = int(N * 0.52)
        recov_i = int(N * 0.68)
        x = [round(i * T_us / N, 1) for i in range(N)]
        y = []
        for i in range(N):
            if i < ramp_s:
                v = vout_mv
            elif i < ramp_e:
                prog = (i - ramp_s) / (ramp_e - ramp_s)
                v = vout_mv * (1 - prog)
            elif i < recov_i:
                v = random.gauss(8, 4)
            else:
                v = vout_mv * (1 - math.exp(-(i - recov_i) / 14.0))
            y.append(round(v + random.gauss(0, 1.5), 1))
        return {
            "name": "UVLO 동작 파형 (Vout)",
            "x_label": "시간 (μs)", "y_label": "전압 (mV)",
            "x": x, "y": y,
            "spec_min": None, "spec_max": round(vout_mv + 8, 1),
            "is_fail": fail,
            "meta": "Vin 하강 → UVLO 차단 → Vin 복구 → 재기동",
        }

    # ── 출력 전압 / 레귤레이션 (V vs 부하 스윕) ──────────────────────────────
    elif "전압" in test_name or "레귤레이션" in test_name:
        vout = measurements.get("vout_v", 1.800) * 1000
        s_min_mv, s_max_mv = 1792.0, 1808.0
        N_pts = 25
        loads_ma = [i * 20 for i in range(N_pts)]  # 0 ~ 480 mA

        if status == "pass":
            drop = random.uniform(3, 6)
        else:
            drop = random.uniform(14, 22)

        y = [round(vout - loads_ma[i] * drop / 480 + random.gauss(0, 0.3), 2) for i in range(N_pts)]
        return {
            "name": "부하 레귤레이션 특성 (Vout vs Iload)",
            "x_label": "부하 전류 (mA)", "y_label": "출력 전압 (mV)",
            "x": loads_ma, "y": y,
            "spec_min": s_min_mv, "spec_max": s_max_mv,
            "is_fail": fail,
            "meta": f"드롭 {round(max(y) - min(y), 2)} mV  /  규격 {s_min_mv}~{s_max_mv} mV",
        }

    # ── 효율 (η vs 부하 곡선) ─────────────────────────────────────────────────
    elif "효율" in test_name:
        base_eff = measurements.get("efficiency_pct", 88.0)
        s_min_pct = 85.0
        if fail:
            base_eff = s_min_pct - random.uniform(2, 6)

        N_pts = 20
        loads_ma = [i * 25 + 25 for i in range(N_pts)]  # 25 ~ 500 mA
        y = []
        for i in range(N_pts):
            load_pct = loads_ma[i] / 500
            eff = base_eff * (1 - 0.25 * (load_pct - 0.55) ** 2)
            y.append(round(eff + random.gauss(0, 0.15), 2))
        return {
            "name": "전력 변환 효율 곡선 (η vs Iload)",
            "x_label": "부하 전류 (mA)", "y_label": "효율 (%)",
            "x": loads_ma, "y": y,
            "spec_min": s_min_pct, "spec_max": None,
            "is_fail": fail,
            "meta": f"최대 효율 {max(y)}%  /  규격 ≥ {s_min_pct}%",
        }

    return None
