import { useEffect, useState } from 'react'
import {
  Table, Card, Tag, Badge, Drawer, Space, Typography,
  Button, Descriptions, Row, Col, Statistic,
} from 'antd'
import { ReloadOutlined, RobotOutlined } from '@ant-design/icons'
import api, { AgentNode } from '../api/client'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Text } = Typography

export default function Agents() {
  const [agents, setAgents]   = useState<AgentNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AgentNode | null>(null)

  const load = () => {
    setLoading(true)
    api.get<AgentNode[]>('/agents').then(r => {
      setAgents(r.data)
      setLoading(false)
    })
  }

  useEffect(load, [])

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
