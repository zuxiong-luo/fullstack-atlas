CREATE TABLE jobs(
 id uuid PRIMARY KEY,request_key text NOT NULL UNIQUE,payload jsonb NOT NULL,
 status text NOT NULL CHECK(status IN('queued','running','succeeded','failed')),
 worker_id uuid,result text,error_code text,
 CHECK(jsonb_typeof(payload)='object'),
 CHECK(
  (status='queued' AND worker_id IS NULL AND result IS NULL AND error_code IS NULL) OR
  (status='running' AND worker_id IS NOT NULL AND result IS NULL AND error_code IS NULL) OR
  (status='succeeded' AND worker_id IS NOT NULL AND result IS NOT NULL AND error_code IS NULL) OR
  (status='failed' AND worker_id IS NOT NULL AND result IS NULL AND error_code IS NOT NULL)
 )
);
