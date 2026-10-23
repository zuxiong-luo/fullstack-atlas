CREATE TABLE jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_key text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
  generation bigint NOT NULL DEFAULT 0,
  owner text,
  lease_until timestamptz,
  not_before timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts > 0),
  result_key text,
  CHECK ((status='running' AND owner IS NOT NULL AND lease_until IS NOT NULL) OR (status<>'running' AND lease_until IS NULL))
);
CREATE TABLE artifacts (job_id bigint PRIMARY KEY REFERENCES jobs, generation bigint NOT NULL, result_key text);
CREATE TABLE effects (job_id bigint PRIMARY KEY REFERENCES jobs, generation bigint NOT NULL, result_key text NOT NULL);

CREATE FUNCTION claim_job(p_owner text, p_lease_ms integer DEFAULT 1000)
RETURNS TABLE(job_id bigint, token bigint) LANGUAGE plpgsql AS $$
DECLARE chosen jobs%ROWTYPE;
BEGIN
  IF length(p_owner)=0 OR p_owner IS NULL OR p_lease_ms NOT BETWEEN 1 AND 60000 THEN RAISE EXCEPTION 'INVALID_CLAIM'; END IF;
  SELECT j.* INTO chosen FROM jobs j
  WHERE ((j.status='queued' AND j.not_before<=clock_timestamp()) OR
         (j.status='running' AND j.lease_until<=clock_timestamp()))
    AND j.attempts<j.max_attempts
  ORDER BY j.id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE jobs j SET status='running', owner=p_owner,
    generation=j.generation+1, attempts=j.attempts+1,
    lease_until=clock_timestamp()+p_lease_ms * interval '1 millisecond'
  WHERE j.id=chosen.id RETURNING j.* INTO chosen;
  INSERT INTO artifacts(job_id,generation) VALUES(chosen.id,chosen.generation)
  ON CONFLICT ON CONSTRAINT artifacts_pkey DO UPDATE SET generation=EXCLUDED.generation, result_key=NULL;
  RETURN QUERY SELECT chosen.id,chosen.generation;
END $$;

CREATE FUNCTION renew_job(p_id bigint,p_owner text,p_token bigint,p_ms integer)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  IF p_ms NOT BETWEEN 1 AND 60000 THEN RAISE EXCEPTION 'INVALID_LEASE'; END IF;
  UPDATE jobs SET lease_until=clock_timestamp()+p_ms * interval '1 millisecond'
  WHERE id=p_id AND owner=p_owner AND generation=p_token AND status='running'
    AND lease_until>clock_timestamp();
  RETURN FOUND;
END $$;

CREATE FUNCTION complete_job(p_id bigint,p_owner text,p_token bigint,p_key text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE current_job jobs%ROWTYPE;
BEGIN
  SELECT * INTO current_job FROM jobs WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR current_job.owner IS DISTINCT FROM p_owner OR current_job.generation<>p_token THEN RETURN 'stale'; END IF;
  IF current_job.status='completed' THEN
    IF current_job.result_key=p_key THEN RETURN 'duplicate'; END IF;
    RETURN 'conflict';
  END IF;
  IF current_job.status<>'running' OR current_job.lease_until<=clock_timestamp() THEN RETURN 'stale'; END IF;
  UPDATE artifacts SET result_key=p_key WHERE job_id=p_id AND generation=p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'FENCE_REJECTED'; END IF;
  INSERT INTO effects(job_id,generation,result_key) VALUES(p_id,p_token,p_key);
  UPDATE jobs SET status='completed',lease_until=NULL,result_key=p_key WHERE id=p_id;
  RETURN 'completed';
END $$;

CREATE FUNCTION fail_job(p_id bigint,p_owner text,p_token bigint,p_retry_ms integer DEFAULT 100)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  IF p_retry_ms NOT BETWEEN 0 AND 60000 THEN RAISE EXCEPTION 'INVALID_RETRY'; END IF;
  UPDATE jobs SET status=CASE WHEN attempts<max_attempts THEN 'queued' ELSE 'failed' END,
    owner=NULL,lease_until=NULL,not_before=clock_timestamp()+p_retry_ms * interval '1 millisecond'
  WHERE id=p_id AND owner=p_owner AND generation=p_token AND status='running'
    AND lease_until>clock_timestamp();
  RETURN FOUND;
END $$;
CREATE FUNCTION reap_exhausted() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE changed integer;
BEGIN
  UPDATE jobs SET status='failed',owner=NULL,lease_until=NULL
  WHERE status='running' AND lease_until<=clock_timestamp() AND attempts>=max_attempts;
  GET DIAGNOSTICS changed=ROW_COUNT;
  RETURN changed;
END $$;
