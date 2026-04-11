import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Row, Col, Statistic, Select, Space,
  Typography, Segmented,
} from 'antd'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import api, { TestResult, TestStats } from '../api/client'
import dayjs from 'dayjs'

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  pass: 'success', fail: 'error', error: 'warning',
}

export default function TestResults() {
  const [results, setResults] = useState<TestResult[]>([])
  const [stats, setStats] = useState<TestStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const params: Record<string, unknown> = { days, limit: 200 }
    if (statusFilter) params.status = statusFilter
    Promise.all([
      api.get<TestResult[]>('/test-results', { params }),
      api.get<TestStats>('/test-results/stats', { params: { days } }),
    ]).then(([rr, sr]) => {
      setResults(rr.data)
      setStats(sr.data)
      setLoading(false)
    })
  }

  useEffect(load, [days, statusFilter])

  const columns = [
    {
      title: 'Asset', dataIndex: 'asset_name',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    { title: 'Test Name', dataIndex: 'test_name' },
    {
      title: 'Status', dataIndex: 'status', width: 90,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Duration', dataIndex: 'duration', width: 100,
      render: (v: number) => `${v.toFixed(1)} s`,
      sorter: (a: TestResult, b: TestResult) => a.duration - b.duration,
    },
    { title: 'Operator', dataIndex: 'operator' },
    {
      title: 'Started', dataIndex: 'started_at', width: 130,
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
      sorter: (a: TestResult, b: TestResult) => dayjs(a.started_at).unix() - dayjs(b.started_at).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: 'Measurements', dataIndex: 'measurements', ellipsis: true,
      render: (m: Record<string, number>) =>
        Object.entries(m).map(([k, v]) => (
          <Tag key={k} style={{ fontSize: 11 }}>{k}: {v}</Tag>
        )),
    },
  ]

  return (
    <div>
      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Total" value={stats?.total ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Passed" value={stats?.passed ?? 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Failed" value={stats?.failed ?? 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Pass Rate"
              value={stats?.pass_rate ?? 0}
              suffix="%"
              precision={1}
              valueStyle={{ color: (stats?.pass_rate ?? 0) >= 90 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Trend chart */}
      <Card title="Pass Rate Trend" style={{ marginBottom: 16 }}
        extra={
          <Segmented
            value={days}
            onChange={v => setDays(Number(v))}
            options={[
              { label: '7 days', value: 7 },
              { label: '14 days', value: 14 },
              { label: '30 days', value: 30 },
            ]}
          />
        }
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={stats?.trend ?? []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#52c41a" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#52c41a" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v) => [`${v}%`, 'Pass Rate']} />
            <Area type="monotone" dataKey="pass_rate" stroke="#52c41a" fill="url(#passGrad)" name="Pass Rate %" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Results table */}
      <Card
        extra={
          <Space>
            <Select
              allowClear
              placeholder="Filter by status"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={v => setStatusFilter(v ?? null)}
              options={[
                { value: 'pass',  label: 'Pass' },
                { value: 'fail',  label: 'Fail' },
                { value: 'error', label: 'Error' },
              ]}
            />
          </Space>
        }
      >
        <Table
          dataSource={results}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  )
}
