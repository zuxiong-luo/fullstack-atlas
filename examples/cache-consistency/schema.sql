CREATE TABLE items(tenant_id text NOT NULL,id text NOT NULL,body text NOT NULL,version integer NOT NULL CHECK(version>0),PRIMARY KEY(tenant_id,id));
CREATE TABLE invalidations(event_id bigserial PRIMARY KEY,tenant_id text NOT NULL,item_id text NOT NULL,version integer NOT NULL,applied boolean NOT NULL DEFAULT false);
INSERT INTO items VALUES('red','naive','v1',1),('red','fenced','v1',1),('red','failure','v1',1),('red','eviction','v1',1),('red','duplicate','v1',1),('blue','naive','blue-only',1);
