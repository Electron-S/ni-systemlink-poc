import { useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, Badge, theme, notification } from 'antd'
import {
  DashboardOutlined, DeploymentUnitOutlined,
  CloudUploadOutlined, ExperimentOutlined, BellOutlined,
  RobotOutlined, AuditOutlined, DotChartOutlined,
} from '@ant-design/icons'
import Dashboard           from './pages/Dashboard'
import Assets              from './pages/Assets'
import Deployments         from './pages/Deployments'
import TestResults         from './pages/TestResults'
import Alarms              from './pages/Alarms'
import Agents              from './pages/Agents'
import AuditLogs           from './pages/AuditLogs'
import ParametricAnalysis  from './pages/ParametricAnalysis'
import { WSContext, useWebSocketProvider, useRealtimeMetrics } from './hooks/useWebSocket'

const { Sider, Header, Content } = Layout
const { Title } = Typography

const NAV = [
  { key: '/',             label: '대시보드',       icon: <DashboardOutlined /> },
  { key: '/assets',       label: '자산 관리',       icon: <DeploymentUnitOutlined /> },
  { key: '/deployments',  label: '소프트웨어 배포', icon: <CloudUploadOutlined /> },
  { key: '/test-results', label: '테스트 결과',     icon: <ExperimentOutlined /> },
  { key: '/parametric',  label: '파라메트릭 분석',  icon: <DotChartOutlined /> },
  { key: '/alarms',       label: '알람',            icon: <BellOutlined /> },
  { key: '/agents',       label: 'PXI 에이전트',   icon: <RobotOutlined /> },
  { key: '/audit-logs',   label: '감사 로그',       icon: <AuditOutlined /> },
]

function AppLayout() {
  const location = useLocation()
  const { token } = theme.useToken()
  const { connected, events } = useRealtimeMetrics()
  const lastEventId = useRef<string | null>(null)
  const [api, contextHolder] = notification.useNotification()

  const current = NAV.find(n => n.key === location.pathname)?.label ?? '대시보드'

  useEffect(() => {
    if (events.length === 0) return
    const latest = events[0]
    if (lastEventId.current === latest.id) return
    lastEventId.current = latest.id

    const d = latest.data

    if (latest.event_type === 'alarm_triggered' && d.severity === 'critical') {
      api.error({
        message: '심각 알람 발생',
        description: d.message,
        placement: 'bottomRight',
        duration: 6,
      })
    } else if (latest.event_type === 'test_completed' && d.status === 'fail') {
      api.warning({
        message: '테스트 불합격',
        description: `${d.asset_name} — ${d.test_name}`,
        placement: 'bottomRight',
        duration: 4,
      })
    } else if (latest.event_type === 'deployment_done') {
      api.success({
        message: '배포 완료',
        description: `${d.name} 배포가 완료됐습니다 (성공 ${d.success}건)`,
        placement: 'bottomRight',
        duration: 4,
      })
    }
  }, [events])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      <Sider
        width={220}
        style={{
          background: '#001529',
          position: 'fixed',
          left: 0, top: 0, bottom: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚙️</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>NI SystemLink</div>
              <div style={{ color: '#1890ff', fontSize: 11 }}>내재화 PoC v0.2</div>
            </div>
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ marginTop: 8, flex: 1, borderRight: 0 }}
          items={NAV.map(n => ({
            key: n.key,
            icon: n.icon,
            label: <NavLink to={n.key}>{n.label}</NavLink>,
          }))}
        />

        <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
          Server 에디션 기준 내재화 검토
        </div>
      </Sider>

      <Layout style={{ marginLeft: 220 }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}>
          <Title level={4} style={{ margin: 0, color: token.colorTextHeading }}>{current}</Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: token.colorTextSecondary, fontSize: 13 }}>
            <Badge
              status={connected ? 'processing' : 'error'}
              text={connected ? '실시간 연결됨' : '연결 끊김'}
            />
            <span>Admin</span>
          </div>
        </Header>

        <Content style={{ padding: 24, minHeight: 'calc(100vh - 64px)' }}>
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/assets"        element={<Assets />} />
            <Route path="/deployments"   element={<Deployments />} />
            <Route path="/test-results"  element={<TestResults />} />
            <Route path="/parametric"    element={<ParametricAnalysis />} />
            <Route path="/alarms"        element={<Alarms />} />
            <Route path="/agents"        element={<Agents />} />
            <Route path="/audit-logs"    element={<AuditLogs />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  const wsValue = useWebSocketProvider()
  return (
    <WSContext.Provider value={wsValue}>
      <AppLayout />
    </WSContext.Provider>
  )
}
