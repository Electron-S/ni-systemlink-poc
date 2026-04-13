import { useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, Badge, theme, notification } from 'antd'
import {
  DashboardOutlined, DeploymentUnitOutlined,
  CloudUploadOutlined, ExperimentOutlined, BellOutlined,
  RobotOutlined, AuditOutlined, DotChartOutlined,
  ScheduleOutlined, LineChartOutlined, SafetyCertificateOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import Dashboard           from './pages/Dashboard'
import Assets              from './pages/Assets'
import Deployments         from './pages/Deployments'
import TestResults         from './pages/TestResults'
import Alarms              from './pages/Alarms'
import Agents              from './pages/Agents'
import AuditLogs           from './pages/AuditLogs'
import ParametricAnalysis  from './pages/ParametricAnalysis'
import WorkOrders          from './pages/WorkOrders'
import FPY                 from './pages/FPY'
import SpecManager         from './pages/SpecManager'
import Utilization         from './pages/Utilization'
import { WSContext, useWebSocketProvider, useRealtimeMetrics } from './hooks/useWebSocket'

const { Sider, Header, Content } = Layout
const { Title } = Typography

// ── 페이지 메타: 경로 → 레이블 (헤더 타이틀용) ───────────────────────────────
const PAGE_LABELS: Record<string, string> = {
  '/':             '대시보드',
  '/assets':       '자산 목록',
  '/agents':       'PXI 에이전트',
  '/work-orders':  '작업 지시',
  '/test-results': '테스트 결과',
  '/fpy':          'FPY / Failure Pareto',
  '/parametric':   '파라메트릭 / SPC',
  '/utilization':  '장비 가동률',
  '/deployments':  '소프트웨어 배포',
  '/alarms':       '알람',
  '/specs':        '규격 관리',
  '/audit-logs':   '감사 로그',
}

// ── 그룹화된 메뉴 정의 ────────────────────────────────────────────────────────
function buildMenuItems(pathname: string) {
  const item = (key: string, icon: React.ReactNode, label: string) => ({
    key,
    icon,
    label: <NavLink to={key}>{label}</NavLink>,
  })

  return [
    item('/', <DashboardOutlined />, '대시보드'),

    {
      type: 'group' as const,
      label: 'SYSTEMS',
      children: [
        item('/assets',      <DeploymentUnitOutlined />, '자산 목록'),
        item('/agents',      <RobotOutlined />,          'PXI 에이전트'),
        item('/work-orders', <ScheduleOutlined />,       '작업 지시'),
      ],
    },

    {
      type: 'group' as const,
      label: 'TEST MANAGEMENT',
      children: [
        item('/test-results', <ExperimentOutlined />,       '테스트 결과'),
        item('/fpy',          <BarChartOutlined />,         'FPY / Pareto'),
        item('/parametric',   <DotChartOutlined />,         '파라메트릭 / SPC'),
        item('/utilization',  <LineChartOutlined />,        '장비 가동률'),
      ],
    },

    {
      type: 'group' as const,
      label: 'OPERATIONS',
      children: [
        item('/deployments', <CloudUploadOutlined />, '소프트웨어 배포'),
        item('/alarms',      <BellOutlined />,        '알람'),
      ],
    },

    {
      type: 'group' as const,
      label: 'CONFIGURATION',
      children: [
        item('/specs',      <SafetyCertificateOutlined />, '규격 관리'),
        item('/audit-logs', <AuditOutlined />,             '감사 로그'),
      ],
    },
  ]
}

function AppLayout() {
  const location = useLocation()
  const { token } = theme.useToken()
  const { connected, events } = useRealtimeMetrics()
  const lastEventId = useRef<string | null>(null)
  const [api, contextHolder] = notification.useNotification()

  const pageTitle = PAGE_LABELS[location.pathname] ?? '대시보드'

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
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* 로고 */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>⚙️</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>NI SystemLink</div>
              <div style={{ color: '#1890ff', fontSize: 11 }}>내재화 PoC v0.3</div>
            </div>
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{
            flex: 1,
            borderRight: 0,
            paddingBottom: 16,
            // 그룹 라벨 스타일 오버라이드
          }}
          items={buildMenuItems(location.pathname)}
        />

        <div style={{
          padding: '10px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.35)',
          fontSize: 10,
          flexShrink: 0,
        }}>
          Server 에디션 기준 내재화 검토
        </div>
      </Sider>

      {/* 그룹 라벨 CSS 인젝션 */}
      <style>{`
        .ant-menu-item-group-title {
          color: rgba(255,255,255,0.3) !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          letter-spacing: 0.08em !important;
          padding: 14px 24px 4px !important;
          user-select: none;
        }
        .ant-menu-item-group:not(:first-child) .ant-menu-item-group-title {
          border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: 4px;
        }
      `}</style>

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
          <Title level={4} style={{ margin: 0, color: token.colorTextHeading }}>{pageTitle}</Title>
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
            <Route path="/work-orders"   element={<WorkOrders />} />
            <Route path="/deployments"   element={<Deployments />} />
            <Route path="/test-results"  element={<TestResults />} />
            <Route path="/fpy"           element={<FPY />} />
            <Route path="/parametric"    element={<ParametricAnalysis />} />
            <Route path="/utilization"   element={<Utilization />} />
            <Route path="/specs"         element={<SpecManager />} />
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
