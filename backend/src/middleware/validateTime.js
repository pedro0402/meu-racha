const rachaService = require('../services/rachaService');
const {
  isListaAbertaParaRacha,
  isRachaExpirada,
  nowAsLocalString,
} = require('../utils/time');
const config = require('../config');

/**
 * Retorna `{ status, payload }` se a lista não aceita novas entradas; caso contrário `null`.
 * Usado pelo middleware de POST e pela rota GET …/token-entrada.
 */
function avaliarEntradaNaLista(racha) {
  if (!racha) {
    return { status: 404, payload: { error: 'RACHA_NAO_ENCONTRADO' } };
  }

  if (isRachaExpirada(racha)) {
    return {
      status: 410,
      payload: {
        error: 'LISTA_EXPIRADA',
        message: 'A lista deste racha expirou e não está mais disponível.',
        data_abertura: racha.data_abertura,
        expira_em: racha.expira_em,
        agora: nowAsLocalString(),
        timezone: config.timezone,
      },
    };
  }

  if (!isListaAbertaParaRacha(racha)) {
    return {
      status: 403,
      payload: {
        error: 'LISTA_FECHADA',
        message: racha.data_abertura
          ? `A lista deste racha abre em ${racha.data_abertura.replace('T', ' ')} (${config.timezone}).`
          : `A lista padrão só abre aos domingos a partir das ${config.horaMinima}:00 (${config.timezone}).`,
        data_abertura: racha.data_abertura,
        agora: nowAsLocalString(),
        timezone: config.timezone,
      },
    };
  }

  return null;
}

/**
 * Middleware que bloqueia entradas fora da janela permitida.
 * A validação acontece SEMPRE no servidor — ignoramos o relógio do cliente.
 *
 * Se o racha definiu `data_abertura`, ela é a regra. Caso contrário,
 * cai no padrão (DIA_PERMITIDO + HORA_MINIMA).
 */
async function validateTime(req, res, next) {
  try {
    const racha = await rachaService.getRacha(req.params.id);
    const bloqueio = avaliarEntradaNaLista(racha);
    if (bloqueio) {
      return res.status(bloqueio.status).json(bloqueio.payload);
    }
    req.racha = racha;
    return next();
  } catch (err) {
    return next(err);
  }
}

validateTime.avaliarEntradaNaLista = avaliarEntradaNaLista;
module.exports = validateTime;
