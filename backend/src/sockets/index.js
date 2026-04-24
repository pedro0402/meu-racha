const rachaService = require('../services/rachaService');
const { isRachaExpirada } = require('../utils/time');

const EVENT_RATE_LIMITS = {
  'racha:entrar': { windowMs: 10_000, max: 20 },
  'racha:sair': { windowMs: 10_000, max: 40 },
};

const MAX_CONNS_PER_IP_PER_ROOM = 5;

function getClientIp(socket) {
  const xff = socket.handshake?.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return socket.handshake?.address || 'unknown';
}

function canProcessEvent(socket, eventName) {
  const cfg = EVENT_RATE_LIMITS[eventName];
  if (!cfg) return true;

  const now = Date.now();
  if (!socket.data.eventHits) socket.data.eventHits = new Map();

  const hits = socket.data.eventHits.get(eventName) || [];
  const threshold = now - cfg.windowMs;
  const recentHits = hits.filter((ts) => ts > threshold);

  if (recentHits.length >= cfg.max) {
    return false;
  }

  recentHits.push(now);
  socket.data.eventHits.set(eventName, recentHits);
  return true;
}

function connKey(ip, room) {
  return `${ip}::${room}`;
}

/**
 * Configura os handlers de Socket.IO.
 * Cada cliente entra em uma "sala" identificada pelo racha que está visualizando.
 * Assim, broadcasts (jogador entrou, racha fechado) só vão para os interessados.
 */
function attachSocket(io) {
  const roomConnByIp = new Map();

  function releaseRoom(socket, room) {
    if (!socket.data.joinedRooms?.has(room)) return;

    socket.data.joinedRooms.delete(room);
    const ip = socket.data.clientIp;
    const key = connKey(ip, room);
    const current = roomConnByIp.get(key) || 0;
    if (current <= 1) {
      roomConnByIp.delete(key);
    } else {
      roomConnByIp.set(key, current - 1);
    }
  }

  io.on('connection', (socket) => {
    socket.data.clientIp = getClientIp(socket);
    socket.data.joinedRooms = new Set();

    socket.on('racha:entrar', async ({ rachaId }) => {
      if (typeof rachaId !== 'string') return;
      if (!canProcessEvent(socket, 'racha:entrar')) {
        socket.emit('racha:erro', { message: 'Muitas tentativas em pouco tempo. Aguarde e tente novamente.' });
        return;
      }

      const room = `racha:${rachaId}`;
      if (!socket.data.joinedRooms.has(room)) {
        const key = connKey(socket.data.clientIp, room);
        const roomCount = roomConnByIp.get(key) || 0;
        if (roomCount >= MAX_CONNS_PER_IP_PER_ROOM) {
          socket.emit('racha:erro', {
            message: 'Limite de conexões por IP para esta sala foi atingido.',
          });
          return;
        }
      }

      try {
        const racha = await rachaService.getRacha(rachaId);
        if (!racha) {
          socket.emit('racha:erro', { message: 'Racha não encontrado' });
          return;
        }

        if (isRachaExpirada(racha)) {
          socket.emit('racha:erro', { message: 'A lista deste racha expirou e não está mais disponível.' });
          return;
        }

        socket.join(room);
        if (!socket.data.joinedRooms.has(room)) {
          socket.data.joinedRooms.add(room);
          const key = connKey(socket.data.clientIp, room);
          roomConnByIp.set(key, (roomConnByIp.get(key) || 0) + 1);
        }

        const jogadores = await rachaService.listarJogadores(rachaId);
        socket.emit('jogadores:atualizados', { jogadores });
      } catch (_err) {
        socket.emit('racha:erro', { message: 'Erro interno ao carregar racha.' });
      }
    });

    socket.on('racha:sair', ({ rachaId }) => {
      if (typeof rachaId !== 'string') return;
      if (!canProcessEvent(socket, 'racha:sair')) return;

      const room = `racha:${rachaId}`;
      socket.leave(room);
      releaseRoom(socket, room);
    });

    socket.on('disconnect', () => {
      const rooms = Array.from(socket.data.joinedRooms || []);
      rooms.forEach((room) => releaseRoom(socket, room));
    });
  });
}

module.exports = { attachSocket };
