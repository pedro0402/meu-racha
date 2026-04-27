-- Schema inicial para Supabase/Postgres (MVP)
-- Mantem `data_abertura` e `expira_em` como TEXT no formato YYYY-MM-DDTHH:mm
-- para preservar o contrato atual do backend.

CREATE TABLE IF NOT EXISTS rachas (
  id             TEXT PRIMARY KEY,
  nome_dono      TEXT NOT NULL,
  email          TEXT NOT NULL,
  telefone       TEXT NOT NULL,
  max_jogadores  INTEGER NOT NULL DEFAULT 18 CHECK (max_jogadores BETWEEN 2 AND 50),
  data_criacao   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_abertura  TEXT,
  expira_em      TEXT,
  pdf_gerado     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS jogadores (
  id            BIGSERIAL PRIMARY KEY,
  racha_id      TEXT NOT NULL REFERENCES rachas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  nome_norm     TEXT NOT NULL,
  posicao       TEXT DEFAULT 'jogador',
  data_entrada  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (racha_id, nome_norm)
);

CREATE INDEX IF NOT EXISTS idx_jogadores_racha
  ON jogadores(racha_id, data_entrada);
