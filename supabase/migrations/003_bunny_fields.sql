-- Campos para Bunny Stream (video CDN con HLS)
ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS bunny_video_id    TEXT,
  ADD COLUMN IF NOT EXISTS bunny_status      TEXT;  -- processing | ready | error

CREATE INDEX IF NOT EXISTS idx_creatives_bunny ON creatives(bunny_video_id) WHERE bunny_video_id IS NOT NULL;
