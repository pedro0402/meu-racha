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
      data_criacao   TEXT NOT NULL DEFAULT (datetime('now')),
      data_abertura  TEXT,
      pdf_gerado     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jogadores (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      racha_id      TEXT NOT NULL,
      nome          TEXT NOT NULL,
      nome_norm     TEXT NOT NULL,
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
  if (!cols.some((c) => c.name === 'max_jogadores')) {
    db.exec(`ALTER TABLE rachas ADD COLUMN max_jogadores INTEGER NOT NULL DEFAULT 18`);
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
