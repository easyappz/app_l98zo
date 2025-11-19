import React from 'react';
import { Layout, Typography } from 'antd';
import ErrorBoundary from './ErrorBoundary';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import './App.css';

const { Header, Content } = Layout;

function AdminLayout() {
  return (
    <Layout style={{ minHeight: '100vh', width: '100%' }}>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Админка платежей (Telegram + ЮКАССА)
          </Typography.Title>
        </Header>
        <Content style={{ margin: 24 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24 }}>
            <SettingsPage />
            <br />
            <br />
            <br />
            <StatsPage />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AdminLayout />
    </ErrorBoundary>
  );
}

export default App;
