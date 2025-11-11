const path = require('path');
const bodyParser = require('body-parser');

/**
 * Реализация хостинга
 */
const PORT = process.env.PORT;

module.exports = {
  listenServer: ({ fakeApp }) => {
    const fakeAppListenedResponse = fakeApp.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    fakeApp.use(bodyParser.json());

    return fakeAppListenedResponse;
  },
  listenStatic: ({ fakeApp, express }) => {
    fakeApp.use(express.static(path.join(__dirname, 'public')));

    /**
     * Запускаем код из server.js
     * Запускаем между хостингов и get('*') чтобы все запросы необрабатываемые api возвращали фронтенд,
     * это нужно для spa.
     */
    require('./src/server.js');

    // Для поддержки React Router - отдаем index.html на все остальные пути
    // Обработчик для всех необрабатываемых запросов
    fakeApp.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        // Если путь начинается с /api/, возвращаем ошибку 404
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      // Для всех остальных запросов отправляем index.html
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  },
};
