CREATE TABLE accounts(id integer PRIMARY KEY, balance integer NOT NULL CHECK(balance>=0));
INSERT INTO accounts VALUES(1,100),(2,100);
CREATE FUNCTION move_funds(p_from integer,p_to integer,p_amount integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE locked_count integer;
BEGIN
  IF p_from=p_to OR p_amount<=0 THEN
    RAISE EXCEPTION 'INVALID_TRANSFER' USING ERRCODE='22023';
  END IF;
  PERFORM id FROM accounts WHERE id IN(p_from,p_to) ORDER BY id FOR UPDATE;
  GET DIAGNOSTICS locked_count = ROW_COUNT;
  IF locked_count<>2 THEN
    RAISE EXCEPTION 'ACCOUNT_MISSING' USING ERRCODE='22023';
  END IF;
  UPDATE accounts SET balance=balance-p_amount WHERE id=p_from;
  UPDATE accounts SET balance=balance+p_amount WHERE id=p_to;
END $$;
