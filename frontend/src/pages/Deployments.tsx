import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Button, Modal, Form, Input, Select,
  Space, Progress, Typography, message, Row, Col, Statistic,
  Drawer, Descriptions, Badge,
} from 'antd'
import { PlusOutlined, ReloadOutlined, PlayCircleOutlined, StopOutlined, InfoCircleOutlined } from '@ant-design/icons'
import api, { Deployment, DeploymentTarget, Asset } from '../api/client'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useRealtimeMetrics } from '../hooks/useWebSocket'

dayjs.extend(relativeTime)

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  pending:   'default',
  queued:    'processing',
  running:   'processing',
  succeeded: 'success',
  failed:    'error',
  cancelled: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  pending:   '대기',
  queued:    '큐 등록',
  running:   '진행 중',
  succeeded: '성공',
  failed:    '실패',
  cancelled: '취소됨',
}
const TARGET_STATUS_COLOR: Record<string, string> = {
  pending:   'default',
  running:   'processing',
  succeeded: 'success',
  failed:    'error',
  skipped:   'warning',
}
const TARGET_STATUS_LABEL: Record<string, string> = {
  pending: '대기', running: '진행', succeeded: '성공', failed: '실패', skipped: '건너뜀',
}

const PACKAGES = [
  'NI-SMU Driver', 'NI-DMM Driver', 'NI-Scope Driver',
  'PMIC TestStand Seq', 'PMIC Calibration Suite',
]

export default function Deployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [assets, setAssets]           = useState<Asset[]>([])
  const [loading, setLoading]         = useState(true)
  const [modalOpen, setModalOpen]     = useState(false)
  const [selected, setSelected]       = useState<Deployment | null>(null)
  const [form] = Form.useForm()
  const { events } = useRealtimeMetrics()

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<Deployment[]>('/deployments'),
      api.get<Asset[]>('/assets'),
    ]).then(([dr, ar]) => {
      setDeployments(dr.data)
      setAssets(ar.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [])

  // 배포 완료 이벤트 시 자동 새로고침
  useEffect(() => {
    if (events.length === 0) return
    const e = events[0]
    if (e.event_type === 'deployment_done' || e.event_type === 'deployment_progress') {
      load()
    }
  }, [events.length > 0 ? events[0].id : null])

  const statusCounts = deployments.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await api.post('/deployments', { ...values, created_by: 'admin' })
      message.success('배포가 생성되었습니다')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (_) {}
  }

  const handleQueue = async (id: number) => {
    try {
      await api.post(`/deployments/${id}/queue`, {})
      message.success('배포가 대기열에 등록되었습니다')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '오류가 발생했습니다')
    }
  }

  const handleCancel = async (id: number) => {
    try {
      await api.post(`/deployments/${id}/cancel`, {})
      message.success('배포가 취소되었습니다')
      load()
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '오류가 발생했습니다')
    }
  }

  const columns = [
    {
      title: '배포명', dataIndex: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    { title: '패키지', dataIndex: 'package_name' },
    { title: '버전', dataIndex: 'package_version', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: '대상 장비', dataIndex: 'targets',
      render: (v: DeploymentTarget[]) => <Tag style={{ cursor: 'default' }}>{v.length}개 장비</Tag>,
    },
    {
      title: '상태', dataIndex: 'status', width: 100,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: '진행률', width: 170,
      render: (_: unknown, r: Deployment) => {
        if (r.status === 'pending' || r.status === 'queued') return <Text type="secondary">—</Text>
        const total = r.targets.length
        const done  = r.success_count + r.fail_count
        const pct   = total ? Math.round((done / total) * 100) : 0
        const color = r.fail_count > 0 ? '#ff4d4f' : '#52c41a'
        return (
          <div>
            <Progress percent={pct} strokeColor={color} size="small" />
            <Text style={{ fontSize: 11 }}>{r.success_count} 성공 · {r.fail_count} 실패</Text>
          </div>
        )
      },
    },
    { title: '생성자', dataIndex: 'created_by' },
    {
      title: '생성일', dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
    },
    {
      title: '작업', width: 160,
      render: (_: unknown, r: Deployment) => (
        <Space size={4} onClick={e => e.stopPropagation()}>
          {r.status === 'pending' && (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />}
              onClick={() => handleQueue(r.id)}>
              실행
            </Button>
          )}
          {(r.status === 'pending' || r.status === 'queued') && (
            <Button size="small" danger icon={<StopOutlined />}
              onClick={() => handleCancel(r.id)}>
              취소
            </Button>
          )}
          <Button size="small" icon={<InfoCircleOutlined />}
            onClick={() => setSelected(r)}>
            상세
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { label: '대기',    key: 'pending',   color: '#8c8c8c' },
          { label: '큐 등록', key: 'queued',    color: '#1890ff' },
          { label: '진행 중', key: 'running',   color: '#722ed1' },
          { label: '성공',    key: 'succeeded', color: '#52c41a' },
          { label: '실패',    key: 'failed',    color: '#ff4d4f' },
          { label: '취소',    key: 'cancelled', color: '#faad14' },
        ].map(s => (
          <Col key={s.key} xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic title={s.label} value={statusCounts[s.key] ?? 0} valueStyle={{ color: s.color }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>새로고침</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              새 배포
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={deployments}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10 }}
          onRow={r => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* ── 새 배포 모달 ── */}
      <Modal
        title="새 배포 생성"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        okText="생성"
        cancelText="취소"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="배포명" name="name" rules={[{ required: true, message: '배포명을 입력하세요' }]}>
            <Input placeholder="예: PMIC TestStand 3.2.1 업데이트" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="패키지" name="package_name" rules={[{ required: true }]}>
                <Select options={PACKAGES.map(p => ({ value: p, label: p }))} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="버전" name="package_version" rules={[{ required: true }]}>
                <Input placeholder="23.5.0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="대상 장비" name="target_asset_ids" rules={[{ required: true, message: '장비를 선택하세요' }]}>
            <Select
              mode="multiple"
              placeholder="장비를 선택하세요"
              options={assets.map(a => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>
          <Form.Item label="메모" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 배포 상세 Drawer ── */}
      <Drawer
        title={selected?.name}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={560}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="패키지" span={2}>
                {selected.package_name} <Tag color="blue">{selected.package_version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="상태">
                <Tag color={STATUS_COLOR[selected.status]}>{STATUS_LABEL[selected.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="생성자">{selected.created_by}</Descriptions.Item>
              <Descriptions.Item label="생성일">
                {dayjs(selected.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="시작">
                {selected.started_at ? dayjs(selected.started_at).format('MM/DD HH:mm') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="완료" span={2}>
                {selected.completed_at ? dayjs(selected.completed_at).format('MM/DD HH:mm') : '—'}
              </Descriptions.Item>
              {selected.notes && (
                <Descriptions.Item label="메모" span={2}>{selected.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <Card title="대상 장비 실행 현황" size="small">
              <Table
                dataSource={selected.targets}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: '장비', dataIndex: 'asset_name',
                    render: (v: string | null, r: DeploymentTarget) =>
                      <Text code style={{ fontSize: 12 }}>{v ?? `#${r.asset_id}`}</Text>,
                  },
                  {
                    title: '상태', dataIndex: 'status', width: 90,
                    render: (v: string) => <Badge status={TARGET_STATUS_COLOR[v] as any} text={TARGET_STATUS_LABEL[v]} />,
                  },
                  {
                    title: '로그', dataIndex: 'log',
                    render: (v: string | null) => v
                      ? <Text type={v.startsWith('[OK]') ? 'success' : 'danger'} style={{ fontSize: 11 }}>{v}</Text>
                      : <Text type="secondary">—</Text>,
                  },
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  )
}
