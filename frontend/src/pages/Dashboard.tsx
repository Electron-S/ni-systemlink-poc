import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Tag, Table, Spin, Typography, Space } from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, WarningOutlined,
  BellOutlined, RocketOutlined, ExperimentOutlined,
} from '@ant-design/icons'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import api, { SystemOverview, Alarm, TestStats } from '../api/client'
import dayjs from 'dayjs'

const { Text } = Typography

const STATUS_COLORS: Record<string, string> = {
  online: '#52c41a', offline: '#d9d9d9', warning: '#faad14', error: '#ff4d4f',
}
const SEV_COLOR: Record<string, string> = {
  critical: '#ff4d4f', warning: '#faad14', info: '#1890ff',
}

export default function Dashboard() {
  const [overview, setOverview] = useState<SystemOverview | null>(null)
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [stats, setStats] = useState<TestStats | null>(null)

  useEffect(() => {
    api.get<SystemOverview>('/systems/overview').then(r => setOverview(r.data))
    api.get<Alarm[]>('/alarms', { params: { active_only: true } }).then(r => setAlarms(r.data.slice(0, 5)))
    api.get<TestStats>('/test-results/stats', { params: { days: 7 } }).then(r => setStats(r.data))
  }, [])

  if (!overview) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  const pieData = [
    { name: 'Online',  value: overview.online,  color: STATUS_COLORS.online },
    { name: 'Offline', value: overview.offline, color: STATUS_COLORS.offline },
    { name: 'Warning', value: overview.warning, color: STATUS_COLORS.warning },
    { name: 'Error',   value: overview.error,   color: STATUS_COLORS.error },
  ].filter(d => d.value > 0)

  const alarmColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 100,
      render: (v: string) => <Tag color={SEV_COLOR[v]}>{v.toUpperCase()}</Tag>,
    },
    { title: 'Asset',   dataIndex: 'asset_name', width: 160, render: (v: string) => <Text code>{v ?? '—'}</Text> },
    { title: 'Message', dataIndex: 'message',    ellipsis: true },
    {
      title: 'Triggered',
      dataIndex: 'triggered_at',
      width: 130,
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
    },
  ]

  return (
    <div>
      {/* ── KPI cards ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Total Assets"
              value={overview.total_assets}
              prefix={<RocketOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {overview.online} online · {overview.offline} offline
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Active Alarms"
              value={overview.active_alarms}
              prefix={<BellOutlined style={{ color: overview.critical_alarms > 0 ? '#ff4d4f' : '#faad14' }} />}
              valueStyle={{ color: overview.critical_alarms > 0 ? '#ff4d4f' : '#faad14' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{overview.critical_alarms} critical</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Deployments Running"
              value={overview.deployments_running}
              prefix={<RocketOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Test Pass Rate (today)"
              value={overview.test_pass_rate}
              suffix="%"
              prefix={<ExperimentOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              precision={1}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{overview.total_tests_today} tests today</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Asset status donut */}
        <Col xs={24} lg={8}>
          <Card title="Asset Status Distribution" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 7-day test pass-rate bar chart */}
        <Col xs={24} lg={16}>
          <Card title="7-Day Test Pass Rate (%)" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={stats?.trend ?? []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Pass Rate']} />
                <Bar dataKey="pass_rate" fill="#52c41a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Recent active alarms */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title={<Space><BellOutlined style={{ color: '#ff4d4f' }} />Recent Active Alarms</Space>}>
            <Table
              dataSource={alarms}
              columns={alarmColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'No active alarms' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Asset health grid */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <AssetHealthGrid />
        </Col>
      </Row>
    </div>
  )
}

function AssetHealthGrid() {
  const [assets, setAssets] = useState<{ id: number; name: string; status: string; asset_type: string; location: string }[]>([])

  useEffect(() => {
    api.get('/assets').then(r => setAssets(r.data))
  }, [])

  return (
    <Card title="Asset Health Grid">
      <Row gutter={[8, 8]}>
        {assets.map(a => (
          <Col key={a.id} xs={12} sm={8} md={6} lg={4}>
            <div style={{
              border: `2px solid ${STATUS_COLORS[a.status]}`,
              borderRadius: 8,
              padding: '10px 12px',
              background: `${STATUS_COLORS[a.status]}15`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {a.status === 'online'  && <CheckCircleOutlined style={{ color: STATUS_COLORS.online }} />}
                {a.status === 'offline' && <CloseCircleOutlined style={{ color: STATUS_COLORS.offline }} />}
                {(a.status === 'warning' || a.status === 'error') && <WarningOutlined style={{ color: STATUS_COLORS[a.status] }} />}
                <Text strong style={{ fontSize: 12 }}>{a.name}</Text>
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{a.asset_type} · {a.location}</div>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  )
}
