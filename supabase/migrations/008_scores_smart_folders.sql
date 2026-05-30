-- 008: Winning Ad Score (Feature 2) + Smart Folders (Feature 7)

-- ─── FEATURE 2: Winning Ad Score ─────────────────────────────────────────────
ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS score           SMALLINT CHECK (score >= 0 AND score <= 100),
  ADD COLUMN IF NOT EXISTS score_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS scored_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_creatives_score ON creatives(score DESC NULLS LAST);

-- ─── FEATURE 7: Smart Folder extra dimensions ────────────────────────────────
ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS funnel_stage    TEXT CHECK (funnel_stage IN ('TOFU','MOFU','BOFU')),
  ADD COLUMN IF NOT EXISTS emotional_angle TEXT CHECK (emotional_angle IN ('dolor','beneficio','curiosidad','social_proof','transformacion'));

CREATE INDEX IF NOT EXISTS idx_creatives_funnel    ON creatives(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_creatives_emotional ON creatives(emotional_angle);
