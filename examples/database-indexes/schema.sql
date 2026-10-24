CREATE TABLE orders (
  id bigint PRIMARY KEY,
  tenant_id integer NOT NULL,
  status text NOT NULL,
  created_at timestamp NOT NULL,
  amount_cents integer NOT NULL,
  note text NOT NULL
) WITH (autovacuum_enabled=false);
INSERT INTO orders
SELECT i, i%100,
       CASE WHEN i%3=0 THEN 'paid' ELSE 'pending' END,
       timestamp '2026-01-01' + i*interval '1 second',
       i%10000, repeat('x',120)
FROM generate_series(1,200000) AS s(i);
ANALYZE orders;
