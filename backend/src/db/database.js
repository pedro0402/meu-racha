const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

/**
 * Caminho do banco. Pode ser sobrescrito por DATABASE_PATH.
 * Em testes, usamos `:memory:` para isolamento total entre execuções.
 */
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'meuracha.db');

if (dbPath !== ':memory:') {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);

if (dbPath !== ':memory:') {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rachas (
      id             TEXT PRIMARY KEY,
      nome_dono      TEXT NOT NULL,
      email          TEXT NOT NULL,
      telefone       TEXT NOT NULL,
      max_jogadores  INTEGER NOT NULL DEFAULT 18,
      suplentes_habilitados INTEGER NOT NULL DEFAULT 0,
      max_suplentes  INTEGER NOT NULL DEFAULT 0,
      data_criacao   TEXT NOT NULL DEFAULT (datetime('now')),
      data_abertura  TEXT,
      expira_em      TEXT,
      pdf_gerado_titulares INTEGER NOT NULL DEFAULT 0,
      pdf_gerado_final INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jogadores (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      racha_id      TEXT NOT NULL,
      nome          TEXT NOT NULL,
      nome_norm     TEXT NOT NULL,
      posicao       TEXT DEFAULT 'jogador',
      suplente      INTEGER NOT NULL DEFAULT 0,
      data_entrada  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (racha_id) REFERENCES rachas(id) ON DELETE CASCADE,
      UNIQUE (racha_id, nome_norm)
    );

    CREATE INDEX IF NOT EXISTS idx_jogadores_racha
      ON jogadores(racha_id, data_entrada);
  `);

  const cols = db.prepare(`PRAGMA table_info(rachas)`).all();
  if (!cols.some((c) => c.name === 'data_abertura')) {
    db.exec(`ALTER TABLE rachas ADD COLUMN data_abertura TEXT`);
  }
  if (!cols.some((c) => c.name === 'expira_em')) {
    db.exec(`ALTER TABLE rachas ADD COLUMN expira_em TEXT`);
  }
  if (!cols.some((c) => c.name === 'max_jogadores')) {
    db.exec(`ALTER TABLE rachas ADD COLUMN max_jogadores INTEGER NOT NULL DEFAULT 18`);
  }
  if (!cols.some((c) => c.name === 'suplentes_habilitados')) {
    db.exec(`ALTER TABLE rachas ADD COLUMN suplentes_habilitados INTEGER NOT NULL DEFAULT 0`);
  }
  if (!cols.some((c) => c.name === 'max_suplentes')) {
    db.exec(`ALTER TABLE rachas ADD COLUMN max_suplentes INTEGER NOT NULL DEFAULT 0`);
  }
  if (!cols.some((c) => c.name === 'pdf_gerado_titulares')) {
    db.exec(`ALTER TABLE rachas ADD COLUMN pdf_gerado_titulares INTEGER NOT NULL DEFAULT 0`);
  }
  if (!cols.some((c) => c.name === 'pdf_gerado_final')) {
    db.exec(`ALTER TABLE rachas ADD COLUMN pdf_gerado_final INTEGER NOT NULL DEFAULT 0`);
  }

  const jogadoresCols = db.prepare(`PRAGMA table_info(jogadores)`).all();
  if (!jogadoresCols.some((c) => c.name === 'posicao')) {
    db.exec(`ALTER TABLE jogadores ADD COLUMN posicao TEXT DEFAULT 'jogador'`);
  }
  if (!jogadoresCols.some((c) => c.name === 'suplente')) {
    db.exec(`ALTER TABLE jogadores ADD COLUMN suplente INTEGER NOT NULL DEFAULT 0`);
  }
}

init();

/**
 * Apaga todos os dados (apenas para uso em testes).
 */
function _resetForTests() {
  db.exec(`DELETE FROM jogadores; DELETE FROM rachas;`);
}

module.exports = db;
module.exports._resetForTests = _resetForTests;
