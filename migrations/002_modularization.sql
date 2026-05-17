-- Migration 002: add missing columns + indexes for modularization
-- 2026-05-17

-- 1. Missing columns referenced in code but absent from prospectos
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS temperatura text DEFAULT 'frio';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS destacado boolean DEFAULT false;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS requiere_humano boolean DEFAULT false;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS fecha_agendado timestamptz;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS intenciones_json jsonb;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS chatwoot_conversation_id text;

-- 2. Backfill temperatura from existing oportunidad_score
UPDATE prospectos
SET temperatura = CASE
  WHEN oportunidad_score >= 7 THEN 'caliente'
  WHEN oportunidad_score >= 4 THEN 'tibio'
  ELSE 'frio'
END
WHERE temperatura IS NULL OR temperatura = '';

-- 3. Indexes for the read patterns we actually use
CREATE INDEX IF NOT EXISTS idx_prospectos_telefono ON prospectos(telefono);
CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON prospectos(estado);
CREATE INDEX IF NOT EXISTS idx_prospectos_ultimo_contacto ON prospectos(ultimo_contacto DESC);
CREATE INDEX IF NOT EXISTS idx_prospectos_score ON prospectos(oportunidad_score DESC);
CREATE INDEX IF NOT EXISTS idx_prospectos_temperatura ON prospectos(temperatura);

-- 4. Messages indexes
CREATE INDEX IF NOT EXISTS idx_msgs_telefono_ts ON prospectos_mensajes(telefono, timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msgs_wamid_unique ON prospectos_mensajes(wamid) WHERE wamid IS NOT NULL;

-- 5. Verify
SELECT
  column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'prospectos'
ORDER BY ordinal_position;
