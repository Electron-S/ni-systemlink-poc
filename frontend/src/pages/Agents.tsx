import { useEffect, useState } from 'react'
import {
  Table, Card, Tag, Badge, Drawer, Space, Typography,
  Button, Descriptions, Row, Col, Statistic,
} from 'antd'
import { ReloadOutlined, RobotOutlined, DatabaseOutlined } from '@ant-design/icons'
import api, { AgentNode, Asset } from '../api/client'
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

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<AgentNode[]>('/agents'),
      api.get<Asset[]>('/assets'),
    ]).then(([ar, asr]) => {
      setAgents(ar.data)
      setAssets(asr.data)
      setLoading(false)
    })
  }

  useEffect(load, [])

  const assetMap = Object.fromEntries(assets.map(a => [a.id, a]))

  const onlineCnt  = agents.filter(a => a.status === 'online').length
  const offlineCnt = agents.filter(a => a.status === 'offline').length

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

  return (
    <div>
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
      </Row>

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
