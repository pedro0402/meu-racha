const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const config = require('./config');
const rachasRouter = require('./routes/rachas');
const { attachSocket } = require('./sockets');
const { isListaAbertaPadrao } = require('./utils/time');
const postgres = require('./db/postgres');

function parseAllowedOrigins(frontendUrl) {
  return String(frontendUrl || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedLocalOrigin(origin, frontendUrl) {
  if (!origin) return true;

  try {
    const parsed = new URL(origin);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (isLocalHost) return true;
  } catch (_err) {
    // Continua tentando a origem configurada abaixo.
  }

  const allowedOrigins = parseAllowedOrigins(frontendUrl);
  return allowedOrigins.includes(origin);
}

/**
 * Cria a aplicação (Express + http.Server + Socket.IO) sem iniciá-la.
 * Útil para testes de integração com supertest.
 */
function createApp() {
  const app = express();
  const server = http.createServer(app);

  const corsOptions = {
    origin(origin, callback) {
      if (isAllowedLocalOrigin(origin, config.frontendUrl)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST'],
  };

  const io = new Server(server, {
    cors: corsOptions,
  });

  app.use(cors(corsOptions));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      databaseMode: postgres.isPostgresEnabled() ? 'postgres' : 'sqlite',
      listaAbertaPadrao: isListaAbertaPadrao(),
      timezone: config.timezone,
    });
  });

  app.use('/api/rachas', rachasRouter(io));

  attachSocket(io);

  return { app, server, io };
}

module.exports = { createApp };
