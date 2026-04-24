const { createApp } = require('./app');
const config = require('./config');
const postgres = require('./db/postgres');

const { server } = createApp();

async function bootstrap() {
  if (postgres.isPostgresEnabled()) {
    await postgres.runInitSqlIfNeeded();
    const ok = await postgres.testConnection();
    if (!ok) {
      throw new Error('Falha na verificação de conexão Postgres.');
    }
    console.log('[server] Banco ativo: postgres (Supabase)');
  } else {
    console.log('[server] Banco ativo: sqlite (local)');
  }

  server.listen(config.port, () => {
    console.log(`[server] http://localhost:${config.port}`);
    console.log(`[server] CORS liberado para ${config.frontendUrl}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Falha no bootstrap:', err);
  process.exit(1);
});
