# NI SystemLink PoC — CLAUDE.md

## 프로젝트 개요
PMIC 개발팀용 NI SystemLink 내재화 PoC.  
목적: SystemLink 라이선스 구매 vs 내재화 의사결정 검토.

## 스택
- **프론트엔드:** React + Ant Design (포트 3001)
- **백엔드:** FastAPI + SQLAlchemy (포트 8000)
- **DB:** PostgreSQL
- **실행:** Docker Compose

## 주요 명령어
```bash
# 재시작 (코드 변경 없을 때)
docker compose up -d

# 빌드 후 재시작 (프론트엔드 코드 변경 후)
docker compose up --build -d

# 로그 확인
docker compose logs -f
```

## 경로 규칙
- 로컬: `D:\Develop\ni-systemlink-poc` = WSL: `/mnt/d/Develop/ni-systemlink-poc`
- 접속: http://localhost:3001

## 기술적 주의사항
- **PostgreSQL JSON:** `measurements` 컬럼은 JSON 타입 → 쿼리 시 `measurements::jsonb` 캐스트 필요
- **라우팅 충돌:** FastAPI에서 `/{asset_id}` 같은 동적 경로보다 `/chassis-view`, `/comparison` 등 고정 경로를 반드시 먼저 선언
- **프론트엔드 빌드:** 백엔드는 볼륨 마운트라 즉시 반영되지만, 프론트 변경 시 `--build` 필수
- **시드 재실행:** `_seed_new_models()` 함수로 새 모델만 별도 시드 (기존 DB 보존)
- **인증:** 쓰기 요청에 `X-API-Key: sl-admin-key-2024` 헤더 필요 (프론트 axios 인터셉터가 자동 추가)

## DB 마이그레이션 현황 (최신: 0007)
```
0001 — 초기 스키마 (Asset, TestResult, Alarm, Deployment, User, APIKey, AuditLog)
0002 — PMIC 추적성 필드 (dut_id, board_rev, silicon_rev, lot_id, corner, recipe_version)
0003 — 교정 관리 (calibration_due_date, CalibrationEvent)
0004 — 스텝 계층 (steps JSON)
0005 — 상세 측정 + 파형 (measurement_details, waveform_data)
0006 — 섀시-슬롯 관계 (chassis_id, slot_number)
0007 — 작업 지시 + 테스트 규격 (work_orders, test_specs 테이블)
```

## 구현된 페이지 (12개)
| 경로 | 페이지 |
|------|--------|
| `/` | 대시보드 |
| `/assets` | 자산 목록 (섀시 배치도 탭 포함) |
| `/agents` | PXI 에이전트 (크로스 시스템 비교 탭 포함) |
| `/work-orders` | 작업 지시 CRUD |
| `/test-results` | 테스트 결과 |
| `/fpy` | FPY / Pareto |
| `/parametric` | 파라메트릭 / SPC |
| `/utilization` | 장비 가동률 |
| `/deployments` | 소프트웨어 배포 |
| `/alarms` | 알람 |
| `/specs` | 규격 관리 |
| `/audit-logs` | 감사 로그 |

## 더미 데이터 규모
- 장비: 12개 (Chassis 3, SMU 3, DMM 2, Scope 2, E-Load 1, Timing 1)
- 테스트 결과: 3,000건 (90일치, 합격률 ~78%)
- WorkOrder: 8건 / TestSpec: 90건 / 에이전트: 3개

## GitHub
https://github.com/Electron-S/ni-systemlink-poc
