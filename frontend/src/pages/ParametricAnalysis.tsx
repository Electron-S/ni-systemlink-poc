/**
 * 파라메트릭 분석 페이지
 * 시나리오 11: 교차 root cause 분석 (Corner × Silicon Rev 합격률 히트맵)
 * 시나리오 14: 측정값 산포도 + 그룹별 통계
 */
import { useEffect, useState } from 'react'
import {
  Card, Row, Col, Select, Space, Typography, Table, Tag, Spin,
  DatePicker, Segmented, Tooltip as AntTooltip, Badge,
} from 'antd'
import type { RangePickerProps } from 'antd/es/date-picker'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import api, { Asset, ParametricData, ParametricGroupStat, CrossAnalysis } from '../api/client'
import dayjs from 'dayjs'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

// PMIC 코너/Silicon Rev 색상
const GROUP_COLORS: Record<string, string> = {
  TT: '#1890ff', FF: '#52c41a', SS: '#faad14', FS: '#722ed1', SF: '#eb2f96',
  'ES1.0': '#1890ff', 'ES1.1': '#52c41a', 'ES2.0': '#faad14', 'MP1.0': '#ff4d4f',
}
const FALLBACK_COLORS = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16']
const colorOf = (group: string, idx: number) =>
  GROUP_COLORS[group] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length]

const MEASUREMENT_LABELS: Record<string, string> = {
  efficiency_pct: '변환 효율 (%)',
  vout_v:        '출력 전압 (V)',
  vin_v:         '입력 전압 (V)',
  iout_ma:       '출력 전류 (mA)',
  iin_ma:        '입력 전류 (mA)',
  ripple_mv:     '리플 전압 (mV)',
  psrr_db:       'PSRR (dB)',
  freq_khz:      '스위칭 주파수 (kHz)',
  settling_us:   '정착 시간 (μs)',
  overshoot_mv:  '오버슈트 (mV)',
  deviation_mv:  '전압 편차 (mV)',
}

const GROUP_BY_OPTIONS = [
  { label: '공정 코너', value: 'corner' },
  { label: 'Silicon Rev', value: 'silicon_rev' },
  { label: 'Lot ID', value: 'lot_id' },
  { label: 'Recipe', value: 'recipe_version' },
  { label: '담당자', value: 'operator' },
]

const CROSS_ROW_OPTIONS = [
  { label: '코너', value: 'corner' },
  { label: 'Silicon Rev', value: 'silicon_rev' },
  { label: 'Lot ID', value: 'lot_id' },
  { label: 'Recipe', value: 'recipe_version' },
  { label: '담당자', value: 'operator' },
]

function passRateColor(rate: number | null): string {
  if (rate === null) return '#f0f0f0'
  if (rate >= 90)   return '#f6ffed'
  if (rate >= 70)   return '#fff7e6'
  return '#fff1f0'
}
function passRateTextColor(rate: number | null): string {
  if (rate === null) return '#bfbfbf'
  if (rate >= 90)   return '#52c41a'
  if (rate >= 70)   return '#faad14'
  return '#ff4d4f'
}

export default function ParametricAnalysis() {
  const [assets, setAssets]           = useState<Asset[]>([])
  const [measureKeys, setMeasureKeys] = useState<string[]>([])
  const [measureKey, setMeasureKey]   = useState<string>('')
  const [groupBy, setGroupBy]         = useState('corner')
  const [assetFilter, setAssetFilter] = useState<number | null>(null)
  const [days, setDays]               = useState(30)
  const [dateRange, setDateRange]     = useState<[string, string] | null>(null)
  const [data, setData]               = useState<ParametricData | null>(null)
  const [loading, setLoading]         = useState(false)

  // 교차 분석
  const [crossRowBy, setCrossRowBy]   = useState('corner')
  const [crossColBy, setCrossColBy]   = useState('silicon_rev')
  const [crossData, setCrossData]     = useState<CrossAnalysis | null>(null)
  const [crossLoading, setCrossLoading] = useState(false)

  useEffect(() => {
    api.get<Asset[]>('/assets').then(r => setAssets(r.data))
    api.get<{ keys: string[] }>('/test-results/measurement-keys').then(r => {
      setMeasureKeys(r.data.keys)
      if (r.data.keys.length > 0) setMeasureKey(r.data.keys[0])
    })
  }, [])

  // 산포 데이터 로드
  useEffect(() => {
    if (!measureKey) return
    setLoading(true)
    const params: Record<string, unknown> = { measurement_key: measureKey, group_by: groupBy, limit: 1000 }
    if (dateRange) {
      params.date_from = dateRange[0]
      params.date_to   = dateRange[1]
    } else {
      params.days = days
    }
    if (assetFilter) params.asset_id = assetFilter

    api.get<ParametricData>('/test-results/parametric', { params }).then(r => {
      setData(r.data)
      setLoading(false)
    })
  }, [measureKey, groupBy, assetFilter, days, dateRange])

  // 교차 분석 데이터 로드
  useEffect(() => {
    setCrossLoading(true)
    const params: Record<string, unknown> = { row_by: crossRowBy, col_by: crossColBy }
    if (dateRange) {
      params.date_from = dateRange[0]
      params.date_to   = dateRange[1]
    } else {
      params.days = days
    }
    if (assetFilter) params.asset_id = assetFilter

    api.get<CrossAnalysis>('/test-results/cross-analysis', { params }).then(r => {
      setCrossData(r.data)
      setCrossLoading(false)
    })
  }, [crossRowBy, crossColBy, assetFilter, days, dateRange])

  // 산포 차트용 데이터: 그룹별로 분리
  const groups = data ? [...new Set(data.points.map(p => p.group))].sort() : []
  const scatterByGroup: Record<string, Array<{ x: number; y: number; dut_id: string; ts: string }>> = {}
  data?.points.forEach((p, i) => {
    if (!scatterByGroup[p.group]) scatterByGroup[p.group] = []
    scatterByGroup[p.group].push({
      x: dayjs(p.started_at).valueOf(),
      y: p.value,
      dut_id: p.dut_id ?? '',
      ts: dayjs(p.started_at).format('MM/DD HH:mm'),
    })
  })

  // 전체 평균
  const grandMean = data && data.points.length > 0
    ? data.points.reduce((s, p) => s + p.value, 0) / data.points.length
    : null

  const statsColumns = [
    {
      title: '그룹', dataIndex: 'group',
      render: (v: string) => (
        <Tag color={GROUP_COLORS[v] ? undefined : 'default'}
             style={{ background: GROUP_COLORS[v] ?? undefined, color: GROUP_COLORS[v] ? '#fff' : undefined }}>
          {v}
        </Tag>
      ),
    },
    { title: 'N',    dataIndex: 'count', width: 60, align: 'right' as const },
    { title: '평균',  dataIndex: 'mean',  width: 90, align: 'right' as const, render: (v: number) => v.toFixed(3) },
    { title: '최솟값', dataIndex: 'min',  width: 90, align: 'right' as const, render: (v: number) => v.toFixed(3) },
    { title: '최댓값', dataIndex: 'max',  width: 90, align: 'right' as const, render: (v: number) => v.toFixed(3) },
    { title: 'σ',    dataIndex: 'std',   width: 80, align: 'right' as const, render: (v: number) => v.toFixed(3) },
    {
      title: '합격률', dataIndex: 'pass_rate', width: 80, align: 'right' as const,
      render: (v: number) => (
        <Text style={{ color: v >= 90 ? '#52c41a' : v >= 70 ? '#faad14' : '#ff4d4f', fontWeight: 700 }}>
          {v}%
        </Text>
      ),
    },
  ]

  const handleDateChange: RangePickerProps['onChange'] = (_, s) =>
    setDateRange(s[0] && s[1] ? [s[0], s[1]] : null)

  return (
    <div>
      {/* ── 필터 바 ── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="측정 항목 선택"
            style={{ width: 200 }}
            value={measureKey || undefined}
            onChange={setMeasureKey}
            options={measureKeys.map(k => ({ value: k, label: MEASUREMENT_LABELS[k] ?? k }))}
          />
          <Select
            style={{ width: 130 }}
            value={groupBy}
            onChange={setGroupBy}
            options={GROUP_BY_OPTIONS}
          />
          <Select allowClear placeholder="자산" style={{ width: 180 }} value={assetFilter}
            onChange={v => setAssetFilter(v ?? null)}
            options={assets.map(a => ({ value: a.id, label: a.name }))} />
          <RangePicker size="small" style={{ width: 220 }} onChange={handleDateChange} />
          {!dateRange && (
            <Segmented
              value={days}
              onChange={v => setDays(Number(v))}
              options={[{ label: '7일', value: 7 }, { label: '30일', value: 30 }, { label: '90일', value: 90 }]}
            />
          )}
        </Space>
      </Card>

      {/* ── 산포도 + 통계 ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title={`산포도 — ${MEASUREMENT_LABELS[measureKey] ?? measureKey}`}
            extra={<Badge count={data?.points.length ?? 0} overflowCount={9999} style={{ background: '#1890ff' }} />}
          >
            <Spin spinning={loading}>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x" type="number" domain={['auto', 'auto']} name="시각"
                    tickFormatter={v => dayjs(v).format('MM/DD')} tick={{ fontSize: 11 }}
                  />
                  <YAxis dataKey="y" type="number" name={measureKey} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div style={{ background: '#fff', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 4, fontSize: 12 }}>
                          <div><b>{d.ts}</b></div>
                          <div>값: <b>{d.y}</b></div>
                          {d.dut_id && <div>DUT: {d.dut_id}</div>}
                        </div>
                      )
                    }}
                  />
                  <Legend />
                  {grandMean !== null && (
                    <ReferenceLine y={grandMean} stroke="#ff4d4f" strokeDasharray="4 4"
                      label={{ value: `avg ${grandMean.toFixed(3)}`, position: 'right', fontSize: 11, fill: '#ff4d4f' }} />
                  )}
                  {groups.map((g, i) => (
                    <Scatter
                      key={g}
                      name={g}
                      data={scatterByGroup[g] ?? []}
                      fill={colorOf(g, i)}
                      opacity={0.75}
                      r={3}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </Spin>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="그룹별 통계" style={{ height: '100%' }}>
            <Spin spinning={loading}>
              <Table
                dataSource={data?.stats ?? []}
                columns={statsColumns}
                rowKey="group"
                size="small"
                pagination={false}
                scroll={{ x: true }}
              />
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* ── 교차 분석 히트맵 (시나리오 11) ── */}
      <Card
        title="교차 분석 — Root Cause"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>행</Text>
            <Select size="small" style={{ width: 110 }} value={crossRowBy} onChange={setCrossRowBy}
              options={CROSS_ROW_OPTIONS} />
            <Text type="secondary" style={{ fontSize: 12 }}>열</Text>
            <Select size="small" style={{ width: 110 }} value={crossColBy} onChange={setCrossColBy}
              options={CROSS_ROW_OPTIONS.filter(o => o.value !== crossRowBy)} />
          </Space>
        }
      >
        <Spin spinning={crossLoading}>
          {crossData && crossData.rows.length > 0 ? (
            <CrossTable data={crossData} />
          ) : (
            <Text type="secondary">데이터 없음</Text>
          )}
        </Spin>
      </Card>
    </div>
  )
}

function CrossTable({ data }: { data: CrossAnalysis }) {
  const { rows, cols, matrix } = data

  const columns = [
    {
      title: <Text type="secondary" style={{ fontSize: 11 }}>{data.row_label}</Text>,
      dataIndex: 'row',
      fixed: 'left' as const,
      width: 110,
      render: (v: string) => (
        <Tag color={GROUP_COLORS[v] ? undefined : 'default'}
             style={{ background: GROUP_COLORS[v] ?? undefined, color: GROUP_COLORS[v] ? '#fff' : undefined, fontSize: 11 }}>
          {v}
        </Tag>
      ),
    },
    ...cols.map(c => ({
      title: (
        <Tag color={GROUP_COLORS[c] ? undefined : 'default'}
             style={{ background: GROUP_COLORS[c] ?? undefined, color: GROUP_COLORS[c] ? '#fff' : undefined, fontSize: 11, margin: 0 }}>
          {c}
        </Tag>
      ),
      dataIndex: c,
      width: 90,
      align: 'center' as const,
      render: (cell: { total: number; pass_rate: number | null } | undefined) => {
        if (!cell || cell.total === 0) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
        const rate = cell.pass_rate
        return (
          <AntTooltip title={`${cell.total}건`}>
            <div style={{
              background: passRateColor(rate),
              borderRadius: 4,
              padding: '4px 6px',
              cursor: 'default',
            }}>
              <Text style={{ color: passRateTextColor(rate), fontWeight: 700, fontSize: 13 }}>
                {rate !== null ? `${rate}%` : '—'}
              </Text>
              <div style={{ color: '#8c8c8c', fontSize: 10 }}>{cell.total}건</div>
            </div>
          </AntTooltip>
        )
      },
    })),
  ]

  const tableData = rows.map(r => ({
    key: r,
    row: r,
    ...Object.fromEntries(cols.map(c => [c, matrix[r]?.[c]])),
  }))

  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', gap: 16 }}>
        <Space size={4}><div style={{ width: 14, height: 14, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 2 }} /><Text style={{ fontSize: 11 }}>90%+</Text></Space>
        <Space size={4}><div style={{ width: 14, height: 14, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 2 }} /><Text style={{ fontSize: 11 }}>70–89%</Text></Space>
        <Space size={4}><div style={{ width: 14, height: 14, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 2 }} /><Text style={{ fontSize: 11 }}>70% 미만</Text></Space>
      </div>
      <Table
        dataSource={tableData}
        columns={columns}
        rowKey="row"
        size="small"
        pagination={false}
        scroll={{ x: true }}
        bordered
      />
    </div>
  )
}
