CREATE SEQUENCE fencing_tokens AS bigint NO CYCLE CACHE 1;
CREATE TABLE leases (
 resource text PRIMARY KEY, holder uuid, token bigint NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE unsafe_resources(id text PRIMARY KEY,value text NOT NULL);
CREATE TABLE fenced_resources(id text PRIMARY KEY,value text NOT NULL,last_token bigint NOT NULL DEFAULT 0);
INSERT INTO unsafe_resources VALUES ('report','initial');
INSERT INTO fenced_resources(id,value) VALUES ('report','initial');
