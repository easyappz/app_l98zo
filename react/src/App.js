import React, { useMemo } from 'react';
import { Layout, Menu, Typography } from 'antd';
import { SettingOutlined, BarChartOutlined } from '@ant-design/icons';
import { Routes, Route, Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import './App.css';

const { Header, Sider, Content } = Layout;

function AdminLayout() {
  const location = useLocation();
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/admin/stats')) return 'stats';
    return 'settings';
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={240} breakpoint="lg" collapsedWidth={64}>
        <div style={{ padding: 16 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>Меню</Typography.Title>
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]}> 
          <Menu.Item key="settings" icon={<SettingOutlined />}> 
            <Link to="/admin/settings">Настройки</Link>
          </Menu.Item>
          <Menu.Item key="stats" icon={<BarChartOutlined />}> 
            <Link to="/admin/stats">Статистика</Link>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Админка платежей (Telegram + ЮКАССА)
          </Typography.Title>
        </Header>
        <Content style={{ margin: 24 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/settings" replace />} />
        <Route path="/admin" element={<AdminLayout />}> 
          <Route index element={<Navigate to="settings" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="stats" element={<StatsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/settings" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
