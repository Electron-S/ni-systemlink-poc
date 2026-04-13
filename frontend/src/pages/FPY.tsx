/**
 * First Pass Yield / Failure Pareto 대시보드 — Feature 2
 */
import { useEffect, useState } from 'react'
import {
  Row, Col, Card, Statistic, Select, Segmented, Spin,
  Typography, Space, Progress, Table, Tag,
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined,
  FallOutlined, BarChartOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
  ComposedChart, Line, Legend,
} from 'recharts'
import api, { Asset, FPYResult } from '../api/client'

const { Text, Title } = Typography

const FPY_COLOR = (fpy: number) =>
  fpy >= 95 ? '#52c41a' : fpy >= 85 ? '#faad14' : '#ff4d4f'

export default function FPY() {
  const [assets, setAssets]   = useState<Asset[]>([])
  const [assetId, setAssetId] = useState<number | null>(null)
  const [days, setDays]       = useState(30)
  const [data, setData]       = useState<FPYResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Asset[]>('/assets').then(r => setAssets(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, unknown> = { days }
    if (assetId) params.asset_id = assetId
    api.get<FPYResult>('/test-results/fpy', { params })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days, assetId])

  // Pareto 누적 라인 데이터
  const paretoData = (() => {
    if (!data?.failure_pareto) return []
    const total = data.failure_pareto.reduce((s, p) => s + p.count, 0)
    let cum = 0
    return data.failure_pareto.map(p => {
      cum += p.count
      return { ...p, cumulative: total ? Math.round(cum / total * 100) : 0 }
    })
  })()

  // FPY by test — sorted ascending (worst first)
  const fypSorted = [...(data?.fpy_by_test ?? [])].sort((a, b) => a.fpy - b.fpy)

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
        {/* KPI 카드 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Overall FPY"
                value={data?.overall_fpy ?? 0}
                suffix="%"
                precision={1}
                valueStyle={{ color: FPY_COLOR(data?.overall_fpy ?? 0), fontSize: 32 }}
                prefix={<CheckCircleOutlined />}
              />
              <Progress
                percent={data?.overall_fpy ?? 0}
                showInfo={false}
                strokeColor={FPY_COLOR(data?.overall_fpy ?? 0)}
                style={{ marginTop: 8 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="분석 DUT 수"
                value={data?.total_duts ?? 0}
                valueStyle={{ color: '#1890ff' }}
                prefix={<BarChartOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>고유 DUT × 테스트 조합</Text>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="첫 번째 합격"
                value={data?.pass_duts ?? 0}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>첫 시도에서 합격</Text>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="첫 번째 불합격"
                value={data?.fail_duts ?? 0}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<CloseCircleOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>재검증 또는 폐기 필요</Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* 테스트명별 FPY */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <FallOutlined style={{ color: '#ff4d4f' }} />
                  테스트별 FPY (낮은 순)
                </Space>
              }
            >
              <ResponsiveContainer width="100%" height={Math.max(fypSorted.length * 38, 200)}>
                <BarChart
                  data={fypSorted}
                  layout="vertical"
                  margin={{ top: 0, right: 60, bottom: 0, left: 180 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category" dataKey="test_name"
                    tick={{ fontSize: 11 }} width={175}
                  />
                  <Tooltip
                    formatter={(v: number, _n, p) =>
                      [`${v}%  (${p.payload.pass}/${p.payload.total})`, 'FPY']
                    }
                  />
                  <ReferenceLine x={95} stroke="#52c41a" strokeDasharray="4 4"
                    label={{ value: '95%', position: 'top', fontSize: 10, fill: '#52c41a' }} />
                  <ReferenceLine x={85} stroke="#faad14" strokeDasharray="4 4"
                    label={{ value: '85%', position: 'bottom', fontSize: 10, fill: '#faad14' }} />
                  <Bar dataKey="fpy" radius={[0, 4, 4, 0]}>
                    {fypSorted.map((e, i) => (
                      <Cell key={i} fill={FPY_COLOR(e.fpy)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* 실패 단계 Pareto */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <BarChartOutlined style={{ color: '#faad14' }} />
                  실패 단계 Pareto (상위 20)
                </Space>
              }
            >
              {paretoData.length === 0 ? (
                <Text type="secondary">데이터 없음</Text>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart
                    data={paretoData}
                    margin={{ top: 8, right: 40, bottom: 60, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="step"
                      tick={{ fontSize: 9 }}
                      interval={0}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="right" orientation="right"
                      unit="%" domain={[0, 100]} tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === 'cumulative' ? [`${v}%`, '누적 비율'] : [`${v}건`, '실패 수']
                      }
                    />
                    <Legend verticalAlign="top" height={28} />
                    <Bar yAxisId="left" dataKey="count" name="실패 수" fill="#ff4d4f" opacity={0.85} />
                    <Line
                      yAxisId="right" type="monotone" dataKey="cumulative"
                      name="누적 비율" stroke="#1890ff" strokeWidth={2} dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        </Row>

        {/* 상세 테이블 */}
        <Card title="테스트별 FPY 상세" style={{ marginTop: 16 }}>
          <Table
            dataSource={data?.fpy_by_test ?? []}
            rowKey="test_name"
            size="small"
            pagination={{ pageSize: 20 }}
            columns={[
              { title: '테스트명', dataIndex: 'test_name', ellipsis: true },
              { title: '총 DUT', dataIndex: 'total', width: 80, align: 'right' as const },
              { title: '합격',    dataIndex: 'pass',  width: 80, align: 'right' as const,
                render: (v: number) => <Text style={{ color: '#52c41a' }}>{v}</Text> },
              {
                title: 'FPY', dataIndex: 'fpy', width: 120,
                render: (v: number) => (
                  <Space size={8}>
                    <Tag color={v >= 95 ? 'success' : v >= 85 ? 'warning' : 'error'}>
                      {v}%
                    </Tag>
                    <Progress
                      percent={v} showInfo={false}
                      strokeColor={FPY_COLOR(v)}
                      style={{ width: 60, margin: 0 }}
                    />
                  </Space>
                ),
                sorter: (a, b) => a.fpy - b.fpy,
              },
            ]}
          />
        </Card>
      </Spin>
    </div>
  )
}
