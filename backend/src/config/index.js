require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  maxJogadores: parseInt(process.env.MAX_JOGADORES || '18', 10),
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
