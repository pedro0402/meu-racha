const rachaService = require('../services/rachaService');
const { isRachaExpirada } = require('../utils/time');

/**
 * Configura os handlers de Socket.IO.
 * Cada cliente entra em uma "sala" identificada pelo racha que está visualizando.
 * Assim, broadcasts (jogador entrou, racha fechado) só vão para os interessados.
 */
function attachSocket(io) {
  io.on('connection', (socket) => {
    socket.on('racha:entrar', async ({ rachaId }) => {
      if (typeof rachaId !== 'string') return;

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

        socket.join(`racha:${rachaId}`);

        const jogadores = await rachaService.listarJogadores(rachaId);
        socket.emit('jogadores:atualizados', { jogadores });
      } catch (_err) {
        socket.emit('racha:erro', { message: 'Erro interno ao carregar racha.' });
      }
    });

    socket.on('racha:sair', ({ rachaId }) => {
      if (typeof rachaId !== 'string') return;
      socket.leave(`racha:${rachaId}`);
    });
  });
}

module.exports = { attachSocket };
