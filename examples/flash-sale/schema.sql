CREATE TABLE sales (
  id text PRIMARY KEY,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  total integer NOT NULL CHECK (total >= 0),
  available integer NOT NULL CHECK (available >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  sold integer NOT NULL DEFAULT 0 CHECK (sold >= 0),
  CHECK (available + reserved + sold = total)
);
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  sale_id text NOT NULL REFERENCES sales(id),
  user_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL CHECK (status IN ('PENDING_PAYMENT','PAID','CLOSED')),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '10 minutes'),
  UNIQUE (sale_id,user_id)
);
CREATE TABLE attempts (
  id uuid PRIMARY KEY,
  sale_id text NOT NULL REFERENCES sales(id),
  user_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('PROCESSING','ORDER_CREATED','SOLD_OUT')),
  order_id uuid REFERENCES orders(id)
);
CREATE TABLE releases (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
  sale_id text NOT NULL REFERENCES sales(id),
  applied boolean NOT NULL DEFAULT false
);
