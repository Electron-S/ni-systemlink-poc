from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import statistics as _stats_mod
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text, Integer
from .. import models, schemas
from ..database import get_db
from ..auth import require_engineer

router = APIRouter(prefix="/api/test-results", tags=["test_results"])


@router.get("", response_model=List[schemas.TestResultOut])
def list_results(
    asset_id:      Optional[int]  = Query(None),
    status:        Optional[str]  = Query(None),
    dut_id:        Optional[str]  = Query(None),
    silicon_rev:   Optional[str]  = Query(None),
    corner:        Optional[str]  = Query(None),
    lot_id:        Optional[str]  = Query(None),
    recipe_version: Optional[str] = Query(None),
    days:          int = Query(7, ge=1, le=90),
    date_from:     Optional[str]  = Query(None),  # ISO format
    date_to:       Optional[str]  = Query(None),
    limit:         int = Query(200, le=500),
    db: Session = Depends(get_db),
):
    if date_from:
        since = datetime.fromisoformat(date_from)
    else:
        since = datetime.utcnow() - timedelta(days=days)

    q = db.query(models.TestResult).filter(models.TestResult.started_at >= since)

    if date_to:
        q = q.filter(models.TestResult.started_at <= datetime.fromisoformat(date_to))
    if asset_id:
        q = q.filter(models.TestResult.asset_id == asset_id)
    if status:
        q = q.filter(models.TestResult.status == status)
    if dut_id:
        q = q.filter(models.TestResult.dut_id == dut_id)
    if silicon_rev:
        q = q.filter(models.TestResult.silicon_rev == silicon_rev)
    if corner:
        q = q.filter(models.TestResult.corner == corner)
    if lot_id:
        q = q.filter(models.TestResult.lot_id == lot_id)
    if recipe_version:
        q = q.filter(models.TestResult.recipe_version == recipe_version)

    results = q.order_by(models.TestResult.started_at.desc()).limit(limit).all()
    out = []
    for r in results:
        item = schemas.TestResultOut.model_validate(r)
        item.asset_name = r.asset.name if r.asset else None
        out.append(item)
    return out


@router.post("", response_model=schemas.TestResultOut, status_code=201)
def create_result(
    payload: schemas.TestResultCreate,
    db: Session = Depends(get_db),
    _user: models.User = Depends(require_engineer),
):
    result = models.TestResult(**payload.model_dump())
    db.add(result)
    db.commit()
    db.refresh(result)
    out = schemas.TestResultOut.model_validate(result)
    out.asset_name = result.asset.name if result.asset else None
    return out


@router.get("/stats")
def get_stats(
    asset_id:    Optional[int] = Query(None),
    status:      Optional[str] = Query(None),
    dut_id:      Optional[str] = Query(None),
    silicon_rev: Optional[str] = Query(None),
    corner:      Optional[str] = Query(None),
    lot_id:      Optional[str] = Query(None),
    days:        int = Query(7, ge=1, le=90),
    date_from:   Optional[str] = Query(None),
    date_to:     Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    since = datetime.fromisoformat(date_from) if date_from else datetime.utcnow() - timedelta(days=days)
    until = datetime.fromisoformat(date_to)   if date_to   else datetime.utcnow()

    def _base(db_session):
        """현재 필터 조건이 적용된 기본 쿼리."""
        q = db_session.query(models.TestResult).filter(
            models.TestResult.started_at >= since,
            models.TestResult.started_at <= until,
        )
        if asset_id:    q = q.filter(models.TestResult.asset_id   == asset_id)
        if status:      q = q.filter(models.TestResult.status      == status)
        if dut_id:      q = q.filter(models.TestResult.dut_id      == dut_id)
        if silicon_rev: q = q.filter(models.TestResult.silicon_rev == silicon_rev)
        if corner:      q = q.filter(models.TestResult.corner      == corner)
        if lot_id:      q = q.filter(models.TestResult.lot_id      == lot_id)
        return q

    q      = _base(db)
    total  = q.count()
    passed = q.filter(models.TestResult.status == "pass").count()
    failed = q.filter(models.TestResult.status == "fail").count()
    errors = q.filter(models.TestResult.status == "error").count()
    avg_dur = db.query(func.avg(models.TestResult.duration)).filter(
        models.TestResult.started_at >= since,
        models.TestResult.started_at <= until,
    ).scalar() or 0

    # 일별 합격률 추이 — date_from/to가 있으면 그 범위 내, 없으면 days 기준
    from datetime import date as _date
    day_count  = max((until.date() - since.date()).days + 1, 1)
    trend_days = min(day_count, days if not date_from else day_count)
    trend = []
    for d in range(trend_days - 1, -1, -1):
        day_start = (until - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        day_q = _base(db).filter(
            models.TestResult.started_at >= day_start,
            models.TestResult.started_at <  day_end,
        )
        day_total = day_q.count()
        day_pass  = day_q.filter(models.TestResult.status == "pass").count()
        trend.append({
            "date":      day_start.strftime("%m/%d"),
            "total":     day_total,
            "pass":      day_pass,
            "pass_rate": round(day_pass / day_total * 100, 1) if day_total else 0,
        })

    # 공정 코너별 합격률 (corner 필터가 있으면 해당 코너만, 없으면 전체)
    corners_to_show = [corner] if corner else ["TT", "FF", "SS", "FS", "SF"]
    corner_stats = []
    for c in corners_to_show:
        cq = _base(db).filter(models.TestResult.corner == c)
        ct = cq.count()
        cp = cq.filter(models.TestResult.status == "pass").count()
        if ct > 0:
            corner_stats.append({
                "corner": c,
                "total":  ct,
                "pass_rate": round(cp / ct * 100, 1),
            })

    return {
        "total":          total,
        "passed":         passed,
        "failed":         failed,
        "errors":         errors,
        "pass_rate":      round(passed / total * 100, 1) if total else 0,
        "avg_duration_s": round(avg_dur, 2),
        "trend":          trend,
        "corner_stats":   corner_stats,
    }


# ── 시나리오 14: 파라메트릭 분석 ─────────────────────────────────────────────

@router.get("/measurement-keys")
def get_measurement_keys(db: Session = Depends(get_db)):
    """테스트 결과에 존재하는 측정 항목 키 목록 반환 (PostgreSQL jsonb 전용)."""
    rows = db.execute(
        text("SELECT DISTINCT jsonb_object_keys(measurements::jsonb) FROM test_results "
             "WHERE measurements IS NOT NULL ORDER BY 1")
    ).fetchall()
    return {"keys": [r[0] for r in rows]}


@router.get("/parametric")
def get_parametric(
    measurement_key: str           = Query(...),
    group_by:        str           = Query("corner"),
    asset_id:        Optional[int] = Query(None),
    test_name:       Optional[str] = Query(None),
    days:            int           = Query(30, ge=1, le=90),
    date_from:       Optional[str] = Query(None),
    date_to:         Optional[str] = Query(None),
    limit:           int           = Query(1000, le=2000),
    db: Session = Depends(get_db),
):
    """측정 항목 1개를 선택해 그룹별 산포 데이터 + 통계 반환."""
    VALID_GROUP_BY = {"corner", "silicon_rev", "lot_id", "recipe_version", "asset_id", "operator"}
    if group_by not in VALID_GROUP_BY:
        group_by = "corner"

    since = datetime.fromisoformat(date_from) if date_from else datetime.utcnow() - timedelta(days=days)
    until = datetime.fromisoformat(date_to)   if date_to   else datetime.utcnow()

    q = db.query(models.TestResult).filter(
        models.TestResult.started_at >= since,
        models.TestResult.started_at <= until,
    )
    if asset_id: q = q.filter(models.TestResult.asset_id == asset_id)
    if test_name: q = q.filter(models.TestResult.test_name == test_name)

    rows = q.order_by(models.TestResult.started_at.asc()).limit(limit).all()

    points = []
    for r in rows:
        val = r.measurements.get(measurement_key) if r.measurements else None
        if val is None:
            continue
        group_val = getattr(r, group_by, None)
        if group_val is None:
            continue
        points.append({
            "value":      float(val),
            "group":      str(group_val),
            "dut_id":     r.dut_id,
            "status":     r.status,
            "started_at": r.started_at.isoformat(),
            "test_name":  r.test_name,
        })

    # 그룹별 통계
    grp: dict = defaultdict(list)
    grp_pass: dict = defaultdict(int)
    for p in points:
        grp[p["group"]].append(p["value"])
        if p["status"] == "pass":
            grp_pass[p["group"]] += 1

    group_stats = []
    for g, vals in sorted(grp.items()):
        n = len(vals)
        group_stats.append({
            "group":     g,
            "count":     n,
            "mean":      round(sum(vals) / n, 4),
            "min":       round(min(vals), 4),
            "max":       round(max(vals), 4),
            "std":       round(_stats_mod.stdev(vals), 4) if n > 1 else 0.0,
            "pass_rate": round(grp_pass[g] / n * 100, 1),
        })

    return {"points": points, "stats": group_stats}


# ── 시나리오 17: 장비 가동률 분석 ─────────────────────────────────────────────

@router.get("/utilization")
def get_utilization(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """자산별 테스트 건수·합격률·마지막 사용 시각 (가동률 분석용)."""
    since = datetime.utcnow() - timedelta(days=days)

    rows = (
        db.query(
            models.TestResult.asset_id,
            func.count(models.TestResult.id).label("test_count"),
            func.sum(
                func.cast(models.TestResult.status == "pass", Integer())
            ).label("pass_count"),
            func.max(models.TestResult.started_at).label("last_tested_at"),
        )
        .filter(models.TestResult.started_at >= since)
        .group_by(models.TestResult.asset_id)
        .order_by(func.count(models.TestResult.id).desc())
        .all()
    )

    asset_map = {
        a.id: a for a in
        db.query(models.Asset).filter(
            models.Asset.id.in_([r.asset_id for r in rows])
        ).all()
    }

    return [
        {
            "asset_id":      r.asset_id,
            "asset_name":    asset_map[r.asset_id].name if r.asset_id in asset_map else "Unknown",
            "asset_type":    asset_map[r.asset_id].asset_type if r.asset_id in asset_map else "",
            "test_count":    r.test_count,
            "pass_count":    r.pass_count or 0,
            "pass_rate":     round((r.pass_count or 0) / r.test_count * 100, 1) if r.test_count else 0,
            "last_tested_at": r.last_tested_at.isoformat() if r.last_tested_at else None,
        }
        for r in rows
    ]


# ── Feature 7: 장비 가동률 상세 리포트 ────────────────────────────────────────

@router.get("/utilization-detail")
def get_utilization_detail(
    days:     int           = Query(30, ge=1, le=365),
    asset_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """일별 × 장비별 테스트 건수 / 합격률 / 가동 시간 상세."""
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(models.TestResult).filter(models.TestResult.started_at >= since)
    if asset_id:
        q = q.filter(models.TestResult.asset_id == asset_id)

    results = q.order_by(models.TestResult.started_at.asc()).all()

    asset_ids_set = {r.asset_id for r in results}
    asset_map = {
        a.id: a.name
        for a in db.query(models.Asset).filter(models.Asset.id.in_(asset_ids_set)).all()
    }

    daily: dict = defaultdict(lambda: defaultdict(lambda: {"total": 0, "pass": 0, "duration": 0.0}))
    for r in results:
        day_str    = r.started_at.strftime("%Y-%m-%d")
        asset_name = asset_map.get(r.asset_id, f"Asset-{r.asset_id}")
        daily[day_str][asset_name]["total"]    += 1
        if r.status == "pass":
            daily[day_str][asset_name]["pass"] += 1
        daily[day_str][asset_name]["duration"] += r.duration

    out = []
    for day_str in sorted(daily.keys()):
        for asset_name, counts in daily[day_str].items():
            t = counts["total"]
            p = counts["pass"]
            out.append({
                "date":             day_str,
                "asset_name":       asset_name,
                "test_count":       t,
                "pass_count":       p,
                "pass_rate":        round(p / t * 100, 1) if t else 0,
                "total_duration_s": round(counts["duration"], 1),
            })
    return out


# ── 시나리오 11: 교차 root cause 분석 ────────────────────────────────────────

@router.get("/cross-analysis")
def get_cross_analysis(
    row_by:    str           = Query("corner"),
    col_by:    str           = Query("silicon_rev"),
    asset_id:  Optional[int] = Query(None),
    days:      int           = Query(30, ge=1, le=90),
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """두 PMIC 속성 기준으로 합격률 교차 테이블 반환 (root cause 분석용)."""
    VALID_FIELDS = {"corner", "silicon_rev", "lot_id", "recipe_version", "operator"}
    row_by = row_by if row_by in VALID_FIELDS else "corner"
    col_by = col_by if col_by in VALID_FIELDS else "silicon_rev"

    since = datetime.fromisoformat(date_from) if date_from else datetime.utcnow() - timedelta(days=days)
    until = datetime.fromisoformat(date_to)   if date_to   else datetime.utcnow()

    q = db.query(models.TestResult).filter(
        models.TestResult.started_at >= since,
        models.TestResult.started_at <= until,
    )
    if asset_id:
        q = q.filter(models.TestResult.asset_id == asset_id)

    cell: dict = defaultdict(lambda: {"total": 0, "pass": 0})
    row_vals: set = set()
    col_vals: set = set()

    for r in q.all():
        rv = getattr(r, row_by, None)
        cv = getattr(r, col_by, None)
        if rv is None or cv is None:
            continue
        key = (str(rv), str(cv))
        row_vals.add(str(rv))
        col_vals.add(str(cv))
        cell[key]["total"] += 1
        if r.status == "pass":
            cell[key]["pass"] += 1

    rows_sorted = sorted(row_vals)
    cols_sorted = sorted(col_vals)
    matrix = {}
    for rv in rows_sorted:
        matrix[rv] = {}
        for cv in cols_sorted:
            c = cell[(rv, cv)]
            matrix[rv][cv] = {
                "total":     c["total"],
                "pass_rate": round(c["pass"] / c["total"] * 100, 1) if c["total"] else None,
            }

    return {"rows": rows_sorted, "cols": cols_sorted, "matrix": matrix, "row_label": row_by, "col_label": col_by}


# ── Feature 2: First Pass Yield / Failure Pareto ─────────────────────────────

@router.get("/fpy")
def get_fpy(
    days:     int           = Query(30, ge=1, le=365),
    asset_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """First Pass Yield 분석 + 실패 단계 Pareto."""
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(models.TestResult).filter(models.TestResult.started_at >= since)
    if asset_id:
        q = q.filter(models.TestResult.asset_id == asset_id)

    results = q.order_by(models.TestResult.started_at.asc()).all()

    # DUT별 첫 번째 시도 결과로 FPY 계산
    first_attempt: dict = {}   # (dut_id, test_name) -> status
    for r in results:
        if r.dut_id is None:
            continue
        key = (r.dut_id, r.test_name)
        if key not in first_attempt:
            first_attempt[key] = r.status

    # 테스트명별 집계
    test_total: dict = defaultdict(int)
    test_pass:  dict = defaultdict(int)
    for (_, test_name), status in first_attempt.items():
        test_total[test_name] += 1
        if status == "pass":
            test_pass[test_name] += 1

    fpy_by_test = sorted(
        [
            {
                "test_name": tn,
                "total":     test_total[tn],
                "pass":      test_pass[tn],
                "fpy":       round(test_pass[tn] / test_total[tn] * 100, 1) if test_total[tn] else 0,
            }
            for tn in test_total
        ],
        key=lambda x: x["fpy"],
    )

    total_duts = len(first_attempt)
    pass_duts  = sum(1 for s in first_attempt.values() if s == "pass")
    overall    = round(pass_duts / total_duts * 100, 1) if total_duts else 0

    # 실패 단계 Pareto
    step_fail: dict = defaultdict(int)
    for r in results:
        if r.status == "pass":
            continue
        if r.steps:
            for step in r.steps:
                if step.get("status") in ("fail", "error"):
                    step_fail[step.get("name", "Unknown")] += 1

    pareto = sorted(
        [{"step": k, "count": v} for k, v in step_fail.items()],
        key=lambda x: x["count"], reverse=True,
    )[:20]

    return {
        "overall_fpy":   overall,
        "total_duts":    total_duts,
        "pass_duts":     pass_duts,
        "fail_duts":     total_duts - pass_duts,
        "fpy_by_test":   fpy_by_test,
        "failure_pareto": pareto,
    }


# ── Feature 5: SPC 제어 차트 ──────────────────────────────────────────────────

@router.get("/spc")
def get_spc(
    measurement_key: str           = Query(...),
    asset_id:        Optional[int] = Query(None),
    test_name:       Optional[str] = Query(None),
    days:            int           = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """SPC 제어 차트: 시계열 측정값 + UCL/LCL (3σ 기준)."""
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(models.TestResult).filter(models.TestResult.started_at >= since)
    if asset_id:  q = q.filter(models.TestResult.asset_id == asset_id)
    if test_name: q = q.filter(models.TestResult.test_name == test_name)

    rows = q.order_by(models.TestResult.started_at.asc()).all()

    points = []
    for r in rows:
        val = r.measurements.get(measurement_key) if r.measurements else None
        if val is None:
            continue
        points.append({
            "value":      float(val),
            "started_at": r.started_at.isoformat(),
            "status":     r.status,
            "dut_id":     r.dut_id,
            "asset_id":   r.asset_id,
        })

    if len(points) < 2:
        return {"points": points, "mean": None, "ucl": None, "lcl": None, "std": None, "n": len(points)}

    vals = [p["value"] for p in points]
    mean = sum(vals) / len(vals)
    std  = _stats_mod.stdev(vals)

    return {
        "points": points,
        "mean":   round(mean, 4),
        "ucl":    round(mean + 3 * std, 4),
        "lcl":    round(mean - 3 * std, 4),
        "std":    round(std, 4),
        "n":      len(points),
    }


# ── Feature 4: 자동화 리포트 생성 ─────────────────────────────────────────────

@router.get("/report")
def generate_report(
    asset_id: Optional[int] = Query(None),
    days:     int            = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """HTML 테스트 결과 보고서 다운로드."""
    from fastapi.responses import HTMLResponse
    since   = datetime.utcnow() - timedelta(days=days)
    q       = db.query(models.TestResult).filter(models.TestResult.started_at >= since)
    if asset_id:
        asset_obj = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
        q = q.filter(models.TestResult.asset_id == asset_id)
        asset_label = asset_obj.name if asset_obj else f"Asset {asset_id}"
    else:
        asset_label = "전체 장비"

    results = q.order_by(models.TestResult.started_at.desc()).limit(200).all()
    total   = len(results)
    passed  = sum(1 for r in results if r.status == "pass")
    failed  = sum(1 for r in results if r.status == "fail")
    errors  = total - passed - failed
    rate    = round(passed / total * 100, 1) if total else 0

    rate_color = "#52c41a" if rate >= 90 else "#faad14" if rate >= 70 else "#ff4d4f"

    rows_html = "".join(
        f"""<tr>
          <td>{r.started_at.strftime('%Y-%m-%d %H:%M') if r.started_at else ''}</td>
          <td>{r.asset.name if r.asset else r.asset_id}</td>
          <td>{r.test_name}</td>
          <td style="color:{'#52c41a' if r.status=='pass' else '#ff4d4f'};font-weight:bold">
            {'합격' if r.status=='pass' else '불합격' if r.status=='fail' else '오류'}</td>
          <td>{r.dut_id or '—'}</td>
          <td>{r.corner or '—'}</td>
          <td>{r.silicon_rev or '—'}</td>
          <td>{round(r.duration,1)}s</td>
          <td>{r.operator}</td>
        </tr>"""
        for r in results[:100]
    )

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>PMIC 테스트 보고서</title>
<style>
  body{{font-family:'Segoe UI',sans-serif;margin:30px;color:#333;}}
  h1{{color:#1890ff;border-bottom:2px solid #1890ff;padding-bottom:8px;}}
  .meta{{color:#666;margin-bottom:20px;}}
  .kpi{{display:flex;gap:16px;margin:20px 0;flex-wrap:wrap;}}
  .kpi-card{{background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;padding:16px 24px;min-width:120px;}}
  .kpi-value{{font-size:28px;font-weight:700;}}
  .kpi-label{{color:#666;font-size:13px;}}
  table{{border-collapse:collapse;width:100%;margin-top:20px;font-size:13px;}}
  th{{background:#1890ff;color:#fff;padding:8px 10px;text-align:left;}}
  td{{padding:6px 10px;border-bottom:1px solid #f0f0f0;}}
  tr:nth-child(even){{background:#fafafa;}}
  @media print{{body{{margin:10px}}}}
</style>
</head>
<body>
<h1>PMIC 테스트 결과 보고서</h1>
<div class="meta">
  <b>생성:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC &nbsp;|&nbsp;
  <b>장비:</b> {asset_label} &nbsp;|&nbsp;
  <b>기간:</b> 최근 {days}일 &nbsp;|&nbsp;
  <b>건수:</b> 최대 100건 표시
</div>
<div class="kpi">
  <div class="kpi-card"><div class="kpi-value" style="color:#1890ff">{total}</div><div class="kpi-label">총 테스트</div></div>
  <div class="kpi-card"><div class="kpi-value" style="color:#52c41a">{passed}</div><div class="kpi-label">합격</div></div>
  <div class="kpi-card"><div class="kpi-value" style="color:#ff4d4f">{failed}</div><div class="kpi-label">불합격</div></div>
  <div class="kpi-card"><div class="kpi-value" style="color:#faad14">{errors}</div><div class="kpi-label">오류</div></div>
  <div class="kpi-card"><div class="kpi-value" style="color:{rate_color}">{rate}%</div><div class="kpi-label">합격률</div></div>
</div>
<table>
<tr><th>시작 시각</th><th>장비</th><th>테스트명</th><th>결과</th><th>DUT ID</th><th>코너</th><th>Silicon Rev</th><th>소요</th><th>담당자</th></tr>
{rows_html}
</table>
</body>
</html>"""
    return HTMLResponse(content=html, media_type="text/html")
