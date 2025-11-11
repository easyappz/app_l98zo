// Глобальный обработчик ошибок
window.onerror = function (message, source, lineno, colno, error) {
  // Используем StackTrace для парсинга стека ошибок
  StackTrace.fromError(error).then(stackframes => {
    // Формируем читаемый стек вызовов
    const stackString = stackframes
      .map(sf => `${sf.fileName || 'unknown'}:${sf.lineNumber || '?'}:${sf.columnNumber || '?'}`)
      .join('\n');

    // Формируем объект с данными об ошибке
    const errorData = {
      type: 'error',
      message: message,
      source: source,
      lineno: lineno,
      colno: colno,
      stack: stackString,
      timestamp: new Date().toISOString()
    };

    // Логируем в консоль
    console.error('Глобальная ошибка:', errorData);

    // Отправляем в родительский контекст (для iframe)
    window.parent.postMessage(errorData, '*');
  }).catch(err => {
    // Если не удалось распарсить стек
    console.error('Ошибка при парсинге стека:', err);
    const fallbackErrorData = {
      type: 'error',
      message: message,
      source: source,
      lineno: lineno,
      colno: colno,
      stack: error?.stack || 'Нет данных о стеке',
      timestamp: new Date().toISOString()
    };
    console.error('Глобальная ошибка (запасной вариант):', fallbackErrorData);
    window.parent.postMessage(fallbackErrorData, '*');
  });

  return true; // Предотвращаем стандартный вывод ошибки в консоль
};

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', function (event) {
  const reason = event.reason;
  // Парсим стек ошибки промиса
  StackTrace.fromError(reason).then(stackframes => {
    const stackString = stackframes
      .map(sf => `${sf.fileName || 'unknown'}:${sf.lineNumber || '?'}:${sf.columnNumber || '?'}`)
      .join('\n');

    const errorData = {
      type: 'promiseError',
      message: reason?.message || 'Необработанная ошибка промиса',
      stack: stackString,
      timestamp: new Date().toISOString()
    };

    // Логируем в консоль
    console.error('Необработанная ошибка промиса:', errorData);

    // Отправляем в родительский контекст
    window.parent.postMessage(errorData, '*');
  }).catch(err => {
    // Если не удалось распарсить стек
    console.error('Ошибка при парсинге стека промиса:', err);
    const fallbackErrorData = {
      type: 'promiseError',
      message: reason?.message || 'Необработанная ошибка промиса',
      stack: reason?.stack || 'Нет данных о стеке',
      timestamp: new Date().toISOString()
    };
    console.error('Необработанная ошибка промиса (запасной вариант):', fallbackErrorData);
    window.parent.postMessage(fallbackErrorData, '*');
  });

  event.preventDefault(); // Предотвращаем стандартный вывод
});
