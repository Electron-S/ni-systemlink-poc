import { useEffect, useState } from 'react'
import {
  Table, Tag, Card, Row, Col, Statistic, Drawer, Descriptions,
  Space, Button, Progress, Typography, Badge, Input, Timeline, Spin,
  Modal, Form, Select, DatePicker, message, Tabs, Tooltip as AntTooltip,
} from 'antd'
import { ReloadOutlined, InfoCircleOutlined, SearchOutlined, RobotOutlined, ToolOutlined,
  CheckCircleFilled, CloseCircleFilled, PlusOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api, { Asset, AssetMetrics, AgentNode, CalibrationEvent, ChassisView } from '../api/client'
import { useRealtimeMetrics } from '../hooks/useWebSocket'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  online: 'success', offline: 'default', warning: 'warning', error: 'error',
}
const STATUS_LABEL: Record<string, string> = {
  online: '온라인', offline: '오프라인', warning: '경고', error: '오류',
}

const METRIC_HISTORY_LEN = 20

export default function Assets() {
  const [assets, setAssets]   = useState<Asset[]>([])
  const [agents, setAgents]   = useState<AgentNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState<Asset | null>(null)
  const [history, setHistory]   = useState<AssetMetrics[]>([])
  const [calHistory, setCalHistory]   = useState<CalibrationEvent[]>([])
  const [calLoading, setCalLoading]   = useState(false)
  const [calModalOpen, setCalModalOpen] = useState(false)
  const [calSubmitting, setCalSubmitting] = useState(false)
  const [calForm] = Form.useForm()
  const [chassisData, setChassisData] = useState<ChassisView[]>([])
  const [chassisLoading, setChassisLoading] = useState(false)
  const { metrics: liveMetrics, events } = useRealtimeMetrics()

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<Asset[]>('/assets'),
      api.get<AgentNode[]>('/agents'),
    ]).then(([ar, agr]) => {
      setAssets(ar.data)
      setAgents(agr.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  const loadChassis = () => {
    setChassisLoading(true)
    api.get<ChassisView[]>('/assets/chassis-view')
      .then(r => setChassisData(r.data))
      .catch(() => {})
      .finally(() => setChassisLoading(false))
  }

  // selected 자산을 관리하는 에이전트 찾기
  const managingAgent = selected
    ? agents.find(ag => (ag.managed_asset_ids ?? []).includes(selected.id)) ?? null
    : null

  useEffect(() => { load(); loadChassis() }, [])

  // 장비 상태 변경 이벤트 실시간 반영
  useEffect(() => {
    if (events.length === 0) return
    const e = events[0]
    if (e.event_type === 'asset_status') {
      setAssets(prev => prev.map(a =>
        a.id === e.data.id ? { ...a, status: e.data.new_status } : a
      ))
    }
  }, [events.length > 0 ? events[0].id : null])

  useEffect(() => {
    if (!selected) return
    const m = liveMetrics[selected.id]
    if (!m) return
    setHistory(prev => [...prev.slice(-(METRIC_HISTORY_LEN - 1)), m])
  }, [liveMetrics, selected?.id])

  // 자산 선택 시 교정 이력 로드
  useEffect(() => {
    if (!selected) return
    setCalLoading(true)
    api.get<CalibrationEvent[]>(`/assets/${selected.id}/calibration-history`)
      .then(r => setCalHistory(r.data))
      .catch(() => {})
      .finally(() => setCalLoading(false))
  }, [selected?.id])

  const handleCalSubmit = async () => {
    if (!selected) return
    try {
      const values = await calForm.validateFields()
      setCalSubmitting(true)
      await api.post(`/assets/${selected.id}/calibration-events`, {
        performed_at:  values.performed_at.toISOString(),
        performed_by:  values.performed_by,
        result:        values.result,
        notes:         values.notes || null,
        next_due_date: values.next_due_date ? values.next_due_date.format('YYYY-MM-DD') : null,
      })
      message.success('교정 이력이 등록되었습니다')
      calForm.resetFields()
      setCalModalOpen(false)
      // 이력 새로고침
      setCalLoading(true)
      api.get<CalibrationEvent[]>(`/assets/${selected.id}/calibration-history`)
        .then(r => setCalHistory(r.data))
        .catch(() => {})
        .finally(() => setCalLoading(false))
    } catch {
      // validateFields 실패 시 아무 것도 하지 않음 (폼 유효성 표시)
    } finally {
      setCalSubmitting(false)
    }
  }

  const filtered = assets.filter(a =>
    search === '' ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.model.toLowerCase().includes(search.toLowerCase()) ||
    a.location.toLowerCase().includes(search.toLowerCase()) ||
    a.department.toLowerCase().includes(search.toLowerCase())
  )

  const statusCounts = assets.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const columns = [
    {
      title: '장비명', dataIndex: 'name',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
      sorter: (a: Asset, b: Asset) => a.name.localeCompare(b.name),
    },
    { title: '모델', dataIndex: 'model' },
    { title: '유형', dataIndex: 'asset_type', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '상태', dataIndex: 'status', width: 110,
      filters: ['online', 'offline', 'warning', 'error'].map(s => ({ text: STATUS_LABEL[s], value: s })),
      onFilter: (v: unknown, r: Asset) => r.status === v,
      render: (v: string) => <Badge status={STATUS_COLOR[v] as any} text={STATUS_LABEL[v]} />,
    },
    { title: '위치',   dataIndex: 'location' },
    { title: '부서',   dataIndex: 'department' },
    {
      title: '드라이버', dataIndex: 'driver_version',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '교정', dataIndex: 'calibration_status', width: 90,
      render: (_: string, r: Asset) => {
        const s = r.calibration_status
        const color = s === '유효' ? 'success' : s === '만료임박' ? 'warning' : s === '만료' ? 'error' : 'default'
        return <Badge status={color as any} text={s} />
      },
    },
    {
      title: '마지막 접속', dataIndex: 'last_seen', width: 130,
      render: (v: string | null) => v ? dayjs(v).fromNow() : <Text type="secondary">—</Text>,
    },
    {
      title: '', width: 60,
      render: (_: unknown, r: Asset) => (
        <Button
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={e => { e.stopPropagation(); setSelected(r); setHistory([]) }}
        />
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {['online', 'offline', 'warning', 'error'].map(s => (
          <Col key={s} xs={12} sm={6}>
            <Card size="small">
              <Statistic
                title={STATUS_LABEL[s]}
                value={statusCounts[s] ?? 0}
                valueStyle={{ color: { online: '#52c41a', offline: '#8c8c8c', warning: '#faad14', error: '#ff4d4f' }[s] }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Tabs
        defaultActiveKey="list"
        items={[
          {
            key: 'list',
            label: <Space><UnorderedListOutlined />자산 목록</Space>,
            children: (
              <Card
                extra={
                  <Space>
                    <Input
                      prefix={<SearchOutlined />}
                      placeholder="장비명, 모델, 위치, 부서 검색"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      allowClear
                      style={{ width: 240 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={load}>새로고침</Button>
                  </Space>
                }
              >
                <Table
                  dataSource={filtered}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 15 }}
                  onRow={r => ({ onClick: () => { setSelected(r); setHistory([]) }, style: { cursor: 'pointer' } })}
                />
              </Card>
            ),
          },
          {
            key: 'chassis',
            label: <Space><AppstoreOutlined />섀시 배치도</Space>,
            children: (
              <Spin spinning={chassisLoading}>
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  {chassisData.map(cv => (
                    <ChassisLayout
                      key={cv.chassis.id}
                      view={cv}
                      onModuleClick={a => { setSelected(a); setHistory([]) }}
                    />
                  ))}
                  {!chassisLoading && chassisData.length === 0 && (
                    <Card><Text type="secondary">섀시 데이터 없음</Text></Card>
                  )}
                </Space>
              </Spin>
            ),
          },
        ]}
      />

      {/* ── 교정 등록 Modal ── */}
      <Modal
        title={`교정 이력 등록 — ${selected?.name ?? ''}`}
        open={calModalOpen}
        onOk={handleCalSubmit}
        onCancel={() => { setCalModalOpen(false); calForm.resetFields() }}
        okText="등록"
        cancelText="취소"
        confirmLoading={calSubmitting}
        destroyOnClose
      >
        <Form form={calForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="performed_at" label="교정 수행일" rules={[{ required: true, message: '필수 항목' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="performed_by" label="담당자" rules={[{ required: true, message: '필수 항목' }]}>
            <Input placeholder="예: 김민준" />
          </Form.Item>
          <Form.Item name="result" label="결과" rules={[{ required: true, message: '필수 항목' }]}>
            <Select options={[{ value: 'pass', label: '합격' }, { value: 'fail', label: '불합격' }]} />
          </Form.Item>
          <Form.Item name="next_due_date" label="다음 교정 예정일">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="특이사항 입력 (선택)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── 상세 Drawer ── */}
      <Drawer
        title={selected?.name}
        open={!!selected}
        onClose={() => { setSelected(null); setCalHistory([]); setCalModalOpen(false); calForm.resetFields() }}
        width={520}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="모델">{selected.model}</Descriptions.Item>
              <Descriptions.Item label="유형">{selected.asset_type}</Descriptions.Item>
              <Descriptions.Item label="시리얼">{selected.serial_number}</Descriptions.Item>
              <Descriptions.Item label="IP">{selected.ip_address ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="위치">{selected.location}</Descriptions.Item>
              <Descriptions.Item label="부서">{selected.department}</Descriptions.Item>
              <Descriptions.Item label="펌웨어">{selected.firmware_version}</Descriptions.Item>
              <Descriptions.Item label="드라이버">{selected.driver_version}</Descriptions.Item>
              <Descriptions.Item label="채널 수">{selected.channel_count}</Descriptions.Item>
              <Descriptions.Item label="상태">
                <Badge status={STATUS_COLOR[selected.status] as any} text={STATUS_LABEL[selected.status]} />
              </Descriptions.Item>
            </Descriptions>

            {/* 교정 정보 — 시나리오 01 + calibration history */}
            <Card
              title="교정 정보"
              size="small"
              extra={
                <Space size={8}>
                  <ToolOutlined />
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setCalModalOpen(true)}
                  >
                    교정 등록
                  </Button>
                </Space>
              }
            >
              {(() => {
                const s = selected.calibration_status
                const color = s === '유효' ? '#52c41a' : s === '만료임박' ? '#faad14' : s === '만료' ? '#ff4d4f' : '#8c8c8c'
                return (
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="교정 상태">
                      <Text style={{ color, fontWeight: 700 }}>{s}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="다음 만료일">
                      {selected.calibration_due_date
                        ? <Text style={{ color: s === '만료' || s === '만료임박' ? color : undefined }}>
                            {selected.calibration_due_date}
                          </Text>
                        : <Text type="secondary">미등록</Text>}
                    </Descriptions.Item>
                    <Descriptions.Item label="교정 주기">
                      {selected.calibration_interval_days}일
                    </Descriptions.Item>
                  </Descriptions>
                )
              })()}

              {/* 교정 수행 이력 */}
              <div style={{ marginTop: 12 }}>
                <Text strong style={{ fontSize: 12 }}>교정 수행 이력</Text>
                <Spin spinning={calLoading} size="small">
                  {calHistory.length === 0 && !calLoading ? (
                    <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>이력 없음</Text>
                  ) : (
                    <Timeline
                      style={{ marginTop: 8 }}
                      items={calHistory.map(ev => ({
                        dot: ev.result === 'pass'
                          ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 13 }} />
                          : <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 13 }} />,
                        children: (
                          <div style={{ fontSize: 12 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <Text strong style={{ fontSize: 12 }}>
                                {dayjs(ev.performed_at).format('YYYY-MM-DD')}
                              </Text>
                              <Tag
                                color={ev.result === 'pass' ? 'success' : 'error'}
                                style={{ fontSize: 10, margin: 0 }}
                              >
                                {ev.result === 'pass' ? '합격' : '불합격'}
                              </Tag>
                            </div>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              담당: {ev.performed_by}
                              {ev.next_due_date && ` · 다음 교정: ${ev.next_due_date}`}
                            </Text>
                            {ev.notes && (
                              <div style={{ color: '#595959', fontSize: 11, marginTop: 2 }}>{ev.notes}</div>
                            )}
                          </div>
                        ),
                      }))}
                    />
                  )}
                </Spin>
              </div>
            </Card>

            {/* 관리 에이전트 */}
            <Card title="관리 에이전트" size="small" extra={<RobotOutlined />}>
              {managingAgent ? (
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="에이전트 ID">
                    <Text code style={{ fontSize: 11 }}>{managingAgent.agent_id}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="호스트명">{managingAgent.hostname}</Descriptions.Item>
                  <Descriptions.Item label="상태">
                    <Badge
                      status={managingAgent.status === 'online' ? 'success' : 'default'}
                      text={managingAgent.status === 'online' ? '온라인' : '오프라인'}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="마지막 heartbeat">
                    {managingAgent.last_heartbeat ? dayjs(managingAgent.last_heartbeat).fromNow() : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="역량">
                    <Space size={4} wrap>
                      {managingAgent.capabilities.map(c => <Tag key={c} style={{ fontSize: 10 }}>{c}</Tag>)}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">이 자산을 관리하는 에이전트가 없습니다</Text>
              )}
            </Card>

            <Card title="실시간 메트릭" size="small" extra={<Badge status="processing" text="실시간" />}>
              {liveMetrics[selected.id] ? (
                <>
                  <Row gutter={8}>
                    <Col span={12}><MetricGauge label="CPU" value={liveMetrics[selected.id].cpu_pct} unit="%" warn={80} /></Col>
                    <Col span={12}><MetricGauge label="메모리" value={liveMetrics[selected.id].memory_pct} unit="%" warn={75} /></Col>
                    <Col span={12} style={{ marginTop: 8 }}><MetricGauge label="온도" value={liveMetrics[selected.id].temperature_c} unit="°C" warn={65} max={100} /></Col>
                    <Col span={12} style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>전압</Text>
                      <div style={{ fontWeight: 700 }}>{liveMetrics[selected.id].voltage_v.toFixed(3)} V</div>
                    </Col>
                  </Row>

                  {history.length > 1 && (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>CPU & 온도 추이</Text>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={history.map((m, i) => ({ i, cpu: m.cpu_pct, temp: m.temperature_c }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="i" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="cpu"  stroke="#1890ff" dot={false} name="CPU %" />
                          <Line type="monotone" dataKey="temp" stroke="#ff4d4f" dot={false} name="온도 °C" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <Text type="secondary">데이터 수신 대기 중…</Text>
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  )
}

function MetricGauge({ label, value, unit, warn, max = 100 }: {
  label: string; value: number; unit: string; warn: number; max?: number
}) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value >= warn ? '#ff4d4f' : value >= warn * 0.8 ? '#faad14' : '#52c41a'
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{value}{unit}</div>
      <Progress percent={Math.round(pct)} showInfo={false} strokeColor={color} size="small" />
    </div>
  )
}

// ── 섀시 배치도 컴포넌트 ──────────────────────────────────────────────────────

const SLOT_STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  online:  { bg: '#f6ffed', border: '#52c41a', text: '#237804' },
  warning: { bg: '#fffbe6', border: '#faad14', text: '#ad6800' },
  error:   { bg: '#fff1f0', border: '#ff4d4f', text: '#a8071a' },
  offline: { bg: '#fafafa', border: '#bfbfbf', text: '#595959' },
}

function ChassisLayout({ view, onModuleClick }: {
  view: ChassisView
  onModuleClick: (a: Asset) => void
}) {
  const { chassis, total_slots, occupied, slots } = view
  const chassisStyle = SLOT_STATUS_STYLE[chassis.status] ?? SLOT_STATUS_STYLE.offline

  return (
    <Card
      size="small"
      style={{ borderColor: chassisStyle.border, borderWidth: 2 }}
      title={
        <Space>
          <Badge status={STATUS_COLOR[chassis.status] as any} />
          <Text strong>{chassis.name}</Text>
          <Tag color="blue" style={{ fontSize: 11 }}>{chassis.model}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{chassis.location} · {chassis.department}</Text>
        </Space>
      }
      extra={
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            슬롯 {occupied}/{total_slots} 사용
          </Text>
          <Badge
            count={occupied}
            style={{ background: '#1890ff' }}
            overflowCount={99}
          />
        </Space>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {slots.map(slot => {
          if (slot.is_system_slot) {
            // 슬롯 1: 시스템 컨트롤러 고정
            return (
              <div key={slot.slot_number} style={{
                width: 110, minHeight: 72, border: '1px solid #d9d9d9',
                borderRadius: 6, background: '#f5f5f5',
                padding: '6px 8px', boxSizing: 'border-box',
              }}>
                <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 2 }}>슬롯 {slot.slot_number}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#595959' }}>System Controller</div>
                <Tag style={{ fontSize: 9, marginTop: 4, padding: '0 4px' }}>내장</Tag>
              </div>
            )
          }

          if (!slot.module) {
            // 빈 슬롯
            return (
              <div key={slot.slot_number} style={{
                width: 110, minHeight: 72,
                border: '1px dashed #d9d9d9', borderRadius: 6,
                background: '#fafafa', padding: '6px 8px',
                display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', boxSizing: 'border-box',
              }}>
                <div style={{ fontSize: 10, color: '#bfbfbf' }}>슬롯 {slot.slot_number}</div>
                <div style={{ fontSize: 11, color: '#d9d9d9', textAlign: 'center' }}>— 빈 슬롯 —</div>
              </div>
            )
          }

          const m = slot.module
          const st = SLOT_STATUS_STYLE[m.status] ?? SLOT_STATUS_STYLE.offline
          return (
            <AntTooltip
              key={slot.slot_number}
              title={
                <div style={{ fontSize: 12 }}>
                  <div><b>{m.name}</b></div>
                  <div>모델: {m.model}</div>
                  <div>채널: {m.channel_count}ch</div>
                  <div>드라이버: {m.driver_version}</div>
                  <div>상태: {STATUS_LABEL[m.status]}</div>
                </div>
              }
            >
              <div
                onClick={() => onModuleClick(m)}
                style={{
                  width: 110, minHeight: 72,
                  border: `2px solid ${st.border}`,
                  borderRadius: 6, background: st.bg,
                  padding: '6px 8px', cursor: 'pointer',
                  boxSizing: 'border-box',
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 0 2px ${st.border}55`)}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 2 }}>슬롯 {slot.slot_number}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: st.text, lineHeight: 1.3 }}>
                  {m.name.replace(/-LAB\d+-\d+$/, '').replace(/-[A-Z]+-\d+$/, '')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Tag style={{ fontSize: 9, padding: '0 4px', margin: 0 }}>{m.asset_type}</Tag>
                  <Badge status={STATUS_COLOR[m.status] as any} />
                </div>
              </div>
            </AntTooltip>
          )
        })}
      </div>
    </Card>
  )
}
