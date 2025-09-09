import React, { useEffect } from 'react';
import { Card, Row, Col, Form, Input, InputNumber, Button, Space, Typography, message, Alert, Divider } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings, restartBot } from '../api/settings';

const { Title, Paragraph, Text } = Typography;

function sanitizeCurrency(input) {
  try {
    const str = (input || '').toString();
    let result = '';
    for (let i = 0; i < str.length; i += 1) {
      const code = str.charCodeAt(i);
      const isUpper = code >= 65 && code <= 90;
      const isLower = code >= 97 && code <= 122;
      if (isUpper) {
        result += str[i];
      } else if (isLower) {
        result += String.fromCharCode(code - 32);
      }
      if (result.length >= 3) break;
    }
    return result.slice(0, 3);
  } catch (e) {
    return '';
  }
}

function isThreeUppercaseLetters(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.length !== 3) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isUpper = code >= 65 && code <= 90;
    if (!isUpper) return false;
  }
  return true;
}

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
        amount: typeof data.amount === 'number' ? Math.round(data.amount) : undefined,
        successMessage: data.successMessage || ''
      });
    }
  }, [data, form]);

  const saveMutation = useMutation({
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

  const restartMutation = useMutation({
    mutationFn: restartBot,
    onSuccess: (res) => {
      if (res && res.restarted) {
        if (res.hasTokens) {
          message.success('Бот перезапущен');
        } else {
          message.warning('Бот перезапущен, но токены не заданы. Укажите токены в настройках.');
        }
      } else {
        message.info('Перезапуск выполнен');
      }
    },
    onError: (error) => {
      const errMsg = error?.response?.data?.error?.message || 'Не удалось перезапустить бота';
      message.error(errMsg);
    }
  });

  const handleCurrencyChange = (e) => {
    const next = sanitizeCurrency(e?.target?.value || '');
    form.setFieldsValue({ currency: next });
  };

  const onFinish = async (values) => {
    try {
      const payload = { ...values };

      // title: trim and hard-limit to 32
      const title = (payload.title || '').toString();
      payload.title = title.slice(0, 32);

      // currency: sanitize and validate
      payload.currency = sanitizeCurrency(payload.currency);
      if (!isThreeUppercaseLetters(payload.currency)) {
        message.error('Валюта должна состоять из 3 заглавных букв (например, RUB)');
        return;
      }

      // amount: integer > 0
      const amountNum = Number(payload.amount);
      if (!Number.isFinite(amountNum) || Math.round(amountNum) <= 0) {
        message.error('Сумма должна быть целым положительным числом в минорных единицах');
        return;
      }
      payload.amount = Math.round(amountNum);

      await saveMutation.mutateAsync(payload);

      try {
        const res = await restartMutation.mutateAsync();
        if (res && res.restarted && res.hasTokens) {
          // already notified in onSuccess, keep silent here
        }
      } catch (_) {
        // handled in mutation onError
      }
    } catch (e) {
      const errMsg = e?.message || 'Ошибка сохранения настроек';
      message.error(errMsg);
    }
  };

  const titleValue = Form.useWatch('title', form);
  const titleLen = (titleValue || '').length;

  const onManualRestart = async () => {
    try {
      await restartMutation.mutateAsync();
    } catch (_) {
      // errors handled in mutation
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>Настройки провайдера</Title>
      <Paragraph type="secondary">
        Заполните токены и параметры платежей. Сумма указывается в минорных единицах (например, копейки).
      </Paragraph>

      <Alert
        type="info"
        showIcon
        closable
        message="Подсказка по заполнению"
        description={(
          <div>
            <div>• Заголовок: до 32 символов.</div>
            <div>• Валюта: 3-буквенный код (например, RUB).</div>
            <div>• Сумма: в минорных единицах (например, 10000 для 100.00 RUB).</div>
            <div>• В сообщении об успехе доступны плейсхолдеры: {"{amount}"} и {"{currency}"}.</div>
          </div>
        )}
      />

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          disabled={isFetching || saveMutation.isPending || restartMutation.isPending}
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
              <Form.Item
                name="title"
                label="Заголовок"
                extra={<Text type="secondary">Символов: {titleLen}/32</Text>}
                rules={[
                  { required: true, message: 'Укажите заголовок' },
                  {
                    validator: (_, value) => {
                      const v = (value || '').toString();
                      if (v.length <= 32) return Promise.resolve();
                      return Promise.reject(new Error('Не более 32 символов'));
                    }
                  }
                ]}
              >
                <Input placeholder="Название платежа" maxLength={32} allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="currency"
                label="Валюта"
                extra={<Text type="secondary">3-буквенный код валюты (например, RUB)</Text>}
                rules={[
                  { required: true, message: 'Укажите валюту' },
                  {
                    validator: (_, value) => {
                      const v = sanitizeCurrency(value);
                      if (isThreeUppercaseLetters(v)) return Promise.resolve();
                      return Promise.reject(new Error('Должно быть 3 заглавные буквы'));
                    }
                  }
                ]}
              >
                <Input placeholder="RUB" maxLength={3} onChange={handleCurrencyChange} allowClear />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="description" label="Описание">
                <Input.TextArea placeholder="Краткое описание платежа" rows={3} allowClear />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                name="amount"
                label={(<span>Сумма, минорные единицы (<Text type="secondary">например, копейки</Text>)</span>)}
                extra={<Text type="secondary">Например: 10000 для 100.00 RUB</Text>}
                rules={[
                  { required: true, message: 'Укажите сумму' },
                  {
                    validator: (_, value) => {
                      if (value === undefined || value === null) return Promise.resolve();
                      const num = Number(value);
                      if (!Number.isFinite(num)) return Promise.reject(new Error('Введите корректное число'));
                      if (Math.round(num) !== num) return Promise.reject(new Error('Только целое число'));
                      if (num <= 0) return Promise.reject(new Error('Сумма должна быть больше 0'));
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} step={1} precision={0} placeholder="Например: 19900 (это 199.00)" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="successMessage"
                label="Сообщение об успехе"
                extra={<Text type="secondary">Можно использовать плейсхолдеры: {"{amount}"} и {"{currency}"}</Text>}
              >
                <Input.TextArea rows={3} placeholder="Payment received: {amount} {currency}. Thank you!" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 16px' }} />

          <Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>Сохранить</Button>
              <Button htmlType="button" onClick={() => form.resetFields()} disabled={saveMutation.isPending}>Сбросить</Button>
              <Button htmlType="button" onClick={onManualRestart} loading={restartMutation.isPending}>Перезапустить бота</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
}
