-- Projects System — Creative Hub
-- Aplicar en: Supabase Dashboard → SQL Editor

-- ─── PROJECTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL DEFAULT 'paid_campaign'
               CHECK (type IN ('paid_campaign','organic_campaign','partner','ugc_campaign','branding')),
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','active','paused','completed','archived')),
  client_name  TEXT,
  brief        TEXT,
  cover_color  TEXT NOT NULL DEFAULT '#6366f1',
  start_date   DATE,
  end_date     DATE,
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(status);

-- ─── PROJECT FOLDERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_folders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id    TEXT NOT NULL,
  folder_name  TEXT NOT NULL,
  purpose      TEXT NOT NULL DEFAULT 'general'
               CHECK (purpose IN ('general','creatives','designs','references','approved','deliverables')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_pfolders_project ON project_folders(project_id);

-- ─── PROJECT MEMBERS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  name         TEXT,
  role         TEXT NOT NULL
               CHECK (role IN ('admin','community_manager','content_strategist','traffic','designer','editor','viewer')),
  invited_by   TEXT NOT NULL,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_pmembers_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pmembers_email   ON project_members(email);

-- ─── CAMPAIGNS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  platform     TEXT NOT NULL
               CHECK (platform IN ('meta_ads','tiktok_ads','google_ads','instagram_organic','tiktok_organic','youtube_ads','whatsapp')),
  type         TEXT NOT NULL DEFAULT 'paid'
               CHECK (type IN ('paid','organic')),
  status       TEXT NOT NULL DEFAULT 'planning'
               CHECK (status IN ('planning','production','review','active','paused','ended')),
  objective    TEXT CHECK (objective IN ('awareness','consideration','conversion','traffic','engagement','leads',NULL)),
  budget       NUMERIC(12,2),
  spent        NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date   DATE,
  end_date     DATE,
  impressions  BIGINT NOT NULL DEFAULT 0,
  clicks       BIGINT NOT NULL DEFAULT 0,
  conversions  INTEGER NOT NULL DEFAULT 0,
  roas         NUMERIC(8,2),
  ctr          NUMERIC(6,4),
  cpm          NUMERIC(8,2),
  notes        TEXT,
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_project ON campaigns(project_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON campaigns(status);

-- ─── CAMPAIGN CREATIVES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_creatives (
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creative_id  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','active','paused','ended')),
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (campaign_id, creative_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_campaign  ON campaign_creatives(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cc_creative  ON campaign_creatives(creative_id);

-- ─── DELIVERABLES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliverables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  campaign_id    UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  assigned_to    TEXT,
  role           TEXT CHECK (role IN ('admin','community_manager','content_strategist','traffic','designer','editor',NULL)),
  type           TEXT NOT NULL DEFAULT 'creative_upload'
                 CHECK (type IN ('creative_upload','copy','strategy_doc','campaign_setup','design','video_edit','other')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','review','approved','rejected','done')),
  due_date       DATE,
  notes          TEXT,
  reviewer_notes TEXT,
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_project     ON deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_campaign    ON deliverables(campaign_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_assigned_to ON deliverables(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deliverables_status      ON deliverables(status);

-- ─── DELIVERABLE CREATIVES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliverable_creatives (
  deliverable_id UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  creative_id    TEXT NOT NULL,
  linked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (deliverable_id, creative_id)
);

-- ─── ADD project_id TO CREATIVES ─────────────────────────────────────────────
ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_creatives_project ON creatives(project_id);

-- ─── EXPAND team_members ROLES ───────────────────────────────────────────────
-- Drop existing constraint and add more granular roles
ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('admin','community_manager','content_strategist','traffic','designer','editor','viewer'));

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_folders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_creatives   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverable_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON projects              USING (false);
CREATE POLICY "service_role_only" ON project_folders       USING (false);
CREATE POLICY "service_role_only" ON project_members       USING (false);
CREATE POLICY "service_role_only" ON campaigns             USING (false);
CREATE POLICY "service_role_only" ON campaign_creatives    USING (false);
CREATE POLICY "service_role_only" ON deliverables          USING (false);
CREATE POLICY "service_role_only" ON deliverable_creatives USING (false);
