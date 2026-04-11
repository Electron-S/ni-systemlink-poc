import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Button, Modal, Form, Input, Select,
  Space, Progress, Typography, message, Row, Col, Statistic, Popover,
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import api, { Deployment, Asset } from '../api/client'
import dayjs from 'dayjs'

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  pending: 'default', running: 'processing', completed: 'success', failed: 'error',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '대기', running: '진행 중', completed: '완료', failed: '실패',
}

export default function Deployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [assets, setAssets]           = useState<Asset[]>([])
  const [loading, setLoading]         = useState(true)
  const [modalOpen, setModalOpen]     = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<Deployment[]>('/deployments'),
      api.get<Asset[]>('/assets'),
    ]).then(([dr, ar]) => {
      setDeployments(dr.data)
      setAssets(ar.data)
      setLoading(false)
    })
  }

  useEffect(load, [])

  const statusCounts = deployments.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await api.post('/deployments', { ...values, created_by: 'Admin' })
      message.success('배포가 생성되었습니다')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (_) {}
  }

  const handleStatusChange = async (id: number, status: string) => {
    await api.patch(`/deployments/${id}/status`, null, { params: { status } })
    load()
  }

  const assetName = (id: number) => assets.find(a => a.id === id)?.name ?? `#${id}`

  const columns = [
    {
      title: '배포명', dataIndex: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    { title: '패키지',  dataIndex: 'package_name' },
    { title: '버전',    dataIndex: 'package_version', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: '대상 장비', dataIndex: 'target_assets',
      render: (v: number[]) => (
        <Popover
          title="대상 장비 목록"
          content={
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {v.map(id => (
                <div key={id} style={{ padding: '2px 0', fontSize: 13 }}>
                  <Text code style={{ fontSize: 12 }}>{assetName(id)}</Text>
                </div>
              ))}
            </div>
          }
        >
          <Tag style={{ cursor: 'pointer' }}>{v.length}개 장비 ▾</Tag>
        </Popover>
      ),
    },
    {
      title: '상태', dataIndex: 'status', width: 110,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: '진행률', width: 160,
      render: (_: unknown, r: Deployment) => {
        if (r.status === 'pending') return <Text type="secondary">—</Text>
        const total = r.target_assets.length
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
    { title: '생성자',  dataIndex: 'created_by' },
    {
      title: '생성일', dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
    },
    {
      title: '작업', width: 160,
      render: (_: unknown, r: Deployment) => (
        <Space size={4}>
          {r.status === 'pending' && <Button size="small" type="primary" onClick={() => handleStatusChange(r.id, 'running')}>시작</Button>}
          {r.status === 'running' && <Button size="small" onClick={() => handleStatusChange(r.id, 'completed')}>완료</Button>}
          {r.status === 'running' && <Button size="small" danger onClick={() => handleStatusChange(r.id, 'failed')}>실패</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { label: '대기',    key: 'pending',   color: '#8c8c8c' },
          { label: '진행 중', key: 'running',   color: '#1890ff' },
          { label: '완료',    key: 'completed', color: '#52c41a' },
          { label: '실패',    key: 'failed',    color: '#ff4d4f' },
        ].map(s => (
          <Col key={s.key} xs={12} sm={6}>
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
        />
      </Card>

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
            <Input placeholder="예: NI-DAQmx 23.5 업데이트" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="패키지" name="package_name" rules={[{ required: true, message: '패키지를 선택하세요' }]}>
                <Select options={[
                  { value: 'NI-DAQmx',         label: 'NI-DAQmx' },
                  { value: 'NI-VISA',           label: 'NI-VISA' },
                  { value: 'LabVIEW Runtime',   label: 'LabVIEW Runtime' },
                  { value: 'TestStand',         label: 'TestStand' },
                  { value: 'NI-488.2',          label: 'NI-488.2' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="버전" name="package_version" rules={[{ required: true, message: '버전을 입력하세요' }]}>
                <Input placeholder="23.5.0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="대상 장비" name="target_assets" rules={[{ required: true, message: '장비를 선택하세요' }]}>
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
    </div>
  )
}
