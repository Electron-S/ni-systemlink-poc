import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Row, Col, Statistic, Drawer, Descriptions,
  Space, Button, Progress, Typography, Badge, Input,
} from 'antd'
import { ReloadOutlined, InfoCircleOutlined, SearchOutlined, RobotOutlined } from '@ant-design/icons'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api, { Asset, AssetMetrics, AgentNode } from '../api/client'
import { useRealtimeMetrics } from '../hooks/useWebSocket'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  online: 'success', offline: 'default', warning: 'warning', error: 'error',
}
const STATUS_LABEL: Record<string, string> = {
  online: '온라인', offline: '오프라인', warning: '경고', error: '오류',
}

const METRIC_HISTORY_LEN = 20

export default function Assets() {
  const [assets, setAssets]   = useState<Asset[]>([])
  const [agents, setAgents]   = useState<AgentNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState<Asset | null>(null)
  const [history, setHistory]   = useState<AssetMetrics[]>([])
  const { metrics: liveMetrics, events } = useRealtimeMetrics()

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<Asset[]>('/assets'),
      api.get<AgentNode[]>('/agents'),
    ]).then(([ar, agr]) => {
      setAssets(ar.data)
      setAgents(agr.data)
      setLoading(false)
    })
  }

  // selected 자산을 관리하는 에이전트 찾기
  const managingAgent = selected
    ? agents.find(ag => (ag.managed_asset_ids ?? []).includes(selected.id)) ?? null
    : null

  useEffect(load, [])

  // 장비 상태 변경 이벤트 실시간 반영
  useEffect(() => {
    if (events.length === 0) return
    const e = events[0]
    if (e.event_type === 'asset_status') {
      setAssets(prev => prev.map(a =>
        a.id === e.data.id ? { ...a, status: e.data.new_status } : a
      ))
    }
  }, [events.length > 0 ? events[0].id : null])

  useEffect(() => {
    if (!selected) return
    const m = liveMetrics[selected.id]
    if (!m) return
    setHistory(prev => [...prev.slice(-(METRIC_HISTORY_LEN - 1)), m])
  }, [liveMetrics, selected?.id])

  const filtered = assets.filter(a =>
    search === '' ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.model.toLowerCase().includes(search.toLowerCase()) ||
    a.location.toLowerCase().includes(search.toLowerCase()) ||
    a.department.toLowerCase().includes(search.toLowerCase())
  )

  const statusCounts = assets.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const columns = [
    {
      title: '장비명', dataIndex: 'name',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
      sorter: (a: Asset, b: Asset) => a.name.localeCompare(b.name),
    },
    { title: '모델', dataIndex: 'model' },
    { title: '유형', dataIndex: 'asset_type', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '상태', dataIndex: 'status', width: 110,
      filters: ['online', 'offline', 'warning', 'error'].map(s => ({ text: STATUS_LABEL[s], value: s })),
      onFilter: (v: unknown, r: Asset) => r.status === v,
      render: (v: string) => <Badge status={STATUS_COLOR[v] as any} text={STATUS_LABEL[v]} />,
    },
    { title: '위치',   dataIndex: 'location' },
    { title: '부서',   dataIndex: 'department' },
    {
      title: '드라이버', dataIndex: 'driver_version',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '마지막 접속', dataIndex: 'last_seen', width: 130,
      render: (v: string | null) => v ? dayjs(v).fromNow() : <Text type="secondary">—</Text>,
    },
    {
      title: '', width: 60,
      render: (_: unknown, r: Asset) => (
        <Button
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={e => { e.stopPropagation(); setSelected(r); setHistory([]) }}
        />
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {['online', 'offline', 'warning', 'error'].map(s => (
          <Col key={s} xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title={STATUS_LABEL[s]}
                value={statusCounts[s] ?? 0}
                valueStyle={{ color: { online: '#52c41a', offline: '#8c8c8c', warning: '#faad14', error: '#ff4d4f' }[s] }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        extra={
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="장비명, 모델, 위치, 부서 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              style={{ width: 240 }}
            />
            <Button icon={<ReloadOutlined />} onClick={load}>새로고침</Button>
          </Space>
        }
      >
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15 }}
          onRow={r => ({ onClick: () => { setSelected(r); setHistory([]) }, style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* ── 상세 Drawer ── */}
      <Drawer
        title={selected?.name}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={520}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="모델">{selected.model}</Descriptions.Item>
              <Descriptions.Item label="유형">{selected.asset_type}</Descriptions.Item>
              <Descriptions.Item label="시리얼">{selected.serial_number}</Descriptions.Item>
              <Descriptions.Item label="IP">{selected.ip_address ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="위치">{selected.location}</Descriptions.Item>
              <Descriptions.Item label="부서">{selected.department}</Descriptions.Item>
              <Descriptions.Item label="펌웨어">{selected.firmware_version}</Descriptions.Item>
              <Descriptions.Item label="드라이버">{selected.driver_version}</Descriptions.Item>
              <Descriptions.Item label="채널 수">{selected.channel_count}</Descriptions.Item>
              <Descriptions.Item label="상태">
                <Badge status={STATUS_COLOR[selected.status] as any} text={STATUS_LABEL[selected.status]} />
              </Descriptions.Item>
            </Descriptions>

            {/* 관리 에이전트 */}
            <Card title="관리 에이전트" size="small" extra={<RobotOutlined />}>
              {managingAgent ? (
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="에이전트 ID">
                    <Text code style={{ fontSize: 11 }}>{managingAgent.agent_id}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="호스트명">{managingAgent.hostname}</Descriptions.Item>
                  <Descriptions.Item label="상태">
                    <Badge
                      status={managingAgent.status === 'online' ? 'success' : 'default'}
                      text={managingAgent.status === 'online' ? '온라인' : '오프라인'}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="마지막 heartbeat">
                    {managingAgent.last_heartbeat ? dayjs(managingAgent.last_heartbeat).fromNow() : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="역량">
                    <Space size={4} wrap>
                      {managingAgent.capabilities.map(c => <Tag key={c} style={{ fontSize: 10 }}>{c}</Tag>)}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">이 자산을 관리하는 에이전트가 없습니다</Text>
              )}
            </Card>

            <Card title="실시간 메트릭" size="small" extra={<Badge status="processing" text="실시간" />}>
              {liveMetrics[selected.id] ? (
                <>
                  <Row gutter={8}>
                    <Col span={12}><MetricGauge label="CPU" value={liveMetrics[selected.id].cpu_pct} unit="%" warn={80} /></Col>
                    <Col span={12}><MetricGauge label="메모리" value={liveMetrics[selected.id].memory_pct} unit="%" warn={75} /></Col>
                    <Col span={12} style={{ marginTop: 8 }}><MetricGauge label="온도" value={liveMetrics[selected.id].temperature_c} unit="°C" warn={65} max={100} /></Col>
                    <Col span={12} style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>전압</Text>
                      <div style={{ fontWeight: 700 }}>{liveMetrics[selected.id].voltage_v.toFixed(3)} V</div>
                    </Col>
                  </Row>

                  {history.length > 1 && (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>CPU & 온도 추이</Text>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={history.map((m, i) => ({ i, cpu: m.cpu_pct, temp: m.temperature_c }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="i" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="cpu"  stroke="#1890ff" dot={false} name="CPU %" />
                          <Line type="monotone" dataKey="temp" stroke="#ff4d4f" dot={false} name="온도 °C" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <Text type="secondary">데이터 수신 대기 중…</Text>
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  )
}

function MetricGauge({ label, value, unit, warn, max = 100 }: {
  label: string; value: number; unit: string; warn: number; max?: number
}) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value >= warn ? '#ff4d4f' : value >= warn * 0.8 ? '#faad14' : '#52c41a'
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{value}{unit}</div>
      <Progress percent={Math.round(pct)} showInfo={false} strokeColor={color} size="small" />
    </div>
  )
}
