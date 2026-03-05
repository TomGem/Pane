module.exports = {
  apps: [{
    name: 'pane',
    script: 'build/index.js',
    env: {
      PORT: 3000,
      HOST: '127.0.0.1'
    }
  }]
};
