-- Análisis de video/imagen con Gemini
CREATE TABLE IF NOT EXISTS creative_analyses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id   TEXT NOT NULL UNIQUE REFERENCES creatives(id) ON DELETE CASCADE,
  analyzed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model         TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  status        TEXT NOT NULL DEFAULT 'done',  -- processing | done | error
  transcript    TEXT,
  analysis      JSONB NOT NULL DEFAULT '{}',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_analyses_creative ON creative_analyses(creative_id);

-- RLS: solo service_role
ALTER TABLE creative_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON creative_analyses USING (false);
