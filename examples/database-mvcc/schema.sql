CREATE TABLE account(id integer PRIMARY KEY, balance integer NOT NULL);
INSERT INTO account VALUES(1,10);
CREATE TABLE versions(id integer PRIMARY KEY, payload text NOT NULL)
WITH (autovacuum_enabled=false);
INSERT INTO versions SELECT i,repeat('old',100) FROM generate_series(1,5000) s(i);
