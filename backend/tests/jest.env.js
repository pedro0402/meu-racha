// Configura ambiente para todos os testes ANTES de qualquer require do app.
process.env.DATABASE_PATH = ':memory:';
process.env.TIMEZONE = 'America/Sao_Paulo';
process.env.MAX_JOGADORES = '18';
process.env.DIA_PERMITIDO = '0';
process.env.HORA_MINIMA = '12';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.DATABASE_SSL = '';
