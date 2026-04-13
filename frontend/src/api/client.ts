import axios from 'axios'
import { message } from 'antd'

// 쓰기 작업용 API 키 (실제 환경에서는 로그인 플로우로 획득)
const ADMIN_API_KEY = 'sl-admin-key-2024'

const api = axios.create({ baseURL: '/api' })

// 쓰기 요청에 X-API-Key 헤더 자동 추가
api.interceptors.request.use(cfg => {
  if (cfg.method && ['post', 'patch', 'put', 'delete'].includes(cfg.method)) {
    cfg.headers['X-API-Key'] = ADMIN_API_KEY
  }
  return cfg
})

// 전역 에러 핸들러 — API 오류 시 Ant Design 알림 표시
api.interceptors.response.use(
  res => res,
  err => {
    const status  = err.response?.status
    const detail  = err.response?.data?.detail ?? err.message ?? '알 수 없는 오류'
    const summary = status ? `${status}: ${detail}` : detail
    message.error(`API 오류 — ${summary}`, 4)
    return Promise.reject(err)
  }
)

export default api

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Asset {
  id: number
  name: string
  model: string
  asset_type: string
  serial_number: string
  ip_address: string | null
  location: string
  department: string
  firmware_version: string
  driver_version: string
  status: 'online' | 'offline' | 'warning' | 'error'
  last_seen: string | null
  created_at: string
  channel_count: number
  tags: Record<string, string>
  calibration_due_date: string | null        // YYYY-MM-DD
  calibration_interval_days: number
  calibration_status: '유효' | '만료임박' | '만료' | '미등록'
  chassis_id:  number | null
  slot_number: number | null
}

export interface ChassisSlot {
  slot_number: number
  is_system_slot: boolean
  module: Asset | null
}

export interface ChassisView {
  chassis: Asset
  total_slots: number
  occupied: number
  slots: ChassisSlot[]
}

export interface UtilizationEntry {
  asset_id: number
  asset_name: string
  asset_type: string
  test_count: number
  pass_count: number
  pass_rate: number
  last_tested_at: string | null
}

export interface DeploymentTarget {
  id: number
  asset_id: number
  asset_name: string | null
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped'
  log: string | null
  started_at: string | null
  completed_at: string | null
}

export interface Deployment {
  id: number
  name: string
  package_name: string
  package_version: string
  targets: DeploymentTarget[]
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  created_by: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  success_count: number
  fail_count: number
  notes: string | null
}

export interface TestStep {
  seq:         number
  name:        string
  status:      'pass' | 'fail' | 'error' | 'skip'
  duration_ms: number
  error_msg:   string | null
}

export interface MeasurementDetail {
  name:      string
  condition: string
  value:     number
  unit:      string
  spec_min:  number | null
  spec_max:  number | null
  status:    'pass' | 'fail' | 'unknown'
}

export interface WaveformData {
  name:     string
  x_label:  string
  y_label:  string
  x:        number[]
  y:        number[]
  spec_min: number | null
  spec_max: number | null
  is_fail:  boolean
  meta:     string
}

export interface TestResult {
  id: number
  asset_id: number
  asset_name: string | null
  test_name: string
  status: 'pass' | 'fail' | 'error'
  duration: number
  started_at: string
  completed_at: string
  measurements: Record<string, number>
  operator: string
  notes: string | null
  // PMIC 추적성
  dut_id:         string | null
  board_rev:      string | null
  silicon_rev:    string | null
  lot_id:         string | null
  corner:         string | null
  recipe_version: string | null
  // 스텝 계층
  steps: TestStep[] | null
  // 상세 측정 + 파형
  measurement_details: MeasurementDetail[] | null
  waveform_data:       WaveformData | null
}

export interface CalibrationEvent {
  id:            number
  asset_id:      number
  performed_at:  string
  performed_by:  string
  result:        'pass' | 'fail'
  notes:         string | null
  next_due_date: string | null
}

export interface Alarm {
  id: number
  asset_id: number | null
  asset_name: string | null
  severity: 'info' | 'warning' | 'critical'
  category: string
  message: string
  is_active: boolean
  triggered_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
}

export interface SystemOverview {
  total_assets: number
  online: number
  offline: number
  warning: number
  error: number
  active_alarms: number
  critical_alarms: number
  deployments_running: number
  test_pass_rate: number
  total_tests_today: number
}

export interface TestStats {
  total: number
  passed: number
  failed: number
  errors: number
  pass_rate: number
  avg_duration_s: number
  trend: { date: string; total: number; pass: number; pass_rate: number }[]
  corner_stats: { corner: string; total: number; pass_rate: number }[]
}

export interface AssetMetrics {
  asset_id: number
  temperature_c: number
  cpu_pct: number
  memory_pct: number
  voltage_v: number
  channels_active: number
}

export interface AgentInventory {
  id: number
  package_name: string
  version: string
  install_path: string | null
  recorded_at: string
}

export interface AgentNode {
  id: number
  agent_id: string
  hostname: string
  version: string
  status: 'online' | 'offline'
  last_heartbeat: string | null
  ip_address: string | null
  capabilities: string[]
  managed_asset_ids: number[]
  inventory: AgentInventory[]
}

export interface AuditLog {
  id: number
  user_identifier: string
  action: string
  resource_type: string
  resource_id: number | null
  detail: Record<string, any>
  timestamp: string
}

// ── 파라메트릭 분석 ──────────────────────────────────────────────────────────

export interface ParametricPoint {
  value: number
  group: string
  dut_id: string | null
  status: string
  started_at: string
  test_name: string
}

export interface ParametricGroupStat {
  group: string
  count: number
  mean: number
  min: number
  max: number
  std: number
  pass_rate: number
}

export interface ParametricData {
  points: ParametricPoint[]
  stats: ParametricGroupStat[]
}

export interface CrossCell {
  total: number
  pass_rate: number | null
}

export interface CrossAnalysis {
  rows: string[]
  cols: string[]
  matrix: Record<string, Record<string, CrossCell>>
  row_label: string
  col_label: string
}

// ── WorkOrder ─────────────────────────────────────────────────────────────────

export interface WorkOrder {
  id: number
  title: string
  asset_id: number
  asset_name: string | null
  operator: string
  scheduled_start: string
  scheduled_end: string
  test_plan: string | null
  dut_id: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
}

// ── TestSpec ──────────────────────────────────────────────────────────────────

export interface TestSpec {
  id: number
  product: string
  spec_version: string
  corner: string | null
  measurement_name: string
  spec_min: number | null
  spec_max: number | null
  unit: string | null
  is_active: boolean
  created_by: string
  created_at: string
  notes: string | null
}

// ── FPY ───────────────────────────────────────────────────────────────────────

export interface FPYResult {
  overall_fpy: number
  total_duts: number
  pass_duts: number
  fail_duts: number
  fpy_by_test: { test_name: string; total: number; pass: number; fpy: number }[]
  failure_pareto: { step: string; count: number }[]
}

// ── SPC ───────────────────────────────────────────────────────────────────────

export interface SPCData {
  points: { value: number; started_at: string; status: string; dut_id: string | null }[]
  mean: number | null
  ucl: number | null
  lcl: number | null
  std: number | null
  n: number
}

// ── CrossSystemComparison ─────────────────────────────────────────────────────

export interface AgentComparisonData {
  agents: { agent_id: string; hostname: string; status: string; version: string; packages: Record<string, string> }[]
  package_names: string[]
  mismatch_packages: string[]
}

// ── Utilization Detail ────────────────────────────────────────────────────────

export interface UtilizationDetailEntry {
  date: string
  asset_name: string
  test_count: number
  pass_count: number
  pass_rate: number
  total_duration_s: number
}

// ── WebSocket ────────────────────────────────────────────────────────────────

export interface WSEvent {
  id: string   // 프론트에서 생성 (타임스탬프 기반)
  event_type:
    | 'test_completed'
    | 'alarm_triggered'
    | 'asset_status'
    | 'deployment_progress'
    | 'deployment_done'
  data: Record<string, any>
}
