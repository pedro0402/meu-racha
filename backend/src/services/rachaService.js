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
  suplentes_habilitados = false,
  max_suplentes = 0,
}) {
  const id = genId();
  const expiraEm = data_abertura
    ? addHoursToLocalString(data_abertura, config.listaExpiracaoHoras)
    : null;

  if (!pg.isPostgresEnabled()) {
    const stmtInsertRacha = db.prepare(`
      INSERT INTO rachas (id, nome_dono, email, telefone, data_abertura, expira_em, max_jogadores, suplentes_habilitados, max_suplentes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmtInsertRacha.run(
      id,
      nome_dono,
      email,
      telefone,
      data_abertura,
      expiraEm,
      max_jogadores,
      suplentes_habilitados ? 1 : 0,
      max_suplentes,
    );
    return toSqliteRachaNotFound(db.prepare('SELECT * FROM rachas WHERE id = ?').get(id));
  }

  await ensurePostgresInit();
  await pg.query(
    `
      INSERT INTO rachas (id, nome_dono, email, telefone, data_abertura, expira_em, max_jogadores, suplentes_habilitados, max_suplentes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      id,
      nome_dono,
      email,
      telefone,
      data_abertura,
      expiraEm,
      max_jogadores,
      suplentes_habilitados,
      max_suplentes,
    ],
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
      SELECT id, nome, posicao, suplente, data_entrada
      FROM jogadores
      WHERE racha_id = ?
      ORDER BY id ASC
    `).all(rachaId);
  }

  await ensurePostgresInit();
  const res = await pg.query(
    `
      SELECT id, nome, posicao, suplente, data_entrada
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

      const titularesTotal = db.prepare('SELECT COUNT(*) AS total FROM jogadores WHERE racha_id = ? AND (suplente IS NULL OR suplente = 0)').get(txRachaId).total;
      const suplentesTotal = db.prepare('SELECT COUNT(*) AS total FROM jogadores WHERE racha_id = ? AND suplente = 1').get(txRachaId).total;
      const limiteTitulares = racha.max_jogadores;
      const suplentesHabilitados = Boolean(racha.suplentes_habilitados);
      const limiteSuplentes = racha.max_suplentes || 0;

      let inserirComoSuplente = false;
      if (titularesTotal < limiteTitulares) {
        inserirComoSuplente = false;
      } else if (suplentesHabilitados && suplentesTotal < limiteSuplentes) {
        inserirComoSuplente = true;
      } else {
        throw buildError('FULL', `Lista cheia (limite ${limiteTitulares})`);
      }

      try {
        db.prepare('INSERT INTO jogadores (racha_id, nome, nome_norm, posicao, suplente) VALUES (?, ?, ?, ?, ?)').run(
          txRachaId,
          txNome,
          txNomeNorm,
          txPosicao,
          inserirComoSuplente ? 1 : 0,
        );
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw buildError('DUPLICATE', 'Esse nome já está na lista');
        }
        throw e;
      }

      const jogadores = db.prepare(`
        SELECT id, nome, posicao, suplente, data_entrada
        FROM jogadores
        WHERE racha_id = ?
        ORDER BY id ASC
      `).all(txRachaId);

      const novoTitulares = db.prepare('SELECT COUNT(*) AS total FROM jogadores WHERE racha_id = ? AND (suplente IS NULL OR suplente = 0)').get(txRachaId).total;
      const novoSuplentes = db.prepare('SELECT COUNT(*) AS total FROM jogadores WHERE racha_id = ? AND suplente = 1').get(txRachaId).total;

      return {
        jogador: jogadores[jogadores.length - 1],
        jogadores,
        atingiuLimiteTitulares: novoTitulares >= limiteTitulares,
        atingiuLimiteSuplentes: suplentesHabilitados && novoSuplentes >= limiteSuplentes,
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

    const titularesRes = await tx.query('SELECT COUNT(*)::int AS total FROM jogadores WHERE racha_id = $1 AND (suplente IS NULL OR suplente = FALSE)', [rachaId]);
    const titularesTotal = titularesRes.rows[0]?.total || 0;
    const suplentesRes = await tx.query('SELECT COUNT(*)::int AS total FROM jogadores WHERE racha_id = $1 AND suplente = TRUE', [rachaId]);
    const suplentesTotal = suplentesRes.rows[0]?.total || 0;

    const limiteTitulares = racha.max_jogadores;
    const suplentesHabilitados = Boolean(racha.suplentes_habilitados);
    const limiteSuplentes = racha.max_suplentes || 0;

    let inserirComoSuplente = false;
    if (titularesTotal < limiteTitulares) {
      inserirComoSuplente = false;
    } else if (suplentesHabilitados && suplentesTotal < limiteSuplentes) {
      inserirComoSuplente = true;
    } else {
      throw buildError('FULL', `Lista cheia (limite ${limiteTitulares})`);
    }

    try {
      await tx.query(
        'INSERT INTO jogadores (racha_id, nome, nome_norm, posicao, suplente) VALUES ($1, $2, $3, $4, $5)',
        [rachaId, nome, nomeNorm, posicao, inserirComoSuplente],
      );
    } catch (e) {
      if (e.code === '23505') {
        throw buildError('DUPLICATE', 'Esse nome já está na lista');
      }
      throw e;
    }

    const jogadoresRes = await tx.query(
      `
        SELECT id, nome, posicao, suplente, data_entrada
        FROM jogadores
        WHERE racha_id = $1
        ORDER BY id ASC
      `,
      [rachaId],
    );

    const jogadores = jogadoresRes.rows;

    const novoTitularesRes = await tx.query('SELECT COUNT(*)::int AS total FROM jogadores WHERE racha_id = $1 AND (suplente IS NULL OR suplente = FALSE)', [rachaId]);
    const novoTitulares = novoTitularesRes.rows[0]?.total || 0;
    const novoSuplentesRes = await tx.query('SELECT COUNT(*)::int AS total FROM jogadores WHERE racha_id = $1 AND suplente = TRUE', [rachaId]);
    const novoSuplentes = novoSuplentesRes.rows[0]?.total || 0;

    return {
      jogador: jogadores[jogadores.length - 1],
      jogadores,
      atingiuLimiteTitulares: novoTitulares >= limiteTitulares,
      atingiuLimiteSuplentes: suplentesHabilitados && novoSuplentes >= limiteSuplentes,
    };
  });
}

/**
 * Marca pdf_gerado de forma atômica.
 * Retorna true SOMENTE se foi este chamador que conseguiu marcar.
 */
async function tentarReservarGeracaoPdf(rachaId, tipo = 'final') {
  // tipo: 'titulares' | 'final'
  if (!pg.isPostgresEnabled()) {
    if (tipo === 'titulares') {
      const result = db.prepare(`
        UPDATE rachas SET pdf_gerado_titulares = 1
        WHERE id = ? AND (pdf_gerado_titulares = 0 OR pdf_gerado_titulares IS NULL)
      `).run(rachaId);
      return result.changes === 1;
    }
    const result = db.prepare(`
      UPDATE rachas SET pdf_gerado_final = 1
      WHERE id = ? AND (pdf_gerado_final = 0 OR pdf_gerado_final IS NULL)
    `).run(rachaId);
    return result.changes === 1;
  }

  await ensurePostgresInit();
  if (tipo === 'titulares') {
    const res = await pg.query(
      'UPDATE rachas SET pdf_gerado_titulares = TRUE WHERE id = $1 AND pdf_gerado_titulares = FALSE',
      [rachaId],
    );
    return res.rowCount === 1;
  }

  const res = await pg.query(
    'UPDATE rachas SET pdf_gerado_final = TRUE WHERE id = $1 AND pdf_gerado_final = FALSE',
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
