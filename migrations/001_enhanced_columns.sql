-- Migration: Enhanced columns for prospection system
-- Run this in Supabase SQL Editor (supabase.com/dashboard → project → SQL Editor)
-- Project: nndsqzkocvbgyudrvsgd
-- Date: 2026-05-14

-- ============================================
-- PROSPECTOS: Enhanced classification columns
-- ============================================
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS rubro text DEFAULT '';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS temperatura text DEFAULT 'frio';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS intenciones_json text DEFAULT '[]';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS requiere_humano boolean DEFAULT false;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS destacado boolean DEFAULT false;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS url_negocio text DEFAULT '';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS tags text DEFAULT '[]';

-- ============================================
-- PROSPECTOS_MENSAJES: Media & transcription
-- ============================================
ALTER TABLE prospectos_mensajes ADD COLUMN IF NOT EXISTS transcripcion text DEFAULT '';
ALTER TABLE prospectos_mensajes ADD COLUMN IF NOT EXISTS media_url text DEFAULT '';

-- ============================================
-- Verification query (run after migration)
-- ============================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'prospectos'
ORDER BY ordinal_position;
