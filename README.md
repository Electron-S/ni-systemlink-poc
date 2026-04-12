# NI SystemLink 내재화 검토 PoC

Mobile향 PMIC 개발팀의 **NI SystemLink 구매 vs. 내재화** 의사결정을 위한 기술 PoC입니다.

---

## NI SystemLink란 무엇인가

**"분산된 테스트 랩 운영 플랫폼 + 테스트 데이터 인사이트 플랫폼"**

| 영역 | 대표 기능 | 해당 모듈 |
|------|-----------|----------|
| 시스템/자산 운영 | 장비 상태·calibration·소프트웨어 배포·인벤토리·알람 | Asset + Software Config |
| 테스트 추적/분석 | DUT·operator·system·step 추적, root cause, parametric 시각화 | Test + Measurement Data |
| 검증랩 스케줄링 | Test plan·work order·fixture 예약·스케줄 최적화 | Enterprise |
| 자동화/협업 | Jupyter 기반 분석·알람·routines, 댓글·mention | Enterprise |

### 에디션 비교

| 에디션 | 사용자 | 노드(장비) | 인프라 |
|--------|--------|------------|--------|
| **SystemLink** | 1–10명 | 1–25 | 단일 서버 |
| **SystemLink Server** | 11–50명 | 26–100 | 단일 서버 |
| **SystemLink Enterprise** | 51–500+명 | 101–3,000+ | Kubernetes 클러스터 |

> **우리 팀 해당 에디션:** ~50명 사용, PMIC Lab 장비 ~12대 → **SystemLink Server**

---

## SystemLink 공식 시나리오 29개 × PoC 대응 현황

공식 문서/영상 기준 검증 가능한 시나리오를 전수 정리하고, 우리 PoC 대응 여부와 PMIC 팀 중요도를 매겼습니다.

### 시스템/자산 운영 (시나리오 1–8, 26–28)

| # | 시나리오 | PoC | PMIC 중요도 |
|---|----------|-----|------------|
| 1 | 시스템 등록 및 online/offline/stale 상태 모니터링 | ✅ heartbeat + watchdog | ★★★★★ |
| 2 | 자산 인벤토리 (NI + 3rd-party 장비) 추적 | ✅ 자산 목록·메타데이터 | ★★★★☆ |
| 3 | 자산 위치 이력 추적 | ❌ | ★★☆☆☆ |
| 4 | Calibration due date 추적·만료 전 알람 | ⚠️ 알람만, 일정 관리 없음 | ★★★☆☆ |
| 5 | 태그 기반 실시간 상태 감시 + tag historian | ⚠️ WS 실시간은 있으나 tag 모델 없음 | ★★★☆☆ |
| 6 | 중앙 소프트웨어 배포 (패키지·드라이버·런타임) | ✅ 배포 워크플로우·인벤토리 비교·로그 | ★★★★★ |
| 7 | Golden config 복제 (검증 완료 구성 → 타 시스템) | ❌ | ★★☆☆☆ |
| 8 | 시스템별 설치 job 이력·성공/실패 사유 조회 | ✅ target별 로그 | ★★★☆☆ |
| 26 | 시스템 상태 파일 저장·다중 시스템 적용 | ❌ | ★☆☆☆☆ |
| 27 | NI + non-NI 혼합 자산 관리 | ✅ 수동 등록 | ★★★☆☆ |
| 28 | 결과·자산·데이터 파일 검색·미리보기 | ❌ | ★★★☆☆ |

### 테스트 추적/분석 (시나리오 9–16, 19, 29)

| # | 시나리오 | PoC | PMIC 중요도 |
|---|----------|-----|------------|
| 9 | 분산 스테이션 테스트 실행 실시간 모니터링 | ✅ WS 실시간 피드 | ★★★★★ |
| 10 | DUT 기준 테스트 이력 전체 추적 | ✅ DUT ID·PMIC 6개 추적성 필드 | ★★★★★ |
| 11 | Operator·시스템·환경 교차 root cause 분석 | ⚠️ 필터만, 교차 히트맵 없음 | ★★★★★ |
| 12 | TDMS·CSV·PDF 리포트 결과 연결·미리보기 | ❌ | ★★★☆☆ |
| 13 | 테스트 step 상세 (step별 input/output/measurement) | ❌ 측정값 집계만 존재 | ★★★★☆ |
| 14 | Parametric 데이터 scatter·histogram·box 시각화 | ❌ | ★★★★★ |
| 15 | 결과 그리드 필터·saved view 저장 | ⚠️ 필터 있음, saved view 없음 | ★★★☆☆ |
| 16 | Jupyter 기반 result/dataset 분석·재실행 | ❌ | ★★★★☆ |
| 19 | Product family 기준 yield·trend 집계 | ❌ | ★★★★☆ |
| 29 | API 기반 자체 테스트 시스템 연결 | ✅ REST API 완전 구현 | ★★★★★ |

### 랩 운영/스케줄링 (시나리오 21–25)

| # | 시나리오 | PoC | PMIC 중요도 |
|---|----------|-----|------------|
| 21 | Test plan 생성·template 재사용 | ❌ | ★★★☆☆ |
| 22 | Work order 생성·할당·완료 추적 | ❌ | ★★★☆☆ |
| 23 | System·fixture 가용성 기반 test plan 스케줄링 | ❌ | ★★☆☆☆ |
| 24 | Fixture·slot·channel 예약 | ❌ | ★★☆☆☆ |
| 25 | Jupyter 기반 work item 자동 배정 | ❌ | ★☆☆☆☆ |

### 알람/자동화/협업 (시나리오 17–18, 20)

| # | 시나리오 | PoC | PMIC 중요도 |
|---|----------|-----|------------|
| 17 | Tag threshold·이벤트 기반 알람·이메일·후속 작업 | ⚠️ 알람 있음, rule engine 없음 | ★★★☆☆ |
| 18 | OOTB 대시보드 (자산·테스트·work order KPI) | ⚠️ 기본 KPI만 | ★★★★☆ |
| 20 | 결과·work order에 댓글·@mention 협업 | ❌ | ★★☆☆☆ |

---

## PMIC 팀 핵심 5개 검증 항목

공식 시나리오 29개 중 PMIC 팀 의사결정에 직접 영향을 주는 항목만 뽑으면:

| 검증 항목 | SystemLink 제공 | PoC 현황 | 핵심 차이 |
|-----------|----------------|---------|----------|
| **① DUT/lot/rev/corner/recipe 추적** | DUT·operator·system 연결 (범용) | ✅ PMIC 6개 필드 + 필터 | PoC가 더 도메인 특화 |
| **② Step/measurement 수준 분석** | step-level data·fail step pinpoint | ⚠️ measurement 집계만 | step hierarchy 미구현 |
| **③ Parametric scatter·histogram** | data spaces, X/Y 설정 가능 | ❌ 미구현 | **최대 격차** |
| **④ Work order·test plan·스케줄링** | Enterprise 완전 지원 | ❌ 미구현 | 랩 운영 관점 격차 |
| **⑤ PMIC 도메인 특화 분석** | 범용 tag/filter 기반 | ⚠️ 기본 교차 필터만 | Corner×SiRev×Lot 교차 분석 없음 |

**③ Parametric 분석이 최대 격차인 이유:**
- SystemLink data spaces는 범용 X/Y scatter이지만 PMIC 도메인 개념(corner·lot·silicon_rev)을 모름
- 우리 PoC는 PMIC 측정값(효율·리플·PSRR·settling)을 corner/SiRev별로 비교하는 특화 뷰를 만들 수 있음
- 이 기능이 없으면 "SystemLink가 있어도 별도 Python/Grafana가 필요"한 상황이 그대로 유지됨

---

## PMIC 팀 use case와 SystemLink의 본질적 거리

SystemLink의 기본 use case는 **테스트 조직 전체 운영**이고,
우리 팀의 핵심 use case는 그보다 **좁고 더 도메인 특화된 PMIC 실험 추적/분석**입니다.

| 우리 팀 필요 | SystemLink | PoC | 평가 |
|------------|-----------|-----|------|
| Corner (TT/FF/SS/FS/SF) 합격률 비교 | 범용 tag 필터 | ✅ PMIC 특화 | PoC 우위 |
| Silicon Rev(ES1.0→MP1.0) 수율 추이 | 범용 tag 필터 | ✅ PMIC 특화 | PoC 우위 |
| Lot × Corner 교차 불량 패턴 | 미지원 | ⚠️ 필터만 | 둘 다 미흡 |
| Parametric scatter (효율/리플/PSRR) | data spaces | ❌ 미구현 | SystemLink 우위 |
| Recipe version별 실험 비교 | 범용 tag 필터 | ✅ PMIC 특화 | PoC 우위 |

---

## 의사결정 프레임

| 구분 | SystemLink Server 구매 | 내재화 개발 |
|------|----------------------|-----------|
| **초기 비용** | 라이선스 비용 (견적 필요) | 개발 공수 |
| **유지보수** | NI 지원·업데이트 포함 | 자체 유지보수 필요 |
| **PMIC 도메인 분석** | ❌ 별도 커스텀 툴 필요 | ✅ 단일 플랫폼 통합 가능 |
| **Parametric 시각화** | ✅ data spaces 제공 | ⚠️ 직접 구현 필요 (난이도: 중) |
| **테스트 조직 운영 인프라** | ✅ 즉시 사용 | ⚠️ 직접 구현 필요 |
| **검증랩 스케줄링/work order** | ✅ Enterprise 포함 | ❌ 상당한 추가 공수 |
| **NI 장비 네이티브 연동** | ✅ NI 드라이버 내장 | ⚠️ NI-DAQmx Python API |
| **구현 가능성** | 즉시 사용 가능 | PoC로 핵심 기능 가능성 확인됨 ✅ |

### 권고 시나리오

**시나리오 A — SystemLink 구매:**
- PMIC 도메인 분석(Corner/SiRev/Lot/Recipe 교차 분석)은 어차피 별도 툴 필요
- 검증랩 스케줄링·work order·calibration 관리가 현재 가장 큰 pain point인 팀에 적합

**시나리오 B — 내재화:**
- 인프라(heartbeat·배포·알람) + PMIC 도메인 분석을 단일 플랫폼에서 통합 가능
- parametric 시각화(scatter/histogram) 추가 구현 시 SystemLink 대비 열위 항목 해소됨
- 유지보수 책임을 감당할 엔지니어 리소스가 확보된 경우에 유효

**최종 판단 기준:**
> 랩 스케줄링·work order가 필요하냐 아니냐가 핵심 분기점입니다.
> 그게 없어도 된다면 내재화 쪽이 PMIC 도메인에 더 맞는 플랫폼을 만들 수 있습니다.

---

## PoC 다음 단계 제안

현재 PoC 대비 SystemLink 우위 항목 중 내재화로 메울 수 있는 것:

| 항목 | 구현 내용 | 난이도 | 우선순위 |
|------|-----------|--------|---------|
| **파라메트릭 분석 페이지** | Corner/SiRev별 scatter·histogram (효율·리플·PSRR) | 중 | 1순위 |
| **step-level 분석** | 테스트 step 저장·fail step pinpoint | 중상 | 2순위 |
| **Calibration 일정 관리** | due date·만료 알림·forecast 대시보드 | 중 | 3순위 |
| **Saved view** | 자주 쓰는 필터 조건 저장 | 하 | 4순위 |

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
- [자산 관리 가이드](https://www.ni.com/docs/en-AT/bundle/systemlink-enterprise/page/managing-your-assets.html)
- [태그 모니터링](https://www.ni.com/docs/en-SG/bundle/systemlink-enterprise/page/monitoring-data-with-tags.html)
- [Parametric 데이터 시각화](https://www.ni.com/docs/en-AS/bundle/systemlink-enterprise/page/plotting-parametric-data.html)
