module.exports = {
  apps: [{
    name: 'music-bot',
    script: './dist/index.js',
    cwd: '/root/music-bot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      // Inherit PATH to ensure yt-dlp and other binaries are found
      PATH: process.env.PATH
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
    
    // Kill timeout (give yt-dlp time to finish)
    kill_timeout: 5000,
    
    // Wait for process to be ready
    wait_ready: false,
    
    // Node.js specific args
    node_args: [
      '--max-old-space-size=512'
    ]
  }]
};
