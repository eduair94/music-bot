module.exports = {
  apps: [{
    name: 'music-bot',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
  }]
};
