import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Button, Modal, Form, Input, Select,
  Space, Progress, Typography, message, Row, Col, Statistic,
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import api, { Deployment, Asset } from '../api/client'
import dayjs from 'dayjs'

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  pending: 'default', running: 'processing', completed: 'success', failed: 'error',
}

export default function Deployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
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
      message.success('Deployment created')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch (e) {
      // validation error handled by Form
    }
  }

  const handleStatusChange = async (id: number, status: string) => {
    await api.patch(`/deployments/${id}/status`, null, { params: { status } })
    load()
  }

  const columns = [
    {
      title: 'Name', dataIndex: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    { title: 'Package',  dataIndex: 'package_name' },
    { title: 'Version',  dataIndex: 'package_version', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: 'Targets', dataIndex: 'target_assets',
      render: (v: number[]) => <Tag>{v.length} assets</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', width: 130,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Progress', width: 160,
      render: (_: unknown, r: Deployment) => {
        if (r.status === 'pending') return <Text type="secondary">—</Text>
        const total = r.target_assets.length
        const done = r.success_count + r.fail_count
        const pct = total ? Math.round((done / total) * 100) : 0
        const color = r.fail_count > 0 ? '#ff4d4f' : '#52c41a'
        return (
          <div>
            <Progress percent={pct} strokeColor={color} size="small" />
            <Text style={{ fontSize: 11 }}>
              {r.success_count} ok · {r.fail_count} fail
            </Text>
          </div>
        )
      },
    },
    { title: 'Created By', dataIndex: 'created_by' },
    {
      title: 'Created', dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
    },
    {
      title: 'Actions', width: 160,
      render: (_: unknown, r: Deployment) => (
        <Space size={4}>
          {r.status === 'pending'  && <Button size="small" type="primary" onClick={() => handleStatusChange(r.id, 'running')}>Start</Button>}
          {r.status === 'running'  && <Button size="small" onClick={() => handleStatusChange(r.id, 'completed')}>Complete</Button>}
          {r.status === 'running'  && <Button size="small" danger onClick={() => handleStatusChange(r.id, 'failed')}>Fail</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Pending',   key: 'pending',   color: '#8c8c8c' },
          { label: 'Running',   key: 'running',   color: '#1890ff' },
          { label: 'Completed', key: 'completed', color: '#52c41a' },
          { label: 'Failed',    key: 'failed',    color: '#ff4d4f' },
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
            <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              New Deployment
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

      {/* Create modal */}
      <Modal
        title="New Deployment"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        okText="Create"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Deployment Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. NI-DAQmx 23.5 Update" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label="Package" name="package_name" rules={[{ required: true }]}>
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
              <Form.Item label="Version" name="package_version" rules={[{ required: true }]}>
                <Input placeholder="23.5.0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Target Assets" name="target_assets" rules={[{ required: true }]}>
            <Select
              mode="multiple"
              placeholder="Select assets"
              options={assets.map(a => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
