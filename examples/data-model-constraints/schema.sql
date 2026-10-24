CREATE TABLE tenants(id text PRIMARY KEY);
CREATE TABLE members(
 tenant_id text NOT NULL REFERENCES tenants(id),user_id text NOT NULL,
 display_name text NOT NULL CHECK(length(btrim(display_name))>0),
 PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE products(
 tenant_id text NOT NULL REFERENCES tenants(id),id text NOT NULL,
 sku text NOT NULL CHECK(length(btrim(sku))>0),
 stock integer NOT NULL CHECK(stock>=0),price_cents bigint NOT NULL CHECK(price_cents>=0),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,sku)
);
CREATE TABLE orders(
 tenant_id text NOT NULL,id text NOT NULL,owner_id text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','submitted','cancelled')),
 note text,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES members(tenant_id,user_id)
);
CREATE TABLE order_items(
 tenant_id text NOT NULL,order_id text NOT NULL,product_id text NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),unit_price_cents bigint NOT NULL CHECK(unit_price_cents>=0),
 PRIMARY KEY(tenant_id,order_id,product_id),
 CONSTRAINT item_order_fk FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id)
   DEFERRABLE INITIALLY IMMEDIATE,
 FOREIGN KEY(tenant_id,product_id) REFERENCES products(tenant_id,id)
);
INSERT INTO tenants VALUES('red'),('blue');
INSERT INTO members VALUES('red','alice','Alice'),('blue','bob','Bob');
INSERT INTO products VALUES('red','p1','BOOK',5,1000),('blue','p2','BOOK',8,1200);
