#!/bin/bash

APP_NAME="my-app"
SCRIPT_PATH="./secret-node-fake-000.js"
LOG_DIR="/root/app_l98zo/server/logs"

# Создаем директорию для логов
mkdir -p $LOG_DIR

export MONGO_URI=mongodb://localhost:27017
export PORT=80

# Останавливаем если уже запущено
forever stop $APP_NAME 2>/dev/null || true

# Запускаем с настройками автоматического перезапуска
forever start \
  -a \
  --uid $APP_NAME \
  -l $LOG_DIR/forever.log \
  -o $LOG_DIR/out.log \
  -e $LOG_DIR/error.log \
  --minUptime 10000 \
  --spinSleepTime 5000 \
  --killSignal SIGTERM \
  $SCRIPT_PATH

echo "✅ Application '$APP_NAME' started with auto-restart"
echo "📊 Process info:"
forever list

# Скрипт для мониторинга (опционально)
echo "🔄 Monitoring script started. Press Ctrl+C to stop."
while true; do
    sleep 30
    if ! forever list | grep -q "$APP_NAME"; then
        echo "❌ Application crashed! Restarting..."
        forever start -a --uid $APP_NAME $SCRIPT_PATH
    fi
done