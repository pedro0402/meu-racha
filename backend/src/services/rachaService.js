const { customAlphabet } = require('nanoid');
const db = require('../db/database');
const pg = require('../db/postgres');
const config = require('../config');
const { normalizeName } = require('../utils/normalize');
const { addHoursToLocalString } = require('../utils/time');
const { normalizeVisitorHash, isValidVisitorHash } = require('../utils/visitorHash');

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
  // Coluna `email` no Postgres é NOT NULL: sempre persistir string ('' se vazio), nunca NULL.
  const emailParaDb =
    email !== undefined && email !== null && String(email).trim() !== ''
      ? String(email).trim()
      : '';

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
      emailParaDb,
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
      emailParaDb,
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
 * Valida token de entrada e bloqueia visitor_hash duplicado no mesmo racha (SQLite).
 */
function validarTokenEVisitanteSqlite(txRachaId, txToken, txVisitorHash) {
  const row = db.prepare('SELECT * FROM entrada_tokens WHERE token = ? AND racha_id = ?').get(
    txToken,
    txRachaId,
  );
  if (!row) {
    throw buildError('TOKEN_INVALIDO', 'Token de entrada inválido ou inexistente.');
  }
  if (row.usado_em) {
    throw buildError('TOKEN_JA_USADO', 'Este token já foi utilizado.');
  }
  if (new Date(row.expira_em) <= new Date()) {
    throw buildError('TOKEN_EXPIRADO', 'O token de entrada expirou. Atualize a página e tente de novo.');
  }

  const jaVisitante = db
    .prepare('SELECT 1 AS x FROM jogadores WHERE racha_id = ? AND visitor_hash = ?')
    .get(txRachaId, txVisitorHash);
  if (jaVisitante) {
    throw buildError(
      'VISITOR_JA_INSCRITO',
      'Já há uma inscrição nesta lista a partir deste aparelho.',
    );
  }
}

/**
 * Adiciona um jogador respeitando:
 *  - existência do racha
 *  - token de entrada descartável (uso único)
 *  - no máximo uma inscrição por visitor_hash por racha
 *  - limite de jogadores (atomicamente)
 *  - duplicidade de nome no mesmo racha (UNIQUE no banco)
 *  - posição válida (goleiro ou jogador)
 *
 * opts: { entradaToken: string, visitorHash: string } — obrigatório na API.
 *
 * Retorna { jogador, jogadores, atingiuLimiteTitulares, atingiuLimiteSuplentes }.
 */
async function adicionarJogador(rachaId, nomeOriginal, posicao = 'jogador', opts = {}) {
  const entradaToken = opts?.entradaToken;
  const visitorHashRaw = opts?.visitorHash;
  const visitorHash = visitorHashRaw ? normalizeVisitorHash(visitorHashRaw) : '';

  if (!entradaToken || typeof entradaToken !== 'string' || !String(entradaToken).trim()) {
    throw buildError('TOKEN_OBRIGATORIO', 'Token de entrada ausente.');
  }
  if (!isValidVisitorHash(visitorHash)) {
    throw buildError('VISITOR_HASH_INVALIDO', 'Identificador de visitante inválido.');
  }

  const { nome, nomeNorm } = normalizeInputName(nomeOriginal);

  // Validar posição
  if (!['goleiro', 'jogador'].includes(posicao)) {
    throw buildError('POSICAO_INVALIDA', 'Posição deve ser "goleiro" ou "jogador"');
  }

  const txToken = String(entradaToken).trim();

  if (!pg.isPostgresEnabled()) {
    const addJogadorTx = db.transaction((txRachaId, txNome, txNomeNorm, txPosicao, tok, vHash) => {
      validarTokenEVisitanteSqlite(txRachaId, tok, vHash);

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
        db.prepare(
          'INSERT INTO jogadores (racha_id, nome, nome_norm, posicao, suplente, visitor_hash) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(txRachaId, txNome, txNomeNorm, txPosicao, inserirComoSuplente ? 1 : 0, vHash);
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          const msg = String(e.message || '');
          if (msg.includes('nome_norm')) {
            throw buildError('DUPLICATE', 'Esse nome já está na lista');
          }
          throw buildError('VISITOR_JA_INSCRITO', 'Já há uma inscrição nesta lista a partir deste aparelho.');
        }
        throw e;
      }

      db.prepare('UPDATE entrada_tokens SET usado_em = ? WHERE token = ?').run(new Date().toISOString(), tok);

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

    return addJogadorTx(rachaId, nome, nomeNorm, posicao, txToken, visitorHash);
  }

  await ensurePostgresInit();

  return pg.withTransaction(async (tx) => {
    const tokRes = await tx.query(
      `SELECT token, racha_id, expira_em, usado_em
       FROM entrada_tokens
       WHERE token = $1 AND racha_id = $2
       FOR UPDATE`,
      [txToken, rachaId],
    );
    const row = tokRes.rows[0];
    if (!row) {
      throw buildError('TOKEN_INVALIDO', 'Token de entrada inválido ou inexistente.');
    }
    if (row.usado_em) {
      throw buildError('TOKEN_JA_USADO', 'Este token já foi utilizado.');
    }
    if (new Date(row.expira_em) <= new Date()) {
      throw buildError('TOKEN_EXPIRADO', 'O token de entrada expirou. Atualize a página e tente de novo.');
    }

    const dupV = await tx.query(
      'SELECT 1 FROM jogadores WHERE racha_id = $1 AND visitor_hash = $2 LIMIT 1',
      [rachaId, visitorHash],
    );
    if (dupV.rows.length > 0) {
      throw buildError(
        'VISITOR_JA_INSCRITO',
        'Já há uma inscrição nesta lista a partir deste aparelho.',
      );
    }

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
        `INSERT INTO jogadores (racha_id, nome, nome_norm, posicao, suplente, visitor_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [rachaId, nome, nomeNorm, posicao, inserirComoSuplente, visitorHash],
      );
    } catch (e) {
      if (e.code === '23505') {
        const detail = String(e.detail || '');
        if (detail.includes('nome_norm')) {
          throw buildError('DUPLICATE', 'Esse nome já está na lista');
        }
        throw buildError('VISITOR_JA_INSCRITO', 'Já há uma inscrição nesta lista a partir deste aparelho.');
      }
      throw e;
    }

    await tx.query('UPDATE entrada_tokens SET usado_em = NOW() WHERE token = $1', [txToken]);

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
