-- Schema inicial para Supabase/Postgres (MVP)
-- Mantem `data_abertura` e `expira_em` como TEXT no formato YYYY-MM-DDTHH:mm
-- para preservar o contrato atual do backend.

CREATE TABLE IF NOT EXISTS rachas (
  id             TEXT PRIMARY KEY,
  nome_dono      TEXT NOT NULL,
  email          TEXT NOT NULL,
  telefone       TEXT NOT NULL,
  max_jogadores  INTEGER NOT NULL DEFAULT 18 CHECK (max_jogadores BETWEEN 2 AND 50),
  suplentes_habilitados BOOLEAN NOT NULL DEFAULT FALSE,
  max_suplentes  INTEGER NOT NULL DEFAULT 0,
  data_criacao   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_abertura  TEXT,
  expira_em      TEXT,
  pdf_gerado_titulares BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_gerado_final BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE rachas
  ADD COLUMN IF NOT EXISTS suplentes_habilitados BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rachas
  ADD COLUMN IF NOT EXISTS max_suplentes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE rachas
  ADD COLUMN IF NOT EXISTS pdf_gerado_titulares BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rachas
  ADD COLUMN IF NOT EXISTS pdf_gerado_final BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'rachas'
      AND column_name = 'suplentes_habilitados'
      AND data_type <> 'boolean'
  ) THEN
    EXECUTE '
      ALTER TABLE rachas
      ALTER COLUMN suplentes_habilitados TYPE BOOLEAN
      USING CASE
        WHEN suplentes_habilitados::text IN (''1'', ''t'', ''true'', ''yes'', ''y'') THEN TRUE
        ELSE FALSE
      END';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'rachas'
      AND column_name = 'pdf_gerado_titulares'
      AND data_type <> 'boolean'
  ) THEN
    EXECUTE '
      ALTER TABLE rachas
      ALTER COLUMN pdf_gerado_titulares TYPE BOOLEAN
      USING CASE
        WHEN pdf_gerado_titulares::text IN (''1'', ''t'', ''true'', ''yes'', ''y'') THEN TRUE
        ELSE FALSE
      END';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'rachas'
      AND column_name = 'pdf_gerado_final'
      AND data_type <> 'boolean'
  ) THEN
    EXECUTE '
      ALTER TABLE rachas
      ALTER COLUMN pdf_gerado_final TYPE BOOLEAN
      USING CASE
        WHEN pdf_gerado_final::text IN (''1'', ''t'', ''true'', ''yes'', ''y'') THEN TRUE
        ELSE FALSE
      END';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS jogadores (
  id            BIGSERIAL PRIMARY KEY,
  racha_id      TEXT NOT NULL REFERENCES rachas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  nome_norm     TEXT NOT NULL,
  posicao       TEXT DEFAULT 'jogador',
  suplente      BOOLEAN NOT NULL DEFAULT FALSE,
  data_entrada  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (racha_id, nome_norm)
);

ALTER TABLE jogadores
  ADD COLUMN IF NOT EXISTS suplente BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'jogadores'
      AND column_name = 'suplente'
      AND data_type <> 'boolean'
  ) THEN
    EXECUTE '
      ALTER TABLE jogadores
      ALTER COLUMN suplente TYPE BOOLEAN
      USING CASE
        WHEN suplente::text IN (''1'', ''t'', ''true'', ''yes'', ''y'') THEN TRUE
        ELSE FALSE
      END';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jogadores_racha
  ON jogadores(racha_id, data_entrada);
