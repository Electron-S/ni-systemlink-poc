/**
 * 장비 가동률 상세 리포트 — Feature 7
 */
import { useEffect, useState } from 'react'
import {
  Row, Col, Card, Select, Segmented, Spin, Typography,
  Space, Table, Tag, Statistic,
} from 'antd'
import { ToolOutlined, ClockCircleOutlined } from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
  ComposedChart, Line,
} from 'recharts'
import api, { Asset, UtilizationDetailEntry, UtilizationEntry } from '../api/client'
import dayjs from 'dayjs'

const { Text } = Typography

const PASS_RATE_COLOR = (rate: number) =>
  rate >= 90 ? '#52c41a' : rate >= 70 ? '#faad14' : '#ff4d4f'

export default function Utilization() {
  const [assets, setAssets]           = useState<Asset[]>([])
  const [assetId, setAssetId]         = useState<number | null>(null)
  const [days, setDays]               = useState(30)
  const [detail, setDetail]           = useState<UtilizationDetailEntry[]>([])
  const [summary, setSummary]         = useState<UtilizationEntry[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    api.get<Asset[]>('/assets').then(r => setAssets(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, unknown> = { days }
    if (assetId) params.asset_id = assetId
    Promise.all([
      api.get<UtilizationDetailEntry[]>('/test-results/utilization-detail', { params }),
      api.get<UtilizationEntry[]>('/test-results/utilization', { params }),
    ]).then(([dr, sr]) => {
      setDetail(dr.data)
      setSummary(sr.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [days, assetId])

  // 일별 집계 (선택 장비 있으면 해당 장비만, 없으면 전체 합산)
  const dailyAgg = (() => {
    const byDate: Record<string, { date: string; test_count: number; pass_count: number; duration_s: number }> = {}
    for (const d of detail) {
      if (!byDate[d.date]) byDate[d.date] = { date: d.date, test_count: 0, pass_count: 0, duration_s: 0 }
      byDate[d.date].test_count += d.test_count
      byDate[d.date].pass_count += d.pass_count
      byDate[d.date].duration_s += d.total_duration_s
    }
    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        pass_rate:    d.test_count ? Math.round(d.pass_count / d.test_count * 100) : 0,
        duration_h:   Math.round(d.duration_s / 3600 * 10) / 10,
        date_label:   dayjs(d.date).format('MM/DD'),
      }))
  })()

  // KPI
  const totalTests = summary.reduce((s, u) => s + u.test_count, 0)
  const totalPass  = summary.reduce((s, u) => s + u.pass_count, 0)
  const overallRate = totalTests ? Math.round(totalPass / totalTests * 100 * 10) / 10 : 0
  const totalHours = detail.reduce((s, d) => s + d.total_duration_s, 0) / 3600

  return (
    <div>
      {/* 필터 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="전체 장비"
            style={{ width: 200 }}
            value={assetId}
            onChange={v => setAssetId(v ?? null)}
            options={assets.map(a => ({ value: a.id, label: a.name }))}
          />
          <Segmented
            value={days}
            onChange={v => setDays(Number(v))}
            options={[
              { label: '7일', value: 7 },
              { label: '30일', value: 30 },
              { label: '90일', value: 90 },
            ]}
          />
        </Space>
      </Card>

      <Spin spinning={loading}>
        {/* KPI */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="총 테스트 건수"
                value={totalTests}
                valueStyle={{ color: '#1890ff' }}
                prefix={<ToolOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="합격률"
                value={overallRate}
                suffix="%"
                precision={1}
                valueStyle={{ color: PASS_RATE_COLOR(overallRate) }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="총 가동 시간"
                value={Math.round(totalHours * 10) / 10}
                suffix="h"
                precision={1}
                valueStyle={{ color: '#722ed1' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title="활성 장비 수"
                value={summary.length}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 일별 테스트 + 합격률 차트 */}
        <Card title="일별 테스트 현황" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={dailyAgg} margin={{ top: 8, right: 40, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date_label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, name: string) => {
                  if (name === '합격률') return [`${v}%`, name]
                  if (name === '가동 시간') return [`${v}h`, name]
                  return [v, name]
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="test_count" name="테스트 수" opacity={0.8}>
                {dailyAgg.map((d, i) => (
                  <Cell key={i} fill={PASS_RATE_COLOR(d.pass_rate)} />
                ))}
              </Bar>
              <Line
                yAxisId="right" type="monotone" dataKey="pass_rate"
                name="합격률" stroke="#1890ff" strokeWidth={2} dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
            <Space size={4}><div style={{ width: 12, height: 12, background: '#52c41a', borderRadius: 2 }} /><Text style={{ fontSize: 11 }}>합격률 90%+</Text></Space>
            <Space size={4}><div style={{ width: 12, height: 12, background: '#faad14', borderRadius: 2 }} /><Text style={{ fontSize: 11 }}>70–89%</Text></Space>
            <Space size={4}><div style={{ width: 12, height: 12, background: '#ff4d4f', borderRadius: 2 }} /><Text style={{ fontSize: 11 }}>70% 미만</Text></Space>
          </div>
        </Card>

        <Row gutter={[16, 16]}>
          {/* 장비별 요약 */}
          <Col xs={24} lg={12}>
            <Card title="장비별 가동 현황" style={{ height: 360, overflowY: 'auto' }}>
              <ResponsiveContainer width="100%" height={Math.max(summary.length * 36, 200)}>
                <BarChart
                  data={[...summary].reverse()}
                  layout="vertical"
                  margin={{ top: 0, right: 60, bottom: 0, left: 160 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="asset_name" tick={{ fontSize: 11 }} width={155} />
                  <Tooltip
                    formatter={(v: number, _n, p) =>
                      [`${v}건 (합격률 ${p.payload.pass_rate}%)`, '테스트']}
                  />
                  <Bar dataKey="test_count" radius={[0, 4, 4, 0]}>
                    {[...summary].reverse().map((e, i) => (
                      <Cell key={i} fill={PASS_RATE_COLOR(e.pass_rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* 상세 테이블 */}
          <Col xs={24} lg={12}>
            <Card title="장비별 상세 통계">
              <Table
                dataSource={summary}
                rowKey="asset_id"
                size="small"
                pagination={{ pageSize: 8 }}
                columns={[
                  { title: '장비', dataIndex: 'asset_name',
                    render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
                  { title: '테스트', dataIndex: 'test_count', width: 70, align: 'right' as const },
                  { title: '합격률', dataIndex: 'pass_rate', width: 90,
                    render: (v: number) => (
                      <Tag color={v >= 90 ? 'success' : v >= 70 ? 'warning' : 'error'}>{v}%</Tag>
                    ),
                    sorter: (a: UtilizationEntry, b: UtilizationEntry) => a.pass_rate - b.pass_rate,
                  },
                  { title: '최근 실행', dataIndex: 'last_tested_at', width: 110,
                    render: (v: string | null) => v ? dayjs(v).format('MM/DD HH:mm') :
                      <Text type="secondary">—</Text> },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
