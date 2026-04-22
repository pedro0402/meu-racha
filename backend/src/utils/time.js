const config = require('../config');

/**
 * Retorna {weekday, hour, minute} no fuso oficial do servidor.
 * NÃO confiamos no horário do cliente.
 */
function nowInTimezone() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const weekdayStr = parts.find((p) => p.type === 'weekday').value;
  const hour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute').value, 10);

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: weekdayMap[weekdayStr], hour, minute };
}

/**
 * Retorna a string "YYYY-MM-DDTHH:mm" representando o "agora"
 * no fuso oficial. Útil para comparar lexicograficamente com
 * a `data_abertura` do racha (que é gravada também como
 * "YYYY-MM-DDTHH:mm" no mesmo fuso).
 */
function nowAsLocalString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * Regra padrão (fallback): só abre no DIA_PERMITIDO a partir
 * de HORA_MINIMA. Mantida para retrocompatibilidade com rachas
 * antigos que não possuam `data_abertura`.
 */
function isListaAbertaPadrao() {
  const { weekday, hour } = nowInTimezone();
  return weekday === config.diaPermitido && hour >= config.horaMinima;
}

/**
 * Verifica se a lista de UM RACHA específico já está aberta.
 * - Se o racha tem data_abertura: compara com o "agora" no fuso oficial.
 * - Se não tem: aplica a regra padrão.
 */
function isListaAbertaParaRacha(racha) {
  if (!racha) return false;
  if (racha.data_abertura) {
    return nowAsLocalString() >= racha.data_abertura;
  }
  return isListaAbertaPadrao();
}

/**
 * Valida o formato "YYYY-MM-DDTHH:mm" enviado pelo cliente
 * (input <input type="datetime-local">).
 */
function isValidDataAbertura(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
}

module.exports = {
  nowInTimezone,
  nowAsLocalString,
  isListaAbertaPadrao,
  isListaAbertaParaRacha,
  isValidDataAbertura,
};
