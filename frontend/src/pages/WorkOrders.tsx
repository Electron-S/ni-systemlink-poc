/**
 * 작업 지시 관리 — Feature 1: Work Order + 테스트 스케줄링
 */
import { useEffect, useState } from 'react'
import {
  Table, Card, Tag, Button, Space, Typography, Modal, Form,
  Input, Select, DatePicker, Row, Col, Statistic, Tabs, Tooltip,
  Popconfirm, Badge,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import api, { Asset, WorkOrder } from '../api/client'
import dayjs from 'dayjs'

const { Text } = Typography
const { RangePicker } = DatePicker
const { TextArea } = Input

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'red', high: 'orange', normal: 'blue', low: 'default',
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: '긴급', high: '높음', normal: '보통', low: '낮음',
}
const STATUS_COLOR: Record<string, string> = {
  scheduled: 'blue', in_progress: 'processing', completed: 'success', cancelled: 'default',
}
const STATUS_LABEL: Record<string, string> = {
  scheduled: '예정', in_progress: '진행 중', completed: '완료', cancelled: '취소',
}

export default function WorkOrders() {
  const [orders, setOrders]   = useState<WorkOrder[]>([])
  const [assets, setAssets]   = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays]       = useState(30)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editTarget, setEditTarget]     = useState<WorkOrder | null>(null)
  const [saving, setSaving]             = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    const params: Record<string, unknown> = { days }
    if (statusFilter) params.status = statusFilter
    Promise.all([
      api.get<WorkOrder[]>('/work-orders', { params }),
      api.get<Asset[]>('/assets'),
    ]).then(([or, ar]) => {
      setOrders(or.data)
      setAssets(ar.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [days, statusFilter])

  const openCreate = () => {
    setEditTarget(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (order: WorkOrder) => {
    setEditTarget(order)
    form.setFieldsValue({
      title:    order.title,
      asset_id: order.asset_id,
      operator: order.operator,
      priority: order.priority,
      test_plan: order.test_plan,
      dut_id:   order.dut_id,
      notes:    order.notes,
      time_range: [
        dayjs(order.scheduled_start),
        dayjs(order.scheduled_end),
      ],
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const [start, end] = values.time_range
      const payload = {
        title:           values.title,
        asset_id:        values.asset_id,
        operator:        values.operator,
        priority:        values.priority ?? 'normal',
        test_plan:       values.test_plan ?? null,
        dut_id:          values.dut_id ?? null,
        notes:           values.notes ?? null,
        scheduled_start: start.toISOString(),
        scheduled_end:   end.toISOString(),
      }
      setSaving(true)
      if (editTarget) {
        await api.patch(`/work-orders/${editTarget.id}`, payload)
      } else {
        await api.post('/work-orders', payload)
      }
      setModalOpen(false)
      load()
    } catch {
      // validation error or API error handled by global interceptor
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id: number, status: string) => {
    await api.patch(`/work-orders/${id}`, { status }).catch(() => {})
    load()
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/work-orders/${id}`).catch(() => {})
    load()
  }

  const counts = {
    scheduled:   orders.filter(o => o.status === 'scheduled').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    completed:   orders.filter(o => o.status === 'completed').length,
    cancelled:   orders.filter(o => o.status === 'cancelled').length,
  }

  const columns = [
    {
      title: '우선순위',
      dataIndex: 'priority',
      width: 90,
      render: (v: string) => <Tag color={PRIORITY_COLOR[v]}>{PRIORITY_LABEL[v]}</Tag>,
      sorter: (a: WorkOrder, b: WorkOrder) => {
        const order = { urgent: 0, high: 1, normal: 2, low: 3 }
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
      },
    },
    {
      title: '작업 지시명', dataIndex: 'title',
      render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: '장비',
      dataIndex: 'asset_name',
      width: 180,
      render: (v: string | null) => <Text code style={{ fontSize: 11 }}>{v ?? '—'}</Text>,
    },
    { title: '담당자', dataIndex: 'operator', width: 90 },
    { title: '테스트 계획', dataIndex: 'test_plan', width: 160,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text> },
    {
      title: '예정 시작',
      dataIndex: 'scheduled_start',
      width: 140,
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
      sorter: (a: WorkOrder, b: WorkOrder) =>
        dayjs(a.scheduled_start).valueOf() - dayjs(b.scheduled_start).valueOf(),
    },
    {
      title: '예정 종료', dataIndex: 'scheduled_end', width: 140,
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
    },
    {
      title: '상태', dataIndex: 'status', width: 100,
      render: (v: string) => <Badge status={STATUS_COLOR[v] as any} text={STATUS_LABEL[v]} />,
    },
    {
      title: '액션', width: 200,
      render: (_: unknown, r: WorkOrder) => (
        <Space size={4}>
          {r.status === 'scheduled' && (
            <Tooltip title="진행 중으로 변경">
              <Button size="small" type="primary" ghost
                icon={<CheckCircleOutlined />}
                onClick={() => handleStatusChange(r.id, 'in_progress')}>
                시작
              </Button>
            </Tooltip>
          )}
          {r.status === 'in_progress' && (
            <Tooltip title="완료 처리">
              <Button size="small" type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleStatusChange(r.id, 'completed')}>
                완료
              </Button>
            </Tooltip>
          )}
          <Button size="small" icon={<EditOutlined />}
            onClick={() => openEdit(r)}>수정</Button>
          {r.status !== 'completed' && r.status !== 'cancelled' && (
            <Popconfirm title="취소하시겠습니까?" onConfirm={() => handleStatusChange(r.id, 'cancelled')}>
              <Button size="small" danger>취소</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const tabItems = [
    { key: 'all',         label: `전체 (${orders.length})` },
    { key: 'scheduled',   label: <Space><ClockCircleOutlined />예정 ({counts.scheduled})</Space> },
    { key: 'in_progress', label: <Space><CheckCircleOutlined style={{ color: '#1890ff' }} />진행 중 ({counts.in_progress})</Space> },
    { key: 'completed',   label: `완료 (${counts.completed})` },
    { key: 'cancelled',   label: `취소 (${counts.cancelled})` },
  ]

  return (
    <div>
      {/* KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {(['scheduled', 'in_progress', 'completed'] as const).map(s => (
          <Col xs={12} sm={8} key={s}>
            <Card size="small" style={{ cursor: 'pointer' }}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}>
              <Statistic
                title={STATUS_LABEL[s]}
                value={counts[s]}
                valueStyle={{ color: s === 'in_progress' ? '#1890ff' : s === 'completed' ? '#52c41a' : '#8c8c8c' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        extra={
          <Space>
            <Select
              value={days}
              style={{ width: 100 }}
              options={[{ value: 7, label: '7일' }, { value: 30, label: '30일' }, { value: 90, label: '90일' }]}
              onChange={setDays}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              새 작업 지시
            </Button>
          </Space>
        }
      >
        <Tabs
          items={tabItems}
          activeKey={statusFilter ?? 'all'}
          onChange={k => setStatusFilter(k === 'all' ? null : k)}
          style={{ marginBottom: 8 }}
        />
        <Table
          dataSource={orders}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15, showTotal: t => `총 ${t}건` }}
          rowClassName={r =>
            r.priority === 'urgent' ? 'row-urgent' :
            r.priority === 'high'   ? 'row-high'   : ''
          }
        />
      </Card>

      {/* 작업 지시 생성/수정 모달 */}
      <Modal
        title={editTarget ? '작업 지시 수정' : '새 작업 지시 생성'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editTarget ? '수정' : '생성'}
        cancelText="취소"
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="작업 지시명"
            rules={[{ required: true, message: '작업 지시명을 입력하세요' }]}>
            <Input placeholder="예: PMIC-A100 출력 전압 정확도 검사" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="asset_id" label="장비"
                rules={[{ required: true, message: '장비를 선택하세요' }]}>
                <Select
                  showSearch
                  placeholder="장비 선택"
                  options={assets.map(a => ({ value: a.id, label: a.name }))}
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="operator" label="담당자"
                rules={[{ required: true, message: '담당자를 입력하세요' }]}>
                <Input placeholder="예: 김민준" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="priority" label="우선순위" initialValue="normal">
                <Select options={[
                  { value: 'urgent', label: '긴급' },
                  { value: 'high',   label: '높음' },
                  { value: 'normal', label: '보통' },
                  { value: 'low',    label: '낮음' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="test_plan" label="테스트 계획">
                <Input placeholder="예: 출력 전압 정확도 검사" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="time_range" label="예정 시간 (시작 ~ 종료)"
            rules={[{ required: true, message: '예정 시간을 선택하세요' }]}>
            <RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dut_id" label="DUT ID">
                <Input placeholder="예: DUT-A001" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="메모">
            <TextArea rows={2} placeholder="추가 사항 입력" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
