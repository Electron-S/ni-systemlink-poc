import { useEffect, useState } from 'react'
import {
  Table, Card, Tag, Badge, Drawer, Space, Typography,
  Button, Descriptions, Row, Col, Statistic, Tabs, Tooltip,
} from 'antd'
import {
  ReloadOutlined, RobotOutlined, DatabaseOutlined,
  DiffOutlined, WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import api, { AgentNode, Asset, AgentComparisonData } from '../api/client'
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

export default function Agents() {
  const [agents, setAgents]   = useState<AgentNode[]>([])
  const [assets, setAssets]   = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AgentNode | null>(null)
  const [comparison, setComparison] = useState<AgentComparisonData | null>(null)
  const [cmpLoading, setCmpLoading] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<AgentNode[]>('/agents'),
      api.get<Asset[]>('/assets'),
    ]).then(([ar, asr]) => {
      setAgents(ar.data)
      setAssets(asr.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  const loadComparison = () => {
    setCmpLoading(true)
    api.get<AgentComparisonData>('/agents/comparison')
      .then(r => setComparison(r.data))
      .catch(() => {})
      .finally(() => setCmpLoading(false))
  }

  useEffect(() => { load(); loadComparison() }, [])

  const assetMap = Object.fromEntries(assets.map(a => [a.id, a]))
  const onlineCnt  = agents.filter(a => a.status === 'online').length
  const offlineCnt = agents.filter(a => a.status === 'offline').length
  const mismatchCount = comparison?.mismatch_packages.length ?? 0

  const columns = [
    {
      title: '에이전트 ID', dataIndex: 'agent_id',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    { title: '호스트명', dataIndex: 'hostname' },
    { title: '버전',    dataIndex: 'version', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: '상태', dataIndex: 'status', width: 110,
      render: (v: string) => (
        <Badge
          status={v === 'online' ? 'success' : 'default'}
          text={v === 'online' ? '온라인' : '오프라인'}
        />
      ),
    },
    { title: 'IP 주소', dataIndex: 'ip_address', render: (v: string | null) => v ?? '—' },
    {
      title: '마지막 heartbeat', dataIndex: 'last_heartbeat', width: 160,
      render: (v: string | null) => v ? dayjs(v).fromNow() : <Text type="secondary">—</Text>,
    },
    {
      title: '역량', dataIndex: 'capabilities',
      render: (v: string[]) => (
        <Space size={4} wrap>
          {v.map(c => <Tag key={c} style={{ fontSize: 11 }}>{c}</Tag>)}
        </Space>
      ),
    },
    {
      title: '관리 자산', dataIndex: 'managed_asset_ids',
      render: (ids: number[]) => (
        <Tag icon={<DatabaseOutlined />} color="geekblue">{(ids ?? []).length}개 자산</Tag>
      ),
    },
    {
      title: '인벤토리', dataIndex: 'inventory',
      render: (_: unknown, r: AgentNode) => (
        <Button size="small" onClick={e => { e.stopPropagation(); setSelected(r) }}>
          {r.inventory.length}개 패키지
        </Button>
      ),
    },
  ]

  // ── 비교 테이블 컬럼 ──────────────────────────────────────────────────────
  const comparisonColumns = comparison ? [
    {
      title: '패키지', dataIndex: 'package_name', fixed: 'left' as const, width: 200,
      render: (v: string) => {
        const isMismatch = comparison.mismatch_packages.includes(v)
        return (
          <Space>
            {isMismatch && <WarningOutlined style={{ color: '#ff4d4f' }} />}
            <Text style={{ fontSize: 12, fontWeight: isMismatch ? 700 : 400 }}>{v}</Text>
          </Space>
        )
      },
    },
    ...comparison.agents.map(a => ({
      title: (
        <div style={{ textAlign: 'center' as const }}>
          <div style={{ fontSize: 11 }}>{a.hostname}</div>
          <Badge
            status={a.status === 'online' ? 'success' : 'default'}
            text={<Text style={{ fontSize: 10 }}>{a.status === 'online' ? '온라인' : '오프라인'}</Text>}
          />
        </div>
      ),
      dataIndex: a.agent_id,
      width: 140,
      align: 'center' as const,
      render: (ver: string | undefined) => {
        if (!ver) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
        return <Tag color="blue" style={{ fontSize: 11 }}>{ver}</Tag>
      },
    })),
  ] : []

  const comparisonData = comparison
    ? comparison.package_names.map(pkg => {
        const row: Record<string, unknown> = { package_name: pkg, key: pkg }
        for (const a of comparison.agents) {
          row[a.agent_id] = a.packages[pkg] ?? undefined
        }
        return row
      })
    : []

  return (
    <div>
      {/* KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="전체 에이전트" value={agents.length}
              prefix={<RobotOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="온라인" value={onlineCnt} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="오프라인" value={offlineCnt} valueStyle={{ color: '#8c8c8c' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="버전 불일치 패키지"
              value={mismatchCount}
              valueStyle={{ color: mismatchCount > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={mismatchCount > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'agents',
            label: <Space><RobotOutlined />에이전트 목록</Space>,
            children: (
              <Card extra={<Button icon={<ReloadOutlined />} onClick={load}>새로고침</Button>}>
                <Table
                  dataSource={agents}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 15 }}
                  onRow={r => ({ onClick: () => setSelected(r), style: { cursor: 'pointer' } })}
                />
              </Card>
            ),
          },
          {
            key: 'comparison',
            label: (
              <Space>
                <DiffOutlined />
                설정 비교
                {mismatchCount > 0 && (
                  <Tag color="error" style={{ margin: 0, fontSize: 10 }}>{mismatchCount}건 불일치</Tag>
                )}
              </Space>
            ),
            children: (
              <Card
                title="크로스 시스템 패키지 버전 비교"
                extra={<Button icon={<ReloadOutlined />} onClick={loadComparison}>새로고침</Button>}
              >
                {mismatchCount > 0 && (
                  <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6 }}>
                    <Space>
                      <WarningOutlined style={{ color: '#ff4d4f' }} />
                      <Text style={{ color: '#ff4d4f', fontSize: 13 }}>
                        <b>{mismatchCount}개 패키지</b>의 버전이 에이전트 간 불일치합니다:&nbsp;
                        {comparison?.mismatch_packages.join(', ')}
                      </Text>
                    </Space>
                  </div>
                )}
                <Table
                  dataSource={comparisonData}
                  columns={comparisonColumns}
                  rowKey="key"
                  loading={cmpLoading}
                  size="small"
                  pagination={false}
                  scroll={{ x: true }}
                  rowClassName={(r: any) =>
                    comparison?.mismatch_packages.includes(r.package_name) ? 'row-urgent' : ''
                  }
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 에이전트 상세 Drawer */}
      <Drawer
        title={
          <Space>
            <RobotOutlined />
            {selected?.agent_id}
          </Space>
        }
        open={!!selected}
        onClose={() => setSelected(null)}
        width={480}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="호스트명">{selected.hostname}</Descriptions.Item>
              <Descriptions.Item label="버전">{selected.version}</Descriptions.Item>
              <Descriptions.Item label="IP">{selected.ip_address ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="상태">
                <Badge
                  status={selected.status === 'online' ? 'success' : 'default'}
                  text={selected.status === 'online' ? '온라인' : '오프라인'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="마지막 heartbeat">
                {selected.last_heartbeat ? dayjs(selected.last_heartbeat).format('YYYY-MM-DD HH:mm:ss') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="역량">
                <Space size={4} wrap>
                  {selected.capabilities.map(c => <Tag key={c}>{c}</Tag>)}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {/* 관리 자산 */}
            <Card title="관리 자산" size="small" extra={
              <Tag color="geekblue">{(selected.managed_asset_ids ?? []).length}개</Tag>
            }>
              {(selected.managed_asset_ids ?? []).length === 0 ? (
                <Text type="secondary">연결된 자산 없음</Text>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  {(selected.managed_asset_ids ?? []).map(id => {
                    const a = assetMap[id]
                    if (!a) return <Tag key={id}>ID:{id}</Tag>
                    return (
                      <div key={id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 8px', background: '#fafafa', borderRadius: 4,
                        border: '1px solid #f0f0f0',
                      }}>
                        <Space size={6}>
                          <DatabaseOutlined style={{ color: '#1890ff' }} />
                          <Text code style={{ fontSize: 11 }}>{a.name}</Text>
                        </Space>
                        <Space size={4}>
                          <Tag style={{ fontSize: 10, margin: 0 }}>{a.asset_type}</Tag>
                          <Badge status={STATUS_COLOR[a.status] as any} text={
                            <Text style={{ fontSize: 11 }}>{STATUS_LABEL[a.status]}</Text>
                          } />
                        </Space>
                      </div>
                    )
                  })}
                </Space>
              )}
            </Card>

            <Card title="설치된 패키지" size="small">
              <Table
                dataSource={selected.inventory}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '패키지', dataIndex: 'package_name' },
                  {
                    title: '버전', dataIndex: 'version', width: 90,
                    render: (v: string) => <Tag color="blue">{v}</Tag>,
                  },
                  { title: '설치 경로', dataIndex: 'install_path', render: (v: string | null) => (
                    <Text type="secondary" style={{ fontSize: 11 }}>{v ?? '—'}</Text>
                  )},
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  )
}
