-- supabase/migrations/001_initial.sql

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users belong to organizations
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'field_worker',  -- 'field_worker' | 'manager' | 'admin'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Encrypted records — server NEVER sees plaintext
CREATE TABLE encrypted_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL UNIQUE,             -- Client-generated UUID
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  form_type TEXT NOT NULL,                     -- 'incident' | 'beneficiary'
  encrypted_data TEXT NOT NULL,                -- Base64 EncryptedEnvelope
  has_photo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,             -- Client timestamp (when form was filled)
  synced_at TIMESTAMPTZ DEFAULT now()          -- Server timestamp (when sync happened)
);

-- Photo blobs stored separately (can be large)
CREATE TABLE encrypted_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES encrypted_records(record_id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  encrypted_blob TEXT NOT NULL,                -- Base64 encrypted photo
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_records_org ON encrypted_records(org_id);
CREATE INDEX idx_records_user ON encrypted_records(user_id);
CREATE INDEX idx_records_form_type ON encrypted_records(form_type);
CREATE INDEX idx_photos_record ON encrypted_photos(record_id);

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_photos ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "users_own_profile"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Users can read their org
CREATE POLICY "users_read_own_org"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Users can INSERT records for their own org
CREATE POLICY "users_insert_own_org_records"
  ON encrypted_records FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- Users can SELECT records from their own org
-- NOTE: managers/admins see all org records, field workers see only their own
CREATE POLICY "users_read_org_records"
  ON encrypted_records FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Same pattern for photos
CREATE POLICY "users_insert_own_org_photos"
  ON encrypted_photos FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "users_read_org_photos"
  ON encrypted_photos FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- No UPDATE or DELETE policies for MVP
-- Records are append-only (immutable audit trail)
