const rachaService = require('../services/rachaService');

/**
 * Configura os handlers de Socket.IO.
 * Cada cliente entra em uma "sala" identificada pelo racha que está visualizando.
 * Assim, broadcasts (jogador entrou, racha fechado) só vão para os interessados.
 */
function attachSocket(io) {
  io.on('connection', (socket) => {
    socket.on('racha:entrar', ({ rachaId }) => {
      if (typeof rachaId !== 'string') return;

      const racha = rachaService.getRacha(rachaId);
      if (!racha) {
        socket.emit('racha:erro', { message: 'Racha não encontrado' });
        return;
      }

      socket.join(`racha:${rachaId}`);

      const jogadores = rachaService.listarJogadores(rachaId);
      socket.emit('jogadores:atualizados', { jogadores });
    });

    socket.on('racha:sair', ({ rachaId }) => {
      if (typeof rachaId !== 'string') return;
      socket.leave(`racha:${rachaId}`);
    });
  });
}

module.exports = { attachSocket };
