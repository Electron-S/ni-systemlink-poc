import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Row, Col, Statistic, Select, Space,
  Typography, Segmented, Modal, Descriptions, Divider,
  Input, DatePicker, Badge, Drawer, Timeline, Spin, Button,
} from 'antd'
import type { RangePickerProps } from 'antd/es/date-picker'
import {
  CheckCircleFilled, CloseCircleFilled, WarningFilled, HistoryOutlined, PrinterOutlined,
} from '@ant-design/icons'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import api, { TestResult, TestStats, Asset } from '../api/client'
import dayjs from 'dayjs'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

const CORNERS   = ['TT', 'FF', 'SS', 'FS', 'SF']
const SIL_REVS  = ['ES1.0', 'ES1.1', 'ES2.0', 'MP1.0']
const CORNER_COLORS: Record<string, string> = {
  TT: '#1890ff', FF: '#52c41a', SS: '#faad14', FS: '#722ed1', SF: '#eb2f96',
}

const STATUS_COLOR: Record<string, string> = { pass: 'success', fail: 'error', error: 'warning' }
const STATUS_LABEL: Record<string, string> = { pass: '합격', fail: '불합격', error: '오류' }

function unitFromKey(key: string): string {
  if (key.endsWith('_v'))   return 'V'
  if (key.endsWith('_ma'))  return 'mA'
  if (key.endsWith('_hz') || key.endsWith('_khz')) return key.endsWith('_khz') ? 'kHz' : 'Hz'
  if (key.endsWith('_c'))   return '°C'
  if (key.endsWith('_pct')) return '%'
  if (key.endsWith('_db'))  return 'dB'
  if (key.endsWith('_us'))  return 'μs'
  if (key.endsWith('_mv'))  return 'mV'
  return ''
}

function prettyKey(key: string): string {
  return key.replace(/_v$|_ma$|_hz$|_khz$|_c$|_pct$|_db$|_us$|_mv$/, '').replace(/_/g, ' ')
}

export default function TestResults() {
  const [results, setResults]     = useState<TestResult[]>([])
  const [stats, setStats]         = useState<TestStats | null>(null)
  const [assets, setAssets]       = useState<Asset[]>([])
  const [loading, setLoading]     = useState(true)
  const [days, setDays]           = useState(7)
  const [selected, setSelected]   = useState<TestResult | null>(null)

  // DUT 이력 드로어 (시나리오 10)
  const [dutId, setDutId]           = useState<string | null>(null)
  const [dutHistory, setDutHistory] = useState<TestResult[]>([])
  const [dutLoading, setDutLoading] = useState(false)

  const openDutHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDutId(id)
    setDutLoading(true)
    api.get<TestResult[]>('/test-results', { params: { dut_id: id, limit: 100, days: 90 } })
      .then(r => { setDutHistory(r.data); setDutLoading(false) })
  }

  // 필터 상태
  const [statusFilter,     setStatusFilter]     = useState<string | null>(null)
  const [assetFilter,      setAssetFilter]      = useState<number | null>(null)
  const [cornerFilter,     setCornerFilter]     = useState<string | null>(null)
  const [silRevFilter,     setSilRevFilter]     = useState<string | null>(null)
  const [dutFilter,        setDutFilter]        = useState('')
  const [dateRange,        setDateRange]        = useState<[string, string] | null>(null)

  useEffect(() => {
    api.get<Asset[]>('/assets').then(r => setAssets(r.data))
  }, [])

  const load = () => {
    setLoading(true)
    const params: Record<string, unknown> = { limit: 300 }
    if (dateRange) {
      params.date_from = dateRange[0]
      params.date_to   = dateRange[1]
    } else {
      params.days = days
    }
    if (statusFilter)  params.status      = statusFilter
    if (assetFilter)   params.asset_id    = assetFilter
    if (cornerFilter)  params.corner      = cornerFilter
    if (silRevFilter)  params.silicon_rev = silRevFilter
    if (dutFilter)     params.dut_id      = dutFilter

    Promise.all([
      api.get<TestResult[]>('/test-results', { params }),
      api.get<TestStats>('/test-results/stats', { params }),
    ]).then(([rr, sr]) => {
      setResults(rr.data)
      setStats(sr.data)
      setLoading(false)
    })
  }

  useEffect(load, [days, statusFilter, assetFilter, cornerFilter, silRevFilter, dutFilter, dateRange])

  const columns = [
    {
      title: '자산', dataIndex: 'asset_name',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    { title: '테스트명', dataIndex: 'test_name' },
    {
      title: 'DUT', dataIndex: 'dut_id',
      render: (v: string | null) => v
        ? <Tag style={{ fontSize: 11, cursor: 'pointer' }} icon={<HistoryOutlined />}
            onClick={e => openDutHistory(v, e)}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '코너', dataIndex: 'corner',
      render: (v: string | null) => v
        ? <Tag color={CORNER_COLORS[v] ?? 'default'} style={{ fontSize: 11 }}>{v}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Si Rev', dataIndex: 'silicon_rev',
      render: (v: string | null) => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <Text type="secondary">—</Text>,
    },
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

  const cornerStats = (stats as any)?.corner_stats ?? []

  return (
    <div>
      {/* KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="전체"   value={stats?.total ?? 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="합격"   value={stats?.passed ?? 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="불합격" value={stats?.failed ?? 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="합격률" value={stats?.pass_rate ?? 0} suffix="%" precision={1}
              valueStyle={{ color: (stats?.pass_rate ?? 0) >= 90 ? '#52c41a' : '#faad14' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* 합격률 추이 */}
        <Col xs={24} lg={16}>
          <Card title="합격률 추이" extra={
            <Segmented value={days} onChange={v => setDays(Number(v))}
              options={[{ label: '7일', value: 7 }, { label: '14일', value: 14 }, { label: '30일', value: 30 }]} />
          }>
            <ResponsiveContainer width="100%" height={180}>
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
        </Col>

        {/* 코너별 합격률 */}
        <Col xs={24} lg={8}>
          <Card title="공정 코너별 합격률">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cornerStats} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="corner" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, '합격률']} />
                <Bar dataKey="pass_rate" radius={[4, 4, 0, 0]}>
                  {cornerStats.map((entry: any) => (
                    <Cell key={entry.corner} fill={CORNER_COLORS[entry.corner] ?? '#1890ff'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 결과 테이블 */}
      <Card
        extra={
          <Space wrap>
            <Select allowClear placeholder="자산" style={{ width: 180 }} value={assetFilter}
              onChange={v => setAssetFilter(v ?? null)}
              options={assets.map(a => ({ value: a.id, label: a.name }))} />
            <Select allowClear placeholder="상태" style={{ width: 100 }} value={statusFilter}
              onChange={v => setStatusFilter(v ?? null)}
              options={[{ value: 'pass', label: '합격' }, { value: 'fail', label: '불합격' }, { value: 'error', label: '오류' }]} />
            <Select allowClear placeholder="코너" style={{ width: 90 }} value={cornerFilter}
              onChange={v => setCornerFilter(v ?? null)}
              options={CORNERS.map(c => ({ value: c, label: c }))} />
            <Select allowClear placeholder="Si Rev" style={{ width: 110 }} value={silRevFilter}
              onChange={v => setSilRevFilter(v ?? null)}
              options={SIL_REVS.map(r => ({ value: r, label: r }))} />
            <Input.Search placeholder="DUT ID" style={{ width: 140 }} allowClear
              onSearch={v => setDutFilter(v)} onClear={() => setDutFilter('')} />
            <RangePicker size="small" style={{ width: 220 }}
              onChange={(_, s) => setDateRange(s[0] && s[1] ? [s[0], s[1]] : null)} />
          </Space>
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

      <Modal
        title="테스트 결과 레포트"
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={
          <Button
            icon={<PrinterOutlined />}
            onClick={() => {
              if (!selected) return
              const el = document.getElementById('test-report-print')
              if (!el) return
              const win = window.open('', '_blank')!
              win.document.write(`<html><head><title>${selected.test_name} 리포트</title>
                <style>
                  body{font-family:sans-serif;margin:24px;font-size:13px}
                  table{border-collapse:collapse;width:100%}
                  td,th{border:1px solid #ddd;padding:6px 10px}
                  .pass{color:#52c41a;font-weight:bold}
                  .fail{color:#ff4d4f;font-weight:bold}
                  .error{color:#faad14;font-weight:bold}
                  @media print{button{display:none}}
                </style></head><body>`)
              win.document.write(el.innerHTML)
              win.document.write('</body></html>')
              win.document.close()
              setTimeout(() => win.print(), 400)
            }}
          >
            PDF 출력
          </Button>
        }
        width={620}>
        {selected && <div id="test-report-print"><TestReport result={selected} /></div>}
      </Modal>

      {/* DUT 이력 드로어 — 시나리오 10: DUT 기준 테스트 추적성 */}
      <Drawer
        title={
          <Space>
            <HistoryOutlined />
            <span>DUT 이력</span>
            {dutId && <Tag>{dutId}</Tag>}
            {!dutLoading && <Badge count={dutHistory.length} overflowCount={999} style={{ background: '#1890ff' }} />}
          </Space>
        }
        open={!!dutId}
        onClose={() => { setDutId(null); setDutHistory([]) }}
        width={560}
      >
        <Spin spinning={dutLoading}>
          {dutHistory.length > 0 ? (
            <Timeline
              items={dutHistory.map(r => ({
                color: r.status === 'pass' ? 'green' : r.status === 'fail' ? 'red' : 'orange',
                dot: r.status === 'pass'
                  ? <CheckCircleFilled style={{ color: '#52c41a' }} />
                  : r.status === 'fail'
                  ? <CloseCircleFilled style={{ color: '#ff4d4f' }} />
                  : <WarningFilled style={{ color: '#faad14' }} />,
                children: (
                  <div style={{ paddingBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text strong style={{ fontSize: 13 }}>{r.test_name}</Text>
                      <Tag color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Tag>
                    </div>
                    <div style={{ color: '#8c8c8c', fontSize: 11, marginTop: 2 }}>
                      {dayjs(r.started_at).format('YYYY-MM-DD HH:mm')} · {r.duration.toFixed(1)}초 · {r.asset_name ?? '—'}
                    </div>
                    <Space size={4} style={{ marginTop: 4 }} wrap>
                      {r.corner    && <Tag color={CORNER_COLORS[r.corner]}    style={{ fontSize: 10 }}>{r.corner}</Tag>}
                      {r.silicon_rev && <Tag style={{ fontSize: 10 }}>{r.silicon_rev}</Tag>}
                      {r.lot_id    && <Tag color="cyan"    style={{ fontSize: 10 }}>{r.lot_id}</Tag>}
                      {r.recipe_version && <Tag color="blue" style={{ fontSize: 10 }}>{r.recipe_version}</Tag>}
                    </Space>
                    {Object.entries(r.measurements).length > 0 && (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#595959' }}>
                        {Object.entries(r.measurements).slice(0, 3).map(([k, v]) =>
                          `${prettyKey(k)}: ${v}${unitFromKey(k)}`
                        ).join(' · ')}
                        {Object.entries(r.measurements).length > 3 && ' · …'}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            !dutLoading && <Text type="secondary">이력 없음</Text>
          )}
        </Spin>
      </Drawer>
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
    name: prettyKey(k), value: v, unit: unitFromKey(k),
  }))

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {/* 상태 배너 */}
      <div style={{
        background: statusConfig.color, border: `1px solid ${statusConfig.border}`,
        borderRadius: 8, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {statusConfig.icon}
        <div>
          <Title level={4} style={{ margin: 0 }}>{result.test_name}</Title>
          <Text style={{ fontSize: 16, fontWeight: 600 }}>{statusConfig.label}</Text>
        </div>
      </div>

      {/* PMIC 추적성 */}
      <Descriptions title="추적성 정보" bordered column={3} size="small">
        <Descriptions.Item label="DUT ID" span={2}>
          {result.dut_id ? <Tag>{result.dut_id}</Tag> : <Text type="secondary">—</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="공정 코너">
          {result.corner ? <Tag color={CORNER_COLORS[result.corner]}>{result.corner}</Tag> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Board Rev">
          {result.board_rev ?? <Text type="secondary">—</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Si Rev">
          {result.silicon_rev ?? <Text type="secondary">—</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Lot ID">
          {result.lot_id ?? <Text type="secondary">—</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="레시피 버전" span={3}>
          {result.recipe_version ? <Tag color="blue">{result.recipe_version}</Tag> : <Text type="secondary">—</Text>}
        </Descriptions.Item>
      </Descriptions>

      {/* 기본 정보 */}
      <Descriptions title="실행 정보" bordered column={2} size="small">
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
                key: k, name: prettyKey(k), value: v, unit: unitFromKey(k),
              }))}
              columns={[
                { title: '항목', dataIndex: 'name', render: (v: string) => <Text style={{ textTransform: 'capitalize' }}>{v}</Text> },
                { title: '값',   dataIndex: 'value', render: (v: number) => <Text strong>{v}</Text>, align: 'right' as const },
                { title: '단위', dataIndex: 'unit',  width: 60 },
              ]}
              pagination={false} size="small"
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
    </Space>
  )
}
