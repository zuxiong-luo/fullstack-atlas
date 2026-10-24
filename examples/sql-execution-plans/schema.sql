CREATE TABLE customers(id integer PRIMARY KEY,region text NOT NULL);
CREATE TABLE orders(id integer PRIMARY KEY,customer_id integer NOT NULL REFERENCES customers(id),
 created_at timestamptz NOT NULL,amount integer NOT NULL,payload text NOT NULL);
INSERT INTO customers SELECT i,CASE WHEN i%2=0 THEN 'east' ELSE 'west' END FROM generate_series(1,1000)i;
INSERT INTO orders SELECT i,CASE WHEN i<=30000 THEN 1 ELSE 2+i%999 END,
 '2026-01-01T00:00:00Z'::timestamptz+(i%1000)*interval '1 second',i%100,
 repeat(md5(i::text),8) FROM generate_series(1,60000)i;
ANALYZE customers;ANALYZE orders;
