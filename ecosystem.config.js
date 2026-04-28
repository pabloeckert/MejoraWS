// ecosystem.config.js — PM2 Configuration
// Uso: pm2 start ecosystem.config.js
// Logs: pm2 logs mejoraws
// Monit: pm2 monit

module.exports = {
  apps: [
    {
      name: 'mejoraws',
      script: 'dist/server.js',
      instances: 'max', // Cluster mode: 1 instance per CPU core
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // Health check
      health_check: {
        interval: 30000,
        timeout: 10000,
        retries: 3,
        url: 'http://localhost:3000/health',
      },

      // Exponential backoff restart
      exp_backoff_restart_delay: 1000,

      // Max restarts
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
}
