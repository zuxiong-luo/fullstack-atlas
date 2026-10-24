CREATE TABLE documents(id text PRIMARY KEY,body text NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>0));
INSERT INTO documents VALUES('note','initial',1);
CREATE TABLE inventory(tenant_id text NOT NULL,product_id text NOT NULL,stock integer NOT NULL CHECK(stock>=0),PRIMARY KEY(tenant_id,product_id));
CREATE TABLE receipts(tenant_id text NOT NULL,request_id text NOT NULL,payload jsonb NOT NULL,result jsonb,PRIMARY KEY(tenant_id,request_id));
INSERT INTO inventory VALUES('red','p1',5),('blue','p1',5);
