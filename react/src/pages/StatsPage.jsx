import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Space, Select, InputNumber, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getStats, getPayments } from '../api/payments';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusLabels = {
  pending: 'Ожидает',
  succeeded: 'Успешен',
  expired: 'Просрочен',
  failed: 'Ошибка'
};

export default function StatsPage() {
  const { data: stats, isFetching: statsLoading } = useQuery({ queryKey: ['stats'], queryFn: getStats });

  const [status, setStatus] = useState();
  const [limit, setLimit] = useState(50);

  const { data: payments = [], isFetching: paymentsLoading } = useQuery({
    queryKey: ['payments', { status, limit }],
    queryFn: () => getPayments({ status, limit, skip: 0 })
  });

  const columns = useMemo(() => [
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (val) => {
        let color = 'default';
        if (val === 'succeeded') color = 'green';
        if (val === 'pending') color = 'gold';
        if (val === 'expired') color = 'orange';
        if (val === 'failed') color = 'red';
        return <Tag color={color}>{statusLabels[val] || val}</Tag>;
      }
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
      render: (val, record) => {
        const currency = record?.currency || 'RUB';
        const major = typeof val === 'number' ? (val / 100).toFixed(2) : '-';
        return `${major} ${currency}`;
      }
    },
    {
      title: 'Пользователь',
      key: 'user',
      render: (_, r) => `UID: ${r?.userId || '-'} / Chat: ${r?.chatId || '-'}`
    },
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: 'Создано',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val) => val ? dayjs(val).format('DD.MM.YYYY HH:mm') : '-'
    },
    {
      title: 'Истекает',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (val) => val ? dayjs(val).format('DD.MM.YYYY HH:mm') : '-'
    }
  ], []);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>Статистика платежей</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card loading={statsLoading}>
            <Statistic title="Всего платежей" value={stats?.total || 0} />
          </Card>
        </Col>
        <Col xs={24} md={18}>
          <Row gutter={[16, 16]}> 
            <Col xs={12} md={6}>
              <Card loading={statsLoading}><Statistic title="Ожидают" value={stats?.byStatus?.pending || 0} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card loading={statsLoading}><Statistic title="Успешные" value={stats?.byStatus?.succeeded || 0} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card loading={statsLoading}><Statistic title="Просрочены" value={stats?.byStatus?.expired || 0} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card loading={statsLoading}><Statistic title="Ошибка" value={stats?.byStatus?.failed || 0} /></Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Card title="Список платежей" extra={
        <Space size={12}>
          <Select
            allowClear
            placeholder="Фильтр по статусу"
            style={{ width: 200 }}
            value={status}
            onChange={setStatus}
            options={[
              { label: 'Ожидает', value: 'pending' },
              { label: 'Успешен', value: 'succeeded' },
              { label: 'Просрочен', value: 'expired' },
              { label: 'Ошибка', value: 'failed' }
            ]}
          />
          <InputNumber
            min={1}
            max={200}
            value={limit}
            onChange={(v) => setLimit(Number(v || 50))}
            addonBefore="Лимит"
          />
        </Space>
      }>
        <Table
          rowKey={(r) => r._id}
          loading={paymentsLoading}
          dataSource={payments}
          columns={columns}
          pagination={false}
          size="middle"
        />
      </Card>
    </Space>
  );
}
