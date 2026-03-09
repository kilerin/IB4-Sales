/**
 * PM2 ecosystem config for IB4 Sales.
 * Запуск: pm2 start ecosystem.config.cjs
 * Приложение слушает порт 3001 (чтобы не конфликтовать с другими сервисами).
 */
module.exports = {
  apps: [
    {
      name: 'ib4sales',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
