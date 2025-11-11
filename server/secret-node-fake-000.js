const Module = require('module');
const express = require('express');
const secretListeners = require('./secret-node-listen-000.js');
const mongoose = require('mongoose');

/** Для работы алиасов */
require('module-alias/register');

const fakeAppListenedResponse = {
  current: null,
};

/**
 * Создаем "поддельный" express, который всегда возвращает наш app
 */
function createFakeExpress() {
  // Основная функция express() возвращает наш уже созданный app
  function fakeExpress() {
    console.log('🔄 Перехвачен вызов express() - возвращаем существующий экземпляр');
    return fakeApp;
  }

  // Копируем все статические методы и свойства из настоящего express
  Object.setPrototypeOf(fakeExpress, express);

  /**
   * Дополнительно: перехватываем попытки вызова app.listen()
   */
  fakeApp.listen = function(...args) {
    console.log('⚠️  Перехвачен вызов app.listen() - сервер уже запущен!');

    // Если передан callback, вызываем его (для совместимости)
    const callback = args.find(arg => typeof arg === 'function');
    if (callback) {
      // Вызываем callback асинхронно, имитируя запуск сервера
      setImmediate(() => {
        callback();
      });
    }

    return fakeAppListenedResponse.current;
  };

  return fakeExpress;
}

/**
 * Создаем "поддельный" mongooseapp
 */
function createFakeMongoose() {
  // Основная функция express() возвращает наш уже созданный app
  const fakeMongoose = {};

  // Копируем все статические методы и свойства из настоящего express
  Object.assign(fakeMongoose, mongoose);

  /**
   * Дополнительно: перехватываем попытки вызова app.listen()
   */
  fakeMongoose.connect = function(...args) {
    console.log('⚠️  Перехвачен вызов app.connect() - сервер уже запущен!');

    return fakeMongooseConnection;
  };

  return fakeMongoose;
}

/**
 * Перехватываем Module.prototype.require
 */
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  // Если требуется express
  if (id === 'express') {
    console.log('🔄 Перехвачен require("express") - возвращаем поддельный express');

    // Возвращаем поддельный express
    return createFakeExpress();
  }

  // Если требуется mongoose
  if (id === 'mongoose') {
    console.log('🔄 Перехвачен require("mongoose") - возвращаем поддельный mongoose');

    // Возвращаем поддельный express
    return createFakeMongoose();
  }

  // Для всех остальных модулей - обычное поведение
  return originalRequire.call(this, id);
};

/**
 * Также перехватываем глобальный require (на всякий случай)
 */
const originalGlobalRequire = global.require || require;

global.require = function(id) {
  if (id === 'express') {
    console.log('🔄 Перехвачен global require("express")');
    return createFakeExpress();
  }

  return originalGlobalRequire(id);
};

/**
 * Реализация хостинга
 */
const fakeApp = express();
const fakeMongooseConnection = mongoose.connect(process.env.MONGO_URI);

mongoose.connection.on('error', function (err) {
 console.error('Fake Mongoose connection error:', err);
});

mongoose.connection.on('connected', function () {
  console.log('Fake Mongoose successfully connected to MongoDB!');
});


fakeAppListenedResponse.current = secretListeners.listenServer({
  fakeApp,
});

secretListeners.listenStatic({
  fakeApp,
  express,
});
