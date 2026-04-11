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
const SEV_LABEL: Record<string, string> = {
  critical: '심각', warning: '경고', info: '정보',
}
const CAT_LABEL: Record<string, string> = {
  connection: '연결', performance: '성능', calibration: '교정', system: '시스템',
}

export default function Alarms() {
  const [alarms, setAlarms]     = useState<Alarm[]>([])
  const [loading, setLoading]   = useState(true)
  const [ackModal, setAckModal] = useState<{ id: number; msg: string } | null>(null)
  const [ackBy, setAckBy]       = useState('Admin')

  const load = () => {
    setLoading(true)
    api.get<Alarm[]>('/alarms').then(r => { setAlarms(r.data); setLoading(false) })
  }

  useEffect(load, [])

  const handleAck = async () => {
    if (!ackModal) return
    await api.patch(`/alarms/${ackModal.id}/acknowledge`, null, { params: { acknowledged_by: ackBy } })
    message.success('알람이 확인 처리되었습니다')
    setAckModal(null)
    load()
  }

  const active   = alarms.filter(a => a.is_active)
  const resolved = alarms.filter(a => !a.is_active)
  const critical = active.filter(a => a.severity === 'critical')
  const warnings = active.filter(a => a.severity === 'warning')

  const buildColumns = (showAck: boolean) => [
    {
      title: '심각도', dataIndex: 'severity', width: 90,
      render: (v: string) => <Tag color={SEV_COLOR[v]}>{SEV_LABEL[v] ?? v}</Tag>,
    },
    {
      title: '분류', dataIndex: 'category', width: 100,
      render: (v: string) => <Tag>{CAT_LABEL[v] ?? v}</Tag>,
    },
    {
      title: '자산', dataIndex: 'asset_name', width: 170,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    { title: '내용', dataIndex: 'message', ellipsis: true },
    {
      title: '발생 시각', dataIndex: 'triggered_at', width: 130,
      render: (v: string) => (
        <span title={dayjs(v).format('YYYY-MM-DD HH:mm:ss')}>{dayjs(v).fromNow()}</span>
      ),
      sorter: (a: Alarm, b: Alarm) => dayjs(a.triggered_at).unix() - dayjs(b.triggered_at).unix(),
      defaultSortOrder: 'descend' as const,
    },
    ...(showAck
      ? [{
          title: '', width: 80,
          render: (_: unknown, r: Alarm) => (
            <Button
              size="small"
              icon={<CheckOutlined />}
              onClick={() => setAckModal({ id: r.id, msg: r.message })}
            >
              확인
            </Button>
          ),
        }]
      : [
          {
            title: '확인자', dataIndex: 'acknowledged_by', width: 120,
            render: (v: string) => v ?? '—',
          },
          {
            title: '확인 시각', dataIndex: 'acknowledged_at', width: 130,
            render: (v: string | null) => v ? dayjs(v).format('MM/DD HH:mm') : '—',
          },
        ]),
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="활성 알람"
              value={active.length}
              prefix={<BellOutlined />}
              valueStyle={{ color: active.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="심각" value={critical.length} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="경고" value={warnings.length} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="해결 완료" value={resolved.length} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card extra={<Button icon={<ReloadOutlined />} onClick={load}>새로고침</Button>}>
        <Tabs
          defaultActiveKey="active"
          items={[
            {
              key: 'active',
              label: <Badge count={active.length} offset={[8, 0]} color="#ff4d4f">활성 알람</Badge>,
              children: (
                <Table
                  dataSource={active}
                  columns={buildColumns(true)}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 15 }}
                  locale={{ emptyText: '활성 알람이 없습니다' }}
                />
              ),
            },
            {
              key: 'resolved',
              label: `해결됨 (${resolved.length})`,
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

      <Modal
        title="알람 확인 처리"
        open={!!ackModal}
        onOk={handleAck}
        onCancel={() => setAckModal(null)}
        okText="확인 처리"
        cancelText="취소"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{ackModal?.msg}</Text>
        <Input
          addonBefore="확인자"
          value={ackBy}
          onChange={e => setAckBy(e.target.value)}
        />
      </Modal>
    </div>
  )
}
