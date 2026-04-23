const { customAlphabet } = require('nanoid');
const db = require('../db/database');
const config = require('../config');
const { normalizeName } = require('../utils/normalize');

/**
 * Gera um ID curto e amigável para o link compartilhável.
 * Ex.: "kf3h8jq2x9"
 */
const genId = customAlphabet('abcdefghijkmnopqrstuvwxyz23456789', 10);

// ----------- Statements pré-compilados (mais performático) -----------

const stmtInsertRacha = db.prepare(`
  INSERT INTO rachas (id, nome_dono, email, telefone, data_abertura, max_jogadores)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const stmtGetRacha = db.prepare(`SELECT * FROM rachas WHERE id = ?`);

const stmtCountJogadores = db.prepare(`
  SELECT COUNT(*) AS total FROM jogadores WHERE racha_id = ?
`);

const stmtListJogadores = db.prepare(`
  SELECT id, nome, data_entrada
  FROM jogadores
  WHERE racha_id = ?
  ORDER BY id ASC
`);

const stmtInsertJogador = db.prepare(`
  INSERT INTO jogadores (racha_id, nome, nome_norm)
  VALUES (?, ?, ?)
`);

const stmtMarcarPdfGerado = db.prepare(`
  UPDATE rachas SET pdf_gerado = 1
  WHERE id = ? AND pdf_gerado = 0
`);

// ----------- Funções públicas -----------

function criarRacha({
  nome_dono,
  email,
  telefone,
  data_abertura = null,
  max_jogadores = config.maxJogadores,
}) {
  const id = genId();
  stmtInsertRacha.run(id, nome_dono, email, telefone, data_abertura, max_jogadores);
  return getRacha(id);
}

function getRacha(id) {
  return stmtGetRacha.get(id);
}

function listarJogadores(rachaId) {
  return stmtListJogadores.all(rachaId);
}

function contarJogadores(rachaId) {
  return stmtCountJogadores.get(rachaId).total;
}

/**
 * Adiciona um jogador respeitando:
 *  - existência do racha
 *  - limite de jogadores (atomicamente)
 *  - duplicidade de nome no mesmo racha (UNIQUE no banco)
 *
 * Toda a lógica é executada dentro de uma TRANSAÇÃO para evitar
 * que requisições concorrentes ultrapassem o limite (race condition).
 *
 * Retorna { jogador, jogadores, atingiuLimite }.
 */
const addJogadorTx = db.transaction((rachaId, nomeOriginal) => {
  const racha = stmtGetRacha.get(rachaId);
  if (!racha) {
    const err = new Error('Racha não encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const total = stmtCountJogadores.get(rachaId).total;
  const limite = racha.max_jogadores;
  if (total >= limite) {
    const err = new Error(`Lista cheia (limite ${limite})`);
    err.code = 'FULL';
    throw err;
  }

  const nome = nomeOriginal.replace(/\s+/g, ' ').trim();
  const nomeNorm = normalizeName(nome);

  if (nomeNorm.length < 2) {
    const err = new Error('Nome inválido');
    err.code = 'INVALID_NAME';
    throw err;
  }

  try {
    stmtInsertJogador.run(rachaId, nome, nomeNorm);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const err = new Error('Esse nome já está na lista');
      err.code = 'DUPLICATE';
      throw err;
    }
    throw e;
  }

  const jogadores = stmtListJogadores.all(rachaId);
  return {
    jogador: jogadores[jogadores.length - 1],
    jogadores,
    atingiuLimite: jogadores.length >= limite,
  };
});

function adicionarJogador(rachaId, nomeOriginal) {
  return addJogadorTx(rachaId, nomeOriginal);
}

/**
 * Marca pdf_gerado = 1 atomicamente.
 * Retorna true SOMENTE se foi este chamador que conseguiu marcar
 * (impede geração duplicada em race condition).
 */
function tentarReservarGeracaoPdf(rachaId) {
  const result = stmtMarcarPdfGerado.run(rachaId);
  return result.changes === 1;
}

module.exports = {
  criarRacha,
  getRacha,
  listarJogadores,
  contarJogadores,
  adicionarJogador,
  tentarReservarGeracaoPdf,
};
