import axios from 'axios'

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
