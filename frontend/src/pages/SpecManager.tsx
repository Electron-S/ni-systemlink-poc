/**
 * Specification Manager — Feature 3: 테스트 규격 중앙 관리
 */
import { useEffect, useState } from 'react'
import {
  Table, Card, Button, Space, Typography, Modal, Form,
  Input, Select, InputNumber, Tag, Row, Col, Statistic, Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, FilterOutlined } from '@ant-design/icons'
import api, { TestSpec } from '../api/client'
import dayjs from 'dayjs'

const { Text } = Typography

const CORNERS = ['TT', 'FF', 'SS', 'FS', 'SF']
const MEASUREMENT_LABELS: Record<string, string> = {
  efficiency_pct: '변환 효율 (%)',
  vout_v:         '출력 전압 (V)',
  vin_v:          '입력 전압 (V)',
  iout_ma:        '출력 전류 (mA)',
  iin_ma:         '입력 전류 (mA)',
  ripple_mv:      '리플 전압 (mV)',
  psrr_db:        'PSRR (dB)',
  freq_khz:       '스위칭 주파수 (kHz)',
  settling_us:    '정착 시간 (μs)',
  overshoot_mv:   '오버슈트 (mV)',
  deviation_mv:   '전압 편차 (mV)',
}
const CORNER_COLOR: Record<string, string> = {
  TT: '#1890ff', FF: '#52c41a', SS: '#faad14', FS: '#722ed1', SF: '#eb2f96',
}

export default function SpecManager() {
  const [specs, setSpecs]         = useState<TestSpec[]>([])
  const [products, setProducts]   = useState<string[]>([])
  const [loading, setLoading]     = useState(true)
  const [productFilter, setProductFilter] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TestSpec | null>(null)
  const [saving, setSaving]       = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    setLoading(true)
    const params: Record<string, unknown> = { is_active: true }
    if (productFilter) params.product = productFilter
    Promise.all([
      api.get<TestSpec[]>('/specs', { params }),
      api.get<{ products: string[] }>('/specs/products'),
    ]).then(([sr, pr]) => {
      setSpecs(sr.data)
      setProducts(pr.data.products)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [productFilter])

  const openCreate = () => {
    setEditTarget(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (spec: TestSpec) => {
    setEditTarget(spec)
    form.setFieldsValue({
      product:          spec.product,
      spec_version:     spec.spec_version,
      corner:           spec.corner,
      measurement_name: spec.measurement_name,
      spec_min:         spec.spec_min,
      spec_max:         spec.spec_max,
      unit:             spec.unit,
      notes:            spec.notes,
      created_by:       spec.created_by,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        corner:     values.corner ?? null,
        spec_min:   values.spec_min ?? null,
        spec_max:   values.spec_max ?? null,
        unit:       values.unit ?? null,
        notes:      values.notes ?? null,
        created_by: values.created_by || 'engineer',
      }
      setSaving(true)
      if (editTarget) {
        await api.patch(`/specs/${editTarget.id}`, payload)
      } else {
        await api.post('/specs', payload)
      }
      setModalOpen(false)
      load()
    } catch {
      // handled by global interceptor
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    await api.delete(`/specs/${id}`).catch(() => {})
    load()
  }

  const columns = [
    {
      title: '제품',
      dataIndex: 'product',
      width: 120,
      render: (v: string) => <Tag color="geekblue">{v}</Tag>,
      filters: products.map(p => ({ text: p, value: p })),
      onFilter: (value: unknown, r: TestSpec) => r.product === value,
    },
    { title: '버전', dataIndex: 'spec_version', width: 80 },
    {
      title: '코너', dataIndex: 'corner', width: 80,
      render: (v: string | null) => v
        ? <Tag style={{ background: CORNER_COLOR[v], color: '#fff', borderColor: CORNER_COLOR[v] }}>{v}</Tag>
        : <Text type="secondary" style={{ fontSize: 11 }}>공통</Text>,
    },
    {
      title: '측정 항목', dataIndex: 'measurement_name',
      render: (v: string) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 12 }}>{MEASUREMENT_LABELS[v] ?? v}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>
        </Space>
      ),
    },
    {
      title: '규격 범위', width: 160,
      render: (_: unknown, r: TestSpec) => {
        const hasMin = r.spec_min !== null
        const hasMax = r.spec_max !== null
        if (!hasMin && !hasMax) return <Text type="secondary">—</Text>
        return (
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {hasMin ? r.spec_min : '—'} ~ {hasMax ? r.spec_max : '—'}
            {r.unit ? <Text type="secondary"> {r.unit}</Text> : null}
          </Text>
        )
      },
    },
    { title: '단위', dataIndex: 'unit', width: 60,
      render: (v: string | null) => v ?? <Text type="secondary">—</Text> },
    {
      title: '등록일', dataIndex: 'created_at', width: 120,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    { title: '작성자', dataIndex: 'created_by', width: 90 },
    {
      title: '액션', width: 100,
      render: (_: unknown, r: TestSpec) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm
            title="규격을 비활성화하시겠습니까?"
            onConfirm={() => handleDelete(r.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const uniqueProducts = new Set(specs.map(s => s.product))

  return (
    <div>
      {/* KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="총 규격" value={specs.length} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="제품 수" value={uniqueProducts.size} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="코너별 규격"
              value={specs.filter(s => s.corner !== null).length}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="공통 규격"
              value={specs.filter(s => s.corner === null).length}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        extra={
          <Space>
            <Select
              allowClear
              placeholder="제품 필터"
              style={{ width: 150 }}
              value={productFilter}
              onChange={v => setProductFilter(v ?? null)}
              options={products.map(p => ({ value: p, label: p }))}
              prefix={<FilterOutlined />}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              규격 추가
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={specs}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showTotal: t => `총 ${t}건` }}
        />
      </Card>

      {/* 규격 생성/수정 모달 */}
      <Modal
        title={editTarget ? '규격 수정' : '새 규격 추가'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editTarget ? '수정' : '추가'}
        cancelText="취소"
        confirmLoading={saving}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="product" label="제품"
                rules={[{ required: true, message: '제품명을 입력하세요' }]}>
                <Input placeholder="예: PMIC-A100" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="spec_version" label="버전" initialValue="v1.0">
                <Input placeholder="v1.0" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="corner" label="코너 (없으면 공통)">
                <Select allowClear placeholder="공통"
                  options={CORNERS.map(c => ({ value: c, label: c }))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="measurement_name" label="측정 항목"
                rules={[{ required: true, message: '측정 항목을 선택하세요' }]}>
                <Select
                  showSearch
                  placeholder="측정 항목 선택"
                  options={Object.entries(MEASUREMENT_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  filterOption={(input, opt) =>
                    (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="unit" label="단위">
                <Input placeholder="예: V, mV, %, dB" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="spec_min" label="최솟값 (Spec Min)">
                <InputNumber style={{ width: '100%' }} placeholder="없으면 비워두세요" step={0.001} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="spec_max" label="최댓값 (Spec Max)">
                <InputNumber style={{ width: '100%' }} placeholder="없으면 비워두세요" step={0.001} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="created_by" label="작성자"
                rules={[{ required: true, message: '작성자를 입력하세요' }]}>
                <Input placeholder="예: engineer" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="메모">
            <Input.TextArea rows={2} placeholder="추가 설명" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
