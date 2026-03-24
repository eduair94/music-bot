module.exports = {
  apps: [{
    name: 'music-bot',
    script: './dist/index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    node_args: '-r dotenv/config',
  }]
};
