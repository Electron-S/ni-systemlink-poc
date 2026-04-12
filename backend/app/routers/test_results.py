from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import statistics as _stats_mod
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
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
        text("SELECT DISTINCT jsonb_object_keys(measurements) FROM test_results "
             "WHERE measurements IS NOT NULL AND measurements != '{}' ORDER BY 1")
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
    VALID_GROUP_BY = {"corner", "silicon_rev", "lot_id", "recipe_version", "asset_id"}
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
