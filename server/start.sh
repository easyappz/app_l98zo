#!/bin/bash
export MONGO_URI=mongodb://localhost:27017
export PORT=80
forever start -a ./secret-node-fake-000.js