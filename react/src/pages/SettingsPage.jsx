import React, { useEffect } from 'react';
import { Card, Row, Col, Form, Input, InputNumber, Button, Space, Typography, message, Select } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '../api/settings';

const { Title, Paragraph, Text } = Typography;

export default function SettingsPage() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isFetching, error: settingsError } = useQuery({ queryKey: ['settings'], queryFn: getSettings, staleTime: 30000 });

  useEffect(() => {
    if (settingsError) {
      const errMsg = settingsError?.response?.data?.error?.message || 'Не удалось загрузить настройки';
      message.error(errMsg);
    }
  }, [settingsError]);

  useEffect(() => {
    if (data) {
      form.setFieldsValue({
        telegramBotToken: data.telegramBotToken || '',
        telegramProviderToken: data.telegramProviderToken || '',
        title: data.title || '',
        description: data.description || '',
        currency: data.currency || 'RUB',
        amount: typeof data.amount === 'number' ? data.amount : undefined,
        successMessage: data.successMessage || ''
      });
    }
  }, [data, form]);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      message.success('Настройки сохранены');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.error?.message || 'Не удалось сохранить настройки';
      message.error(errMsg);
    }
  });

  const onFinish = async (values) => {
    await mutateAsync(values);
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>Настройки провайдера</Title>
      <Paragraph type="secondary">
        Заполните токены и параметры платежей. Сумма указывается в минорных единицах (например, копейки).
      </Paragraph>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          disabled={isFetching || isPending}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="telegramBotToken"
                label="Токен Telegram-бота"
                rules={[{ required: true, message: 'Укажите токен бота' }]}
              >
                <Input.Password placeholder="Например: 123456:ABCDEF..." autoComplete="off" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="telegramProviderToken"
                label="Токен провайдера платежей"
                rules={[{ required: true, message: 'Укажите токен провайдера' }]}
              >
                <Input.Password placeholder="Секретный токен провайдера" autoComplete="off" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="title" label="Заголовок" rules={[{ required: true, message: 'Укажите заголовок' }]}> 
                <Input placeholder="Название платежа" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="currency" label="Валюта" rules={[{ required: true, message: 'Укажите валюту' }]}> 
                <Select
                  options={[{ label: 'RUB', value: 'RUB' }]}
                  placeholder="Выберите валюту"
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="description" label="Описание"> 
                <Input.TextArea placeholder="Краткое описание платежа" rows={3} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="amount"
                label={
                  <span>
                    Сумма, минорные единицы (<Text type="secondary">копейки</Text>)
                  </span>
                }
                rules={[
                  { required: true, message: 'Укажите сумму' },
                  {
                    validator: (_, value) => {
                      if (value === undefined || value === null) return Promise.resolve();
                      if (Number(value) > 0) return Promise.resolve();
                      return Promise.reject(new Error('Сумма должна быть больше 0'));
                    }
                  }
                ]}
              > 
                <InputNumber style={{ width: '100%' }} min={1} step={1} placeholder="Например: 19900 (это 199.00)" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="successMessage" label="Сообщение об успехе">
                <Input.TextArea rows={3} placeholder="Payment received: {amount} {currency}. Thank you!" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={isPending}>Сохранить</Button>
              <Button htmlType="button" onClick={() => form.resetFields()}>Сбросить</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
}
