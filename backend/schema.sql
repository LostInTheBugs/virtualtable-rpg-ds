-- ============================================================
--  VirtualTable RPG — Schéma PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Utilisateurs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     VARCHAR(50)  UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url   VARCHAR(500),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Campagnes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  owner_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_code  VARCHAR(10)  UNIQUE NOT NULL,
  system       VARCHAR(100) DEFAULT 'D&D 5e',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Membres d'une campagne ──────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_id  UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id)     ON DELETE CASCADE,
  role         VARCHAR(20) NOT NULL DEFAULT 'player', -- 'gm' | 'player'
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (campaign_id, user_id)
);

-- ── Personnages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS characters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES campaigns(id)  ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id)      ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  race         VARCHAR(100),
  class        VARCHAR(100),
  level        INTEGER DEFAULT 1,
  hp_current   INTEGER DEFAULT 10,
  hp_max       INTEGER DEFAULT 10,
  ac           INTEGER DEFAULT 10,
  speed        INTEGER DEFAULT 30,
  initiative   INTEGER DEFAULT 0,
  stats        JSONB   DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  skills       JSONB   DEFAULT '{}',
  inventory    JSONB   DEFAULT '[]',
  spells       JSONB   DEFAULT '[]',
  notes        TEXT,
  portrait_url VARCHAR(500),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Cartes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  background_url VARCHAR(500),
  grid_size      INTEGER DEFAULT 50,
  width          INTEGER DEFAULT 2000,
  height         INTEGER DEFAULT 1500,
  is_active      BOOLEAN DEFAULT FALSE,
  fog_of_war     JSONB   DEFAULT '[]',
  drawings       JSONB   DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tokens sur la carte ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id       UUID REFERENCES maps(id)       ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  label        VARCHAR(255),
  image_url    VARCHAR(500),
  color        VARCHAR(20) DEFAULT '#c9a227',
  x            FLOAT NOT NULL DEFAULT 0,
  y            FLOAT NOT NULL DEFAULT 0,
  size         INTEGER DEFAULT 1,
  hp_current   INTEGER,
  visible      BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages du chat ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id)     ON DELETE SET NULL,
  character_name VARCHAR(255),
  content        TEXT NOT NULL,
  type           VARCHAR(20) DEFAULT 'chat',  -- 'chat' | 'roll' | 'system'
  roll_data      JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Index ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaign_members_user     ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign       ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_characters_user           ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_maps_campaign             ON maps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tokens_map                ON tokens(map_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign_time    ON messages(campaign_id, created_at DESC);

ALTER TABLE characters ADD COLUMN IF NOT EXISTS vision_radius INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS vision_angle INTEGER DEFAULT 360;
ALTER TABLE maps ADD COLUMN IF NOT EXISTS walls   JSONB DEFAULT '[]';
ALTER TABLE maps ADD COLUMN IF NOT EXISTS lights  JSONB DEFAULT '[]';
ALTER TABLE maps ADD COLUMN IF NOT EXISTS objects JSONB DEFAULT '[]';
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS facing FLOAT DEFAULT 0;

-- ── Macros de jets de dés ────────────────────────────────────
CREATE TABLE IF NOT EXISTS macros (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(30)  NOT NULL,
  formula    VARCHAR(100) NOT NULL,
  color      VARCHAR(20)  DEFAULT '#c9a227',
  position   INTEGER      DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_macros_user ON macros(user_id);

-- ── Handouts (journal de campagne) ──────────────────────────
CREATE TABLE IF NOT EXISTS handouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  content     TEXT,
  image_url   VARCHAR(500),
  shared      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_handouts_campaign ON handouts(campaign_id);

-- ── Tables aléatoires ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS random_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS table_entries (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES random_tables(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  weight   INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_random_tables_campaign ON random_tables(campaign_id);
CREATE INDEX IF NOT EXISTS idx_table_entries_table    ON table_entries(table_id);

-- ── Système d'invitation ────────────────────────────────────
-- invite_code : code unique de chaque utilisateur (à partager pour inviter)
-- invited_by  : UUID de l'utilisateur qui a fourni le code lors de l'inscription
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code VARCHAR(8) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by  UUID REFERENCES users(id) ON DELETE SET NULL;

-- Générer un code pour les comptes existants qui n'en ont pas
UPDATE users
SET invite_code = upper(encode(gen_random_bytes(4), 'hex'))
WHERE invite_code IS NULL;

-- Rendre la colonne obligatoire avec une valeur par défaut auto-générée
ALTER TABLE users ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE users ALTER COLUMN invite_code SET DEFAULT upper(encode(gen_random_bytes(4), 'hex'));

-- ── Nouvelles colonnes personnages ──────────────────────────
ALTER TABLE characters ADD COLUMN IF NOT EXISTS background        VARCHAR(150);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS proficiency_bonus SMALLINT DEFAULT 2;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS system_data       JSONB    DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS subclass          VARCHAR(100);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS abilities         JSONB    DEFAULT '[]';

-- ── Réglages de campagne (vision, HP display…) ───────────────
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- ── Demandes de montée de niveau ────────────────────────────
CREATE TABLE IF NOT EXISTS level_up_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID REFERENCES campaigns(id)  ON DELETE CASCADE,
  character_id   UUID REFERENCES characters(id) ON DELETE CASCADE,
  requested_by   UUID REFERENCES users(id)      ON DELETE CASCADE,
  status         VARCHAR(20)  DEFAULT 'pending',
  hp_method      VARCHAR(10)  DEFAULT 'average',
  hp_roll        INTEGER,
  hp_gained      INTEGER,
  old_level      INTEGER,
  new_level      INTEGER,
  reject_reason  TEXT,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_level_up_campaign ON level_up_requests(campaign_id, status);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS saving_throws JSONB DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS body_weight NUMERIC(6,2) DEFAULT 0;

-- ── Colonnes sécurité auth ────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'player';

-- ── Colonnes dessin sur carte ─────────────────────────────────
ALTER TABLE maps ADD COLUMN IF NOT EXISTS drawings JSONB DEFAULT '[]';
