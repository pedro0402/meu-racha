const rachaService = require('../services/rachaService');
const {
  isListaAbertaParaRacha,
  isRachaExpirada,
  nowAsLocalString,
} = require('../utils/time');
const config = require('../config');

/**
 * Middleware que bloqueia entradas fora da janela permitida.
 * A validação acontece SEMPRE no servidor — ignoramos o relógio do cliente.
 *
 * Se o racha definiu `data_abertura`, ela é a regra. Caso contrário,
 * cai no padrão (DIA_PERMITIDO + HORA_MINIMA).
 */
function validateTime(req, res, next) {
  const racha = rachaService.getRacha(req.params.id);
  if (!racha) {
    return res.status(404).json({ error: 'RACHA_NAO_ENCONTRADO' });
  }

  if (isRachaExpirada(racha)) {
    return res.status(410).json({
      error: 'LISTA_EXPIRADA',
      message: 'A lista deste racha expirou e não está mais disponível.',
      data_abertura: racha.data_abertura,
      expira_em: racha.expira_em,
      agora: nowAsLocalString(),
      timezone: config.timezone,
    });
  }

  if (isListaAbertaParaRacha(racha)) {
    req.racha = racha;
    return next();
  }

  return res.status(403).json({
    error: 'LISTA_FECHADA',
    message: racha.data_abertura
      ? `A lista deste racha abre em ${racha.data_abertura.replace('T', ' ')} (${config.timezone}).`
      : `A lista padrão só abre aos domingos a partir das ${config.horaMinima}:00 (${config.timezone}).`,
    data_abertura: racha.data_abertura,
    agora: nowAsLocalString(),
    timezone: config.timezone,
  });
}

module.exports = validateTime;
