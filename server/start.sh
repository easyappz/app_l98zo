#!/bin/bash
export MONGO_URI=mongodb://localhost:27017
export PORT=80

forever start \
  -a \
  -l /root/app_l98zo/server/forever.log \
  -o /root/app_l98zo/server/out.log \
  -e /root/app_l98zo/server/error.log \
  --minUptime 5000 \
  --spinSleepTime 2000 \
  --uid "my-app" \
  ./secret-node-fake-000.js

echo "Application started with forever (auto-restart enabled)"
forever list