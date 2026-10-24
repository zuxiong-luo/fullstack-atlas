CREATE TABLE orders(id text PRIMARY KEY,amount integer NOT NULL CHECK(amount BETWEEN 1 AND 999999));
CREATE TABLE outbox(
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id text UNIQUE NOT NULL,
  amount integer NOT NULL CHECK(amount BETWEEN 1 AND 999999),
  published_at timestamptz
);
CREATE TABLE inbox(event_id text PRIMARY KEY,amount integer NOT NULL CHECK(amount BETWEEN 1 AND 999999));
CREATE TABLE wallet(id integer PRIMARY KEY,balance bigint NOT NULL);
INSERT INTO wallet VALUES(1,0);
CREATE FUNCTION place_order(p_id text,p_amount integer) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_id!~'^[a-z0-9-]{1,40}$' THEN RAISE EXCEPTION 'BAD_ID'; END IF;
  INSERT INTO orders VALUES(p_id,p_amount);
  INSERT INTO outbox(event_id,amount) VALUES(p_id||'-created',p_amount);
END $$;
CREATE FUNCTION consume_event(p_id text,p_amount integer) RETURNS text LANGUAGE plpgsql AS $$
DECLARE previous integer;
BEGIN
  IF p_id!~'^[a-z0-9-]{1,60}$' OR p_amount NOT BETWEEN 1 AND 999999 THEN RAISE EXCEPTION 'BAD_AMOUNT'; END IF;
  INSERT INTO inbox VALUES(p_id,p_amount) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    UPDATE wallet SET balance=balance+p_amount WHERE id=1;
    IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_MISSING'; END IF;
    RETURN 'applied';
  END IF;
  SELECT amount INTO previous FROM inbox WHERE event_id=p_id;
  IF previous<>p_amount THEN RAISE EXCEPTION 'EVENT_ID_CONFLICT'; END IF;
  RETURN 'duplicate';
END $$;
