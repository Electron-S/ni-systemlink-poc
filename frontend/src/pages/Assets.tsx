import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Row, Col, Statistic, Drawer, Descriptions,
  Space, Button, Progress, Typography, Tooltip as AntTooltip, Badge,
} from 'antd'
import { ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api, { Asset, AssetMetrics } from '../api/client'
import { useRealtimeMetrics } from '../hooks/useWebSocket'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  online: 'success', offline: 'default', warning: 'warning', error: 'error',
}

const METRIC_HISTORY_LEN = 20

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Asset | null>(null)
  const [history, setHistory] = useState<AssetMetrics[]>([])
  const liveMetrics = useRealtimeMetrics()

  const load = () => {
    setLoading(true)
    api.get<Asset[]>('/assets').then(r => { setAssets(r.data); setLoading(false) })
  }

  useEffect(load, [])

  // Append live metrics for selected asset to chart history
  useEffect(() => {
    if (!selected) return
    const m = liveMetrics[selected.id]
    if (!m) return
    setHistory(prev => [...prev.slice(-(METRIC_HISTORY_LEN - 1)), m])
  }, [liveMetrics, selected?.id])

  const statusCounts = assets.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const columns = [
    {
      title: 'Name', dataIndex: 'name',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
      sorter: (a: Asset, b: Asset) => a.name.localeCompare(b.name),
    },
    { title: 'Model', dataIndex: 'model' },
    { title: 'Type',  dataIndex: 'asset_type', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      filters: ['online', 'offline', 'warning', 'error'].map(s => ({ text: s, value: s })),
      onFilter: (v: unknown, r: Asset) => r.status === v,
      render: (v: string) => <Badge status={STATUS_COLOR[v] as any} text={v} />,
    },
    { title: 'Location',   dataIndex: 'location' },
    { title: 'Department', dataIndex: 'department' },
    {
      title: 'Driver Ver.', dataIndex: 'driver_version',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Last Seen', dataIndex: 'last_seen', width: 130,
      render: (v: string | null) => v ? dayjs(v).fromNow() : <Text type="secondary">—</Text>,
    },
    {
      title: '', width: 60,
      render: (_: unknown, r: Asset) => (
        <Button
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={() => { setSelected(r); setHistory([]) }}
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
                title={s.charAt(0).toUpperCase() + s.slice(1)}
                value={statusCounts[s] ?? 0}
                valueStyle={{ color: { online: '#52c41a', offline: '#8c8c8c', warning: '#faad14', error: '#ff4d4f' }[s] }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        extra={<Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>}
      >
        <Table
          dataSource={assets}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15 }}
          onRow={r => ({ onClick: () => { setSelected(r); setHistory([]) } })}
          rowClassName={() => 'cursor-pointer'}
        />
      </Card>

      {/* ── Detail drawer ── */}
      <Drawer
        title={selected?.name}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={520}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Model">{selected.model}</Descriptions.Item>
              <Descriptions.Item label="Type">{selected.asset_type}</Descriptions.Item>
              <Descriptions.Item label="Serial">{selected.serial_number}</Descriptions.Item>
              <Descriptions.Item label="IP">{selected.ip_address ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Location">{selected.location}</Descriptions.Item>
              <Descriptions.Item label="Department">{selected.department}</Descriptions.Item>
              <Descriptions.Item label="Firmware">{selected.firmware_version}</Descriptions.Item>
              <Descriptions.Item label="Driver">{selected.driver_version}</Descriptions.Item>
              <Descriptions.Item label="Channels">{selected.channel_count}</Descriptions.Item>
              <Descriptions.Item label="Status"><Badge status={STATUS_COLOR[selected.status] as any} text={selected.status} /></Descriptions.Item>
            </Descriptions>

            {/* Live metrics */}
            <Card title="Live Metrics" size="small" extra={<Badge status="processing" text="live" />}>
              {liveMetrics[selected.id] ? (
                <>
                  <Row gutter={8}>
                    <Col span={12}><MetricGauge label="CPU" value={liveMetrics[selected.id].cpu_pct} unit="%" warn={80} /></Col>
                    <Col span={12}><MetricGauge label="Memory" value={liveMetrics[selected.id].memory_pct} unit="%" warn={75} /></Col>
                    <Col span={12} style={{ marginTop: 8 }}><MetricGauge label="Temp" value={liveMetrics[selected.id].temperature_c} unit="°C" warn={65} max={100} /></Col>
                    <Col span={12} style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Voltage</Text>
                      <div style={{ fontWeight: 700 }}>{liveMetrics[selected.id].voltage_v.toFixed(3)} V</div>
                    </Col>
                  </Row>

                  {history.length > 1 && (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>CPU & Temp trend</Text>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={history.map((m, i) => ({ i, cpu: m.cpu_pct, temp: m.temperature_c }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="i" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="cpu"  stroke="#1890ff" dot={false} name="CPU %" />
                          <Line type="monotone" dataKey="temp" stroke="#ff4d4f" dot={false} name="Temp °C" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <Text type="secondary">Waiting for data…</Text>
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
