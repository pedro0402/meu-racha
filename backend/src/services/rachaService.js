const { customAlphabet } = require('nanoid');
const db = require('../db/database');
const pg = require('../db/postgres');
const config = require('../config');
const { normalizeName } = require('../utils/normalize');
const { addHoursToLocalString } = require('../utils/time');

/**
 * Gera um ID curto e amigável para o link compartilhável.
 * Ex.: "kf3h8jq2x9"
 */
const genId = customAlphabet('abcdefghijkmnopqrstuvwxyz23456789', 10);

let initPromise = null;

async function ensurePostgresInit() {
  if (!pg.isPostgresEnabled()) return;
  if (!initPromise) {
    initPromise = pg.runInitSqlIfNeeded();
  }
  await initPromise;
}

function buildError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function normalizeInputName(nomeOriginal) {
  const nome = String(nomeOriginal).replace(/\s+/g, ' ').trim();
  const nomeNorm = normalizeName(nome);
  if (nomeNorm.length < 2) {
    throw buildError('INVALID_NAME', 'Nome inválido');
  }
  return { nome, nomeNorm };
}

function toSqliteRachaNotFound(value) {
  return value === undefined ? null : value;
}

async function criarRacha({
  nome_dono,
  email,
  telefone,
  data_abertura = null,
  max_jogadores = config.maxJogadores,
}) {
  const id = genId();
  const expiraEm = data_abertura
    ? addHoursToLocalString(data_abertura, config.listaExpiracaoHoras)
    : null;

  if (!pg.isPostgresEnabled()) {
    const stmtInsertRacha = db.prepare(`
      INSERT INTO rachas (id, nome_dono, email, telefone, data_abertura, expira_em, max_jogadores)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmtInsertRacha.run(id, nome_dono, email, telefone, data_abertura, expiraEm, max_jogadores);
    return toSqliteRachaNotFound(db.prepare('SELECT * FROM rachas WHERE id = ?').get(id));
  }

  await ensurePostgresInit();
  await pg.query(
    `
      INSERT INTO rachas (id, nome_dono, email, telefone, data_abertura, expira_em, max_jogadores)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [id, nome_dono, email, telefone, data_abertura, expiraEm, max_jogadores],
  );

  return getRacha(id);
}

async function getRacha(id) {
  if (!pg.isPostgresEnabled()) {
    return toSqliteRachaNotFound(db.prepare('SELECT * FROM rachas WHERE id = ?').get(id));
  }

  await ensurePostgresInit();
  const res = await pg.query('SELECT * FROM rachas WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function listarJogadores(rachaId) {
  if (!pg.isPostgresEnabled()) {
    return db.prepare(`
      SELECT id, nome, posicao, data_entrada
      FROM jogadores
      WHERE racha_id = ?
      ORDER BY id ASC
    `).all(rachaId);
  }

  await ensurePostgresInit();
  const res = await pg.query(
    `
      SELECT id, nome, posicao, data_entrada
      FROM jogadores
      WHERE racha_id = $1
      ORDER BY id ASC
    `,
    [rachaId],
  );
  return res.rows;
}

async function contarJogadores(rachaId) {
  if (!pg.isPostgresEnabled()) {
    return db.prepare('SELECT COUNT(*) AS total FROM jogadores WHERE racha_id = ?').get(rachaId).total;
  }

  await ensurePostgresInit();
  const res = await pg.query('SELECT COUNT(*)::int AS total FROM jogadores WHERE racha_id = $1', [rachaId]);
  return res.rows[0]?.total || 0;
}

/**
 * Adiciona um jogador respeitando:
 *  - existência do racha
 *  - limite de jogadores (atomicamente)
 *  - duplicidade de nome no mesmo racha (UNIQUE no banco)
 *  - posição válida (goleiro ou jogador)
 *
 * Retorna { jogador, jogadores, atingiuLimite }.
 */
async function adicionarJogador(rachaId, nomeOriginal, posicao = 'jogador') {
  const { nome, nomeNorm } = normalizeInputName(nomeOriginal);

  // Validar posição
  if (!['goleiro', 'jogador'].includes(posicao)) {
    throw buildError('POSICAO_INVALIDA', 'Posição deve ser "goleiro" ou "jogador"');
  }

  if (!pg.isPostgresEnabled()) {
    const addJogadorTx = db.transaction((txRachaId, txNome, txNomeNorm, txPosicao) => {
      const racha = db.prepare('SELECT * FROM rachas WHERE id = ?').get(txRachaId);
      if (!racha) {
        throw buildError('NOT_FOUND', 'Racha não encontrado');
      }

      const total = db.prepare('SELECT COUNT(*) AS total FROM jogadores WHERE racha_id = ?').get(txRachaId).total;
      const limite = racha.max_jogadores;
      if (total >= limite) {
        throw buildError('FULL', `Lista cheia (limite ${limite})`);
      }

      try {
        db.prepare('INSERT INTO jogadores (racha_id, nome, nome_norm, posicao) VALUES (?, ?, ?, ?)').run(
          txRachaId,
          txNome,
          txNomeNorm,
          txPosicao,
        );
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw buildError('DUPLICATE', 'Esse nome já está na lista');
        }
        throw e;
      }

      const jogadores = db.prepare(`
        SELECT id, nome, posicao, data_entrada
        FROM jogadores
        WHERE racha_id = ?
        ORDER BY id ASC
      `).all(txRachaId);

      return {
        jogador: jogadores[jogadores.length - 1],
        jogadores,
        atingiuLimite: jogadores.length >= limite,
      };
    });

    return addJogadorTx(rachaId, nome, nomeNorm, posicao);
  }

  await ensurePostgresInit();

  return pg.withTransaction(async (tx) => {
    const rachaRes = await tx.query('SELECT * FROM rachas WHERE id = $1 FOR UPDATE', [rachaId]);
    const racha = rachaRes.rows[0];
    if (!racha) {
      throw buildError('NOT_FOUND', 'Racha não encontrado');
    }

    const totalRes = await tx.query('SELECT COUNT(*)::int AS total FROM jogadores WHERE racha_id = $1', [rachaId]);
    const total = totalRes.rows[0]?.total || 0;
    const limite = racha.max_jogadores;
    if (total >= limite) {
      throw buildError('FULL', `Lista cheia (limite ${limite})`);
    }

    try {
      await tx.query(
        'INSERT INTO jogadores (racha_id, nome, nome_norm, posicao) VALUES ($1, $2, $3, $4)',
        [rachaId, nome, nomeNorm, posicao],
      );
    } catch (e) {
      if (e.code === '23505') {
        throw buildError('DUPLICATE', 'Esse nome já está na lista');
      }
      throw e;
    }

    const jogadoresRes = await tx.query(
      `
        SELECT id, nome, posicao, data_entrada
        FROM jogadores
        WHERE racha_id = $1
        ORDER BY id ASC
      `,
      [rachaId],
    );

    const jogadores = jogadoresRes.rows;
    return {
      jogador: jogadores[jogadores.length - 1],
      jogadores,
      atingiuLimite: jogadores.length >= limite,
    };
  });
}

/**
 * Marca pdf_gerado de forma atômica.
 * Retorna true SOMENTE se foi este chamador que conseguiu marcar.
 */
async function tentarReservarGeracaoPdf(rachaId) {
  if (!pg.isPostgresEnabled()) {
    const result = db.prepare(`
      UPDATE rachas SET pdf_gerado = 1
      WHERE id = ? AND pdf_gerado = 0
    `).run(rachaId);
    return result.changes === 1;
  }

  await ensurePostgresInit();
  const res = await pg.query(
    'UPDATE rachas SET pdf_gerado = TRUE WHERE id = $1 AND pdf_gerado = FALSE',
    [rachaId],
  );
  return res.rowCount === 1;
}

module.exports = {
  criarRacha,
  getRacha,
  listarJogadores,
  contarJogadores,
  adicionarJogador,
  tentarReservarGeracaoPdf,
};
