-- Creative Hub schema
-- Aplicar en: Supabase Dashboard → SQL Editor

-- ─── CREATIVES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creatives (
  id                TEXT PRIMARY KEY,          -- Google Drive file ID
  drive_id          TEXT,                       -- Shared Drive ID (nullable)
  folder_id         TEXT NOT NULL DEFAULT '',
  folder_name       TEXT NOT NULL DEFAULT 'Mi unidad',
  name              TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  file_type         TEXT NOT NULL CHECK (file_type IN ('video','image','other')),
  size_bytes        BIGINT,
  created_time      TIMESTAMPTZ,
  modified_time     TIMESTAMPTZ,
  web_view_link     TEXT,
  tag_content_type  TEXT NOT NULL DEFAULT 'sin_clasificar',
  tag_platforms     TEXT[] NOT NULL DEFAULT '{}',
  tag_status        TEXT NOT NULL DEFAULT 'sin_estado',
  tag_custom        TEXT[] NOT NULL DEFAULT '{}',
  indexed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tagged_at         TIMESTAMPTZ,
  uploaded_via_app  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_creatives_modified    ON creatives(modified_time DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_creatives_folder      ON creatives(folder_id);
CREATE INDEX IF NOT EXISTS idx_creatives_file_type   ON creatives(file_type);
CREATE INDEX IF NOT EXISTS idx_creatives_status      ON creatives(tag_status);
CREATE INDEX IF NOT EXISTS idx_creatives_content_type ON creatives(tag_content_type);
CREATE INDEX IF NOT EXISTS idx_creatives_name        ON creatives USING gin(to_tsvector('simple', name));

-- ─── SYNC STATE ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_full_scan  TIMESTAMPTZ,
  last_delta_scan TIMESTAMPTZ,
  total_indexed   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'idle',
  error_message   TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sync_state (status) VALUES ('idle')
ON CONFLICT DO NOTHING;

-- ─── COPY GENERATIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copy_generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id     TEXT NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  generated_by    TEXT NOT NULL,
  instructions    TEXT NOT NULL,
  platform_target TEXT NOT NULL,
  output          JSONB NOT NULL,
  model           TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copy_creative ON copy_generations(creative_id);

-- ─── TEAM MEMBERS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  invited_by  TEXT,
  joined_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE creatives        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state       ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members     ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — todas las ops del servidor van por service_role
-- Las policies abajo son capa de seguridad defensiva (acceso desde cliente = bloqueado)
CREATE POLICY "service_role_only" ON creatives        USING (false);
CREATE POLICY "service_role_only" ON sync_state       USING (false);
CREATE POLICY "service_role_only" ON copy_generations USING (false);
CREATE POLICY "service_role_only" ON team_members     USING (false);
