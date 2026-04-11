import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Row, Col, Statistic, Select, Space,
  Typography, Segmented, Modal, Descriptions, Divider,
} from 'antd'
import {
  CheckCircleFilled, CloseCircleFilled, WarningFilled,
} from '@ant-design/icons'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import api, { TestResult, TestStats } from '../api/client'
import dayjs from 'dayjs'

const { Text, Title } = Typography

const STATUS_COLOR: Record<string, string> = {
  pass: 'success', fail: 'error', error: 'warning',
}
const STATUS_LABEL: Record<string, string> = {
  pass: '합격', fail: '불합격', error: '오류',
}

// 측정값 키에서 단위 추출
function unitFromKey(key: string): string {
  if (key.endsWith('_v'))   return 'V'
  if (key.endsWith('_ma'))  return 'mA'
  if (key.endsWith('_hz'))  return 'Hz'
  if (key.endsWith('_c'))   return '°C'
  if (key.endsWith('_pct')) return '%'
  return ''
}

function prettyKey(key: string): string {
  return key.replace(/_v$|_ma$|_hz$|_c$|_pct$/, '').replace(/_/g, ' ')
}

export default function TestResults() {
  const [results, setResults]         = useState<TestResult[]>([])
  const [stats, setStats]             = useState<TestStats | null>(null)
  const [loading, setLoading]         = useState(true)
  const [days, setDays]               = useState(7)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [selected, setSelected]       = useState<TestResult | null>(null)

  const load = () => {
    setLoading(true)
    const params: Record<string, unknown> = { days, limit: 200 }
    if (statusFilter) params.status = statusFilter
    Promise.all([
      api.get<TestResult[]>('/test-results', { params }),
      api.get<TestStats>('/test-results/stats', { params: { days } }),
    ]).then(([rr, sr]) => {
      setResults(rr.data)
      setStats(sr.data)
      setLoading(false)
    })
  }

  useEffect(load, [days, statusFilter])

  const columns = [
    {
      title: '자산', dataIndex: 'asset_name',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    { title: '테스트명', dataIndex: 'test_name' },
    {
      title: '상태', dataIndex: 'status', width: 90,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}</Tag>,
    },
    {
      title: '소요 시간', dataIndex: 'duration', width: 100,
      render: (v: number) => `${v.toFixed(1)}초`,
      sorter: (a: TestResult, b: TestResult) => a.duration - b.duration,
    },
    { title: '담당자', dataIndex: 'operator' },
    {
      title: '시작 시각', dataIndex: 'started_at', width: 130,
      render: (v: string) => dayjs(v).format('MM/DD HH:mm'),
      sorter: (a: TestResult, b: TestResult) => dayjs(a.started_at).unix() - dayjs(b.started_at).unix(),
      defaultSortOrder: 'descend' as const,
    },
  ]

  return (
    <div>
      {/* KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="전체"   value={stats?.total ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="합격"   value={stats?.passed ?? 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="불합격" value={stats?.failed ?? 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="합격률"
              value={stats?.pass_rate ?? 0}
              suffix="%"
              precision={1}
              valueStyle={{ color: (stats?.pass_rate ?? 0) >= 90 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 합격률 추이 */}
      <Card
        title="합격률 추이"
        style={{ marginBottom: 16 }}
        extra={
          <Segmented
            value={days}
            onChange={v => setDays(Number(v))}
            options={[
              { label: '7일', value: 7 },
              { label: '14일', value: 14 },
              { label: '30일', value: 30 },
            ]}
          />
        }
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={stats?.trend ?? []} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#52c41a" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#52c41a" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v) => [`${v}%`, '합격률']} />
            <Area type="monotone" dataKey="pass_rate" stroke="#52c41a" fill="url(#passGrad)" name="합격률 %" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* 결과 테이블 */}
      <Card
        extra={
          <Select
            allowClear
            placeholder="상태 필터"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={v => setStatusFilter(v ?? null)}
            options={[
              { value: 'pass',  label: '합격' },
              { value: 'fail',  label: '불합격' },
              { value: 'error', label: '오류' },
            ]}
          />
        }
      >
        <Table
          dataSource={results}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15 }}
          onRow={r => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* ── 테스트 결과 레포트 모달 ── */}
      <Modal
        title="테스트 결과 레포트"
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        width={580}
      >
        {selected && <TestReport result={selected} />}
      </Modal>
    </div>
  )
}

function TestReport({ result }: { result: TestResult }) {
  const statusConfig = {
    pass:  { icon: <CheckCircleFilled style={{ color: '#52c41a', fontSize: 36 }} />, color: '#f6ffed', border: '#b7eb8f', label: '합격' },
    fail:  { icon: <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 36 }} />, color: '#fff1f0', border: '#ffa39e', label: '불합격' },
    error: { icon: <WarningFilled     style={{ color: '#faad14', fontSize: 36 }} />, color: '#fffbe6', border: '#ffe58f', label: '오류' },
  }[result.status]

  const measurements = Object.entries(result.measurements)

  const chartData = measurements.map(([k, v]) => ({
    name: prettyKey(k),
    value: v,
    unit: unitFromKey(k),
  }))

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {/* 상태 배너 */}
      <div style={{
        background: statusConfig.color,
        border: `1px solid ${statusConfig.border}`,
        borderRadius: 8,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        {statusConfig.icon}
        <div>
          <Title level={4} style={{ margin: 0 }}>{result.test_name}</Title>
          <Text style={{ fontSize: 16, fontWeight: 600 }}>{statusConfig.label}</Text>
        </div>
      </div>

      {/* 기본 정보 */}
      <Descriptions title="기본 정보" bordered column={2} size="small">
        <Descriptions.Item label="자산" span={2}>
          <Text code>{result.asset_name ?? '—'}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="담당자">{result.operator}</Descriptions.Item>
        <Descriptions.Item label="소요 시간">{result.duration.toFixed(2)}초</Descriptions.Item>
        <Descriptions.Item label="시작">{dayjs(result.started_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        <Descriptions.Item label="완료">{dayjs(result.completed_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
      </Descriptions>

      {/* 측정값 */}
      {measurements.length > 0 && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <div>
            <Text strong style={{ fontSize: 14 }}>측정값</Text>
            <Table
              style={{ marginTop: 8 }}
              dataSource={measurements.map(([k, v]) => ({
                key: k,
                name: prettyKey(k),
                value: v,
                unit: unitFromKey(k),
              }))}
              columns={[
                { title: '항목',  dataIndex: 'name',  render: (v: string) => <Text style={{ textTransform: 'capitalize' }}>{v}</Text> },
                { title: '값',    dataIndex: 'value', render: (v: number) => <Text strong>{v}</Text>, align: 'right' as const },
                { title: '단위',  dataIndex: 'unit',  width: 60 },
              ]}
              pagination={false}
              size="small"
              showHeader
            />
          </div>

          {chartData.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>측정값 비교</Text>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, _, p) => [`${v} ${p.payload.unit}`, p.payload.name]} />
                  <Bar dataKey="value" fill="#1890ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* 메모 */}
      {result.notes && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <div>
            <Text strong>메모</Text>
            <div style={{ marginTop: 4, color: '#595959' }}>{result.notes}</div>
          </div>
        </>
      )}
    </Space>
  )
}
