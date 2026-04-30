const crypto = require('crypto');
const db = require('../db/database');
const pg = require('../db/postgres');
const config = require('../config');

/**
 * Emite um token descartável para uma tentativa de entrada na lista.
 * Deve ser chamado só quando a lista já está aberta para entradas (validado na rota).
 */
async function emitirTokenEntrada(rachaId) {
  if (pg.isPostgresEnabled()) {
    await pg.runInitSqlIfNeeded();
  }

  const token = crypto.randomUUID();
  const expira = new Date(Date.now() + config.entradaTokenTtlMs);
  const expiraIso = expira.toISOString();

  if (!pg.isPostgresEnabled()) {
    db.prepare(`
      INSERT INTO entrada_tokens (token, racha_id, expira_em)
      VALUES (?, ?, ?)
    `).run(token, rachaId, expiraIso);
    return { token, expiraEm: expiraIso };
  }

  await pg.query(
    `INSERT INTO entrada_tokens (token, racha_id, expira_em) VALUES ($1, $2, $3)`,
    [token, rachaId, expiraIso],
  );
  return { token, expiraEm: expiraIso };
}

module.exports = {
  emitirTokenEntrada,
};
