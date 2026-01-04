module.exports = {
  apps: [{
    name: 'music-bot-dashboard',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 4123',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 4123
    },
    
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Restart behavior
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Kill timeout
    kill_timeout: 5000,
    
    // Wait for process to be ready
    wait_ready: false,
    
    // Node.js specific args
    node_args: [
      '--max-old-space-size=256'
    ]
  }]
};
