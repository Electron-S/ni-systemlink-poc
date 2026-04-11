import { useEffect, useState } from 'react'
import { Table, Card, Tag, Typography, Select, Space, Button } from 'antd'
import { ReloadOutlined, AuditOutlined } from '@ant-design/icons'
import api, { AuditLog } from '../api/client'
import dayjs from 'dayjs'

const { Text } = Typography

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'blue', UPDATE: 'cyan', DELETE: 'red',
  ACK: 'green', QUEUE: 'purple', CANCEL: 'orange',
}

const RESOURCE_TYPES = ['Deployment', 'Alarm', 'Asset', 'Agent']

export default function AuditLogs() {
  const [logs, setLogs]         = useState<AuditLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [resFilter, setResFilter] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const params: Record<string, unknown> = { limit: 200 }
    if (resFilter) params.resource_type = resFilter
    api.get<AuditLog[]>('/audit-logs', { params }).then(r => {
      setLogs(r.data)
      setLoading(false)
    })
  }

  useEffect(load, [resFilter])

  const columns = [
    {
      title: '시각', dataIndex: 'timestamp', width: 150,
      render: (v: string) => dayjs(v).format('MM/DD HH:mm:ss'),
      sorter: (a: AuditLog, b: AuditLog) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '사용자', dataIndex: 'user_identifier',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '액션', dataIndex: 'action', width: 100,
      render: (v: string) => <Tag color={ACTION_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: '리소스', dataIndex: 'resource_type', width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'ID', dataIndex: 'resource_id', width: 60,
      render: (v: number | null) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: '상세', dataIndex: 'detail',
      render: (v: Record<string, unknown>) => {
        const text = Object.entries(v)
          .map(([k, val]) => `${k}: ${val}`)
          .join(' · ')
        return <Text type="secondary" style={{ fontSize: 12 }}>{text || '—'}</Text>
      },
    },
  ]

  return (
    <Card
      extra={
        <Space>
          <Select
            allowClear
            placeholder="리소스 유형"
            style={{ width: 140 }}
            value={resFilter}
            onChange={v => setResFilter(v ?? null)}
            options={RESOURCE_TYPES.map(t => ({ value: t, label: t }))}
          />
          <Button icon={<ReloadOutlined />} onClick={load}>새로고침</Button>
        </Space>
      }
      title={
        <Space>
          <AuditOutlined />
          감사 로그
        </Space>
      }
    >
      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
      />
    </Card>
  )
}
