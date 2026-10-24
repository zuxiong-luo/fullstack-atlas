CREATE ROLE atlas_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE memberships(
 tenant_id text NOT NULL,user_id text NOT NULL,
 role text NOT NULL CHECK(role IN('viewer','editor','admin')),
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE documents(
 id text PRIMARY KEY,tenant_id text NOT NULL,owner_id text NOT NULL,
 visibility text NOT NULL CHECK(visibility IN('private','shared')),
 body text NOT NULL CHECK(length(body)<=200),version integer NOT NULL DEFAULT 1 CHECK(version>=1),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES memberships(tenant_id,user_id)
);
INSERT INTO memberships VALUES
 ('red','alice','editor'),('red','bob','viewer'),('red','sue','admin'),('red','erin','editor'),('blue','carol','admin');
INSERT INTO documents(id,tenant_id,owner_id,visibility,body) VALUES
 ('a1','red','alice','private','Alice private'),('a2','red','alice','shared','Red shared'),
 ('e1','red','erin','private','Erin private'),('b1','blue','carol','private','Blue secret');
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY own_memberships ON memberships FOR SELECT TO atlas_app
 USING(user_id=current_setting('app.user_id',true));
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
CREATE POLICY visible_documents ON documents FOR SELECT TO atlas_app USING(
 tenant_id=current_setting('app.tenant_id',true)
 AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=documents.tenant_id AND
   (documents.visibility='shared' OR documents.owner_id=m.user_id OR m.role='admin'))
);
CREATE POLICY writable_documents ON documents FOR UPDATE TO atlas_app USING(
 tenant_id=current_setting('app.tenant_id',true)
 AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=documents.tenant_id AND
   m.role IN('editor','admin') AND (documents.owner_id=m.user_id OR m.role='admin'))
) WITH CHECK(
 tenant_id=current_setting('app.tenant_id',true)
 AND EXISTS(SELECT 1 FROM memberships m WHERE m.tenant_id=documents.tenant_id AND
   m.role IN('editor','admin') AND (documents.owner_id=m.user_id OR m.role='admin'))
);
GRANT USAGE ON SCHEMA public TO atlas_app;
GRANT SELECT ON memberships,documents TO atlas_app;
GRANT UPDATE(body,version) ON documents TO atlas_app;
-- No INSERT/DELETE, tenant/owner updates or membership administration is granted.
