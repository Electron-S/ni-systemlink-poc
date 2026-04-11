"""Mock PXI 어댑터 — PMIC 도메인 측정값 시뮬레이션."""
import random


class MockPXIAdapter:
    """실제 PXI 하드웨어 없이 PMIC 측정값을 시뮬레이션합니다."""

    def __init__(self, capabilities: list[str]):
        self.capabilities = capabilities

    def run_test(self, test_name: str) -> dict:
        """테스트 항목 실행 → PMIC 측정값 반환."""
        if "효율" in test_name:
            return self._efficiency_test()
        elif "리플" in test_name:
            return self._ripple_test()
        elif "PSRR" in test_name or "노이즈" in test_name:
            return self._psrr_test()
        elif "정착" in test_name or "소프트" in test_name:
            return self._settling_test()
        else:
            return self._voltage_test()

    def _efficiency_test(self) -> dict:
        vin  = round(random.uniform(3.5, 4.2), 3)
        vout = round(random.uniform(1.78, 1.82), 4)
        iout = round(random.uniform(100, 500), 1)
        iin  = round(iout * vout / vin * random.uniform(1.05, 1.15), 1)
        eff  = round(iout * vout / (iin * vin) * 100, 2)
        return {"vin_v": vin, "vout_v": vout, "iin_ma": iin, "iout_ma": iout, "efficiency_pct": eff}

    def _ripple_test(self) -> dict:
        return {
            "vout_v":    round(random.uniform(1.79, 1.81), 4),
            "ripple_mv": round(random.uniform(2.0, 15.0), 2),
            "iout_ma":   round(random.uniform(100, 300), 1),
        }

    def _psrr_test(self) -> dict:
        return {
            "psrr_db":  round(random.uniform(55, 75), 1),
            "freq_khz": round(random.uniform(100, 1000), 1),
            "vout_v":   round(random.uniform(1.799, 1.801), 4),
        }

    def _settling_test(self) -> dict:
        return {
            "settling_us":  round(random.uniform(5, 50), 1),
            "vout_v":       round(random.uniform(1.78, 1.82), 4),
            "overshoot_mv": round(random.uniform(0, 30), 1),
        }

    def _voltage_test(self) -> dict:
        vin  = round(random.uniform(3.6, 4.2), 3)
        vout = round(random.uniform(1.78, 1.82), 4)
        return {
            "vin_v":        vin,
            "vout_v":       vout,
            "iout_ma":      round(random.uniform(50, 500), 1),
            "deviation_mv": round(abs(vout - 1.800) * 1000, 2),
        }
