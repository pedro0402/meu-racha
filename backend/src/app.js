const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const rachasRouter = require('./routes/rachas');
const { attachSocket } = require('./sockets');
const { isListaAbertaPadrao } = require('./utils/time');

/**
 * Cria a aplicação (Express + http.Server + Socket.IO) sem iniciá-la.
 * Útil para testes de integração com supertest.
 */
function createApp() {
  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: config.frontendUrl, methods: ['GET', 'POST'] },
  });

  app.use(cors({ origin: config.frontendUrl }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      listaAbertaPadrao: isListaAbertaPadrao(),
      timezone: config.timezone,
    });
  });

  app.use('/api/rachas', rachasRouter(io));

  attachSocket(io);

  return { app, server, io };
}

module.exports = { createApp };
