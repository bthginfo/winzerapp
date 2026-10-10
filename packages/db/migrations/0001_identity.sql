-- Prepared foundation only; run through a migration workflow after DB/auth setup.
BEGIN;
CREATE TABLE tenant (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Berlin',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity (
  issuer text NOT NULL,
  subject text NOT NULL,
  PRIMARY KEY (issuer, subject)
);
CREATE TABLE membership (
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  issuer text NOT NULL,
  subject text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'oenologist', 'cellar', 'vineyard', 'office', 'external')),
  FOREIGN KEY (issuer, subject) REFERENCES identity(issuer, subject),
  PRIMARY KEY (tenant_id, issuer, subject)
);
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
ALTER TABLE membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership FORCE ROW LEVEL SECURITY;
ALTER TABLE identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON tenant USING (
  id = nullif(current_setting('app.tenant_id', true), '')::uuid
);
CREATE POLICY membership_context ON membership USING (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
  AND issuer = current_setting('app.issuer', true)
  AND subject = current_setting('app.subject', true)
);
CREATE POLICY identity_context ON identity USING (
  issuer = current_setting('app.issuer', true)
  AND subject = current_setting('app.subject', true)
);
COMMIT;
