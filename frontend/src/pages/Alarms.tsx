import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Button, Space, message, Typography,
  Tabs, Badge, Modal, Input, Row, Col, Statistic,
} from 'antd'
import { BellOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import api, { Alarm } from '../api/client'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Text } = Typography

const SEV_COLOR: Record<string, string> = {
  critical: 'error', warning: 'warning', info: 'processing',
}
const SEV_BG: Record<string, string> = {
  critical: '#fff1f0', warning: '#fffbe6', info: '#e6f7ff',
}

export default function Alarms() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [loading, setLoading] = useState(true)
  const [ackModal, setAckModal] = useState<{ id: number; msg: string } | null>(null)
  const [ackBy, setAckBy] = useState('Admin')

  const load = () => {
    setLoading(true)
    api.get<Alarm[]>('/alarms').then(r => { setAlarms(r.data); setLoading(false) })
  }

  useEffect(load, [])

  const handleAck = async () => {
    if (!ackModal) return
    await api.patch(`/alarms/${ackModal.id}/acknowledge`, null, { params: { acknowledged_by: ackBy } })
    message.success('Alarm acknowledged')
    setAckModal(null)
    load()
  }

  const active   = alarms.filter(a => a.is_active)
  const resolved = alarms.filter(a => !a.is_active)
  const critical = active.filter(a => a.severity === 'critical')
  const warnings = active.filter(a => a.severity === 'warning')

  const buildColumns = (showAck: boolean) => [
    {
      title: 'Severity', dataIndex: 'severity', width: 100,
      render: (v: string) => <Tag color={SEV_COLOR[v]}>{v.toUpperCase()}</Tag>,
    },
    { title: 'Category', dataIndex: 'category', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Asset', dataIndex: 'asset_name', width: 170,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    { title: 'Message', dataIndex: 'message', ellipsis: true },
    {
      title: 'Triggered', dataIndex: 'triggered_at', width: 130,
      render: (v: string) => (
        <span title={dayjs(v).format('YYYY-MM-DD HH:mm:ss')}>{dayjs(v).fromNow()}</span>
      ),
      sorter: (a: Alarm, b: Alarm) => dayjs(a.triggered_at).unix() - dayjs(b.triggered_at).unix(),
      defaultSortOrder: 'descend' as const,
    },
    ...(showAck
      ? [{
          title: '', width: 100,
          render: (_: unknown, r: Alarm) => (
            <Button
              size="small"
              icon={<CheckOutlined />}
              onClick={() => setAckModal({ id: r.id, msg: r.message })}
            >
              Ack
            </Button>
          ),
        }]
      : [
          {
            title: 'Ack By', dataIndex: 'acknowledged_by', width: 130,
            render: (v: string) => v ?? '—',
          },
          {
            title: 'Ack At', dataIndex: 'acknowledged_at', width: 130,
            render: (v: string | null) => v ? dayjs(v).format('MM/DD HH:mm') : '—',
          },
        ]),
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Active Alarms" value={active.length}
              prefix={<BellOutlined />} valueStyle={{ color: active.length > 0 ? '#ff4d4f' : '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Critical" value={critical.length} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Warnings" value={warnings.length} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Resolved (total)" value={resolved.length} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card extra={<Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>}>
        <Tabs
          defaultActiveKey="active"
          items={[
            {
              key: 'active',
              label: <span><Badge count={active.length} offset={[8, 0]} color="#ff4d4f">Active Alarms</Badge></span>,
              children: (
                <Table
                  dataSource={active}
                  columns={buildColumns(true)}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 15 }}
                  rowClassName={r => r.severity === 'critical' ? 'alarm-critical' : ''}
                  style={{ '--critical-bg': '#fff1f0' } as React.CSSProperties}
                />
              ),
            },
            {
              key: 'resolved',
              label: `Resolved (${resolved.length})`,
              children: (
                <Table
                  dataSource={resolved}
                  columns={buildColumns(false)}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 15 }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Ack modal */}
      <Modal
        title="Acknowledge Alarm"
        open={!!ackModal}
        onOk={handleAck}
        onCancel={() => setAckModal(null)}
        okText="Acknowledge"
      >
        <p style={{ marginBottom: 12 }}><Text type="secondary">{ackModal?.msg}</Text></p>
        <Input
          addonBefore="Acknowledged by"
          value={ackBy}
          onChange={e => setAckBy(e.target.value)}
        />
      </Modal>
    </div>
  )
}
