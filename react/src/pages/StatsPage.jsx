import React, { useMemo, useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Space, Select, Table, Tag, Typography, message } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getStats, getPayments } from '../api/payments';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusLabels = {
  pending: 'В ожидании',
  succeeded: 'Успешен',
  expired: 'Просрочен',
  failed: 'Ошибка'
};

export default function StatsPage() {
  const { data: stats, isFetching: statsLoading, error: statsError } = useQuery({ queryKey: ['stats'], queryFn: getStats, staleTime: 15000 });

  useEffect(() => {
    if (statsError) {
      const errMsg = statsError?.response?.data?.error?.message || 'Не удалось загрузить статистику';
      message.error(errMsg);
    }
  }, [statsError]);

  const [status, setStatus] = useState();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalCount = useMemo(() => {
    if (!stats) return 0;
    if (status) return Number(stats?.byStatus?.[status] || 0);
    return Number(stats?.total || 0);
  }, [stats, status]);

  const { data: payments = [], isFetching: paymentsLoading, error: paymentsError } = useQuery({
    queryKey: ['payments', { status, page, pageSize }],
    queryFn: () => getPayments({ status, limit: pageSize, skip: (page - 1) * pageSize }),
    keepPreviousData: true
  });

  useEffect(() => {
    if (paymentsError) {
      const errMsg = paymentsError?.response?.data?.error?.message || 'Не удалось загрузить платежи';
      message.error(errMsg);
    }
  }, [paymentsError]);

  // Calculate sum of succeeded payments (minor units) via pagination using stats counts
  const { data: succeededSum = 0, isFetching: sumLoading, error: sumError } = useQuery({
    queryKey: ['succeeded-sum', stats?.byStatus?.succeeded],
    enabled: typeof stats?.byStatus?.succeeded === 'number',
    queryFn: async () => {
      const count = Number(stats?.byStatus?.succeeded || 0);
      if (count <= 0) return 0;
      const pageLimit = 200;
      const pages = Math.ceil(count / pageLimit);
      let sum = 0;
      for (let i = 0; i < pages; i++) {
        const batch = await getPayments({ status: 'succeeded', limit: pageLimit, skip: i * pageLimit });
        for (const p of batch) {
          if (typeof p?.amount === 'number') sum += p.amount;
        }
      }
      return sum;
    }
  });

  useEffect(() => {
    if (sumError) {
      const errMsg = sumError?.response?.data?.error?.message || 'Не удалось посчитать сумму успешных платежей';
      message.error(errMsg);
    }
  }, [sumError]);

  const columns = useMemo(() => [
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val) => (val ? dayjs(val).format('DD.MM.YYYY HH:mm') : '-')
    },
    {
      title: 'Чат ID',
      dataIndex: 'chatId',
      key: 'chatId',
      render: (val) => (val ? String(val) : '-')
    },
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
      render: (val) => (typeof val === 'number' ? (val / 100).toFixed(2) : '-')
    },
    {
      title: 'Валюта',
      dataIndex: 'currency',
      key: 'currency',
      render: (val) => val || '-'
    },
    {
      title: 'Заголовок',
      dataIndex: 'title',
      key: 'title',
      render: (val) => val || '-'
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      render: (val) => val || '-'
    },
    {
      title: 'ProviderChargeId',
      dataIndex: 'providerPaymentChargeId',
      key: 'providerPaymentChargeId',
      render: (val) => val || '-'
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
              <Card loading={statsLoading}><Statistic title="В ожидании" value={stats?.byStatus?.pending || 0} /></Card>
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

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card loading={sumLoading}>
            <Statistic title="Сумма успешных (RUB)" value={(Number(succeededSum || 0) / 100).toFixed(2)} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Список платежей"
        extra={
          <Space size={12}>
            <Select
              allowClear
              placeholder="Фильтр по статусу"
              style={{ width: 220 }}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { label: 'В ожидании', value: 'pending' },
                { label: 'Успешен', value: 'succeeded' },
                { label: 'Просрочен', value: 'expired' },
                { label: 'Ошибка', value: 'failed' }
              ]}
            />
          </Space>
        }
      >
        <Table
          rowKey={(r) => r._id}
          loading={paymentsLoading}
          dataSource={payments}
          columns={columns}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          }}
        />
      </Card>
    </Space>
  );
}
