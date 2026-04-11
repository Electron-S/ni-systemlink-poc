import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

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
}

export interface Deployment {
  id: number
  name: string
  package_name: string
  package_version: string
  target_assets: number[]
  status: 'pending' | 'running' | 'completed' | 'failed'
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
