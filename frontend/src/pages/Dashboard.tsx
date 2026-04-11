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
  const [alarms, setAlarms]   = useState<Alarm[]>([])
  const [stats, setStats]     = useState<TestStats | null>(null)

  useEffect(() => {
    const fetch = () => {
      api.get<SystemOverview>('/systems/overview').then(r => setOverview(r.data))
      api.get<Alarm[]>('/alarms', { params: { active_only: true } }).then(r => setAlarms(r.data.slice(0, 5)))
      api.get<TestStats>('/test-results/stats', { params: { days: 7 } }).then(r => setStats(r.data))
    }
    fetch()
    const interval = setInterval(fetch, 30_000) // 30초마다 자동 갱신
    return () => clearInterval(interval)
  }, [])

  if (!overview) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  const pieData = [
    { name: '온라인',  value: overview.online,  color: STATUS_COLORS.online },
    { name: '오프라인', value: overview.offline, color: STATUS_COLORS.offline },
    { name: '경고',    value: overview.warning, color: STATUS_COLORS.warning },
    { name: '오류',    value: overview.error,   color: STATUS_COLORS.error },
  ].filter(d => d.value > 0)

  const alarmColumns = [
    {
      title: '심각도', dataIndex: 'severity', width: 100,
      render: (v: string) => {
        const label: Record<string, string> = { critical: '심각', warning: '경고', info: '정보' }
        return <Tag color={SEV_COLOR[v]}>{label[v] ?? v}</Tag>
      },
    },
    { title: '자산',   dataIndex: 'asset_name', width: 160, render: (v: string) => <Text code>{v ?? '—'}</Text> },
    { title: '내용',   dataIndex: 'message',    ellipsis: true },
    {
      title: '발생 시각', dataIndex: 'triggered_at', width: 130,
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
    },
  ]

  return (
    <div>
      {/* ── KPI 카드 ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="전체 자산"
              value={overview.total_assets}
              prefix={<RocketOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {overview.online} 온라인 · {overview.offline} 오프라인
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="활성 알람"
              value={overview.active_alarms}
              prefix={<BellOutlined style={{ color: overview.critical_alarms > 0 ? '#ff4d4f' : '#faad14' }} />}
              valueStyle={{ color: overview.critical_alarms > 0 ? '#ff4d4f' : '#faad14' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{overview.critical_alarms}건 심각</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="배포 진행 중"
              value={overview.deployments_running}
              prefix={<RocketOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="테스트 합격률 (오늘)"
              value={overview.test_pass_rate}
              suffix="%"
              prefix={<ExperimentOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              precision={1}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>오늘 {overview.total_tests_today}건 실행</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="자산 상태 현황" style={{ height: 320 }}>
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

        <Col xs={24} lg={16}>
          <Card title="7일 테스트 합격률 (%)" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={stats?.trend ?? []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, '합격률']} />
                <Bar dataKey="pass_rate" fill="#52c41a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title={<Space><BellOutlined style={{ color: '#ff4d4f' }} />최근 활성 알람</Space>}>
            <Table
              dataSource={alarms}
              columns={alarmColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: '활성 알람이 없습니다' }}
            />
          </Card>
        </Col>
      </Row>

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
    <Card title="자산 상태 그리드">
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
