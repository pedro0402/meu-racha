const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config');

let pool = null;

function isPostgresEnabled() {
  return Boolean(config.database.url);
}

function resolveSslConfig() {
  const mode = (config.database.ssl || '').trim().toLowerCase();
  if (!mode) return undefined;
  if (mode === 'disable' || mode === 'false' || mode === '0') return false;
  return { rejectUnauthorized: false };
}

function getPool() {
  if (!isPostgresEnabled()) {
    throw new Error('DATABASE_URL não configurada para Postgres.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      ssl: resolveSslConfig(),
    });
  }

  return pool;
}

async function query(text, params = []) {
  const activePool = getPool();
  return activePool.query(text, params);
}

async function withTransaction(callback) {
  const activePool = getPool();
  const client = await activePool.connect();

  try {
    await client.query('BEGIN');
    const db = {
      query(text, params = []) {
        return client.query(text, params);
      },
    };

    const result = await callback(db);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function testConnection() {
  const res = await query('SELECT 1 AS ok');
  return res.rows[0]?.ok === 1;
}

async function runInitSqlIfNeeded() {
  const filePath = path.join(__dirname, 'sql', 'init_postgres.sql');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Schema SQL não encontrado: ${filePath}`);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  if (!sql.trim()) return;

  await query(sql);
}

module.exports = {
  isPostgresEnabled,
  getPool,
  query,
  withTransaction,
  testConnection,
  runInitSqlIfNeeded,
};
