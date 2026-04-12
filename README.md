# NI SystemLink 내재화 검토 PoC

Mobile향 PMIC 개발팀의 **NI SystemLink 구매 vs. 내재화** 의사결정을 위한 기술 PoC입니다.

---

## NI SystemLink란 무엇인가

**"분산된 테스트 랩 운영 플랫폼 + 테스트 데이터 인사이트 플랫폼"**

NI가 공식 영상과 문서에서 일관되게 강조하는 핵심 use case는 4가지입니다.

| # | Use Case | 핵심 기능 | 대상 |
|---|----------|-----------|------|
| 1 | **테스트 결과 수집/추적** | DUT·오퍼레이터·테스트시스템·스텝·환경을 엮어 실시간 모니터링, root cause 추적 | Test Module |
| 2 | **검증랩 운영/스케줄링** | Test plan·work order·schedule·fixture 예약까지 랩 전체 운영 (Enterprise 성격 강함) | Enterprise |
| 3 | **시스템/자산/소프트웨어 관리** | 장비 상태·calibration·원격 소프트웨어 배포·인벤토리·알람 | Asset + Software Config Module |
| 4 | **대시보드/파라메트릭 분석** | KPI 대시보드, parametric data query/visualize, Jupyter 연동 | Measurement Data |

### 에디션 비교

| 에디션 | 사용자 | 노드(장비) | 인프라 |
|--------|--------|------------|--------|
| **SystemLink** | 1–10명 | 1–25 | 단일 서버 |
| **SystemLink Server** | 11–50명 | 26–100 | 단일 서버 |
| **SystemLink Enterprise** | 51–500+명 | 101–3,000+ | Kubernetes 클러스터 |

> **우리 팀 해당 에디션:** ~50명 사용, PMIC Lab 장비 ~12대 → **SystemLink Server**

---

## PMIC 팀 use case와의 거리

SystemLink가 잘 맞는 부분과 본질적으로 벗어나는 부분이 있습니다.

### 잘 맞는 부분 (SystemLink의 본래 강점)

| 우리 팀 필요 | SystemLink 대응 | 적합도 |
|------------|----------------|--------|
| 장비 상태 모니터링 | Asset Module | ★★★★★ |
| 소프트웨어 배포·버전 관리 | Software Config Module | ★★★★★ |
| 알람·이상 감지 | Asset Module | ★★★★☆ |
| 테스트 결과 수집 (DUT·operator·시스템) | Test Module | ★★★★★ |
| calibration 일정 관리 | Asset Module | ★★★★☆ |
| 합격률 KPI·추이 대시보드 | Measurement Data | ★★★★☆ |

### 덜 맞는 부분 (PMIC 도메인 특화 필요)

SystemLink의 기본 use case는 **테스트 조직 전체 운영**이고,
우리 팀의 핵심 use case는 그보다 **좁고 더 도메인 특화된 PMIC 실험 추적/분석**입니다.

| 우리 팀 필요 | SystemLink 대응 | 적합도 | 이유 |
|------------|----------------|--------|------|
| Silicon Rev(ES1.0/MP1.0)별 합격률 비교 | 범용 tag 필터 | ★★☆☆☆ | PMIC 개념 없음 |
| 공정 코너(TT/FF/SS/FS/SF) 분석 | 범용 tag 필터 | ★★☆☆☆ | PMIC 개념 없음 |
| Lot ID 별 수율·불량 패턴 추적 | 부분 지원 | ★★★☆☆ | DUT tracking 수준 |
| Recipe version별 실험 결과 비교 | 범용 tag 필터 | ★★☆☆☆ | TestStand 연동 필요 |
| Board Rev × Corner 교차 분석 | 미지원 | ★☆☆☆☆ | 커스텀 대시보드 필요 |

**핵심 결론:**
- SystemLink를 구매해도 PMIC 도메인 분석 계층은 **별도 커스텀 툴링이 필요합니다**
- 직접 만들면 두 계층을 통합하지만 인프라 계층 유지보수를 직접 부담합니다

---

## PoC 구현 범위

### 구현된 기능 ✅

| PoC 화면 | 대응 SystemLink 모듈 | 구현 내용 |
|---------|---------------------|----------|
| 자산 관리 | Asset Module | PXIe/SMU/DMM 장비 목록, 실시간 상태, CPU/온도 메트릭 |
| 소프트웨어 배포 | Software Configuration | 패키지 배포 워크플로우, 인벤토리 비교, 상태 머신 |
| 테스트 결과 | Test Module | PMIC 추적성(DUT/Corner/SiRev/Lot/Recipe), 측정값 레포트 |
| 알람 | Asset Module | 심각도별 알람, 확인(Acknowledge), 실시간 피드 |
| PXI 에이전트 | Software Configuration | heartbeat, 관리 자산 자동 연결, 인벤토리 수집 |
| 감사 로그 | (공통) | 쓰기 작업 이력, 사용자/시각/상세 추적 |

### 미구현 / 추가 검토 필요 ⚠️

| 기능 | SystemLink 제공 | PoC 현황 | 내재화 난이도 |
|------|----------------|---------|-------------|
| Calibration 일정 관리 | ✅ 만료 알림·추적 | ⚠️ 알람만 존재 | 중 |
| 가동률(Utilization) 통계 | ✅ 장비별 가동률 | ❌ 미구현 | 중 |
| 검증랩 스케줄링/work order | ✅ Enterprise | ❌ 미구현 | 상 |
| Jupyter 기반 측정 분석 | ✅ 내장 | ❌ 미구현 | 상 |
| LDAP/SSO 인증 | ✅ Enterprise | ❌ API Key만 | 중 |
| Kubernetes 배포 | ✅ Enterprise | ❌ Docker Compose | 중 |

---

## 의사결정 프레임

| 구분 | SystemLink Server 구매 | 내재화 개발 |
|------|----------------------|-----------|
| **초기 비용** | 라이선스 비용 (견적 필요) | 개발 공수 |
| **유지보수** | NI 지원·업데이트 포함 | 자체 유지보수 필요 |
| **PMIC 도메인 분석** | ❌ 별도 커스텀 필요 | ✅ 완전 통합 가능 |
| **테스트 조직 운영** | ✅ 즉시 사용 | ⚠️ 직접 구현 필요 |
| **검증랩 스케줄링** | ✅ Enterprise 포함 | ❌ 상당한 추가 공수 |
| **NI 장비 네이티브 연동** | ✅ NI 드라이버 내장 | ⚠️ NI-DAQmx Python API |
| **확장성** | 에디션 업그레이드 | 자체 설계에 따라 결정 |
| **구현 가능성** | 즉시 사용 가능 | PoC로 기술적 가능성 확인됨 ✅ |

### 권고 시나리오

**시나리오 A — SystemLink 구매:**
- PMIC 도메인 분석(Corner/SiRev/Lot/Recipe 교차 분석)을 별도 Python/Grafana 툴로 보완해야 함
- 테스트 조직 운영(스케줄링·calibration·배포)이 현재 가장 큰 pain point인 팀에 적합

**시나리오 B — 내재화:**
- 인프라(heartbeat·배포·알람) + PMIC 도메인 분석을 단일 플랫폼에서 통합 가능
- 유지보수 책임을 감당할 수 있는 엔지니어 리소스가 확보된 경우에 유효
- PoC 기준으로 핵심 기능은 ~2주 이내 구현 가능함이 확인됨

---

## 아키텍처

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐
│   React 프론트   │◄──►│   FastAPI 백엔드   │◄──►│  PostgreSQL │
│  (Ant Design)   │ WS │  (Python 3.11)   │    │   (DB)      │
└─────────────────┘    └────────┬─────────┘    └─────────────┘
                                │
                    ┌───────────▼──────────┐
                    │   PXI Agent 서비스    │
                    │ (pxi-lab1/lab2/emc)  │
                    │  heartbeat·인벤토리   │
                    └──────────────────────┘
```

**스택:** React + TypeScript + Ant Design 5 / FastAPI / SQLAlchemy + Alembic / PostgreSQL / Docker Compose

---

## 실행 방법

```bash
# 처음 실행 or 스키마 변경 시
docker compose down -v
docker compose up --build

# 코드 변경 후 재시작
docker compose up --build
```

접속: http://localhost:3001

### API 키 (개발용)

| 역할 | 키 |
|------|----|
| Admin | `sl-admin-key-2024` |
| Engineer | `sl-engineer-key-2024` |
| Agent | `sl-agent-pxi-key-2024` |

---

## 참고 링크

- [SystemLink 에디션 비교](https://www.ni.com/en/shop/electronic-test-instrumentation/application-software-for-electronic-test-and-instrumentation-category/systemlink/select-edition.html)
- [Asset Module](https://www.ni.com/en/shop/electronic-test-instrumentation/add-ons-for-electronic-test-and-instrumentation/what-is-systemlink-asset-module.html)
- [Software Configuration Module](https://www.ni.com/en/shop/electronic-test-instrumentation/add-ons-for-electronic-test-and-instrumentation/what-is-systemlink-software-configuration-module.html)
- [Test Module](https://www.ni.com/en/shop/electronic-test-instrumentation/add-ons-for-electronic-test-and-instrumentation/what-is-systemlink-test-module.html)
- [테스트 모니터링 가이드](https://www.ni.com/docs/en-AT/bundle/systemlink-enterprise/page/monitoring-tests.html)
