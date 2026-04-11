import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, Badge, theme } from 'antd'
import {
  DashboardOutlined,
  DeploymentUnitOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  BellOutlined,
} from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import Deployments from './pages/Deployments'
import TestResults from './pages/TestResults'
import Alarms from './pages/Alarms'

const { Sider, Header, Content } = Layout
const { Title } = Typography

const NAV = [
  { key: '/',            label: '대시보드',      icon: <DashboardOutlined /> },
  { key: '/assets',      label: '자산 관리',     icon: <DeploymentUnitOutlined /> },
  { key: '/deployments', label: '소프트웨어 배포', icon: <CloudUploadOutlined /> },
  { key: '/test-results',label: '테스트 결과',   icon: <ExperimentOutlined /> },
  { key: '/alarms',      label: '알람',          icon: <BellOutlined /> },
]

export default function App() {
  const location = useLocation()
  const { token } = theme.useToken()

  const current = NAV.find(n => n.key === location.pathname)?.label ?? 'Dashboard'

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
        {/* Logo */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚙️</span>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>NI SystemLink</div>
              <div style={{ color: '#1890ff', fontSize: 11 }}>PoC v0.1</div>
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
          NI SystemLink PoC — Internal
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
            <Badge dot status="processing">
              <span style={{ cursor: 'pointer' }}>Live</span>
            </Badge>
            <span>Admin</span>
          </div>
        </Header>

        <Content style={{ padding: 24, minHeight: 'calc(100vh - 64px)' }}>
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/assets"        element={<Assets />} />
            <Route path="/deployments"   element={<Deployments />} />
            <Route path="/test-results"  element={<TestResults />} />
            <Route path="/alarms"        element={<Alarms />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
