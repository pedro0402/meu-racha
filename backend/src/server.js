const { createApp } = require('./app');
const config = require('./config');

const { server } = createApp();

server.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}`);
  console.log(`[server] CORS liberado para ${config.frontendUrl}`);
});
