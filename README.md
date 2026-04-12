# NI SystemLink 내재화 검토 PoC

Mobile향 PMIC 개발팀의 **NI SystemLink 구매 vs. 내재화** 의사결정을 위한 기술 PoC입니다.

---

## NI SystemLink 공식 정보 요약

| 항목 | 내용 |
|------|------|
| 제품 성격 | 웹 기반 테스트 시스템 관리 플랫폼 (자산·소프트웨어·테스트결과·측정데이터) |
| 최신 릴리스 | SystemLink 2026 Q1 (분기별 릴리스) |
| 라이선스 | 연간 갱신 구독형 (Annually Renewing Subscription) |
| 가격 | Contact us for pricing (공개 고정가 없음) |

### 에디션 비교

| 에디션 | 사용자 | 노드(장비) | 인프라 |
|--------|--------|------------|--------|
| **SystemLink** | 1–10명 | 1–25 | 단일 서버 |
| **SystemLink Server** | 11–50명 | 26–100 | 단일 서버 |
| **SystemLink Enterprise** | 51–500+명 | 101–3,000+ | Kubernetes 클러스터 (동적 확장) |

> **우리 팀 해당 에디션:** ~50명 사용, PMIC Lab 장비 ~12대 기준 → **SystemLink Server**

### 주요 기능 모듈 (공식)

| 모듈 | 기능 |
|------|------|
| **Asset Module** | 자산 관리, 가동률 추적, 교정(Calibration) 일정 관리 |
| **Software Configuration Module** | 소프트웨어 패키지 배포·버전 관리, 노드 인벤토리 |
| **Test Module** | 실시간 테스트 모니터링, DUT/오퍼레이터/시스템 추적성 |
| **Measurement Data** | 측정 데이터 검색·분석, Jupyter 기반 자동화 |

---

## PoC 구현 범위

### 구현된 기능 ✅

| PoC 화면 | 대응 SystemLink 모듈 | 구현 내용 |
|---------|---------------------|----------|
| 자산 관리 | Asset Module | PXIe/SMU/DMM 장비 목록, 실시간 상태, CPU/온도 메트릭 |
| 소프트웨어 배포 | Software Configuration | 패키지 배포 워크플로우, 장비별 실행 로그, 상태 머신 |
| 테스트 결과 | Test Module | PMIC 도메인 테스트, 측정값 레포트, 합격률 추이 |
| 알람 | Asset Module | 심각도별 알람, 확인(Acknowledge), 실시간 피드 |
| PXI 에이전트 | Software Configuration | heartbeat, 인벤토리 자동 수집 |
| 감사 로그 | (공통) | 쓰기 작업 이력, 사용자/시각/상세 추적 |

### 미구현 / 추가 검토 필요 ⚠️

| 기능 | SystemLink 제공 | PoC 현황 | 내재화 난이도 |
|------|----------------|---------|-------------|
| 교정(Calibration) 일정 관리 | ✅ 만료 알림·추적 | ⚠️ 알람만 존재 | 중 |
| 가동률(Utilization) 통계 | ✅ 장비별 가동률 | ❌ 미구현 | 중 |
| DUT(피시험체) 추적성 | ✅ DUT ID·이력 연결 | ❌ 미구현 | 상 |
| Jupyter 기반 측정 분석 | ✅ 내장 | ❌ 미구현 | 상 |
| LDAP/SSO 인증 | ✅ 엔터프라이즈 | ❌ API Key만 | 중 |
| 멀티테넌시 | ✅ Enterprise | ❌ 미구현 | 상 |
| Kubernetes 배포 | ✅ Enterprise | ❌ Docker Compose | 중 |

---

## 의사결정 포인트

| 구분 | SystemLink Server 구매 | 내재화 개발 |
|------|----------------------|-----------|
| 초기 비용 | 라이선스 비용 (견적 필요) | 개발 공수 |
| 유지보수 | NI 지원·업데이트 포함 | 자체 유지보수 필요 |
| PMIC 특화 | 범용 플랫폼 | 완전 커스터마이징 가능 |
| 확장성 | 에디션 업그레이드 | 자체 설계에 따라 결정 |
| NI 장비 연동 | NI 드라이버 네이티브 지원 | NI-DAQmx Python API 활용 |
| 구현 가능성 | 즉시 사용 | PoC로 기술적 가능성 확인됨 ✅ |

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

- [NI SystemLink 다운로드](https://www.ni.com/en/support/downloads/software-products/download.systemlink.html)
- [릴리스 노트](https://www.ni.com/en-us/support/documentation/release-notes/product.systemlink.html)
- [에디션 비교](https://www.ni.com/en/shop/electronic-test-instrumentation/application-software-for-electronic-test-and-instrumentation-category/systemlink/select-edition.html)
- [Asset Module](https://www.ni.com/en/shop/electronic-test-instrumentation/add-ons-for-electronic-test-and-instrumentation/what-is-systemlink-asset-module.html)
- [Software Configuration Module](https://www.ni.com/en/shop/electronic-test-instrumentation/add-ons-for-electronic-test-and-instrumentation/what-is-systemlink-software-configuration-module.html)
- [Test Module](https://www.ni.com/en/shop/electronic-test-instrumentation/add-ons-for-electronic-test-and-instrumentation/what-is-systemlink-test-module.html)
