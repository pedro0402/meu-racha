require('dotenv').config();

function normalizeOrigin(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed).origin;
  } catch (_err) {
    return trimmed.replace(/\/$/, '');
  }
}

function parseOriginList(value) {
  return String(value || '')
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
}

const frontendOrigins = parseOriginList(process.env.FRONTEND_URL || 'http://localhost:5173');
const frontendUrl = frontendOrigins[0] || 'http://localhost:5173';

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl,
  frontendOrigins,
  database: {
    url: process.env.DATABASE_URL || '',
    ssl: process.env.DATABASE_SSL || '',
  },
  maxJogadores: parseInt(process.env.MAX_JOGADORES || '18', 10),
  listaExpiracaoHoras: parseInt(process.env.LISTA_EXPIRACAO_HORAS || '24', 10),
  diaPermitido: parseInt(process.env.DIA_PERMITIDO || '0', 10),
  horaMinima: parseInt(process.env.HORA_MINIMA || '12', 10),
  timezone: process.env.TIMEZONE || 'America/Sao_Paulo',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'MeuRacha <noreply@meuracha.app>',
  },
};

module.exports = config;
