CREATE TABLE inventory (sku integer PRIMARY KEY, stock integer NOT NULL CHECK (stock >= 0));
CREATE TABLE orders (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, request_key text NOT NULL UNIQUE, sku integer NOT NULL REFERENCES inventory(sku));
CREATE TABLE doctors (id integer PRIMARY KEY, on_call boolean NOT NULL);
CREATE FUNCTION purchase(p_key text, p_sku integer) RETURNS text LANGUAGE plpgsql AS $$
DECLARE new_order bigint; old_sku integer;
BEGIN
  INSERT INTO orders(request_key, sku) VALUES(p_key, p_sku)
  ON CONFLICT(request_key) DO NOTHING RETURNING id INTO new_order;
  IF new_order IS NULL THEN
    SELECT sku INTO old_sku FROM orders WHERE request_key = p_key;
    IF old_sku IS DISTINCT FROM p_sku THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_CONFLICT'; END IF;
    RETURN 'duplicate';
  END IF;
  UPDATE inventory SET stock = stock - 1 WHERE sku = p_sku AND stock > 0;
  IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
  RETURN 'created';
END $$;
